module RiskManager

open AST
open EngineTypes
open System

type Scenario = {
    Name: string
    PriceMultiplier: float
    VolMultiplier: float
}

type SellableUnit = 
    | SingleUnit of PositionInstance
    | CompositeUnit of {| GroupId: Guid; Positions: PositionInstance list; BuyDate: int |}

let private stressScenarios = [
    { Name = "Flat"; PriceMultiplier = 1.0; VolMultiplier = 1.0 }
    { Name = "Crash -20%"; PriceMultiplier = 0.8; VolMultiplier = 1.3 }
    { Name = "Crash -50%"; PriceMultiplier = 0.5; VolMultiplier = 2.0 }
    { Name = "Crash -99%"; PriceMultiplier = 0.01; VolMultiplier = 1.0 }
    { Name = "Moon +20%"; PriceMultiplier = 1.2; VolMultiplier = 0.9 }
    { Name = "Moon +100%"; PriceMultiplier = 2.0; VolMultiplier = 1.5 }
]

let private getSellableUnits (portfolio: Portfolio) : SellableUnit list =
    let grouped = 
        portfolio.Positions
        |> List.filter (fun p -> p.GroupId.IsSome)
        |> List.groupBy (fun p -> p.GroupId.Value)
        |> List.map (fun (gid, posList) -> 
            let groupDate = posList |> List.map (fun p -> p.BuyDate) |> List.min
            CompositeUnit {| GroupId = gid; Positions = posList; BuyDate = groupDate |}
        )
        |> List.sortBy (fun c -> match c with CompositeUnit u -> u.BuyDate | _ -> 0)

    let singles = 
        portfolio.Positions
        |> List.filter (fun p -> p.GroupId.IsNone)
        |> List.sortBy (fun p -> p.BuyDate)
        |> List.map SingleUnit

    singles @ grouped

let private removeUnit (portfolio: Portfolio) (unit: SellableUnit) : Portfolio =
    let idsToRemove = 
        match unit with
        | SingleUnit p -> Set.singleton p.Id
        | CompositeUnit c -> c.Positions |> List.map (fun p -> p.Id) |> Set.ofList
    
    { portfolio with 
        Positions = portfolio.Positions |> List.filter (fun p -> not (idsToRemove.Contains p.Id)) 
    }

let private getUnderlyingTicker (instrument: ResolvedInstrument) : string =
    match instrument with
    | ResolvedAsset assetRef -> 
        match assetRef with | SimpleAsset t -> t | LeveragedAsset(t, _) -> t
    | ResolvedOption opt -> 
        match opt.Underlying with | SimpleAsset t -> t | LeveragedAsset(t, _) -> t
    | Compound -> "COMPOUND"

let private calculatePositionValue 
    (position: PositionInstance) 
    (scenario: Scenario) 
    (marketData: Map<Identifier, MarketDataPoint>)
    (currentDay: int) 
    (riskFreeRate: float) // <--- ADDED
    : float =
    
    match position.Instrument with
    | ResolvedAsset assetRef ->
        let ticker = 
            match assetRef with | SimpleAsset t -> t | LeveragedAsset(t, _) -> t
        
        let basePrice = marketData.[ticker].Price
        
        let scenarioPrice = 
            match assetRef with
            | SimpleAsset _ -> basePrice * scenario.PriceMultiplier
            | LeveragedAsset(_, leverage) -> 
                let pctChange = (scenario.PriceMultiplier - 1.0) * leverage
                basePrice * (1.0 + pctChange) |> max 0.0

        scenarioPrice * position.Quantity

    | ResolvedOption opt ->
        let ticker = 
            match opt.Underlying with | SimpleAsset t -> t | LeveragedAsset(t, _) -> t
            
        let basePrice = marketData.[ticker].Price
        let scenarioUnderlyingPrice = basePrice * scenario.PriceMultiplier
        let dte = opt.ExpiryDay - currentDay
        
        // Note: calculateOptionPrice still uses the multiplier logic, but now takes riskFreeRate
        let optionPrice = PricingModels.calculateOptionPrice opt scenarioUnderlyingPrice scenario.VolMultiplier dte riskFreeRate
        optionPrice * position.Quantity * 100.0

    | Compound -> 0.0

let private calculateBuyingPower 
    (portfolio: Portfolio) 
    (marketData: Map<Identifier, MarketDataPoint>)
    (currentDay: int) 
    (riskFreeRate: float) // <--- ADDED
    : float =

    let currentScenario = { Name = "Current"; PriceMultiplier = 1.0; VolMultiplier = 1.0 }
    let liquidationValue = 
        portfolio.Positions 
        |> List.sumBy (fun p -> calculatePositionValue p currentScenario marketData currentDay riskFreeRate)
    
    let totalEquity = portfolio.Cash + liquidationValue

    let positionsByUnderlying = 
        portfolio.Positions 
        |> List.groupBy (fun p -> getUnderlyingTicker p.Instrument)

    let totalMarginRequirement = 
        positionsByUnderlying
        |> List.sumBy (fun (ticker, positions) ->
            if ticker = "COMPOUND" then 0.0
            else
                let currentVal = 
                    positions 
                    |> List.sumBy (fun p -> calculatePositionValue p currentScenario marketData currentDay riskFreeRate)

                let worstCasePnL = 
                    stressScenarios
                    |> List.map (fun scenario -> 
                        let scenarioVal = 
                            positions 
                            |> List.sumBy (fun p -> calculatePositionValue p scenario marketData currentDay riskFreeRate)
                        scenarioVal - currentVal
                    )
                    |> List.min

                if worstCasePnL < 0.0 then abs(worstCasePnL) else 0.0
        )

    totalEquity - totalMarginRequirement

let private simulateTrade 
    (portfolio: Portfolio) 
    (trade: PrimitiveTrade) 
    (marketData: Map<Identifier, MarketDataPoint>)
    (currentDay: int) 
    (riskFreeRate: float) // <--- ADDED
    : Portfolio =
    
    let currentScenario = { Name = "Current"; PriceMultiplier = 1.0; VolMultiplier = 1.0 }

    match trade with
    | PrimitiveRebalance _ -> portfolio
    | PrimitiveBuy p ->
        let dummyPos = { 
            Id = Guid.Empty; GroupId = None; DefinitionName = ""; ComponentName = None; ParentId = None;
            BuyPrice = 0.0; BuyDate = 0; Quantity = p.Quantity; Instrument = p.Instrument 
        }
        let cost = calculatePositionValue dummyPos currentScenario marketData currentDay riskFreeRate
        
        let newPos = {
            Id = Guid.NewGuid()
            GroupId = None 
            DefinitionName = Option.defaultValue "" p.DefinitionName
            ComponentName = p.ComponentName
            ParentId = None
            BuyPrice = (cost / p.Quantity)
            BuyDate = currentDay
            Quantity = p.Quantity
            Instrument = p.Instrument
        }

        { portfolio with 
            Cash = portfolio.Cash - cost
            Positions = newPos :: portfolio.Positions 
        }

    | PrimitiveSell p ->
        let dummyPos = { 
            Id = Guid.Empty; GroupId = None; DefinitionName = ""; ComponentName = None; ParentId = None;
            BuyPrice = 0.0; BuyDate = 0; Quantity = p.Quantity; Instrument = p.Instrument 
        }
        let proceeds = calculatePositionValue dummyPos currentScenario marketData currentDay riskFreeRate

        let rec reducePositions (remainingToSell: float) (positions: PositionInstance list) (acc: PositionInstance list) =
            if remainingToSell <= 0.0 then (acc @ positions)
            else
                match positions with
                | [] -> 
                    let shortPos = {
                        Id = Guid.NewGuid(); GroupId = None; DefinitionName = "SHORT"; ComponentName = None; ParentId = None;
                        BuyPrice = (proceeds / p.Quantity); BuyDate = currentDay; Quantity = -remainingToSell; Instrument = p.Instrument
                    }
                    shortPos :: acc
                | pos :: rest ->
                    if pos.Instrument = p.Instrument then
                        if pos.Quantity > remainingToSell then
                            let reducedP = { pos with Quantity = pos.Quantity - remainingToSell }
                            acc @ (reducedP :: rest)
                        else
                            reducePositions (remainingToSell - pos.Quantity) rest acc
                    else
                        reducePositions remainingToSell rest (pos :: acc)

        let sortedPositions = portfolio.Positions |> List.sortBy (fun p -> p.BuyDate)
        let newPositions = reducePositions p.Quantity sortedPositions []

        { portfolio with 
            Cash = portfolio.Cash + proceeds
            Positions = newPositions 
        }

let validateTrades 
    (trades: PrimitiveTrade list) 
    (portfolio: Portfolio) 
    (marketData: Map<Identifier, MarketDataPoint>)
    (currentDay: int) 
    (riskFreeRate: float) // <--- ADDED
    : Result<unit, string> =
    
    let hypotheticalPortfolio = 
        trades 
        |> List.fold (fun port trade -> simulateTrade port trade marketData currentDay riskFreeRate) portfolio

    let bp = calculateBuyingPower hypotheticalPortfolio marketData currentDay riskFreeRate

    if bp >= 0.0 then Ok ()
    else Error $"Insufficient Buying Power. Post-trade BP would be ${bp:F2}"

let calculateMaxQuantity 
    (tradesForOneUnit: PrimitiveTrade list) 
    (portfolio: Portfolio) 
    (marketData: Map<Identifier, MarketDataPoint>)
    (currentDay: int) 
    (riskFreeRate: float) // <--- ADDED
    : int =
    
    let currentBP = calculateBuyingPower portfolio marketData currentDay riskFreeRate

    let oneUnitPortfolio = 
        tradesForOneUnit 
        |> List.fold (fun port trade -> simulateTrade port trade marketData currentDay riskFreeRate) portfolio

    let oneUnitBP = calculateBuyingPower oneUnitPortfolio marketData currentDay riskFreeRate
    let costPerUnit = currentBP - oneUnitBP

    if costPerUnit <= 0.0 then 10000
    else int (Math.Floor(currentBP / costPerUnit))

let analyzeAndPlanRebalance 
    (target: ActionTarget) 
    (targetPercentage: float) 
    (portfolio: Portfolio) 
    (marketData: Map<Identifier, MarketDataPoint>)
    (currentDay: int) 
    (riskFreeRate: float) // <--- ADDED
    : RebalanceAnalysis =

    let currentScenario = { Name = "Current"; PriceMultiplier = 1.0; VolMultiplier = 1.0 }
    
    let currentPortfolioValue = 
        portfolio.Cash + (portfolio.Positions |> List.sumBy (fun p -> calculatePositionValue p currentScenario marketData currentDay riskFreeRate))
    
    let targetValue = currentPortfolioValue * (targetPercentage / 100.0)
    
    let (targetPrice, resolvedTargetInstrument) = 
        match target with
        | AssetTarget assetRef ->
            let ticker = match assetRef with | SimpleAsset t -> t | LeveragedAsset(t, _) -> t
            let price = marketData.[ticker].Price 
            (price, ResolvedAsset assetRef)
        | IdentifierTarget _ -> 
             failwith "Identifier targets not supported for rebalancing logic yet"

    let targetQty = if targetPrice = 0.0 then 0.0 else targetValue / targetPrice
    let cost = targetQty * targetPrice

    let targetPositionInstance = {
        Id = Guid.NewGuid()
        GroupId = None
        DefinitionName = "REBALANCE_TARGET"
        ComponentName = None
        ParentId = None
        BuyPrice = targetPrice
        BuyDate = currentDay
        Quantity = targetQty
        Instrument = resolvedTargetInstrument
    }

    let goalPortfolio = { 
        portfolio with 
            Positions = targetPositionInstance :: portfolio.Positions 
            Cash = portfolio.Cash - cost 
    }

    let startBP = calculateBuyingPower goalPortfolio marketData currentDay riskFreeRate

    if startBP >= 0.0 then
        { IsAchievable = true; PreparatoryTrades = []; DebugReason = "Sufficient Capital" }
    else
        let candidates = 
            getSellableUnits goalPortfolio
            |> List.filter (fun unit -> 
                match unit with
                | SingleUnit p -> p.Id <> targetPositionInstance.Id
                | CompositeUnit c -> c.Positions |> List.forall (fun p -> p.Id <> targetPositionInstance.Id)
            )

        let rankedCandidates = 
            candidates
            |> List.map (fun unit ->
                let testPortfolio = removeUnit goalPortfolio unit
                
                let cashBack = 
                    match unit with
                    | SingleUnit p -> calculatePositionValue p currentScenario marketData currentDay riskFreeRate
                    | CompositeUnit c -> c.Positions |> List.sumBy (fun p -> calculatePositionValue p currentScenario marketData currentDay riskFreeRate)
                
                let testPortfolioWithCash = { testPortfolio with Cash = testPortfolio.Cash + cashBack }
                
                let newBP = calculateBuyingPower testPortfolioWithCash marketData currentDay riskFreeRate
                let impact = newBP - startBP
                
                {| Unit = unit; Impact = impact |}
            )
            |> List.filter (fun x -> x.Impact > 0.0)
            |> List.sortByDescending (fun x -> x.Impact)

        let mutable currentBP = startBP
        let mutable unitsToSell = []
        let mutable solved = false

        for candidate in rankedCandidates do
            if not solved then
                unitsToSell <- candidate.Unit :: unitsToSell
                currentBP <- currentBP + candidate.Impact
                if currentBP >= 0.0 then
                    solved <- true

        if solved then
            let trades = 
                unitsToSell 
                |> List.collect (fun unit ->
                    match unit with
                    | SingleUnit p -> 
                        [ PrimitiveSell { Instrument = p.Instrument; Quantity = p.Quantity; ComponentName = p.ComponentName; DefinitionName = Some p.DefinitionName } ]
                    | CompositeUnit c -> 
                        c.Positions |> List.map (fun p -> 
                            PrimitiveSell { Instrument = p.Instrument; Quantity = p.Quantity; ComponentName = p.ComponentName; DefinitionName = Some p.DefinitionName }
                        )
                )
            
            { IsAchievable = true; PreparatoryTrades = trades; DebugReason = "Rebalance Plan Generated" }
        else
            { IsAchievable = false; PreparatoryTrades = []; DebugReason = "Cannot raise sufficient Buying Power" }