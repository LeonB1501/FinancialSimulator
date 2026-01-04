module AnalyticsTests

open Xunit
open FsUnit.Xunit
open EngineTypes
open StrategyEngine.Analytics.Types
open StrategyEngine.Analytics.Metrics
open StrategyEngine.Analytics.Aggregator
open System

type AnalyticsSuite() =

    // ============================================================================
    // HELPERS
    // ============================================================================

    let makeRun (id: int) (curve: float[]) =
        {
            RunId = id
            EquityCurve = curve
            // FIX: Pass riskFreeRate (0.0) to emptyState
            FinalState = Interpreter.emptyState 0.0 0.0 
            TransactionHistory = [] 
        }

    let makeConfig (target: float option) (days: int option) =
        {
            TargetWealth = target
            TargetDays = days
            RiskFreeRate = 0.0
        }

    let startDate = DateTime(2024, 1, 1)

    // ============================================================================
    // Category 1: Single Path Metrics
    // ============================================================================

    [<Fact>]
    member _.``MET-1.1 CAGR Calculation``() =
        let curve = Array.append [| 100.0 |] (Array.create 251 150.0) 
        let curveFinal = Array.append curve [| 200.0 |] 
        
        let run = makeRun 1 curveFinal
        let metrics = calculateSingleRun run (makeConfig None None)
        
        Assert.Equal(1.0, metrics.CAGR, 4)

    [<Fact>]
    member _.``MET-1.2 Volatility of Flatline``() =
        let curve = Array.create 252 100.0
        let run = makeRun 1 curve
        let metrics = calculateSingleRun run (makeConfig None None)
        
        Assert.Equal(0.0, metrics.AnnualizedVolatility, 5)

    // ============================================================================
    // Category 2: Drawdown Logic
    // ============================================================================

    [<Fact>]
    member _.``MET-2.1 Max Drawdown``() =
        let curve = [| 100.0; 50.0; 100.0 |]
        let run = makeRun 1 curve
        let metrics = calculateSingleRun run (makeConfig None None)
        
        Assert.Equal(0.5, metrics.Drawdown.MaxDrawdown, 2)

    [<Fact>]
    member _.``MET-2.2 Drawdown Frequency Counts``() =
        let curve = [| 100.0; 90.0; 100.0; 80.0; 100.0 |]
        let run = makeRun 1 curve
        let metrics = calculateSingleRun run (makeConfig None None)
        
        Assert.Equal(2, metrics.Drawdown.DrawdownCounts.[0.1])
        Assert.Equal(1, metrics.Drawdown.DrawdownCounts.[0.2])
        Assert.Equal(0, metrics.Drawdown.DrawdownCounts.[0.3])

    [<Fact>]
    member _.``MET-2.3 Multi-Step Drawdown (Single Event)``() =
        let curve = [| 100.0; 90.0; 80.0; 100.0 |]
        let run = makeRun 1 curve
        let metrics = calculateSingleRun run (makeConfig None None)
        
        Assert.Equal(1, metrics.Drawdown.DrawdownCounts.[0.1])
        Assert.Equal(1, metrics.Drawdown.DrawdownCounts.[0.2])

    // ============================================================================
    // Category 3: Goal & Ruin
    // ============================================================================

    [<Fact>]
    member _.``MET-3.1 Time to Goal (First Touch)``() =
        let curve = [| 100.0; 110.0; 105.0; 120.0 |]
        let run = makeRun 1 curve
        let metrics = calculateSingleRun run (makeConfig (Some 110.0) None)
        
        Assert.True(metrics.ReachedGoal)
        Assert.Equal(1, metrics.DaysToGoal.Value)

    [<Fact>]
    member _.``MET-3.2 Ruin Detection``() =
        let curve = [| 100.0; 10.0; -5.0; 0.0 |]
        let run = makeRun 1 curve
        let metrics = calculateSingleRun run (makeConfig None None)
        
        Assert.True(metrics.IsRuined)

    // ============================================================================
    // Category 4: Aggregation
    // ============================================================================

    [<Fact>]
    member _.``AGG-4.1 Percentiles``() =
        let runs = [| for i in 0 .. 10 -> makeRun i [| float (i * 10) |] |]
        
        let dummyMetric wealth = 
            { RunId=0; FinalWealth=wealth; CAGR=0.0; AnnualizedVolatility=0.0; SharpeRatio=0.0; SortinoRatio=0.0; 
              Drawdown={MaxDrawdown=0.0; DrawdownCounts=Map.empty}; ReachedGoal=false; DaysToGoal=None; IsRuined=false;
              TotalCommission=0.0; TotalSlippage=0.0; TotalTax=0.0 } // FIX: Added TotalTax
        
        let metrics = runs |> Array.map (fun r -> dummyMetric r.EquityCurve.[0])
        
        let report = aggregate runs metrics (makeConfig None None) startDate
        
        Assert.Equal(50.0, report.WealthStats.Median)
        Assert.Equal(90.0, report.WealthStats.Deciles.[90])

    [<Fact>]
    member _.``AGG-4.2 Geometric Mean``() =
        let runs = [| makeRun 1 [| 10.0 |]; makeRun 2 [| 1000.0 |] |]
        let metrics = [| 
            { RunId=1; FinalWealth=10.0; CAGR=0.0; AnnualizedVolatility=0.0; SharpeRatio=0.0; SortinoRatio=0.0; Drawdown={MaxDrawdown=0.0; DrawdownCounts=Map.empty}; ReachedGoal=false; DaysToGoal=None; IsRuined=false; TotalCommission=0.0; TotalSlippage=0.0; TotalTax=0.0 }
            { RunId=2; FinalWealth=1000.0; CAGR=0.0; AnnualizedVolatility=0.0; SharpeRatio=0.0; SortinoRatio=0.0; Drawdown={MaxDrawdown=0.0; DrawdownCounts=Map.empty}; ReachedGoal=false; DaysToGoal=None; IsRuined=false; TotalCommission=0.0; TotalSlippage=0.0; TotalTax=0.0 }
        |]
        
        let report = aggregate runs metrics (makeConfig None None) startDate
        
        Assert.Equal(100.0, report.WealthStats.GeometricMean, 4)

    [<Fact>]
    member _.``AGG-4.3 Probability of Success``() =
        let runs = Array.zeroCreate 4
        let mSuccess = { RunId=0; FinalWealth=0.0; CAGR=0.0; AnnualizedVolatility=0.0; SharpeRatio=0.0; SortinoRatio=0.0; Drawdown={MaxDrawdown=0.0; DrawdownCounts=Map.empty}; ReachedGoal=true; DaysToGoal=Some 10; IsRuined=false; TotalCommission=0.0; TotalSlippage=0.0; TotalTax=0.0 }
        let mFail = { mSuccess with ReachedGoal=false; DaysToGoal=None }
        
        let metrics = [| mSuccess; mSuccess; mSuccess; mFail |]
        
        let report = aggregate runs metrics (makeConfig (Some 100.0) None) startDate
        
        Assert.Equal(0.75, report.ProbabilityOfSuccess, 2)

    [<Fact>]
    member _.``AGG-4.4 Sample Paths Selection``() =
        let runs = [| for i in 1 .. 10 -> makeRun i [| float i |] |]
        let metrics = runs |> Array.map (fun r -> 
            { RunId=0; FinalWealth=r.EquityCurve.[0]; CAGR=0.0; AnnualizedVolatility=0.0; SharpeRatio=0.0; SortinoRatio=0.0; Drawdown={MaxDrawdown=0.0; DrawdownCounts=Map.empty}; ReachedGoal=false; DaysToGoal=None; IsRuined=false; TotalCommission=0.0; TotalSlippage=0.0; TotalTax=0.0 })
        
        let report = aggregate runs metrics (makeConfig None None) startDate
        
        Assert.Equal(5, report.SamplePaths.Length)
        
        let bullPathValue = report.SamplePaths.[4].[0]
        Assert.True(bullPathValue >= 9.0)
        
        let bearPathValue = report.SamplePaths.[0].[0]
        Assert.True(bearPathValue <= 2.0)