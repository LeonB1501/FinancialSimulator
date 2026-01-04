module StrategyEngine.Analytics.Types

open System

// ============================================================================
// CONFIGURATION
// ============================================================================

[<StructuralEquality; NoComparison>]
type AnalysisConfiguration = {
    TargetWealth: float option
    TargetDays: int option
    RiskFreeRate: float
}

// ============================================================================
// METRIC CONTAINERS
// ============================================================================

[<StructuralEquality; NoComparison>]
type DrawdownStats = {
    MaxDrawdown: float 
    DrawdownCounts: Map<float, int> 
}

[<StructuralEquality; NoComparison>]
type SingleRunMetrics = {
    RunId: int
    FinalWealth: float
    CAGR: float
    AnnualizedVolatility: float
    SharpeRatio: float
    SortinoRatio: float
    Drawdown: DrawdownStats
    
    ReachedGoal: bool
    DaysToGoal: int option
    IsRuined: bool
    
    // Cost Metrics
    TotalCommission: float
    TotalSlippage: float
    TotalTax: float // <--- Added
}

[<StructuralEquality; NoComparison>]
type DistributionStats = {
    Mean: float
    Median: float
    GeometricMean: float
    Deciles: Map<int, float> 
}

[<StructuralEquality; NoComparison>]
type SimulationReport = {
    WealthStats: DistributionStats
    TimeStats: DistributionStats 
    
    ProbabilityOfSuccess: float
    ProbabilityOfRuin: float
    
    AverageMaxDrawdown: float
    AverageSharpe: float
    AverageSortino: float
    AverageVolatility: float
    
    // Average Costs
    AverageCommission: float
    AverageSlippage: float
    AverageTax: float // <--- Added
    
    DrawdownFrequencies: Map<float, float> 
    SamplePaths: float[][]
    Dates: DateTime[]
    DrawdownCone: Map<int, float[]>
    RecoveryDistribution: Map<int, int>
}