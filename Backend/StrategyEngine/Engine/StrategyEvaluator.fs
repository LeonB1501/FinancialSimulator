module StrategyEvaluator

open System
open AST
open EngineTypes
open Interpreter
open PortfolioQueries
open PricingModels
open StrategyEngine.Engine.Reconciler

let private processSettlement (portfolio: Portfolio) (history: FullPriceHistory) (currentDay: int) (riskFreeRate: float) : Portfolio =
    let (expired, active) = 
        portfolio.Positions 
        |> List.partition (fun p -> 
            match p.Instrument with
            | ResolvedOption opt -> opt.ExpiryDay <= currentDay
            | _ -> false
        )

    if expired.IsEmpty then 
        portfolio
    else
        let settlementCash = 
            expired 
            |> List.sumBy (fun p -> 
                match p.Instrument with
                | ResolvedOption opt -> 
                    let unitValue = price opt history currentDay riskFreeRate
                    unitValue * p.Quantity * 100.0
                | _ -> 0.0
            )

        { portfolio with 
            Cash = portfolio.Cash + settlementCash
            Positions = active 
        }

let private processCashflows 
    (portfolio: Portfolio) 
    (scenario: FinancialScenario) 
    (currentDay: int) 
    (history: FullPriceHistory) 
    (riskFreeRate: float) 
    (costs: ExecutionCosts)
    (taxConfig: TaxConfig)
    : Portfolio * Transaction list =
    
    let mutable currentPortfolio = portfolio
    let mutable transactions = []

    let isTaxDay = 
        match taxConfig.PaymentMode with
        | ImmediateWithholding -> currentDay > 0 && currentDay % 252 = 0 
        | PeriodicSettlement freq -> currentDay > 0 && currentDay % freq = 0

    if isTaxDay then
        let capGainsTax = currentPortfolio.TaxLiabilityYTD
        let nav = calculatePortfolioValue currentPortfolio history currentDay riskFreeRate
        let wealthTax = nav * taxConfig.WealthTaxRate
        let totalTax = capGainsTax + wealthTax

        if totalTax > 0.0 then
            let (postTaxPortfolio, liqTxns) = reconcileCash currentPortfolio totalTax history currentDay riskFreeRate costs
            
            let taxTxn = {
                Date = currentDay
                Ticker = "TAX_PAYMENT"
                Type = "TAX"
                Quantity = 0.0
                Price = 0.0
                Value = -totalTax
                Commission = 0.0
                Slippage = 0.0
                Tax = totalTax
                Tag = Some "PERIODIC_SETTLEMENT"
            }
            
            currentPortfolio <- { postTaxPortfolio with TaxLiabilityYTD = 0.0 }
            transactions <- transactions @ liqTxns @ [taxTxn]

    if currentDay > 0 && currentDay % 30 = 0 then
        let year = float currentDay / 365.0
        let currentMonth = currentDay / 30
        
        match scenario with
        | NoScenario -> ()
        
        | Accumulation p ->
            let growthFactor = Math.Pow(1.0 + p.ContributionGrowthRate, Math.Floor(year))
            let amount = p.MonthlyContribution * growthFactor
            currentPortfolio <- { currentPortfolio with Cash = currentPortfolio.Cash + amount }
            
        | Retirement p ->
            let inflationFactor = Math.Pow(1.0 + p.InflationRate, Math.Floor(year))
            let grossExpenses = p.MonthlyWithdrawal * inflationFactor
            
            let pensionIncome = 
                if currentMonth >= p.PensionStartMonth then 
                    p.MonthlyPension * inflationFactor
                else 
                    0.0
            
            let netWithdrawal = grossExpenses - pensionIncome
            
            if netWithdrawal <= 0.0 then
                currentPortfolio <- { currentPortfolio with Cash = currentPortfolio.Cash + abs(netWithdrawal) }
            else
                if currentPortfolio.Cash >= netWithdrawal then
                    currentPortfolio <- { currentPortfolio with Cash = currentPortfolio.Cash - netWithdrawal }
                else
                    let (postWithdrawal, liqTxns) = reconcileCash currentPortfolio netWithdrawal history currentDay riskFreeRate costs
                    currentPortfolio <- postWithdrawal
                    transactions <- transactions @ liqTxns

    (currentPortfolio, transactions)

let evaluate 
    (runId: int)
    (program: Program)
    (config: SimulationConfiguration)
    (history: FullPriceHistory)
    (initialCash: float)
    : SimulationRunResult =

    let startCash = 
        match config.Scenario with
        | Retirement p -> p.InitialPortfolio
        | _ -> initialCash

    let initialState = Interpreter.emptyState startCash config.RiskFreeRate
    
    let mutable currentState = initialState
    let equityCurve = Array.zeroCreate (config.TradingDays + 1)

    for day in 0 .. config.TradingDays do
        
        currentState <- { currentState with CurrentDay = day }

        let settledPortfolio = processSettlement currentState.Portfolio history day config.RiskFreeRate
        currentState <- { currentState with Portfolio = settledPortfolio }

        let (cashflowPortfolio, liqTransactions) = 
            processCashflows currentState.Portfolio config.Scenario day history config.RiskFreeRate config.ExecutionCosts config.Tax
            
        currentState <- { 
            currentState with 
                Portfolio = cashflowPortfolio
                TransactionHistory = currentState.TransactionHistory @ liqTransactions 
        }

        let isAlive = currentState.Portfolio.Positions.Length > 0 || currentState.Portfolio.Cash > 0.0
        
        if isAlive && (day = 0 || day % config.Granularity = 0) then
            currentState <- Interpreter.interpretStep program currentState history config.ExecutionCosts config.Tax

        let dailyValue = PortfolioQueries.calculatePortfolioValue currentState.Portfolio history day config.RiskFreeRate
        equityCurve.[day] <- dailyValue

    {
        RunId = runId
        EquityCurve = equityCurve
        FinalState = currentState
        TransactionHistory = currentState.TransactionHistory
    }