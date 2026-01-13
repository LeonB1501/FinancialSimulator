module PricingModels

open AST
open EngineTypes
open System
open FinancialMath

// ============================================================================
// INTERNAL BLACK-SCHOLES ENGINE
// ============================================================================

/// Calculates d1 and d2 for Black-Scholes
let private calculateD1D2 (S: float) (K: float) (t: float) (sigma: float) (r: float) =
    if t <= 0.0 || sigma <= 0.0 || S <= 0.0 then (0.0, 0.0)
    else
        let d1 = (System.Math.Log(S / K) + (r + 0.5 * sigma * sigma) * t) / (sigma * System.Math.Sqrt(t))
        let d2 = d1 - sigma * System.Math.Sqrt(t)
        (d1, d2)

/// Calculates Option Price using Black-Scholes
let calculateOptionPrice (option: ConcreteOption) (underlyingPrice: float) (volMultiplier: float) (dte: int) (riskFreeRate: float) : float =
    let S = underlyingPrice
    let K = option.Strike
    let t = float dte / 365.0
    let r = riskFreeRate
    
    // Note: volMultiplier logic remains for RiskManager scenarios
    let sigma = 0.20 * volMultiplier 

    if t <= 0.0 then
        if option.IsCall then max 0.0 (S - K)
        else max 0.0 (K - S)
    elif sigma <= 1e-9 then
        let discountFactor = System.Math.Exp(-r * t)
        if option.IsCall then max 0.0 (S - K * discountFactor)
        else max 0.0 (K * discountFactor - S)
    else
        let (d1, d2) = calculateD1D2 S K t sigma r
        
        if option.IsCall then
            S * normalCdf(d1) - K * System.Math.Exp(-r * t) * normalCdf(d2)
        else
            K * System.Math.Exp(-r * t) * normalCdf(-d2) - S * normalCdf(-d1)

// ============================================================================
// INTERNAL GREEK CALCULATIONS
// ============================================================================

let private calcGreeksInternal (isCall: bool) (S: float) (K: float) (t: float) (sigma: float) (r: float) =
    if t <= 0.0 then (0.0, 0.0, 0.0, 0.0, 0.0)
    else
        let (d1, d2) = calculateD1D2 S K t sigma r
        let nd1 = normalPdf(d1)
        let sqrtT = System.Math.Sqrt(t)
        let e_rt = System.Math.Exp(-r * t)

        let delta = if isCall then normalCdf(d1) else normalCdf(d1) - 1.0
        let gamma = nd1 / (S * sigma * sqrtT)
        let vega = (S * nd1 * sqrtT) * 0.01 

        let thetaCommon = -(S * nd1 * sigma) / (2.0 * sqrtT)
        let theta = 
            if isCall then 
                thetaCommon - r * K * e_rt * normalCdf(d2)
            else 
                thetaCommon + r * K * e_rt * normalCdf(-d2)
        let thetaDaily = theta / 365.0

        let rho = 
            if isCall then 
                K * t * e_rt * normalCdf(d2)
            else 
                -K * t * e_rt * normalCdf(-d2)
        let rhoScaled = rho * 0.01

        (delta, gamma, thetaDaily, vega, rhoScaled)

// ============================================================================
// SOLVERS
// ============================================================================

let findStrikeForDelta (spec: OptionSpec) (history: FullPriceHistory) (currentDay: int) (riskFreeRate: float) : float =
    let ticker = match spec.Underlying with | SimpleAsset t -> t | LeveragedAsset(t,_) -> t
    
    let (currentPrice, currentVol) = 
        match List.tryFind (fun p -> p.Ticker = ticker) history with
        | Some p -> 
            let data = p.DailyData.[currentDay]
            (data.Price, data.Vol)
        | None -> (100.0, 0.20)
    
    let t = float spec.DTE / 365.0
    let targetDelta = spec.GreekValue 
    let isCallOption = targetDelta > 0.0
    let r = riskFreeRate
    
    let deltaFunc (k: float) =
        let (d1, _) = calculateD1D2 currentPrice k t currentVol r
        let calcDelta = 
            if isCallOption then normalCdf(d1)
            else normalCdf(d1) - 1.0
        calcDelta - targetDelta

    let gammaFunc (k: float) =
        let (d1, _) = calculateD1D2 currentPrice k t currentVol r
        let num = normalPdf(d1)
        let den = k * currentVol * System.Math.Sqrt(t)
        -1.0 * (num / den)

    if abs targetDelta >= 1.0 then currentPrice
    else solveNewtonRaphson deltaFunc gammaFunc 0.0 currentPrice

// ============================================================================
// PUBLIC API WRAPPERS
// ============================================================================

let private getContext (option: ConcreteOption) (history: FullPriceHistory) (currentDay: int) =
    let ticker = match option.Underlying with | SimpleAsset t -> t | LeveragedAsset(t,_) -> t
    let path = List.find (fun p -> p.Ticker = ticker) history
    let data = path.DailyData.[currentDay]
    
    let S = data.Price
    let sigma = data.Vol
    let t = float (option.ExpiryDay - currentDay) / 365.0
    
    (S, option.Strike, t, sigma)

let price (option: ConcreteOption) (history: FullPriceHistory) (currentDay: int) (riskFreeRate: float) : float = 
    let ticker = match option.Underlying with | SimpleAsset t -> t | LeveragedAsset(t,_) -> t
    let path = List.find (fun p -> p.Ticker = ticker) history
    let data = path.DailyData.[currentDay]
    
    let S = data.Price
    let dte = option.ExpiryDay - currentDay
    let t = float dte / 365.0
    let r = riskFreeRate
    
    if t <= 0.0 then
        if option.IsCall then max 0.0 (S - option.Strike) else max 0.0 (option.Strike - S)
    else
        let (d1, d2) = calculateD1D2 S option.Strike t data.Vol r
        if option.IsCall then
            S * normalCdf(d1) - option.Strike * System.Math.Exp(-r * t) * normalCdf(d2)
        else
            option.Strike * System.Math.Exp(-r * t) * normalCdf(-d2) - S * normalCdf(-d1)

let delta (option: ConcreteOption) (history: FullPriceHistory) (currentDay: int) (riskFreeRate: float) : float = 
    let (S, K, t, sigma) = getContext option history currentDay
    let (d, _, _, _, _) = calcGreeksInternal option.IsCall S K t sigma riskFreeRate
    d

let gamma (option: ConcreteOption) (history: FullPriceHistory) (currentDay: int) (riskFreeRate: float) : float = 
    let (S, K, t, sigma) = getContext option history currentDay
    let (_, g, _, _, _) = calcGreeksInternal option.IsCall S K t sigma riskFreeRate
    g

let theta (option: ConcreteOption) (history: FullPriceHistory) (currentDay: int) (riskFreeRate: float) : float = 
    let (S, K, t, sigma) = getContext option history currentDay
    let (_, _, th, _, _) = calcGreeksInternal option.IsCall S K t sigma riskFreeRate
    th

let vega (option: ConcreteOption) (history: FullPriceHistory) (currentDay: int) (riskFreeRate: float) : float = 
    let (S, K, t, sigma) = getContext option history currentDay
    let (_, _, _, v, _) = calcGreeksInternal option.IsCall S K t sigma riskFreeRate
    v

let rho (option: ConcreteOption) (history: FullPriceHistory) (currentDay: int) (riskFreeRate: float) : float = 
    let (S, K, t, sigma) = getContext option history currentDay
    let (_, _, _, _, rVal) = calcGreeksInternal option.IsCall S K t sigma riskFreeRate
    rVal