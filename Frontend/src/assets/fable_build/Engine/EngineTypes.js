import { Union, Record } from "../fable_modules/fable-library-js.4.27.0/Types.js";
import { bool_type, array_type, class_type, tuple_type, option_type, union_type, int32_type, list_type, string_type, record_type, float64_type } from "../fable_modules/fable-library-js.4.27.0/Reflection.js";
import { PositionExpression_$reflection, AssetReference_$reflection } from "../Language/AST.js";

export class HestonParameters extends Record {
    constructor(Kappa, Theta, Sigma, Rho, V0, Mu, Epsilon) {
        super();
        this.Kappa = Kappa;
        this.Theta = Theta;
        this.Sigma = Sigma;
        this.Rho = Rho;
        this.V0 = V0;
        this.Mu = Mu;
        this.Epsilon = Epsilon;
    }
}

export function HestonParameters_$reflection() {
    return record_type("EngineTypes.HestonParameters", [], HestonParameters, () => [["Kappa", float64_type], ["Theta", float64_type], ["Sigma", float64_type], ["Rho", float64_type], ["V0", float64_type], ["Mu", float64_type], ["Epsilon", float64_type]]);
}

export class GarchParameters extends Record {
    constructor(Omega, Alpha, Beta, Mu, InitialVol) {
        super();
        this.Omega = Omega;
        this.Alpha = Alpha;
        this.Beta = Beta;
        this.Mu = Mu;
        this.InitialVol = InitialVol;
    }
}

export function GarchParameters_$reflection() {
    return record_type("EngineTypes.GarchParameters", [], GarchParameters, () => [["Omega", float64_type], ["Alpha", float64_type], ["Beta", float64_type], ["Mu", float64_type], ["InitialVol", float64_type]]);
}

export class RegimeParameters extends Record {
    constructor(Name, Mu, Sigma, TransitionProbs) {
        super();
        this.Name = Name;
        this.Mu = Mu;
        this.Sigma = Sigma;
        this.TransitionProbs = TransitionProbs;
    }
}

export function RegimeParameters_$reflection() {
    return record_type("EngineTypes.RegimeParameters", [], RegimeParameters, () => [["Name", string_type], ["Mu", float64_type], ["Sigma", float64_type], ["TransitionProbs", list_type(float64_type)]]);
}

export class BootstrapParameters extends Record {
    constructor(BlockSize, HistoricalDataId) {
        super();
        this.BlockSize = (BlockSize | 0);
        this.HistoricalDataId = HistoricalDataId;
    }
}

export function BootstrapParameters_$reflection() {
    return record_type("EngineTypes.BootstrapParameters", [], BootstrapParameters, () => [["BlockSize", int32_type], ["HistoricalDataId", string_type]]);
}

export class SimulationModel extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["GeometricBrownianMotion", "Heston", "Garch", "RegimeSwitching", "BlockedBootstrap", "Leveraged"];
    }
}

export function SimulationModel_$reflection() {
    return union_type("EngineTypes.SimulationModel", [], SimulationModel, () => [[["Mu", float64_type], ["Sigma", float64_type]], [["Item", HestonParameters_$reflection()]], [["Item", GarchParameters_$reflection()]], [["InitialRegimeIdx", int32_type], ["Regimes", list_type(RegimeParameters_$reflection())]], [["Item", BootstrapParameters_$reflection()]], [["BaseTicker", string_type], ["Leverage", float64_type]]]);
}

export class AssetDefinition extends Record {
    constructor(Ticker, InitialPrice, Model) {
        super();
        this.Ticker = Ticker;
        this.InitialPrice = InitialPrice;
        this.Model = Model;
    }
}

export function AssetDefinition_$reflection() {
    return record_type("EngineTypes.AssetDefinition", [], AssetDefinition, () => [["Ticker", string_type], ["InitialPrice", float64_type], ["Model", SimulationModel_$reflection()]]);
}

export class MarketDataPoint extends Record {
    constructor(Price, Vol) {
        super();
        this.Price = Price;
        this.Vol = Vol;
    }
}

export function MarketDataPoint_$reflection() {
    return record_type("EngineTypes.MarketDataPoint", [], MarketDataPoint, () => [["Price", float64_type], ["Vol", float64_type]]);
}

export class AccumulationParams extends Record {
    constructor(MonthlyContribution, ContributionGrowthRate, TargetWealth) {
        super();
        this.MonthlyContribution = MonthlyContribution;
        this.ContributionGrowthRate = ContributionGrowthRate;
        this.TargetWealth = TargetWealth;
    }
}

export function AccumulationParams_$reflection() {
    return record_type("EngineTypes.AccumulationParams", [], AccumulationParams, () => [["MonthlyContribution", float64_type], ["ContributionGrowthRate", float64_type], ["TargetWealth", option_type(float64_type)]]);
}

export class RetirementParams extends Record {
    constructor(MonthlyWithdrawal, InflationRate, InitialPortfolio, PensionStartMonth, MonthlyPension) {
        super();
        this.MonthlyWithdrawal = MonthlyWithdrawal;
        this.InflationRate = InflationRate;
        this.InitialPortfolio = InitialPortfolio;
        this.PensionStartMonth = (PensionStartMonth | 0);
        this.MonthlyPension = MonthlyPension;
    }
}

export function RetirementParams_$reflection() {
    return record_type("EngineTypes.RetirementParams", [], RetirementParams, () => [["MonthlyWithdrawal", float64_type], ["InflationRate", float64_type], ["InitialPortfolio", float64_type], ["PensionStartMonth", int32_type], ["MonthlyPension", float64_type]]);
}

export class FinancialScenario extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["NoScenario", "Accumulation", "Retirement"];
    }
}

export function FinancialScenario_$reflection() {
    return union_type("EngineTypes.FinancialScenario", [], FinancialScenario, () => [[], [["Item", AccumulationParams_$reflection()]], [["Item", RetirementParams_$reflection()]]]);
}

export class SimulationConfiguration extends Record {
    constructor(Assets, Correlations, TradingDays, Iterations, RiskFreeRate, Granularity, HistoricalData, StartDate, Scenario) {
        super();
        this.Assets = Assets;
        this.Correlations = Correlations;
        this.TradingDays = (TradingDays | 0);
        this.Iterations = (Iterations | 0);
        this.RiskFreeRate = RiskFreeRate;
        this.Granularity = (Granularity | 0);
        this.HistoricalData = HistoricalData;
        this.StartDate = StartDate;
        this.Scenario = Scenario;
    }
}

export function SimulationConfiguration_$reflection() {
    return record_type("EngineTypes.SimulationConfiguration", [], SimulationConfiguration, () => [["Assets", list_type(AssetDefinition_$reflection())], ["Correlations", class_type("Microsoft.FSharp.Collections.FSharpMap`2", [tuple_type(string_type, string_type), float64_type])], ["TradingDays", int32_type], ["Iterations", int32_type], ["RiskFreeRate", float64_type], ["Granularity", int32_type], ["HistoricalData", class_type("Microsoft.FSharp.Collections.FSharpMap`2", [string_type, array_type(MarketDataPoint_$reflection())])], ["StartDate", class_type("System.DateTime")], ["Scenario", FinancialScenario_$reflection()]]);
}

export class ConcreteOption extends Record {
    constructor(Underlying, Strike, ExpiryDay, IsCall) {
        super();
        this.Underlying = Underlying;
        this.Strike = Strike;
        this.ExpiryDay = (ExpiryDay | 0);
        this.IsCall = IsCall;
    }
}

export function ConcreteOption_$reflection() {
    return record_type("EngineTypes.ConcreteOption", [], ConcreteOption, () => [["Underlying", AssetReference_$reflection()], ["Strike", float64_type], ["ExpiryDay", int32_type], ["IsCall", bool_type]]);
}

export class ResolvedInstrument extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["ResolvedAsset", "ResolvedOption", "Compound"];
    }
}

export function ResolvedInstrument_$reflection() {
    return union_type("EngineTypes.ResolvedInstrument", [], ResolvedInstrument, () => [[["Item", AssetReference_$reflection()]], [["Item", ConcreteOption_$reflection()]], []]);
}

export class PositionInstance extends Record {
    constructor(Id, GroupId, DefinitionName, ComponentName, ParentId, BuyPrice, BuyDate, Quantity, Instrument) {
        super();
        this.Id = Id;
        this.GroupId = GroupId;
        this.DefinitionName = DefinitionName;
        this.ComponentName = ComponentName;
        this.ParentId = ParentId;
        this.BuyPrice = BuyPrice;
        this.BuyDate = (BuyDate | 0);
        this.Quantity = Quantity;
        this.Instrument = Instrument;
    }
}

export function PositionInstance_$reflection() {
    return record_type("EngineTypes.PositionInstance", [], PositionInstance, () => [["Id", class_type("System.Guid")], ["GroupId", option_type(class_type("System.Guid"))], ["DefinitionName", string_type], ["ComponentName", option_type(string_type)], ["ParentId", option_type(class_type("System.Guid"))], ["BuyPrice", float64_type], ["BuyDate", int32_type], ["Quantity", float64_type], ["Instrument", ResolvedInstrument_$reflection()]]);
}

export class CompositeMetadata extends Record {
    constructor(GroupId, DefinitionName, OriginalExpression, BuyDate, InitialQuantity) {
        super();
        this.GroupId = GroupId;
        this.DefinitionName = DefinitionName;
        this.OriginalExpression = OriginalExpression;
        this.BuyDate = (BuyDate | 0);
        this.InitialQuantity = InitialQuantity;
    }
}

export function CompositeMetadata_$reflection() {
    return record_type("EngineTypes.CompositeMetadata", [], CompositeMetadata, () => [["GroupId", class_type("System.Guid")], ["DefinitionName", string_type], ["OriginalExpression", PositionExpression_$reflection()], ["BuyDate", int32_type], ["InitialQuantity", float64_type]]);
}

export class Portfolio extends Record {
    constructor(Cash, Positions, CompositeRegistry) {
        super();
        this.Cash = Cash;
        this.Positions = Positions;
        this.CompositeRegistry = CompositeRegistry;
    }
}

export function Portfolio_$reflection() {
    return record_type("EngineTypes.Portfolio", [], Portfolio, () => [["Cash", float64_type], ["Positions", list_type(PositionInstance_$reflection())], ["CompositeRegistry", class_type("Microsoft.FSharp.Collections.FSharpMap`2", [class_type("System.Guid"), CompositeMetadata_$reflection()])]]);
}

export class Value extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["V_Float", "V_Percent", "V_Dollar", "V_Bool", "V_Asset", "V_Position", "V_Instance"];
    }
}

export function Value_$reflection() {
    return union_type("EngineTypes.Value", [], Value, () => [[["Item", float64_type]], [["Item", float64_type]], [["Item", float64_type]], [["Item", bool_type]], [["Item", AssetReference_$reflection()]], [["Item", PositionExpression_$reflection()]], [["Item", PositionInstance_$reflection()]]]);
}

export class EvaluationState extends Record {
    constructor(CurrentDay, Portfolio, ScopeStack, GlobalScope, RiskFreeRate) {
        super();
        this.CurrentDay = (CurrentDay | 0);
        this.Portfolio = Portfolio;
        this.ScopeStack = ScopeStack;
        this.GlobalScope = GlobalScope;
        this.RiskFreeRate = RiskFreeRate;
    }
}

export function EvaluationState_$reflection() {
    return record_type("EngineTypes.EvaluationState", [], EvaluationState, () => [["CurrentDay", int32_type], ["Portfolio", Portfolio_$reflection()], ["ScopeStack", list_type(list_type(tuple_type(string_type, Value_$reflection())))], ["GlobalScope", class_type("Microsoft.FSharp.Collections.FSharpMap`2", [string_type, Value_$reflection()])], ["RiskFreeRate", float64_type]]);
}

export class BuyParams extends Record {
    constructor(Instrument, Quantity, ComponentName, DefinitionName) {
        super();
        this.Instrument = Instrument;
        this.Quantity = Quantity;
        this.ComponentName = ComponentName;
        this.DefinitionName = DefinitionName;
    }
}

export function BuyParams_$reflection() {
    return record_type("EngineTypes.BuyParams", [], BuyParams, () => [["Instrument", ResolvedInstrument_$reflection()], ["Quantity", float64_type], ["ComponentName", option_type(string_type)], ["DefinitionName", option_type(string_type)]]);
}

export class SellParams extends Record {
    constructor(Instrument, Quantity, ComponentName, DefinitionName) {
        super();
        this.Instrument = Instrument;
        this.Quantity = Quantity;
        this.ComponentName = ComponentName;
        this.DefinitionName = DefinitionName;
    }
}

export function SellParams_$reflection() {
    return record_type("EngineTypes.SellParams", [], SellParams, () => [["Instrument", ResolvedInstrument_$reflection()], ["Quantity", float64_type], ["ComponentName", option_type(string_type)], ["DefinitionName", option_type(string_type)]]);
}

export class RebalanceParams extends Record {
    constructor(Instrument, TargetPercent) {
        super();
        this.Instrument = Instrument;
        this.TargetPercent = TargetPercent;
    }
}

export function RebalanceParams_$reflection() {
    return record_type("EngineTypes.RebalanceParams", [], RebalanceParams, () => [["Instrument", ResolvedInstrument_$reflection()], ["TargetPercent", float64_type]]);
}

export class PrimitiveTrade extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["PrimitiveBuy", "PrimitiveSell", "PrimitiveRebalance"];
    }
}

export function PrimitiveTrade_$reflection() {
    return union_type("EngineTypes.PrimitiveTrade", [], PrimitiveTrade, () => [[["Item", BuyParams_$reflection()]], [["Item", SellParams_$reflection()]], [["Item", RebalanceParams_$reflection()]]]);
}

export class RebalanceAnalysis extends Record {
    constructor(IsAchievable, PreparatoryTrades, DebugReason) {
        super();
        this.IsAchievable = IsAchievable;
        this.PreparatoryTrades = PreparatoryTrades;
        this.DebugReason = DebugReason;
    }
}

export function RebalanceAnalysis_$reflection() {
    return record_type("EngineTypes.RebalanceAnalysis", [], RebalanceAnalysis, () => [["IsAchievable", bool_type], ["PreparatoryTrades", list_type(PrimitiveTrade_$reflection())], ["DebugReason", string_type]]);
}

export class PricePath extends Record {
    constructor(Ticker, DailyData) {
        super();
        this.Ticker = Ticker;
        this.DailyData = DailyData;
    }
}

export function PricePath_$reflection() {
    return record_type("EngineTypes.PricePath", [], PricePath, () => [["Ticker", string_type], ["DailyData", array_type(MarketDataPoint_$reflection())]]);
}

export class SimulationRunResult extends Record {
    constructor(RunId, EquityCurve, FinalState) {
        super();
        this.RunId = (RunId | 0);
        this.EquityCurve = EquityCurve;
        this.FinalState = FinalState;
    }
}

export function SimulationRunResult_$reflection() {
    return record_type("EngineTypes.SimulationRunResult", [], SimulationRunResult, () => [["RunId", int32_type], ["EquityCurve", array_type(float64_type)], ["FinalState", EvaluationState_$reflection()]]);
}

