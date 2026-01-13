module PortfolioQueries

open AST
open EngineTypes
open PricingModels

let private getMarketPrice 
    (instrument: ResolvedInstrument) 
    (history: FullPriceHistory) 
    (currentDay: int) 
    (riskFreeRate: float) 
    : float =
    
    match instrument with
    | ResolvedAsset assetRef ->
        let ticker = 
            match assetRef with 
            | SimpleAsset t -> t 
            | LeveragedAsset(t, f) -> $"{f}x_{t}"
        
        match List.tryFind (fun p -> p.Ticker = ticker) history with
        | Some path when currentDay < path.DailyData.Length ->
            path.DailyData.[currentDay].Price
        | _ -> 0.0

    | ResolvedOption opt ->
        price opt history currentDay riskFreeRate

    | Compound -> 0.0

let private positionMatches (p: PositionInstance) (identifier: string) : bool =
    if p.DefinitionName = identifier then true
    else
        match p.Instrument with
        | ResolvedAsset assetRef ->
            match assetRef with
            | SimpleAsset t -> t = identifier
            | LeveragedAsset(t, l) -> $"{t}_{l}x" = identifier
        | _ -> false


let calculatePortfolioValue (portfolio: Portfolio) (history: FullPriceHistory) (currentDay: int) (riskFreeRate: float) : float =
    let positionsValue = 
        portfolio.Positions
        |> List.sumBy (fun p -> 
            let price = getMarketPrice p.Instrument history currentDay riskFreeRate
            price * p.Quantity
        )
    
    portfolio.Cash + positionsValue

let calculatePositionQuantity (portfolio: Portfolio) (identifier: string) : float =
    portfolio.Positions
    |> List.filter (fun p -> positionMatches p identifier)
    |> List.sumBy (fun p -> p.Quantity)

let calculatePositionValue (portfolio: Portfolio) (identifier: string) (history: FullPriceHistory) (currentDay: int) (riskFreeRate: float) : float =
    portfolio.Positions
    |> List.filter (fun p -> positionMatches p identifier)
    |> List.sumBy (fun p -> 
        let price = getMarketPrice p.Instrument history currentDay riskFreeRate
        price * p.Quantity
    )