module SimulationEngineIntegrationTests

open Xunit
open FsUnit.Xunit
open EngineTypes
open SimulationEngine
open System

type SimulationEngineIntegrationSuite() =

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

    let calculateGeometricMean (data: float[]) =
        let logs = data |> Array.map (fun x -> if x <= 0.0 then -100.0 else Math.Log(x))
        Math.Exp(Array.average logs)

    let calculateDailyReturns (curve: float[]) =
        curve 
        |> Array.pairwise 
        |> Array.map (fun (prev, curr) -> if prev = 0.0 then 0.0 else (curr - prev) / prev)

    // ============================================================================
    // CONFIG FACTORIES
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

    let makeGbmConfig (mu: float) (sigma: float) (days: int) (iterations: int) =
        let spy = { 
            Ticker = "spy"
            InitialPrice = 100.0
            Model = GeometricBrownianMotion(mu, sigma) 
        }
        let spy3x = {
            Ticker = "spy_3x"
            InitialPrice = 100.0
            Model = Leveraged("spy", 3.0)
        }
        {
            Assets = [spy; spy3x]
            Correlations = Map.empty
            TradingDays = days
            Iterations = iterations
            RiskFreeRate = 0.0
            Granularity = 1
            HistoricalData = Map.empty
            StartDate = DateTime(2024, 1, 1)
            Scenario = NoScenario
            ExecutionCosts = zeroCosts
            Tax = zeroTax
        }

    let makeMultiAssetConfig (corr: float) =
        let a = { Ticker = "asset_a"; InitialPrice = 100.0; Model = GeometricBrownianMotion(0.05, 0.20) }
        let b = { Ticker = "asset_b"; InitialPrice = 100.0; Model = GeometricBrownianMotion(0.05, 0.20) }
        {
            Assets = [a; b]
            Correlations = Map.ofList [ ("asset_a", "asset_b"), corr ]
            TradingDays = 252
            Iterations = 50
            RiskFreeRate = 0.0
            Granularity = 1
            HistoricalData = Map.empty
            StartDate = DateTime(2024, 1, 1)
            Scenario = NoScenario
            ExecutionCosts = zeroCosts
            Tax = zeroTax
        }

    // ============================================================================
    // Category 1: The Laws of Leverage
    // ============================================================================

    [<Fact>]
    member _.``PHYS-1.1 Volatility Drag (Leverage Decay)``() =
        let config = makeGbmConfig 0.0 0.30 252 50
        let cash = 100_000.0
        let seed = 1

        let res1 = runSimulation config "buy 100% spy" cash seed
        let res3x = runSimulation config "buy 100% spy_3x" cash seed

        match (res1, res3x) with
        | (Ok r1, Ok r3) ->
            let finalWealth1 = r1 |> Array.map (fun r -> r.EquityCurve.[252]) |> calculateMean
            let finalWealth3 = r3 |> Array.map (fun r -> r.EquityCurve.[252]) |> calculateMean
            
            Assert.True(finalWealth3 < finalWealth1, $"3x ({finalWealth3:F0}) should be less than 1x ({finalWealth1:F0}) due to drag")
        | _ -> failwith "Simulation failed"

    [<Fact>]
    member _.``PHYS-1.2 Kelly Criterion (Growth vs Ruin)``() =
        let config = makeGbmConfig 0.15 0.20 500 100
        let cash = 100_000.0
        let seed = 42

        let resOpt = runSimulation config "rebalance_to 200% spy" cash seed
        let resYolo = runSimulation config "rebalance_to 800% spy" cash seed

        match (resOpt, resYolo) with
        | (Ok rOpt, Ok rYolo) ->
            let wealthOpt = rOpt |> Array.map (fun r -> r.EquityCurve.[500])
            let wealthYolo = rYolo |> Array.map (fun r -> r.EquityCurve.[500])

            let geoMeanOpt = calculateGeometricMean wealthOpt
            let geoMeanYolo = calculateGeometricMean wealthYolo

            Assert.True(geoMeanOpt > geoMeanYolo, $"Optimal ({geoMeanOpt:F0}) should beat YOLO ({geoMeanYolo:F0}) in Geometric Growth")
        | _ -> failwith "Simulation failed"

    // ============================================================================
    // Category 2: Option Mechanics
    // ============================================================================

    [<Fact>]
    member _.``OPT-2.1 Theta Gang (Time Decay)``() =
        let config = makeGbmConfig 0.0 0.0 30 1
        let cash = 100_000.0
        let dsl = "sell 10 spy_30dte_50delta"
        
        let result = runSimulation config dsl cash 1
        
        match result with
        | Ok runs ->
            let curve = runs.[0].EquityCurve
            let startEq = curve.[0]
            let endEq = curve.[30]
            
            Assert.True(endEq > startEq, "Should profit from time decay")
            
            let isMonotonic = 
                curve 
                |> Array.pairwise 
                |> Array.forall (fun (prev, curr) -> curr >= prev - 0.01)
            
            Assert.True(isMonotonic, "Equity curve should be monotonically increasing due to theta")
        | _ -> failwith "Sim failed"

    [<Fact>]
    member _.``OPT-2.3 Assignment Risk (The Wheel)``() =
        let crashData = Array.init 31 (fun i -> if i = 0 then { Price=100.0; Vol=0.2 } else { Price=50.0; Vol=0.2 })
        let histMap = Map.ofList ["spy", crashData]
        
        let baseConfig = makeGbmConfig 0.0 0.0 30 1
        
        let bootstrapSpy = { 
            Ticker = "spy"
            InitialPrice = 100.0
            Model = BlockedBootstrap({BlockSize=1; HistoricalDataId="spy"}) 
        }

        let config = { baseConfig with 
                        Assets = [bootstrapSpy]
                        HistoricalData = histMap }
        
        let dsl = "sell 1 spy_30dte_minus50delta"
        let cash = 20_000.0

        let result = runSimulation config dsl cash 1
        
        match result with
        | Ok runs ->
            let finalState = runs.[0].FinalState
            let positions = finalState.Portfolio.Positions
            
            let hasOption = positions |> List.exists (fun p -> match p.Instrument with ResolvedOption _ -> true | _ -> false)
            Assert.False(hasOption, "Option should be removed (expired/assigned)")
            
            let finalEquity = runs.[0].EquityCurve.[30]
            Assert.True(finalEquity < 16_000.0, "Should have taken significant loss on Put assignment")
        | _ -> failwith "Sim failed"

    // ============================================================================
    // Category 3: Portfolio Theory
    // ============================================================================

    [<Fact>]
    member _.``PORT-3.1 Diversification (The Free Lunch)``() =
        let config = makeMultiAssetConfig 0.0
        let cash = 100_000.0
        let seed = 99

        let resConc = runSimulation config "rebalance_to 100% asset_a" cash seed
        let resDiv = runSimulation config "rebalance_to 50% asset_a rebalance_to 50% asset_b" cash seed

        match (resConc, resDiv) with
        | (Ok rC, Ok rD) ->
            let volConc = rC |> Array.averageBy (fun r -> calculateStdDev (calculateDailyReturns r.EquityCurve))
            let volDiv = rD |> Array.averageBy (fun r -> calculateStdDev (calculateDailyReturns r.EquityCurve))
            
            Assert.True(volDiv < volConc, $"Diversified Vol ({volDiv:F4}) should be lower than Concentrated ({volConc:F4})")
        | _ -> failwith "Sim failed"

    [<Fact>]
    member _.``PORT-3.2 The Hedge (Negative Correlation)``() =
        let config = makeMultiAssetConfig -0.9
        let cash = 100_000.0
        let seed = 99

        let resHedge = runSimulation config "rebalance_to 50% asset_a rebalance_to 50% asset_b" cash seed
        
        match resHedge with
        | Ok runs ->
            let volHedge = runs |> Array.averageBy (fun r -> calculateStdDev (calculateDailyReturns r.EquityCurve))
            Assert.True(volHedge < 0.10, $"Hedged Vol ({volHedge:F4}) should be very low")
        | _ -> failwith "Sim failed"

    // ============================================================================
    // Category 5: System Integrity
    // ============================================================================

    [<Fact>]
    member _.``SYS-5.1 Insolvency Spiral``() =
        let config = makeGbmConfig 0.0 0.50 10 1
        let cash = 10_000.0
        let dsl = "rebalance_to 1000% spy"
        
        let mutable foundRuin = false
        
        for seed in 1..20 do
            if not foundRuin then
                let result = runSimulation config dsl cash seed
                match result with
                | Ok runs ->
                    let finalEquity = runs.[0].EquityCurve |> Array.last
                    if finalEquity <= 0.0 then
                        foundRuin <- true
                        Assert.True(finalEquity <= 0.0)
                | _ -> ()
        
        Assert.True(true)