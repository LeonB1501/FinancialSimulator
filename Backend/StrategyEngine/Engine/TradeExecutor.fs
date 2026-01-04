module TradeExecutor

open System
open AST
open EngineTypes
open PricingModels

// ============================================================================
// 1. PRICING & VOLATILITY HELPERS
// ============================================================================

let private getMarketData 
    (instrument: ResolvedInstrument) 
    (history: FullPriceHistory) 
    (currentDay: int) 
    : (float * float) = 
    
    match instrument with
    | ResolvedAsset assetRef ->
        let ticker = 
            match assetRef with 
            | SimpleAsset t -> t 
            | LeveragedAsset(t, f) -> $"{f}x_{t}"
        
        let path = 
            history 
            |> List.tryFind (fun p -> p.Ticker = ticker)
        
        match path with
        | Some p when currentDay < p.DailyData.Length ->
            let pt = p.DailyData.[currentDay]
            (pt.Price, pt.Vol)
        | _ -> (0.0, 0.0)

    | ResolvedOption opt ->
        let ticker = 
            match opt.Underlying with 
            | SimpleAsset t -> t 
            | LeveragedAsset(t, f) -> $"{f}x_{t}"

        let path = 
            history 
            |> List.tryFind (fun p -> p.Ticker = ticker)
            
        match path with
        | Some p when currentDay < p.DailyData.Length ->
            let pt = p.DailyData.[currentDay]
            (0.0, pt.Vol) 
        | _ -> (0.0, 0.0)

    | Compound -> (0.0, 0.0)

let private getMultiplier (instrument: ResolvedInstrument) : float =
    match instrument with
    | ResolvedOption _ -> 100.0
    | _ -> 1.0

let private getTickerFromInstrument (instrument: ResolvedInstrument) : string =
    match instrument with
    | ResolvedAsset assetRef ->
        match assetRef with 
        | SimpleAsset t -> t 
        | LeveragedAsset(t, f) -> $"{f}x_{t}"
    | ResolvedOption opt ->
        match opt.Underlying with
        | SimpleAsset t -> $"OPT_{t}"
        | LeveragedAsset(t, f) -> $"OPT_{f}x_{t}"
    | Compound -> "COMPOUND"

// ============================================================================
// 2. COST & TAX CALCULATORS
// ============================================================================

let private calculateSlippage (costs: ExecutionCosts) (currentVol: float) : float =
    let tier = 
        costs.Slippage.Tiers 
        |> List.tryFind (fun t -> currentVol >= t.MinVol && currentVol < t.MaxVol)
    
    match tier with
    | Some t -> t.Spread
    | None -> costs.Slippage.DefaultSpread

let private calculateCommission (costs: ExecutionCosts) (quantity: float) : float =
    let absQty = abs quantity
    costs.Commission.PerOrder + (costs.Commission.PerUnit * absQty)

module TaxCalculator =
    
    let addLot (lots: TaxLot list) (ticker: string) (qty: float) (price: float) (day: int) : TaxLot list =
        let newLot = { Ticker = ticker; Quantity = qty; BuyPrice = price; BuyDate = day }
        lots @ [newLot]

    let consumeLots 
        (lots: TaxLot list) 
        (ticker: string) 
        (qtyToSell: float) 
        (sellPrice: float) 
        (currentDay: int) 
        (config: TaxConfig) 
        : (float * float * TaxLot list) = 
        
        let rec processLots (remainingQty: float) (currentLots: TaxLot list) (accLots: TaxLot list) (accBasis: float) (accTax: float) =
            if remainingQty <= 0.000001 then
                (accBasis, accTax, accLots @ currentLots)
            else
                match currentLots with
                | [] -> (accBasis, accTax, accLots)
                | lot :: rest ->
                    if lot.Ticker <> ticker then
                        processLots remainingQty rest (accLots @ [lot]) accBasis accTax
                    else
                        let qtyTaken = min remainingQty lot.Quantity
                        let lotBasis = qtyTaken * lot.BuyPrice
                        let lotProceeds = qtyTaken * sellPrice
                        let gain = lotProceeds - lotBasis
                        
                        let holdingPeriod = currentDay - lot.BuyDate
                        let rate = 
                            if holdingPeriod > config.LongTermThreshold then config.LongTermRate 
                            else config.ShortTermRate
                        
                        let tax = if gain > 0.0 then gain * rate else 0.0
                        
                        let newAccBasis = accBasis + lotBasis
                        let newAccTax = accTax + tax
                        
                        if lot.Quantity > qtyTaken then
                            let partialLot = { lot with Quantity = lot.Quantity - qtyTaken }
                            (newAccBasis, newAccTax, accLots @ (partialLot :: rest))
                        else
                            processLots (remainingQty - qtyTaken) rest accLots newAccBasis newAccTax

        processLots qtyToSell lots [] 0.0 0.0

// ============================================================================
// 3. EXECUTION LOGIC (Buy / Sell)
// ============================================================================

let private executeBuy 
    (portfolio: Portfolio) 
    (params_: BuyParams) 
    (history: FullPriceHistory) 
    (currentDay: int) 
    (batchGroupId: Guid option) 
    (riskFreeRate: float)
    (costs: ExecutionCosts)
    (taxConfig: TaxConfig)
    : Portfolio * Transaction option =

    let (rawPrice, vol) = getMarketData params_.Instrument history currentDay
    
    let basePrice = 
        match params_.Instrument with
        | ResolvedOption opt -> PricingModels.price opt history currentDay riskFreeRate
        | _ -> rawPrice

    let spreadPct = calculateSlippage costs vol
    let executionPrice = basePrice * (1.0 + (spreadPct / 2.0))
    
    let multiplier = getMultiplier params_.Instrument
    let commission = calculateCommission costs params_.Quantity

    let tradeValue = executionPrice * params_.Quantity * multiplier
    let totalCost = tradeValue + commission
    let slippageAmount = (executionPrice - basePrice) * params_.Quantity * multiplier

    // --- LOGIC: Covering Shorts vs Opening Longs ---
    
    let sortedPositions = portfolio.Positions |> List.sortBy (fun p -> p.BuyDate)
    
    let rec coverShorts (remainingToBuy: float) (positions: PositionInstance list) (accPos: PositionInstance list) (accTax: float) =
        if remainingToBuy <= 0.0 then
            (0.0, accPos @ positions, accTax)
        else
            match positions with
            | [] -> (remainingToBuy, accPos, accTax)
            | p :: rest ->
                if p.Instrument = params_.Instrument && p.Quantity < 0.0 then
                    let shortSize = abs p.Quantity
                    let qtyCovered = min shortSize remainingToBuy
                    
                    let gain = (p.BuyPrice - executionPrice) * qtyCovered * multiplier
                    let tax = if gain > 0.0 then gain * taxConfig.ShortTermRate else 0.0
                    
                    if shortSize > remainingToBuy then
                        let remainingShort = { p with Quantity = p.Quantity + remainingToBuy }
                        (0.0, accPos @ (remainingShort :: rest), accTax + tax)
                    else
                        coverShorts (remainingToBuy - shortSize) rest accPos (accTax + tax)
                else
                    coverShorts remainingToBuy rest (accPos @ [p]) accTax

    let (remainingQty, newPositionsAfterCover, coverTax) = coverShorts params_.Quantity sortedPositions [] 0.0

    let (finalPositions, finalTaxLots) = 
        if remainingQty > 0.0 then
            let newPosition = {
                Id = Guid.NewGuid()
                GroupId = batchGroupId
                DefinitionName = Option.defaultValue "" params_.DefinitionName
                ComponentName = params_.ComponentName
                ParentId = None
                BuyPrice = executionPrice
                BuyDate = currentDay
                Quantity = remainingQty
                Instrument = params_.Instrument
            }
            
            let ticker = getTickerFromInstrument params_.Instrument
            let newLots = TaxCalculator.addLot portfolio.TaxLots ticker remainingQty executionPrice currentDay
            
            (newPosition :: newPositionsAfterCover, newLots)
        else
            (newPositionsAfterCover, portfolio.TaxLots)

    let (cashDeduction, liabilityAcc) =
        match taxConfig.PaymentMode with
        | ImmediateWithholding -> (totalCost + coverTax, portfolio.TaxLiabilityYTD)
        | PeriodicSettlement _ -> (totalCost, portfolio.TaxLiabilityYTD + coverTax)

    let newPortfolio = 
        { portfolio with 
            Cash = portfolio.Cash - cashDeduction
            Positions = finalPositions
            TaxLots = finalTaxLots
            TaxLiabilityYTD = liabilityAcc
        }
    
    let transaction = 
        if params_.Quantity > 0.0 then
            Some {
                Date = currentDay
                Ticker = getTickerFromInstrument params_.Instrument
                Type = "BUY"
                Quantity = params_.Quantity
                Price = executionPrice
                Value = totalCost
                Commission = commission
                Slippage = slippageAmount
                Tax = coverTax // Record tax paid (if covering short)
                Tag = params_.DefinitionName 
            }
        else None
    
    (newPortfolio, transaction)

let private executeSell 
    (portfolio: Portfolio) 
    (params_: SellParams) 
    (history: FullPriceHistory) 
    (currentDay: int) 
    (batchGroupId: Guid option) 
    (riskFreeRate: float)
    (costs: ExecutionCosts)
    (taxConfig: TaxConfig)
    : Portfolio * Transaction option =

    let (rawPrice, vol) = getMarketData params_.Instrument history currentDay
    
    let basePrice = 
        match params_.Instrument with
        | ResolvedOption opt -> PricingModels.price opt history currentDay riskFreeRate
        | _ -> rawPrice

    let spreadPct = calculateSlippage costs vol
    let executionPrice = basePrice * (1.0 - (spreadPct / 2.0))
    
    let multiplier = getMultiplier params_.Instrument
    let commission = calculateCommission costs params_.Quantity

    let tradeValue = executionPrice * params_.Quantity * multiplier
    let netProceeds = tradeValue - commission
    let slippageAmount = (basePrice - executionPrice) * params_.Quantity * multiplier

    let sortedPositions = portfolio.Positions |> List.sortBy (fun p -> p.BuyDate)

    let rec consumeQuantity (remainingToSell: float) (positions: PositionInstance list) (accPos: PositionInstance list) =
        if remainingToSell <= 0.0 then
            (0.0, accPos @ positions)
        else
            match positions with
            | [] -> (remainingToSell, accPos)
            | p :: rest ->
                if p.Instrument = params_.Instrument && p.Quantity > 0.0 then
                    if p.Quantity > remainingToSell then
                        let reducedPos = { p with Quantity = p.Quantity - remainingToSell }
                        (0.0, accPos @ (reducedPos :: rest))
                    else
                        consumeQuantity (remainingToSell - p.Quantity) rest accPos
                else
                    consumeQuantity remainingToSell rest (accPos @ [p])

    let (qtyForShort, newPositions) = consumeQuantity params_.Quantity sortedPositions []

    let qtyClosed = params_.Quantity - qtyForShort
    let ticker = getTickerFromInstrument params_.Instrument
    
    let (costBasis, longTax, updatedLots) = 
        if qtyClosed > 0.0 then
            TaxCalculator.consumeLots portfolio.TaxLots ticker qtyClosed executionPrice currentDay taxConfig
        else
            (0.0, 0.0, portfolio.TaxLots)

    let finalPositions = 
        if qtyForShort > 0.0 then
            let shortPos = {
                Id = Guid.NewGuid()
                GroupId = batchGroupId
                DefinitionName = Option.defaultValue "SHORT" params_.DefinitionName
                ComponentName = params_.ComponentName
                ParentId = None
                BuyPrice = executionPrice
                BuyDate = currentDay
                Quantity = -qtyForShort
                Instrument = params_.Instrument
            }
            shortPos :: newPositions
        else
            newPositions

    let (finalCash, finalLiability) =
        match taxConfig.PaymentMode with
        | ImmediateWithholding -> (portfolio.Cash + netProceeds - longTax, portfolio.TaxLiabilityYTD)
        | PeriodicSettlement _ -> (portfolio.Cash + netProceeds, portfolio.TaxLiabilityYTD + longTax)

    let newPortfolio = 
        { portfolio with 
            Cash = finalCash
            Positions = finalPositions 
            TaxLots = updatedLots
            TaxLiabilityYTD = finalLiability
        }
    
    let transaction = 
        if params_.Quantity > 0.0 then
            Some {
                Date = currentDay
                Ticker = ticker
                Type = "SELL"
                Quantity = params_.Quantity
                Price = executionPrice
                Value = netProceeds
                Commission = commission
                Slippage = slippageAmount
                Tax = longTax // Record tax liability incurred
                Tag = params_.DefinitionName 
            }
        else None
    
    (newPortfolio, transaction)

// ============================================================================
// 4. REBALANCING LOGIC
// ============================================================================

let private executeRebalance 
    (portfolio: Portfolio) 
    (params_: RebalanceParams) 
    (history: FullPriceHistory) 
    (currentDay: int) 
    (riskFreeRate: float)
    (costs: ExecutionCosts)
    (taxConfig: TaxConfig)
    : Portfolio * Transaction list =

    let (rawPrice, _) = getMarketData params_.Instrument history currentDay
    let midPrice = rawPrice 

    let totalValue = 
        portfolio.Cash + 
        (portfolio.Positions |> List.sumBy (fun p -> 
            let (pPrice, _) = getMarketData p.Instrument history currentDay
            let finalP = match p.Instrument with | ResolvedOption opt -> PricingModels.price opt history currentDay riskFreeRate | _ -> pPrice
            let mult = getMultiplier p.Instrument
            finalP * p.Quantity * mult
        ))

    let targetValue = totalValue * (params_.TargetPercent / 100.0)

    let currentHoldingsValue = 
        portfolio.Positions
        |> List.filter (fun p -> p.Instrument = params_.Instrument)
        |> List.sumBy (fun p -> 
            let mult = getMultiplier p.Instrument
            midPrice * p.Quantity * mult
        )

    let diff = targetValue - currentHoldingsValue
    let multiplier = getMultiplier params_.Instrument

    if midPrice = 0.0 then 
        (portfolio, [])
    else
        let qty = abs(diff / (midPrice * multiplier))

        if diff > 0.0 then
            let buyParams : BuyParams = { 
                Instrument = params_.Instrument
                Quantity = qty
                ComponentName = None
                DefinitionName = Some "REBALANCE" 
            }
            let (newPortfolio, txn) = executeBuy portfolio buyParams history currentDay None riskFreeRate costs taxConfig
            (newPortfolio, Option.toList txn)
        else
            let sellParams : SellParams = { 
                Instrument = params_.Instrument
                Quantity = qty
                ComponentName = None
                DefinitionName = Some "REBALANCE" 
            }
            let (newPortfolio, txn) = executeSell portfolio sellParams history currentDay None riskFreeRate costs taxConfig
            (newPortfolio, Option.toList txn)

// ============================================================================
// 5. MAIN ENTRY POINT
// ============================================================================

let executeTrades 
    (trades: PrimitiveTrade list) 
    (portfolio: Portfolio) 
    (history: FullPriceHistory) 
    (currentDay: int) 
    (riskFreeRate: float)
    (costs: ExecutionCosts)
    (taxConfig: TaxConfig)
    : Portfolio * Transaction list =
    
    let batchGroupId = 
        let definitions = 
            trades 
            |> List.choose (function 
                | PrimitiveBuy p -> p.DefinitionName 
                | PrimitiveSell p -> p.DefinitionName
                | _ -> None)
            |> List.distinct
        
        match definitions with
        | [name] -> Some (Guid.NewGuid())
        | _ -> None

    trades 
    |> List.fold (fun (currentPortfolio, txnAcc) trade ->
        match trade with
        | PrimitiveBuy p -> 
            let (newPortfolio, txn) = executeBuy currentPortfolio p history currentDay batchGroupId riskFreeRate costs taxConfig
            (newPortfolio, txnAcc @ Option.toList txn)
        | PrimitiveSell p -> 
            let (newPortfolio, txn) = executeSell currentPortfolio p history currentDay batchGroupId riskFreeRate costs taxConfig
            (newPortfolio, txnAcc @ Option.toList txn)
        | PrimitiveRebalance p -> 
            let (newPortfolio, txns) = executeRebalance currentPortfolio p history currentDay riskFreeRate costs taxConfig
            (newPortfolio, txnAcc @ txns)
    ) (portfolio, [])