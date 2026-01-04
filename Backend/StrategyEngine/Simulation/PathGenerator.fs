module PathGenerator

open System
open EngineTypes
open  StrategyEngine.Simulation.Stochastic

// ============================================================================
// 1. CONSTANTS & HELPERS
// ============================================================================

let private TRADING_DAYS_PER_YEAR = 252.0

/// Generates a 2D array of correlated random normals [Day][AssetIndex]
let private generateCorrelatedDrivers 
    (rng: NormalRandom) 
    (choleskyMatrix: float[][]) 
    (days: int) 
    (assetCount: int) 
    : float[][] =
    
    let drivers = Array.zeroCreate days
    
    for d in 0 .. days - 1 do
        let independent = Array.init assetCount (fun _ -> rng.Next())
        let correlated = LinearAlgebra.multiplyMatrixVector choleskyMatrix independent
        drivers.[d] <- correlated
        
    drivers

// ============================================================================
// 2. MODEL IMPLEMENTATIONS (Base)
// ============================================================================

let private generateGbmPath 
    (initialPrice: float) (mu: float) (sigma: float) (days: int) (dt: float) (drivers: float[]) 
    : MarketDataPoint array =
    let result = Array.zeroCreate (days + 1)
    result.[0] <- { Price = initialPrice; Vol = sigma }
    let mutable currentPrice = initialPrice
    let drift = (mu - 0.5 * sigma * sigma) * dt
    let diffusion = sigma * Math.Sqrt(dt)
    for i in 0 .. days - 1 do
        let z = drivers.[i]
        currentPrice <- currentPrice * Math.Exp(drift + diffusion * z)
        result.[i + 1] <- { Price = currentPrice; Vol = sigma }
    result

let private generateHestonPath 
    (initialPrice: float) (p: HestonParameters) (days: int) (dt: float) 
    (rng: NormalRandom) (priceDrivers: float[]) 
    : MarketDataPoint array =
    let result = Array.zeroCreate (days + 1)
    result.[0] <- { Price = initialPrice; Vol = Math.Sqrt(p.V0) }
    let mutable S = initialPrice
    let mutable v = p.V0
    let sqrtDt = Math.Sqrt(dt)
    for i in 0 .. days - 1 do
        let z_price = priceDrivers.[i]
        let z_vol_indep = rng.Next()
        let z_vol = p.Rho * z_price + Math.Sqrt(1.0 - p.Rho * p.Rho) * z_vol_indep
        let dv = p.Kappa * (p.Theta - v) * dt + p.Sigma * Math.Sqrt(Math.Max(0.0, v)) * sqrtDt * z_vol
        v <- Math.Max(p.Epsilon, v + dv)
        let drift = (p.Mu - 0.5 * v) * dt
        let diffusion = Math.Sqrt(v) * sqrtDt * z_price
        S <- S * Math.Exp(drift + diffusion)
        result.[i + 1] <- { Price = S; Vol = Math.Sqrt(v) }
    result

let private generateGarchPath
    (initialPrice: float) (p: GarchParameters) (days: int) (dt: float) (drivers: float[])
    : MarketDataPoint array =
    let result = Array.zeroCreate (days + 1)
    let longRunVar = p.Omega / (1.0 - p.Alpha - p.Beta)
    let initialVol = if p.InitialVol > 0.0 then p.InitialVol else Math.Sqrt(longRunVar)
    result.[0] <- { Price = initialPrice; Vol = initialVol }
    let mutable S = initialPrice
    let mutable currentVar = initialVol * initialVol
    let mutable prevReturn = 0.0 
    for i in 0 .. days - 1 do
        let z = drivers.[i]
        let epsilonSq = Math.Pow(prevReturn - p.Mu * dt, 2.0)
        currentVar <- p.Omega + p.Alpha * epsilonSq + p.Beta * currentVar
        let currentVol = Math.Sqrt(currentVar)
        let drift = (p.Mu - 0.5 * currentVar) * dt
        let diffusion = currentVol * Math.Sqrt(dt) * z
        let logReturn = drift + diffusion
        S <- S * Math.Exp(logReturn)
        prevReturn <- logReturn
        result.[i + 1] <- { Price = S; Vol = currentVol }
    result

let private generateRegimePath
    (initialPrice: float) (initialRegime: int) (regimes: RegimeParameters list) 
    (days: int) (dt: float) (rng: NormalRandom) (drivers: float[])
    : MarketDataPoint array =
    let result = Array.zeroCreate (days + 1)
    let regimesArr = List.toArray regimes
    let mutable currentRegimeIdx = initialRegime
    if regimesArr.Length = 0 then failwith "No regimes defined"
    let r0 = regimesArr.[currentRegimeIdx]
    result.[0] <- { Price = initialPrice; Vol = r0.Sigma }
    let mutable S = initialPrice
    let sqrtDt = Math.Sqrt(dt)
    for i in 0 .. days - 1 do
        let z = drivers.[i]
        let currentParams = regimesArr.[currentRegimeIdx]
        let mu = currentParams.Mu
        let sigma = currentParams.Sigma
        let drift = (mu - 0.5 * sigma * sigma) * dt
        let diffusion = sigma * sqrtDt * z
        S <- S * Math.Exp(drift + diffusion)
        result.[i + 1] <- { Price = S; Vol = sigma }
        let u = rng.Next() 
        let u_uniform = FinancialMath.normalCdf u
        let probs = currentParams.TransitionProbs
        let mutable cumSum = 0.0
        let mutable switched = false
        for r in 0 .. probs.Length - 1 do
            if not switched then
                cumSum <- cumSum + probs.[r]
                if u_uniform <= cumSum then
                    currentRegimeIdx <- r
                    switched <- true
    result

let private generateBootstrapPath
    (initialPrice: float) (p: BootstrapParameters) (history: MarketDataPoint array) 
    (days: int) (rng: NormalRandom) 
    : MarketDataPoint array =
    if history.Length < p.BlockSize then failwith "Historical data shorter than block size"
    let result = Array.zeroCreate (days + 1)
    let startVol = if history.Length > 0 then history.[history.Length-1].Vol else 0.2
    result.[0] <- { Price = initialPrice; Vol = startVol }
    let mutable S = initialPrice
    let mutable currentDay = 0
    let histReturns = 
        history 
        |> Array.pairwise 
        |> Array.map (fun (prev, curr) -> 
            let r = Math.Log(curr.Price / prev.Price)
            (r, curr.Vol)
        )
    let maxStartIdx = histReturns.Length - p.BlockSize
    while currentDay < days do
        let u = FinancialMath.normalCdf (rng.Next())
        let startIdx = int (u * float maxStartIdx)
        let safeStartIdx = Math.Clamp(startIdx, 0, maxStartIdx)
        for i in 0 .. p.BlockSize - 1 do
            if currentDay < days then
                let (ret, vol) = histReturns.[safeStartIdx + i]
                S <- S * Math.Exp(ret)
                result.[currentDay + 1] <- { Price = S; Vol = vol }
                currentDay <- currentDay + 1
    result

// ============================================================================
// 3. LEVERAGE WRAPPER (Post-Processing)
// ============================================================================

let private generateLeveragedPath 
    (basePath: MarketDataPoint array) 
    (leverage: float) 
    (initialPrice: float) 
    : MarketDataPoint array =
    
    let result = Array.zeroCreate basePath.Length
    result.[0] <- { Price = initialPrice; Vol = basePath.[0].Vol * abs leverage }
    
    for i in 1 .. basePath.Length - 1 do
        let prevBase = basePath.[i-1].Price
        let currBase = basePath.[i].Price
        
        // Calculate daily return of base asset
        let baseReturn = (currBase - prevBase) / prevBase
        
        // Apply leverage
        let levReturn = baseReturn * leverage
        
        // Apply to previous leveraged price
        let prevLevPrice = result.[i-1].Price
        let currLevPrice = prevLevPrice * (1.0 + levReturn)
        
        // Floor at 0 (cannot go negative)
        let finalPrice = Math.Max(0.0, currLevPrice)
        
        // Scale volatility
        let levVol = basePath.[i].Vol * abs leverage
        
        result.[i] <- { Price = finalPrice; Vol = levVol }
        
    result

// ============================================================================
// 4. MAIN GENERATOR
// ============================================================================

let generatePaths (config: SimulationConfiguration) (seed: int) : FullPriceHistory =
    let rng = NormalRandom(seed)
    let dt = 1.0 / TRADING_DAYS_PER_YEAR
    
    // 1. Separate Primary (Stochastic) vs Derived (Leveraged) Assets
    let primaryAssets = 
        config.Assets 
        |> List.filter (fun a -> match a.Model with Leveraged _ -> false | _ -> true)

    let derivedAssets = 
        config.Assets 
        |> List.filter (fun a -> match a.Model with Leveraged _ -> true | _ -> false)

    // 2. Prepare Correlation Matrix for PRIMARY assets only (Jagged Array)
    let assetCount = primaryAssets.Length
    let corrMatrix = Array.init assetCount (fun _ -> Array.zeroCreate assetCount)
    
    for i in 0 .. assetCount - 1 do corrMatrix.[i].[i] <- 1.0
    for i in 0 .. assetCount - 1 do
        for j in 0 .. assetCount - 1 do
            if i <> j then
                let t1 = primaryAssets.[i].Ticker
                let t2 = primaryAssets.[j].Ticker
                let rho = 
                    config.Correlations.TryFind(t1, t2)
                    |> Option.orElse (config.Correlations.TryFind(t2, t1))
                    |> Option.defaultValue 0.0
                corrMatrix.[i].[j] <- rho

    // 3. Cholesky & Drivers
    let drivers = 
        if assetCount > 0 then
            let L = LinearAlgebra.choleskyDecomposition corrMatrix
            generateCorrelatedDrivers rng L config.TradingDays assetCount
        else
            [||]
    
    // 4. Generate Primary Paths
    let primaryPaths = 
        primaryAssets
        |> List.mapi (fun idx asset ->
            let assetDrivers = Array.init config.TradingDays (fun d -> drivers.[d].[idx])
            
            let pathData = 
                match asset.Model with
                | GeometricBrownianMotion(mu, sigma) ->
                    generateGbmPath asset.InitialPrice mu sigma config.TradingDays dt assetDrivers
                | Heston(p) ->
                    generateHestonPath asset.InitialPrice p config.TradingDays dt rng assetDrivers
                | Garch(p) ->
                    generateGarchPath asset.InitialPrice p config.TradingDays dt assetDrivers
                | RegimeSwitching(initialIdx, regimes) ->
                    generateRegimePath asset.InitialPrice initialIdx regimes config.TradingDays dt rng assetDrivers
                | BlockedBootstrap(p) ->
                    match config.HistoricalData.TryFind asset.Ticker with
                    | Some history -> 
                        generateBootstrapPath asset.InitialPrice p history config.TradingDays rng
                    | None -> 
                        Array.create (config.TradingDays + 1) { Price = asset.InitialPrice; Vol = 0.0 }
                | Leveraged _ -> failwith "Should not happen due to filter"

            { Ticker = asset.Ticker; DailyData = pathData }
        )

    // 5. Generate Derived (Leveraged) Paths
    let pathMap = 
        primaryPaths 
        |> List.map (fun p -> p.Ticker, p.DailyData) 
        |> Map.ofList

    let derivedPaths = 
        derivedAssets
        |> List.map (fun asset ->
            match asset.Model with
            | Leveraged(baseTicker, leverage) ->
                match pathMap.TryFind baseTicker with
                | Some basePath ->
                    let levData = generateLeveragedPath basePath leverage asset.InitialPrice
                    { Ticker = asset.Ticker; DailyData = levData }
                | None ->
                    // Base path not found (configuration error). Return flatline 0.
                    let emptyData = Array.create (config.TradingDays + 1) { Price = 0.0; Vol = 0.0 }
                    { Ticker = asset.Ticker; DailyData = emptyData }
            | _ -> failwith "Should not happen due to filter"
        )

    // 6. Combine and Return
    primaryPaths @ derivedPaths