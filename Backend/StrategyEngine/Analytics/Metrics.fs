module StrategyEngine.Analytics.Metrics

open System
open StrategyEngine.Analytics.Types
open EngineTypes

let private TRADING_DAYS = 252.0

// --- Math Helpers ---

let private calculateCAGR (startValue: float) (endValue: float) (days: int) : float =
    if startValue <= 0.0 || endValue <= 0.0 || days <= 0 then 0.0
    else
        let years = float days / TRADING_DAYS
        Math.Pow(endValue / startValue, 1.0 / years) - 1.0

let private calculateLogReturns (curve: float[]) : float[] =
    curve
    |> Array.pairwise
    |> Array.map (fun (prev, curr) -> 
        if prev <= 0.0 || curr <= 0.0 then 0.0 
        else Math.Log(curr / prev))

let private calculateVolatility (returns: float[]) : float =
    if returns.Length < 2 then 0.0
    else
        let mean = Array.average returns
        let sumSq = returns |> Array.sumBy (fun r -> Math.Pow(r - mean, 2.0))
        let stdDev = Math.Sqrt(sumSq / float (returns.Length - 1))
        stdDev * Math.Sqrt(TRADING_DAYS)

let private calculateDownsideDeviation (returns: float[]) (targetReturnDaily: float) : float =
    if returns.Length < 2 then 0.0
    else
        let downsideSq = 
            returns 
            |> Array.sumBy (fun r -> 
                let diff = r - targetReturnDaily
                if diff < 0.0 then Math.Pow(diff, 2.0) else 0.0)
        
        let downsideStdDev = Math.Sqrt(downsideSq / float (returns.Length - 1))
        downsideStdDev * Math.Sqrt(TRADING_DAYS)

// --- Drawdown Logic ---

let private calculateDrawdownStats (curve: float[]) : DrawdownStats =
    let mutable peak = curve.[0]
    let mutable maxDrawdown = 0.0
    let thresholds = [| 0.1; 0.2; 0.3; 0.4; 0.5; 0.6; 0.7; 0.8; 0.9; 1.0 |]
    let mutable counts = thresholds |> Array.map (fun _ -> 0)
    let mutable thresholdTriggered = thresholds |> Array.map (fun _ -> false)

    for value in curve do
        if value > peak then
            peak <- value
            Array.fill thresholdTriggered 0 thresholdTriggered.Length false
        else
            let dd = (peak - value) / peak
            maxDrawdown <- Math.Max(maxDrawdown, dd)
            for i in 0 .. thresholds.Length - 1 do
                if dd >= thresholds.[i] && not thresholdTriggered.[i] then
                    counts.[i] <- counts.[i] + 1
                    thresholdTriggered.[i] <- true

    let countsMap = Array.zip thresholds counts |> Map.ofArray
    { MaxDrawdown = maxDrawdown; DrawdownCounts = countsMap }

// --- Main Calculator ---

let calculateSingleRun (run: SimulationRunResult) (config: AnalysisConfiguration) : SingleRunMetrics =
    let curve = run.EquityCurve
    let days = curve.Length - 1
    let startVal = curve.[0]
    let endVal = curve.[days]
    
    let cagr = calculateCAGR startVal endVal days
    let logReturns = calculateLogReturns curve
    let vol = calculateVolatility logReturns
    
    let excessReturn = cagr - config.RiskFreeRate
    let sharpe = if vol > 0.0 then excessReturn / vol else 0.0
    
    let dailyRf = config.RiskFreeRate / TRADING_DAYS
    let downsideVol = calculateDownsideDeviation logReturns dailyRf
    let sortino = if downsideVol > 0.0 then excessReturn / downsideVol else 0.0

    let ddStats = calculateDrawdownStats curve

    let target = Option.defaultValue Double.MaxValue config.TargetWealth
    let daysToGoal = curve |> Array.tryFindIndex (fun v -> v >= target)
    let reachedGoal = daysToGoal.IsSome
    let isRuined = curve |> Array.exists (fun v -> v <= 0.0)

    // Sum Costs
    let totalComm = run.TransactionHistory |> List.sumBy (fun t -> t.Commission)
    let totalSlip = run.TransactionHistory |> List.sumBy (fun t -> t.Slippage)
    let totalTax = run.TransactionHistory |> List.sumBy (fun t -> t.Tax) // <--- Added

    {
        RunId = run.RunId
        FinalWealth = endVal
        CAGR = cagr
        AnnualizedVolatility = vol
        SharpeRatio = sharpe
        SortinoRatio = sortino
        Drawdown = ddStats
        ReachedGoal = reachedGoal
        DaysToGoal = daysToGoal
        IsRuined = isRuined
        TotalCommission = totalComm
        TotalSlippage = totalSlip
        TotalTax = totalTax // <--- Added
    }