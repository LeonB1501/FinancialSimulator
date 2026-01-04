module PathGeneratorTests

open Xunit
open FsUnit.Xunit
open EngineTypes
open PathGenerator
open System

type PathGeneratorSuite() =

    // ============================================================================
    // STATISTICAL HELPERS
    // ============================================================================

    let calculateMean (data: float[]) =
        if data.Length = 0 then 0.0 else data |> Array.average

    let calculateStdDev (data: float[]) =
        if data.Length <= 1 then 0.0
        else
            let mean = calculateMean data
            let sumSqDiff = data |> Array.sumBy (fun x -> Math.Pow(x - mean, 2.0))
            Math.Sqrt(sumSqDiff / float (data.Length - 1))

    let calculateCorrelation (data1: float[]) (data2: float[]) =
        let n = float data1.Length
        let mean1 = calculateMean data1
        let mean2 = calculateMean data2
        
        let numerator = 
            Array.zip data1 data2 
            |> Array.sumBy (fun (x, y) -> (x - mean1) * (y - mean2))
        
        let stdDev1 = calculateStdDev data1
        let stdDev2 = calculateStdDev data2
        
        if stdDev1 = 0.0 || stdDev2 = 0.0 then 0.0
        else numerator / ((n - 1.0) * stdDev1 * stdDev2)

    let calculateLogReturns (prices: float[]) =
        prices
        |> Array.pairwise
        |> Array.map (fun (pPrev, pCurr) -> Math.Log(pCurr / pPrev))

    // ============================================================================
    // FACTORIES
    // ============================================================================

    let zeroCosts = {
        Commission = { PerOrder = 0.0; PerUnit = 0.0 }
        Slippage = { DefaultSpread = 0.0; Tiers = [] }
    }

    let zeroTax = {
        PaymentMode = PeriodicSettlement 252
        ShortTermRate = 0.0
        LongTermRate = 0.0
        LongTermThreshold = 365
        WealthTaxRate = 0.0
    }

    let makeConfig (assets: AssetDefinition list) (correlations: Map<string*string, float>) =
        {
            Assets = assets
            Correlations = correlations
            TradingDays = 252
            Iterations = 1
            RiskFreeRate = 0.03
            Granularity = 1
            HistoricalData = Map.empty
            StartDate = DateTime(2024, 1, 1)
            Scenario = NoScenario
            ExecutionCosts = zeroCosts
            Tax = zeroTax
        }

    let makeGbmAsset (ticker: string) (mu: float) (sigma: float) =
        {
            Ticker = ticker
            InitialPrice = 100.0
            Model = GeometricBrownianMotion(mu, sigma)
        }

    let makeHestonAsset (ticker: string) (mu: float) (v0: float) (rho: float) =
        let params_ = {
            Kappa = 2.0
            Theta = 0.04
            Sigma = 0.1
            Rho = rho
            V0 = v0
            Mu = mu
            Epsilon = 1e-4
        }
        {
            Ticker = ticker
            InitialPrice = 100.0
            Model = Heston(params_)
        }

    // ============================================================================
    // Category 1: Infrastructure & Determinism
    // ============================================================================

    [<Fact>]
    member _.``GEN-1.1 Determinism (Seed Verification)``() =
        let asset = makeGbmAsset "spy" 0.05 0.20
        let config = makeConfig [asset] Map.empty
        
        let history1 = generatePaths config 12345
        let history2 = generatePaths config 12345
        
        let prices1 = history1.[0].DailyData |> Array.map (fun x -> x.Price)
        let prices2 = history2.[0].DailyData |> Array.map (fun x -> x.Price)
        
        prices1 |> should equal prices2

    [<Fact>]
    member _.``GEN-1.2 Seed Sensitivity``() =
        let asset = makeGbmAsset "spy" 0.05 0.20
        let config = makeConfig [asset] Map.empty
        
        let history1 = generatePaths config 1
        let history2 = generatePaths config 2
        
        let prices1 = history1.[0].DailyData |> Array.map (fun x -> x.Price)
        let prices2 = history2.[0].DailyData |> Array.map (fun x -> x.Price)
        
        prices1 |> should not' (equal prices2)

    [<Fact>]
    member _.``GEN-1.3 Configuration Mapping``() =
        let assets = [ makeGbmAsset "spy" 0.1 0.2; makeGbmAsset "qqq" 0.1 0.2 ]
        let config = { makeConfig assets Map.empty with TradingDays = 100 }
        
        let history = generatePaths config 42
        
        Assert.Equal(2, history.Length)
        Assert.Equal("spy", history.[0].Ticker)
        Assert.Equal("qqq", history.[1].Ticker)
        Assert.Equal(101, history.[0].DailyData.Length) 

    // ============================================================================
    // Category 2: Geometric Brownian Motion (GBM)
    // ============================================================================

    [<Fact>]
    member _.``GBM-2.1 Constant Volatility``() =
        let targetVol = 0.25
        let asset = makeGbmAsset "spy" 0.05 targetVol
        let config = makeConfig [asset] Map.empty
        
        let history = generatePaths config 42
        let vols = history.[0].DailyData |> Array.map (fun x -> x.Vol)
        
        Assert.All(vols, fun v -> Assert.Equal(targetVol, v))

    [<Fact>]
    member _.``GBM-2.3 Volatility Verification (Statistical)``() =
        let targetVol = 0.30
        let asset = makeGbmAsset "spy" 0.0 targetVol
        let config = makeConfig [asset] Map.empty
        
        let realizedVols = 
            [1..100] 
            |> List.map (fun seed -> 
                let hist = generatePaths config seed
                let prices = hist.[0].DailyData |> Array.map (fun x -> x.Price)
                let returns = calculateLogReturns prices
                let stdDev = calculateStdDev returns
                stdDev * Math.Sqrt(252.0)
            )
            
        let avgRealizedVol = calculateMean (realizedVols |> List.toArray)
        Assert.InRange(avgRealizedVol, 0.28, 0.32)

    // ============================================================================
    // Category 3: Heston Model
    // ============================================================================

    [<Fact>]
    member _.``HES-3.1 Stochastic Volatility Check``() =
        let asset = makeHestonAsset "spy" 0.05 0.04 0.0
        let config = makeConfig [asset] Map.empty
        
        let history = generatePaths config 42
        let vols = history.[0].DailyData |> Array.map (fun x -> x.Vol)
        
        let distinctVols = vols |> Array.distinct
        Assert.True(distinctVols.Length > 1, "Heston Volatility should vary over time")

    [<Fact>]
    member _.``HES-3.4 Internal Correlation (Negative)``() =
        let rho = -0.9
        let asset = makeHestonAsset "spy" 0.0 0.09 rho
        let model = match asset.Model with Heston p -> Heston { p with Sigma = 0.5 } | _ -> failwith "Error"
        let config = makeConfig [{ asset with Model = model }] Map.empty
        
        let correlations = 
            [1..50]
            |> List.map (fun seed ->
                let hist = generatePaths config seed
                let data = hist.[0].DailyData
                let prices = data |> Array.map (fun x -> x.Price)
                let vols = data |> Array.map (fun x -> x.Vol)
                let returns = calculateLogReturns prices
                let volChanges = vols |> Array.pairwise |> Array.map (fun (vPrev, vCurr) -> vCurr - vPrev)
                calculateCorrelation returns volChanges
            )
            
        let avgCorr = calculateMean (correlations |> List.toArray)
        Assert.True(avgCorr < -0.5, $"Expected strong negative correlation, got {avgCorr}")

    // ============================================================================
    // Category 4: Multi-Asset Correlation
    // ============================================================================

    [<Fact>]
    member _.``COR-4.2 Highly Correlated Assets``() =
        let a1 = makeGbmAsset "spy" 0.05 0.20
        let a2 = makeGbmAsset "qqq" 0.05 0.20
        let correlations = Map.ofList [ ("spy", "qqq"), 0.95 ]
        let config = makeConfig [a1; a2] correlations
        
        let correlationsList = 
            [1..50]
            |> List.map (fun seed ->
                let hist = generatePaths config seed
                let p1 = hist.[0].DailyData |> Array.map (fun x -> x.Price)
                let p2 = hist.[1].DailyData |> Array.map (fun x -> x.Price)
                let r1 = calculateLogReturns p1
                let r2 = calculateLogReturns p2
                calculateCorrelation r1 r2
            )
            
        let avgCorr = calculateMean (correlationsList |> List.toArray)
        Assert.InRange(avgCorr, 0.90, 1.0)

    [<Fact>]
    member _.``COR-4.3 Negative Correlation (Hedge)``() =
        let a1 = makeGbmAsset "spy" 0.0 0.20
        let a2 = makeGbmAsset "vix" 0.0 0.20
        let correlations = Map.ofList [ ("spy", "vix"), -0.8 ]
        let config = makeConfig [a1; a2] correlations
        
        let correlationsList = 
            [1..50]
            |> List.map (fun seed ->
                let hist = generatePaths config seed
                let p1 = hist.[0].DailyData |> Array.map (fun x -> x.Price)
                let p2 = hist.[1].DailyData |> Array.map (fun x -> x.Price)
                let r1 = calculateLogReturns p1
                let r2 = calculateLogReturns p2
                calculateCorrelation r1 r2
            )
            
        let avgCorr = calculateMean (correlationsList |> List.toArray)
        Assert.InRange(avgCorr, -0.85, -0.75)

    // ============================================================================
    // Category 5: Leverage Logic
    // ============================================================================

    [<Fact>]
    member _.``LEV-5.1 2x Leverage Mechanics``() =
        let baseAsset = makeGbmAsset "spy" 0.0 0.10
        let levAsset = { Ticker = "spy_2x"; InitialPrice = 100.0; Model = Leveraged("spy", 2.0) }
        let config = makeConfig [baseAsset; levAsset] Map.empty
        
        let history = generatePaths config 42
        let baseData = history |> List.find (fun p -> p.Ticker = "spy") |> fun p -> p.DailyData
        let levData = history |> List.find (fun p -> p.Ticker = "spy_2x") |> fun p -> p.DailyData
        
        let baseRet = (baseData.[1].Price - baseData.[0].Price) / baseData.[0].Price
        let levRet = (levData.[1].Price - levData.[0].Price) / levData.[0].Price
        
        Assert.Equal(levRet, baseRet * 2.0, 5)

    [<Fact>]
    member _.``LEV-5.2 Inverse Leverage (-1x)``() =
        let baseAsset = makeGbmAsset "spy" 0.0 0.10
        let invAsset = { Ticker = "sh"; InitialPrice = 100.0; Model = Leveraged("spy", -1.0) }
        let config = makeConfig [baseAsset; invAsset] Map.empty
        let history = generatePaths config 42
        
        let baseData = history |> List.find (fun p -> p.Ticker = "spy") |> fun p -> p.DailyData
        let invData = history |> List.find (fun p -> p.Ticker = "sh") |> fun p -> p.DailyData
        
        let baseRet = (baseData.[1].Price - baseData.[0].Price) / baseData.[0].Price
        let invRet = (invData.[1].Price - invData.[0].Price) / invData.[0].Price
        
        Assert.Equal(invRet, baseRet * -1.0, 5)

    [<Fact>]
    member _.``LEV-5.3 Volatility Scaling``() =
        let targetVol = 0.10
        let baseAsset = makeGbmAsset "spy" 0.0 targetVol
        let levAsset = { Ticker = "spy_3x"; InitialPrice = 100.0; Model = Leveraged("spy", 3.0) }
        let config = makeConfig [baseAsset; levAsset] Map.empty
        let history = generatePaths config 42
        
        let levData = history |> List.find (fun p -> p.Ticker = "spy_3x") |> fun p -> p.DailyData
        
        Assert.Equal(0.30, levData.[0].Vol, 5)
        Assert.Equal(0.30, levData.[50].Vol, 5)

    [<Fact>]
    member _.``LEV-5.4 Wipeout Logic (Zero Floor)``() =
        let histData = [| { Price = 100.0; Vol=0.1 }; { Price = 50.0; Vol=0.1 } |]
        let bootParams = { BlockSize = 2; HistoricalDataId = "spy" }
        let baseAsset = { Ticker = "spy"; InitialPrice = 100.0; Model = BlockedBootstrap(bootParams) }
        let levAsset = { Ticker = "spy_3x"; InitialPrice = 100.0; Model = Leveraged("spy", 3.0) }
        
        let config = { makeConfig [baseAsset; levAsset] Map.empty with 
                        HistoricalData = Map.ofList ["spy", histData]
                        TradingDays = 1 }
        
        let mutable foundCrash = false
        for seed in 1..20 do
            if not foundCrash then
                let history = generatePaths config seed
                let baseP = history |> List.find (fun p -> p.Ticker = "spy") |> fun p -> p.DailyData
                if baseP.[1].Price < 60.0 then
                    foundCrash <- true
                    let levP = history |> List.find (fun p -> p.Ticker = "spy_3x") |> fun p -> p.DailyData
                    Assert.Equal(0.0, levP.[1].Price, 5)
        
        Assert.True(foundCrash, "Did not generate a crash path to test wipeout")

    // ============================================================================
    // Category 6: Edge Cases
    // ============================================================================

    [<Fact>]
    member _.``EDGE-6.1 Zero Trading Days``() =
        let asset = makeGbmAsset "spy" 0.05 0.20
        let config = { makeConfig [asset] Map.empty with TradingDays = 0 }
        let history = generatePaths config 42
        Assert.Equal(1, history.[0].DailyData.Length)
        Assert.Equal(100.0, history.[0].DailyData.[0].Price)

    [<Fact>]
    member _.``EDGE-6.2 Missing Correlation Defaults to Zero``() =
        let a1 = makeGbmAsset "spy" 0.05 0.20
        let a2 = makeGbmAsset "agg" 0.05 0.05
        let config = makeConfig [a1; a2] Map.empty
        
        let correlationsList = 
            [1..50]
            |> List.map (fun seed ->
                let hist = generatePaths config seed
                let r1 = calculateLogReturns (hist.[0].DailyData |> Array.map (fun x -> x.Price))
                let r2 = calculateLogReturns (hist.[1].DailyData |> Array.map (fun x -> x.Price))
                calculateCorrelation r1 r2
            )
            
        let avgCorr = calculateMean (correlationsList |> List.toArray)
        Assert.InRange(avgCorr, -0.1, 0.1)

    // ============================================================================
    // Category 7: Regime Switching
    // ============================================================================

    [<Fact>]
    member _.``RS-7.1 Locked Regime (Never Switches)``() =
        let rA = { Name = "Locked"; Mu = 0.0; Sigma = 0.0; TransitionProbs = [1.0; 0.0] }
        let rB = { Name = "Chaos"; Mu = 0.0; Sigma = 0.5; TransitionProbs = [0.0; 1.0] }
        let model = RegimeSwitching(0, [rA; rB])
        let asset = { Ticker = "spy"; InitialPrice = 100.0; Model = model }
        let config = makeConfig [asset] Map.empty
        
        let history = generatePaths config 42
        let data = history.[0].DailyData
        
        Assert.Equal(100.0, data.[10].Price)
        Assert.Equal(0.0, data.[10].Vol)

    [<Fact>]
    member _.``RS-7.2 Forced Switch (Immediate Transition)``() =
        let rA = { Name = "Start"; Mu = 0.0; Sigma = 0.10; TransitionProbs = [0.0; 1.0] }
        let rB = { Name = "End"; Mu = 0.0; Sigma = 0.50; TransitionProbs = [0.0; 1.0] }
        let model = RegimeSwitching(0, [rA; rB])
        let asset = { Ticker = "spy"; InitialPrice = 100.0; Model = model }
        let config = makeConfig [asset] Map.empty
        
        let history = generatePaths config 42
        let data = history.[0].DailyData
        
        Assert.Equal(0.10, data.[0].Vol)
        Assert.Equal(0.10, data.[1].Vol) 
        Assert.Equal(0.50, data.[2].Vol)
        Assert.Equal(0.50, data.[10].Vol)

    // ============================================================================
    // Category 8: Blocked Bootstrapping
    // ============================================================================

    [<Fact>]
    member _.``BB-8.1 Volatility Passthrough``() =
        let uniqueVol = 0.42
        let histData = Array.init 100 (fun i -> { Price = 100.0 + float i; Vol = uniqueVol })
        let params_ = { BlockSize = 5; HistoricalDataId = "spy" }
        let asset = { Ticker = "spy"; InitialPrice = 100.0; Model = BlockedBootstrap(params_) }
        let config = { makeConfig [asset] Map.empty with HistoricalData = Map.ofList ["spy", histData] }
        
        let history = generatePaths config 42
        let data = history.[0].DailyData
        
        Assert.Equal(uniqueVol, data.[1].Vol)
        Assert.Equal(uniqueVol, data.[50].Vol)

    [<Fact>]
    member _.``BB-8.2 Sequence Preservation (Block Integrity)``() =
        let prices = [| 100.0; 110.0; 130.0; 160.0; 200.0 |]
        let histData = prices |> Array.map (fun p -> { Price = p; Vol = 0.1 })
        let params_ = { BlockSize = 2; HistoricalDataId = "spy" }
        let asset = { Ticker = "spy"; InitialPrice = 100.0; Model = BlockedBootstrap(params_) }
        let config = { makeConfig [asset] Map.empty with HistoricalData = Map.ofList ["spy", histData]; TradingDays = 20 }
        
        let history = generatePaths config 123
        let generatedPrices = history.[0].DailyData |> Array.map (fun x -> x.Price)
        let returns = calculateLogReturns generatedPrices
        
        let matchReturn (r: float) (target: float) = Math.Abs(r - target) < 0.001
        let r1 = Math.Log(110.0/100.0)
        let r3 = Math.Log(160.0/130.0)
        let r4 = Math.Log(200.0/160.0)
        
        for i in 0 .. returns.Length - 2 do
            let current = returns.[i]
            let next = returns.[i+1]
            if matchReturn current r1 then
                Assert.False(matchReturn next r3, "Found r1 followed immediately by r3 - Block integrity violated")
                Assert.False(matchReturn next r4, "Found r1 followed immediately by r4 - Block integrity violated")

    [<Fact>]
    member _.``BB-8.3 History Too Short Throws``() =
        let histData = Array.create 5 { Price = 100.0; Vol = 0.1 }
        let params_ = { BlockSize = 10; HistoricalDataId = "spy" }
        let asset = { Ticker = "spy"; InitialPrice = 100.0; Model = BlockedBootstrap(params_) }
        let config = { makeConfig [asset] Map.empty with HistoricalData = Map.ofList ["spy", histData] }
        
        Assert.Throws<System.Exception>(fun () -> generatePaths config 42 |> ignore) |> ignore

    [<Fact>]
    member _.``BB-8.4 Missing History Fallback``() =
        let params_ = { BlockSize = 5; HistoricalDataId = "spy" }
        let asset = { Ticker = "spy"; InitialPrice = 100.0; Model = BlockedBootstrap(params_) }
        let config = makeConfig [asset] Map.empty 
        
        let history = generatePaths config 42
        let data = history.[0].DailyData
        
        Assert.Equal(100.0, data.[10].Price)
        Assert.Equal(0.0, data.[10].Vol)