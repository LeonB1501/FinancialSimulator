module HistoricSimulator

open System
open EngineTypes
open Interpreter
open PortfolioQueries
open StrategyEngine.Engine.Reconciler

// ============================================================================
// HISTORIC BACKTEST CONFIGURATION
// ============================================================================

type HistoricConfiguration = {
    Assets: string list
    MarketData: Map<string, PricePath>
    StartIndex: int
    EndIndex: int
    Granularity: int
    RiskFreeRate: float
    BenchmarkTicker: string
    ExecutionCosts: ExecutionCosts
    Tax: TaxConfig // <--- Added
}

type HistoricResult = {
    EquityCurve: float array
    BenchmarkCurve: float array
    Transactions: Transaction list
    DrawdownCurve: float array
    FinalState: EvaluationState
    StartDate: DateTime
    TotalReturn: float
    BenchmarkReturn: float
    MaxDrawdown: float
    SharpeRatio: float
    Volatility: float
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

let private calculateDrawdownCurve (equityCurve: float array) : float array =
    let mutable peak = equityCurve.[0]
    equityCurve 
    |> Array.map (fun value ->
        peak <- max peak value
        if peak > 0.0 then (peak - value) / peak else 0.0
    )

let private calculateSharpe (returns: float array) (riskFreeRate: float) : float =
    if returns.Length < 2 then 0.0
    else
        let avgReturn = returns |> Array.average
        let stdDev = 
            let variance = returns |> Array.map (fun r -> (r - avgReturn) ** 2.0) |> Array.average
            sqrt variance
        if stdDev > 0.0 then
            let annualizedReturn = avgReturn * 252.0
            let annualizedVol = stdDev * sqrt(252.0)
            (annualizedReturn - riskFreeRate) / annualizedVol
        else 0.0

let private calculateDailyReturns (equityCurve: float array) : float array =
    if equityCurve.Length < 2 then [||]
    else
        [| for i in 1 .. equityCurve.Length - 1 do
            let prev = equityCurve.[i-1]
            let curr = equityCurve.[i]
            if prev > 0.0 then (curr - prev) / prev else 0.0
        |]

// ============================================================================
// BENCHMARK CALCULATION
// ============================================================================

let private calculateBenchmark 
    (benchmarkTicker: string) 
    (marketData: Map<string, PricePath>) 
    (initialCash: float)
    (startIdx: int)
    (endIdx: int)
    : float array =
    
    match marketData.TryFind benchmarkTicker with
    | None -> 
        Array.create (endIdx - startIdx + 1) initialCash
    | Some pricePath ->
        let prices = pricePath.DailyData
        if startIdx >= prices.Length then
            Array.create (endIdx - startIdx + 1) initialCash
        else
            let startPrice = prices.[startIdx].Price
            let shares = initialCash / startPrice
            [| for i in startIdx .. endIdx do
                if i < prices.Length then
                    prices.[i].Price * shares
                else
                    prices.[prices.Length - 1].Price * shares
            |]

// ============================================================================
// MAIN HISTORIC SIMULATION
// ============================================================================

let runHistoric 
    (config: HistoricConfiguration)
    (program: AST.Program)
    (initialCash: float)
    (startDate: DateTime)
    : Result<HistoricResult, string> =
    
    try
        let history : FullPriceHistory =
            config.Assets
            |> List.choose (fun ticker ->
                match config.MarketData.TryFind ticker with
                | Some path ->
                    let slicedData = 
                        if config.EndIndex < path.DailyData.Length then
                            path.DailyData.[config.StartIndex .. config.EndIndex]
                        else
                            path.DailyData.[config.StartIndex ..]
                    Some { Ticker = ticker; DailyData = slicedData }
                | None -> None
            )
        
        if history.IsEmpty then
            Error "No valid market data found for the specified assets"
        else
            let tradingDays = 
                history 
                |> List.map (fun p -> p.DailyData.Length) 
                |> List.min
            
            if tradingDays < 2 then
                Error "Insufficient trading days for simulation"
            else
                let initialState = emptyState initialCash config.RiskFreeRate
                let mutable currentState = initialState
                let equityCurve = Array.zeroCreate tradingDays
                
                for day in 0 .. tradingDays - 1 do
                    currentState <- { currentState with CurrentDay = day }
                    
                    let isAlive = currentState.Portfolio.Positions.Length > 0 || currentState.Portfolio.Cash > 0.0
                    
                    if isAlive && (day = 0 || day % config.Granularity = 0) then
                        // PASS TAX CONFIG
                        currentState <- interpretStep program currentState history config.ExecutionCosts config.Tax
                    
                    let dailyValue = calculatePortfolioValue currentState.Portfolio history day config.RiskFreeRate
                    equityCurve.[day] <- dailyValue
                
                let benchmarkCurve = 
                    calculateBenchmark 
                        config.BenchmarkTicker 
                        config.MarketData 
                        initialCash 
                        config.StartIndex 
                        config.EndIndex
                
                let alignedBenchmark = 
                    if benchmarkCurve.Length >= tradingDays then
                        benchmarkCurve.[0 .. tradingDays - 1]
                    else
                        Array.concat [benchmarkCurve; Array.create (tradingDays - benchmarkCurve.Length) (Array.last benchmarkCurve)]
                
                let drawdownCurve = calculateDrawdownCurve equityCurve
                let dailyReturns = calculateDailyReturns equityCurve
                let volatility = 
                    if dailyReturns.Length > 1 then
                        let avgReturn = dailyReturns |> Array.average
                        let variance = dailyReturns |> Array.map (fun r -> (r - avgReturn) ** 2.0) |> Array.average
                        sqrt variance * sqrt 252.0
                    else 0.0
                
                let totalReturn = 
                    if equityCurve.[0] > 0.0 then 
                        (equityCurve.[tradingDays - 1] - equityCurve.[0]) / equityCurve.[0]
                    else 0.0
                
                let benchmarkReturn = 
                    if alignedBenchmark.[0] > 0.0 && alignedBenchmark.Length > 0 then 
                        (Array.last alignedBenchmark - alignedBenchmark.[0]) / alignedBenchmark.[0]
                    else 0.0
                
                Ok {
                    EquityCurve = equityCurve
                    BenchmarkCurve = alignedBenchmark
                    Transactions = currentState.TransactionHistory
                    DrawdownCurve = drawdownCurve
                    FinalState = currentState
                    StartDate = startDate
                    TotalReturn = totalReturn
                    BenchmarkReturn = benchmarkReturn
                    MaxDrawdown = drawdownCurve |> Array.max
                    SharpeRatio = calculateSharpe dailyReturns config.RiskFreeRate
                    Volatility = volatility
                }
    with ex ->
        Error $"Historic simulation error: {ex.Message}"