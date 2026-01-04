module EngineTypes

open AST
open System

// ============================================================================
// TRANSACTION LOGGING
// ============================================================================

[<StructuralEquality; NoComparison>]
type Transaction = {
    Date: int
    Ticker: string
    Type: string  // "BUY", "SELL", "TAX"
    Quantity: float
    Price: float
    Value: float
    // NEW: Cost Breakdown
    Commission: float
    Slippage: float
    Tax: float // <--- Added
    // Tag for context (e.g., "dip_buy", "liquidation")
    Tag: string option
}

// ============================================================================
// MODEL PARAMETERS
// ============================================================================

[<StructuralEquality; NoComparison>]
type HestonParameters = {
    Kappa: float
    Theta: float
    Sigma: float
    Rho: float
    V0: float
    Mu: float
    Epsilon: float
}

[<StructuralEquality; NoComparison>]
type GarchParameters = {
    Omega: float
    Alpha: float
    Beta: float
    Mu: float
    InitialVol: float
}

[<StructuralEquality; NoComparison>]
type RegimeParameters = {
    Name: string
    Mu: float
    Sigma: float
    TransitionProbs: float list 
}

[<StructuralEquality; NoComparison>]
type BootstrapParameters = {
    BlockSize: int
    HistoricalDataId: string 
}

[<StructuralEquality; NoComparison>]
type SimulationModel =
    | GeometricBrownianMotion of Mu: float * Sigma: float
    | Heston of HestonParameters
    | Garch of GarchParameters
    | RegimeSwitching of InitialRegimeIdx: int * Regimes: RegimeParameters list
    | BlockedBootstrap of BootstrapParameters
    | Leveraged of BaseTicker: Identifier * Leverage: float

[<StructuralEquality; NoComparison>]
type AssetDefinition = {
    Ticker: Identifier
    InitialPrice: float
    Model: SimulationModel
}

[<StructuralEquality; NoComparison>]
type MarketDataPoint = {
    Price: float
    Vol: float
}

// ============================================================================
// FINANCIAL SCENARIOS
// ============================================================================

[<StructuralEquality; NoComparison>]
type AccumulationParams = {
    MonthlyContribution: float
    ContributionGrowthRate: float
    TargetWealth: float option
}

[<StructuralEquality; NoComparison>]
type RetirementParams = {
    MonthlyWithdrawal: float
    InflationRate: float
    InitialPortfolio: float
    PensionStartMonth: int
    MonthlyPension: float
}

[<StructuralEquality; NoComparison>]
type FinancialScenario =
    | NoScenario
    | Accumulation of AccumulationParams
    | Retirement of RetirementParams

// ============================================================================
// EXECUTION & COSTS
// ============================================================================

[<StructuralEquality; NoComparison>]
type CommissionModel = {
    PerOrder: float
    PerUnit: float
}

[<StructuralEquality; NoComparison>]
type VolatilityTier = {
    MinVol: float
    MaxVol: float
    Spread: float
}

[<StructuralEquality; NoComparison>]
type SlippageModel = {
    DefaultSpread: float
    Tiers: VolatilityTier list
}

[<StructuralEquality; NoComparison>]
type ExecutionCosts = {
    Commission: CommissionModel
    Slippage: SlippageModel
}

// ============================================================================
// TAX MODELING
// ============================================================================

[<StructuralEquality; NoComparison>]
type TaxPaymentMode =
    | ImmediateWithholding
    | PeriodicSettlement of Days: int

[<StructuralEquality; NoComparison>]
type TaxConfig = {
    PaymentMode: TaxPaymentMode
    ShortTermRate: float
    LongTermRate: float
    LongTermThreshold: int
    WealthTaxRate: float
}

// ============================================================================
// CONFIGURATION
// ============================================================================

[<StructuralEquality; NoComparison>]
type SimulationConfiguration = {
    Assets: AssetDefinition list
    Correlations: Map<Identifier * Identifier, float>
    TradingDays: int
    Iterations: int
    RiskFreeRate: float
    Granularity: int
    HistoricalData: Map<Identifier, MarketDataPoint array>
    StartDate: DateTime
    Scenario: FinancialScenario
    ExecutionCosts: ExecutionCosts
    Tax: TaxConfig
}

// ============================================================================
// PORTFOLIO & STATE
// ============================================================================

[<StructuralEquality; NoComparison>]
type ConcreteOption = {
    Underlying: AssetReference
    Strike: float
    ExpiryDay: int
    IsCall: bool
}

[<StructuralEquality; NoComparison>]
type ResolvedInstrument =
    | ResolvedAsset of AssetReference
    | ResolvedOption of ConcreteOption
    | Compound

[<StructuralEquality; NoComparison>]
type PositionInstance = {
    Id: Guid
    GroupId: Guid option
    DefinitionName: Identifier
    ComponentName: Identifier option
    ParentId: Guid option
    BuyPrice: float
    BuyDate: int
    Quantity: float
    Instrument: ResolvedInstrument
}

type CompositeMetadata = {
    GroupId: Guid
    DefinitionName: Identifier
    OriginalExpression: PositionExpression
    BuyDate: int
    InitialQuantity: float
}

[<StructuralEquality; NoComparison>]
type TaxLot = {
    Ticker: string
    Quantity: float
    BuyPrice: float
    BuyDate: int
}

[<StructuralEquality; NoComparison>]
type Portfolio = {
    Cash: float
    Positions: PositionInstance list
    CompositeRegistry: Map<Guid, CompositeMetadata>
    TaxLots: TaxLot list
    TaxLiabilityYTD: float
    RealizedGainsYTD: float
}

[<StructuralEquality; NoComparison>]
type Value =
    | V_Float of float 
    | V_Percent of float 
    | V_Dollar of float 
    | V_Bool of bool
    | V_Asset of AssetReference 
    | V_Position of PositionExpression 
    | V_Instance of PositionInstance

[<StructuralEquality; NoComparison>]
type EvaluationState = {
    CurrentDay: int
    Portfolio: Portfolio
    ScopeStack: (Identifier * Value) list list
    GlobalScope: Map<Identifier, Value>
    RiskFreeRate: float 
    TransactionHistory: Transaction list
}

// ============================================================================
// TRADING PRIMITIVES
// ============================================================================

[<StructuralEquality; NoComparison>]
type BuyParams = { 
    Instrument: ResolvedInstrument
    Quantity: float
    ComponentName: Identifier option
    DefinitionName: Identifier option
}
[<StructuralEquality; NoComparison>]
type SellParams = { 
    Instrument: ResolvedInstrument
    Quantity: float
    ComponentName: Identifier option
    DefinitionName: Identifier option
}
[<StructuralEquality; NoComparison>]
type RebalanceParams = { 
    Instrument: ResolvedInstrument
    TargetPercent: float 
}

[<StructuralEquality; NoComparison>]
type PrimitiveTrade =
    | PrimitiveBuy of BuyParams
    | PrimitiveSell of SellParams
    | PrimitiveRebalance of RebalanceParams

type RebalanceAnalysis = {
    IsAchievable: bool
    PreparatoryTrades: PrimitiveTrade list
    DebugReason: string
}

type PricePath = {
    Ticker: Identifier
    DailyData: MarketDataPoint array
}

type FullPriceHistory = PricePath list

// ============================================================================
// RESULTS
// ============================================================================

[<StructuralEquality; NoComparison>]
type SimulationRunResult = {
    RunId: int
    EquityCurve: float array
    FinalState: EvaluationState
    TransactionHistory: Transaction list
}