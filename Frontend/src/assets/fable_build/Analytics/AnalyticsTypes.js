import { Record } from "../fable_modules/fable-library-js.4.27.0/Types.js";
import { array_type, bool_type, class_type, record_type, int32_type, option_type, float64_type } from "../fable_modules/fable-library-js.4.27.0/Reflection.js";

export class AnalysisConfiguration extends Record {
    constructor(TargetWealth, TargetDays, RiskFreeRate) {
        super();
        this.TargetWealth = TargetWealth;
        this.TargetDays = TargetDays;
        this.RiskFreeRate = RiskFreeRate;
    }
}

export function AnalysisConfiguration_$reflection() {
    return record_type("StrategyEngine.Analytics.Types.AnalysisConfiguration", [], AnalysisConfiguration, () => [["TargetWealth", option_type(float64_type)], ["TargetDays", option_type(int32_type)], ["RiskFreeRate", float64_type]]);
}

export class DrawdownStats extends Record {
    constructor(MaxDrawdown, DrawdownCounts) {
        super();
        this.MaxDrawdown = MaxDrawdown;
        this.DrawdownCounts = DrawdownCounts;
    }
}

export function DrawdownStats_$reflection() {
    return record_type("StrategyEngine.Analytics.Types.DrawdownStats", [], DrawdownStats, () => [["MaxDrawdown", float64_type], ["DrawdownCounts", class_type("Microsoft.FSharp.Collections.FSharpMap`2", [float64_type, int32_type])]]);
}

export class SingleRunMetrics extends Record {
    constructor(RunId, FinalWealth, CAGR, AnnualizedVolatility, SharpeRatio, SortinoRatio, Drawdown, ReachedGoal, DaysToGoal, IsRuined, TotalCommission, TotalSlippage, TotalTax) {
        super();
        this.RunId = (RunId | 0);
        this.FinalWealth = FinalWealth;
        this.CAGR = CAGR;
        this.AnnualizedVolatility = AnnualizedVolatility;
        this.SharpeRatio = SharpeRatio;
        this.SortinoRatio = SortinoRatio;
        this.Drawdown = Drawdown;
        this.ReachedGoal = ReachedGoal;
        this.DaysToGoal = DaysToGoal;
        this.IsRuined = IsRuined;
        this.TotalCommission = TotalCommission;
        this.TotalSlippage = TotalSlippage;
        this.TotalTax = TotalTax;
    }
}

export function SingleRunMetrics_$reflection() {
    return record_type("StrategyEngine.Analytics.Types.SingleRunMetrics", [], SingleRunMetrics, () => [["RunId", int32_type], ["FinalWealth", float64_type], ["CAGR", float64_type], ["AnnualizedVolatility", float64_type], ["SharpeRatio", float64_type], ["SortinoRatio", float64_type], ["Drawdown", DrawdownStats_$reflection()], ["ReachedGoal", bool_type], ["DaysToGoal", option_type(int32_type)], ["IsRuined", bool_type], ["TotalCommission", float64_type], ["TotalSlippage", float64_type], ["TotalTax", float64_type]]);
}

export class DistributionStats extends Record {
    constructor(Mean, Median, GeometricMean, Deciles) {
        super();
        this.Mean = Mean;
        this.Median = Median;
        this.GeometricMean = GeometricMean;
        this.Deciles = Deciles;
    }
}

export function DistributionStats_$reflection() {
    return record_type("StrategyEngine.Analytics.Types.DistributionStats", [], DistributionStats, () => [["Mean", float64_type], ["Median", float64_type], ["GeometricMean", float64_type], ["Deciles", class_type("Microsoft.FSharp.Collections.FSharpMap`2", [int32_type, float64_type])]]);
}

export class SimulationReport extends Record {
    constructor(WealthStats, TimeStats, ProbabilityOfSuccess, ProbabilityOfRuin, AverageMaxDrawdown, AverageSharpe, AverageSortino, AverageVolatility, AverageCommission, AverageSlippage, AverageTax, DrawdownFrequencies, SamplePaths, Dates, DrawdownCone, RecoveryDistribution) {
        super();
        this.WealthStats = WealthStats;
        this.TimeStats = TimeStats;
        this.ProbabilityOfSuccess = ProbabilityOfSuccess;
        this.ProbabilityOfRuin = ProbabilityOfRuin;
        this.AverageMaxDrawdown = AverageMaxDrawdown;
        this.AverageSharpe = AverageSharpe;
        this.AverageSortino = AverageSortino;
        this.AverageVolatility = AverageVolatility;
        this.AverageCommission = AverageCommission;
        this.AverageSlippage = AverageSlippage;
        this.AverageTax = AverageTax;
        this.DrawdownFrequencies = DrawdownFrequencies;
        this.SamplePaths = SamplePaths;
        this.Dates = Dates;
        this.DrawdownCone = DrawdownCone;
        this.RecoveryDistribution = RecoveryDistribution;
    }
}

export function SimulationReport_$reflection() {
    return record_type("StrategyEngine.Analytics.Types.SimulationReport", [], SimulationReport, () => [["WealthStats", DistributionStats_$reflection()], ["TimeStats", DistributionStats_$reflection()], ["ProbabilityOfSuccess", float64_type], ["ProbabilityOfRuin", float64_type], ["AverageMaxDrawdown", float64_type], ["AverageSharpe", float64_type], ["AverageSortino", float64_type], ["AverageVolatility", float64_type], ["AverageCommission", float64_type], ["AverageSlippage", float64_type], ["AverageTax", float64_type], ["DrawdownFrequencies", class_type("Microsoft.FSharp.Collections.FSharpMap`2", [float64_type, float64_type])], ["SamplePaths", array_type(array_type(float64_type))], ["Dates", array_type(class_type("System.DateTime"))], ["DrawdownCone", class_type("Microsoft.FSharp.Collections.FSharpMap`2", [int32_type, array_type(float64_type)])], ["RecoveryDistribution", class_type("Microsoft.FSharp.Collections.FSharpMap`2", [int32_type, int32_type])]]);
}

