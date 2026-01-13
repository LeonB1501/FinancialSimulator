module StrategyEngine.Analytics.Aggregator

open System
open StrategyEngine.Analytics.Types
open EngineTypes

// --- Statistical Helpers ---

let private calculatePercentile (sortedData: float[]) (percentile: int) : float =
    if sortedData.Length = 0 then 0.0
    else
        let idx = (float percentile / 100.0) * float (sortedData.Length - 1)
        let lower = int (Math.Floor(idx))
        let upper = int (Math.Ceiling(idx))
        
        if lower = upper then sortedData.[lower]
        else
            let weight = idx - float lower
            sortedData.[lower] * (1.0 - weight) + sortedData.[upper] * weight

let private calculateDistribution (data: float[]) : DistributionStats =
    if data.Length = 0 then
        { Mean = 0.0; Median = 0.0; GeometricMean = 0.0; Deciles = Map.empty }
    else
        let sorted = Array.sort data
        let mean = Array.average sorted
        let median = calculatePercentile sorted 50
        
        let positiveData = sorted |> Array.filter (fun x -> x > 0.0)
        let geoMean = 
            if positiveData.Length = 0 then 0.0
            else
                let sumLogs = positiveData |> Array.sumBy Math.Log
                Math.Exp(sumLogs / float positiveData.Length)

        let deciles = 
            [10 .. 10 .. 90]
            |> List.map (fun p -> p, calculatePercentile sorted p)
            |> Map.ofList

        {
            Mean = mean
            Median = median
            GeometricMean = geoMean
            Deciles = deciles
        }

// --- Advanced Metrics Logic ---

let private calculateDrawdownSeries (curve: float[]) : float[] =
    let mutable peak = curve.[0]
    curve |> Array.map (fun v ->
        if v > peak then peak <- v
        if peak > 0.0 then (peak - v) / peak else 0.0
    )

let private calculateDrawdownCone (runs: SimulationRunResult array) : Map<int, float[]> =
    let days = runs.[0].EquityCurve.Length
    let runCount = runs.Length
    let allDrawdowns = runs |> Array.map (fun r -> calculateDrawdownSeries r.EquityCurve)
    
    let p10Line = Array.zeroCreate days
    let p50Line = Array.zeroCreate days
    let p90Line = Array.zeroCreate days
    
    for d in 0 .. days - 1 do
        let dayValues = Array.init runCount (fun i -> allDrawdowns.[i].[d])
        Array.sortInPlace dayValues
        p10Line.[d] <- calculatePercentile dayValues 10
        p50Line.[d] <- calculatePercentile dayValues 50
        p90Line.[d] <- calculatePercentile dayValues 90
        
    Map.ofList [ (10, p10Line); (50, p50Line); (90, p90Line) ]

let private calculateMaxUnderwaterDays (curve: float[]) : int =
    let mutable peak = curve.[0]
    let mutable maxDuration = 0
    let mutable currentDuration = 0
    for v in curve do
        if v >= peak then
            peak <- v
            if currentDuration > maxDuration then maxDuration <- currentDuration
            currentDuration <- 0
        else
            currentDuration <- currentDuration + 1
    if currentDuration > maxDuration then maxDuration <- currentDuration
    maxDuration

let private calculateRecoveryDistribution (runs: SimulationRunResult array) : Map<int, int> =
    runs
    |> Array.map (fun r -> calculateMaxUnderwaterDays r.EquityCurve)
    |> Array.countBy id
    |> Map.ofArray

// --- Main Aggregator ---

let aggregate (runs: SimulationRunResult array) (metrics: SingleRunMetrics array) (config: AnalysisConfiguration) (startDate: DateTime) : SimulationReport =
    let count = float runs.Length
    
    let finalWealths = metrics |> Array.map (fun m -> m.FinalWealth)
    let wealthStats = calculateDistribution finalWealths
    
    let timeToGoals = metrics |> Array.choose (fun m -> m.DaysToGoal) |> Array.map float
    let timeStats = calculateDistribution timeToGoals

    let successCount = 
        metrics 
        |> Array.filter (fun m -> 
            match config.TargetDays, m.DaysToGoal with
            | Some limit, Some days -> days <= limit
            | None, Some _ -> true
            | _, None -> false
        )
        |> Array.length
        
    let ruinCount = metrics |> Array.filter (fun m -> m.IsRuined) |> Array.length
    
    let avgMaxDD = metrics |> Array.averageBy (fun m -> m.Drawdown.MaxDrawdown)
    let avgSharpe = metrics |> Array.averageBy (fun m -> m.SharpeRatio)
    let avgSortino = metrics |> Array.averageBy (fun m -> m.SortinoRatio)
    let avgVol = metrics |> Array.averageBy (fun m -> m.AnnualizedVolatility)

    // Average Costs
    let avgComm = metrics |> Array.averageBy (fun m -> m.TotalCommission)
    let avgSlip = metrics |> Array.averageBy (fun m -> m.TotalSlippage)
    let avgTax = metrics |> Array.averageBy (fun m -> m.TotalTax) // <--- Added

    let thresholds = [0.1; 0.2; 0.3; 0.4; 0.5; 0.6; 0.7; 0.8; 0.9; 1.0]
    let ddFrequencies = 
        thresholds
        |> List.map (fun t -> 
            let hitCount = 
                metrics 
                |> Array.filter (fun m -> m.Drawdown.DrawdownCounts.ContainsKey(t) && m.Drawdown.DrawdownCounts.[t] > 0)
                |> Array.length
            (t, float hitCount / count)
        )
        |> Map.ofList

    let sortedByWealth = Array.zip metrics runs |> Array.sortBy (fun (m, _) -> m.FinalWealth)
    let getPathAtPercentile p =
        let idx = int ((float p / 100.0) * float (count - 1.0))
        let (_, run) = sortedByWealth.[idx]
        run.EquityCurve

    let samples = 
        if runs.Length < 5 then runs |> Array.map (fun r -> r.EquityCurve)
        else
            [|
                getPathAtPercentile 10
                getPathAtPercentile 25
                getPathAtPercentile 50
                getPathAtPercentile 75
                getPathAtPercentile 90
            |]

    let days = runs.[0].EquityCurve.Length
    let dates = Array.init days (fun i -> startDate.AddDays(float i))

    let drawdownCone = calculateDrawdownCone runs
    let recoveryDist = calculateRecoveryDistribution runs

    {
        WealthStats = wealthStats
        TimeStats = timeStats
        ProbabilityOfSuccess = float successCount / count
        ProbabilityOfRuin = float ruinCount / count
        AverageMaxDrawdown = avgMaxDD
        AverageSharpe = avgSharpe
        AverageSortino = avgSortino
        AverageVolatility = avgVol
        AverageCommission = avgComm
        AverageSlippage = avgSlip
        AverageTax = avgTax // <--- Added
        DrawdownFrequencies = ddFrequencies
        SamplePaths = samples
        Dates = dates
        DrawdownCone = drawdownCone
        RecoveryDistribution = recoveryDist
    }