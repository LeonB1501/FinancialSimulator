module StrategyEngine.Engine.Reconciler

open System
open AST
open EngineTypes
open PricingModels

// ============================================================================
// TYPES
// ============================================================================

type LiquidationCandidate =
    | FreeLong of Position: PositionInstance * Value: float
    | PairedUnit of Short: PositionInstance * Long: PositionInstance * NetValue: float

// ============================================================================
// HELPER: Position Slicing
// ============================================================================

let private takeQty (posList: PositionInstance list) (needed: float) : (PositionInstance * PositionInstance list) option =
    let rec find (pList: PositionInstance list) (acc: PositionInstance list) =
        match pList with
        | [] -> None
        | head :: tail ->
            let available = abs head.Quantity
            
            if available >= needed then
                let signedNeeded = if head.Quantity > 0.0 then needed else -needed
                let used : PositionInstance = { head with Quantity = signedNeeded }
                let remainingQty = available - needed
                
                let newTail = 
                    if remainingQty > 1e-9 then 
                        let rem : PositionInstance = { head with Quantity = (if head.Quantity > 0.0 then remainingQty else -remainingQty) }
                        rem :: tail 
                    else tail
                
                Some (used, List.rev acc @ newTail)
            else
                find tail (head :: acc)
    
    find posList []

// ============================================================================
// PRICING HELPERS
// ============================================================================

let private getPrice (p: PositionInstance) (history: FullPriceHistory) (day: int) (r: float) =
    match p.Instrument with
    | ResolvedAsset assetRef ->
        let ticker = match assetRef with | SimpleAsset t -> t | LeveragedAsset(t,_) -> t
        match List.tryFind (fun path -> path.Ticker = ticker) history with
        | Some path -> path.DailyData.[day].Price
        | None -> 0.0
    | ResolvedOption opt ->
        price opt history day r
    | Compound -> 0.0

let private getLiquidationValue (p: PositionInstance) (history: FullPriceHistory) (day: int) (r: float) =
    let unitPrice = getPrice p history day r
    let multiplier = match p.Instrument with | ResolvedOption _ -> 100.0 | _ -> 1.0
    unitPrice * p.Quantity * multiplier

// ============================================================================
// MATCHING LOGIC
// ============================================================================

let private getUnderlying (p: PositionInstance) : string =
    match p.Instrument with
    | ResolvedAsset (SimpleAsset t) -> t
    | ResolvedAsset (LeveragedAsset (t, _)) -> t
    | ResolvedOption opt -> 
        match opt.Underlying with | SimpleAsset t -> t | LeveragedAsset (t, _) -> t
    | Compound -> "COMPOUND"

let private getExpiry (p: PositionInstance) : int =
    match p.Instrument with
    | ResolvedOption opt -> opt.ExpiryDay
    | _ -> Int32.MaxValue

let private getStrike (p: PositionInstance) : float =
    match p.Instrument with
    | ResolvedOption opt -> opt.Strike
    | _ -> 0.0

let private matchPositions (positions: PositionInstance list) (history: FullPriceHistory) (day: int) (r: float) : LiquidationCandidate list =
    let byUnderlying = positions |> List.groupBy getUnderlying
    let candidates = ResizeArray<LiquidationCandidate>()

    for (_, groupPositions) in byUnderlying do
        let mutable longShares = groupPositions |> List.filter (fun p -> match p.Instrument with ResolvedAsset _ -> p.Quantity > 0.0 | _ -> false)
        let mutable shortCalls = groupPositions |> List.filter (fun p -> match p.Instrument with ResolvedOption o -> o.IsCall && p.Quantity < 0.0 | _ -> false)
        let mutable longCalls = groupPositions |> List.filter (fun p -> match p.Instrument with ResolvedOption o -> o.IsCall && p.Quantity > 0.0 | _ -> false)
        let mutable shortPuts = groupPositions |> List.filter (fun p -> match p.Instrument with ResolvedOption o -> not o.IsCall && p.Quantity < 0.0 | _ -> false)
        let mutable longPuts = groupPositions |> List.filter (fun p -> match p.Instrument with ResolvedOption o -> not o.IsCall && p.Quantity > 0.0 | _ -> false)

        for sc in shortCalls do
            let mutable remainingShortQty = abs sc.Quantity
            let scStrike = getStrike sc
            let scExpiry = getExpiry sc

            while remainingShortQty >= 1.0 do
                match takeQty longShares 100.0 with
                | Some (shares, restShares) ->
                    longShares <- restShares
                    let unitShort : PositionInstance = { sc with Quantity = -1.0 }
                    let valShort = getLiquidationValue unitShort history day r
                    let valLong = getLiquidationValue shares history day r
                    let net = valLong + valShort 
                    candidates.Add(PairedUnit(unitShort, shares, net))
                    remainingShortQty <- remainingShortQty - 1.0
                | None -> 
                    let matchIndex = 
                        longCalls |> List.tryFindIndex (fun lc -> 
                            let lcStrike = getStrike lc
                            let lcExpiry = getExpiry lc
                            lcStrike <= scStrike && lcExpiry >= scExpiry
                        )

                    match matchIndex with
                    | Some idx ->
                        let lc = longCalls.[idx]
                        match takeQty [lc] 1.0 with
                        | Some (usedLong, _) ->
                            let newLongCalls = 
                                longCalls |> List.mapi (fun i p -> 
                                    if i = idx then 
                                        if abs p.Quantity > 1.0 then Some { p with Quantity = p.Quantity - 1.0 } else None
                                    else Some p
                                ) |> List.choose id
                            longCalls <- newLongCalls

                            let unitShort : PositionInstance = { sc with Quantity = -1.0 }
                            let valShort = getLiquidationValue unitShort history day r
                            let valLong = getLiquidationValue usedLong history day r
                            let net = valLong + valShort

                            candidates.Add(PairedUnit(unitShort, usedLong, net))
                            remainingShortQty <- remainingShortQty - 1.0
                        | None -> ()
                    | None ->
                        remainingShortQty <- -1.0
                        ()

        for sp in shortPuts do
            let mutable remainingShortQty = abs sp.Quantity
            let spStrike = getStrike sp
            let spExpiry = getExpiry sp

            while remainingShortQty >= 1.0 do
                let matchIndex = 
                    longPuts |> List.tryFindIndex (fun lp -> 
                        let lpStrike = getStrike lp
                        let lpExpiry = getExpiry lp
                        lpStrike >= spStrike && lpExpiry >= spExpiry
                    )

                match matchIndex with
                | Some idx ->
                    let lp = longPuts.[idx]
                    match takeQty [lp] 1.0 with
                    | Some (usedLong, _) ->
                        let newLongPuts = 
                            longPuts |> List.mapi (fun i p -> 
                                if i = idx then 
                                    if abs p.Quantity > 1.0 then Some { p with Quantity = p.Quantity - 1.0 } else None
                                else Some p
                            ) |> List.choose id
                        longPuts <- newLongPuts

                        let unitShort : PositionInstance = { sp with Quantity = -1.0 }
                        let valShort = getLiquidationValue unitShort history day r
                        let valLong = getLiquidationValue usedLong history day r
                        let net = valLong + valShort

                        candidates.Add(PairedUnit(unitShort, usedLong, net))
                        remainingShortQty <- remainingShortQty - 1.0
                    | None -> ()
                | None ->
                    remainingShortQty <- -1.0
                    ()

        for p in longShares @ longCalls @ longPuts do
            if p.Quantity > 0.0 then
                let valLong = getLiquidationValue p history day r
                candidates.Add(FreeLong(p, valLong))

    candidates |> Seq.toList

// ============================================================================
// PUBLIC API
// ============================================================================

let private getTickerName (p: PositionInstance) =
    match p.Instrument with
    | ResolvedAsset assetRef ->
        match assetRef with | SimpleAsset t -> t | LeveragedAsset(t, f) -> $"{f}x_{t}"
    | ResolvedOption opt ->
        match opt.Underlying with | SimpleAsset t -> t | LeveragedAsset(t,_) -> t
    | Compound -> "COMPOUND"

let reconcileCash 
    (portfolio: Portfolio) 
    (requiredCash: float) 
    (history: FullPriceHistory) 
    (day: int) 
    (r: float) 
    (costs: ExecutionCosts)
    : Portfolio * Transaction list =
    
    let currentCash = portfolio.Cash
    let deficit = requiredCash - currentCash
    
    if deficit <= 0.0 then 
        ({ portfolio with Cash = portfolio.Cash - requiredCash }, [])
    else
        let candidates = matchPositions portfolio.Positions history day r
        
        let sortedCandidates = 
            candidates
            |> List.filter (fun c -> 
                match c with 
                | FreeLong(_, v) -> v > 0.0 
                | PairedUnit(_, _, net) -> net > 0.0)
            |> List.sortBy (fun c -> 
                match c with
                | FreeLong(p, v) -> (getExpiry p, -v)
                | PairedUnit(s, _, net) -> (getExpiry s, -net))

        let mutable currentDeficit = deficit
        let mutable totalProceeds = 0.0
        let mutable reductions = Map.empty<Guid, float>
        let mutable transactions = []

        for cand in sortedCandidates do
            if currentDeficit > 0.0 then
                match cand with
                | FreeLong(p, val_) ->
                    let unitVal = val_ / p.Quantity
                    let qtyToSell = Math.Min(p.Quantity, Math.Ceiling(currentDeficit / unitVal))
                    
                    // Calculate Costs for Liquidation
                    let commission = costs.Commission.PerOrder + (costs.Commission.PerUnit * qtyToSell)
                    // Simple slippage assumption for liquidation: Default Spread
                    let slippagePct = costs.Slippage.DefaultSpread
                    let slippageAmount = (unitVal * qtyToSell) * (slippagePct / 2.0)
                    
                    let grossProceeds = qtyToSell * unitVal
                    let netProceeds = grossProceeds - commission - slippageAmount

                    currentDeficit <- currentDeficit - netProceeds
                    totalProceeds <- totalProceeds + netProceeds
                    reductions <- reductions.Add(p.Id, reductions.TryFind(p.Id) |> Option.defaultValue 0.0 |> (+) qtyToSell)
                    
                    transactions <- {
                        Date = day
                        Ticker = getTickerName p
                        Type = "SELL"
                        Quantity = qtyToSell
                        Price = unitVal * (1.0 - slippagePct/2.0) // Execution Price
                        Value = netProceeds
                        Commission = commission
                        Slippage = slippageAmount
                        Tax = 0.0 // <--- FIX: Initialize Tax to 0.0 for liquidation
                        Tag = Some "LIQUIDATION"
                    } :: transactions

                | PairedUnit(shortPos, longPos, netVal) ->
                    let unitNet = netVal / abs shortPos.Quantity
                    let unitsToClose = Math.Min(abs shortPos.Quantity, Math.Ceiling(currentDeficit / unitNet))
                    
                    // Costs for complex liquidation (2 legs)
                    let commission = (costs.Commission.PerOrder * 2.0) + (costs.Commission.PerUnit * unitsToClose * 2.0)
                    let slippagePct = costs.Slippage.DefaultSpread
                    let slippageAmount = (unitNet * unitsToClose) * (slippagePct / 2.0)

                    let grossProceeds = unitsToClose * unitNet
                    let netProceeds = grossProceeds - commission - slippageAmount

                    currentDeficit <- currentDeficit - netProceeds
                    totalProceeds <- totalProceeds + netProceeds
                    reductions <- reductions.Add(shortPos.Id, reductions.TryFind(shortPos.Id) |> Option.defaultValue 0.0 |> (+) -unitsToClose)
                    reductions <- reductions.Add(longPos.Id, reductions.TryFind(longPos.Id) |> Option.defaultValue 0.0 |> (+) unitsToClose)
                    
                    transactions <- {
                        Date = day
                        Ticker = $"SPREAD_{getTickerName longPos}"
                        Type = "SELL"
                        Quantity = unitsToClose
                        Price = 0.0 
                        Value = netProceeds
                        Commission = commission
                        Slippage = slippageAmount
                        Tax = 0.0 // <--- FIX: Initialize Tax to 0.0 for liquidation
                        Tag = Some "LIQUIDATION"
                    } :: transactions

        if currentDeficit > 0.0 then
            ({ portfolio with Cash = 0.0; Positions = [] }, [])
        else
            let newPositions =
                portfolio.Positions
                |> List.map (fun p ->
                    match reductions.TryFind p.Id with
                    | Some reduceBy ->
                        let newQty = p.Quantity - reduceBy
                        { p with Quantity = newQty }
                    | None -> p
                )
                |> List.filter (fun p -> abs p.Quantity > 1e-9)

            let remainingCash = totalProceeds - deficit
            ({ portfolio with Cash = remainingCash; Positions = newPositions }, transactions)