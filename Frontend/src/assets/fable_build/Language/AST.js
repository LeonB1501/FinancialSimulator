import { Record, Union } from "../fable_modules/fable-library-js.4.27.0/Types.js";
import { list_type, option_type, record_type, int32_type, string_type, union_type, float64_type } from "../fable_modules/fable-library-js.4.27.0/Reflection.js";

export class NumericLiteral extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["Number", "Percentage", "Dollar"];
    }
}

export function NumericLiteral_$reflection() {
    return union_type("AST.NumericLiteral", [], NumericLiteral, () => [[["Item", float64_type]], [["Item", float64_type]], [["Item", float64_type]]]);
}

export class BoolLiteral extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["True", "False"];
    }
}

export function BoolLiteral_$reflection() {
    return union_type("AST.BoolLiteral", [], BoolLiteral, () => [[], []]);
}

export class Literal extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["NumericLit", "BoolLit"];
    }
}

export function Literal_$reflection() {
    return union_type("AST.Literal", [], Literal, () => [[["Item", NumericLiteral_$reflection()]], [["Item", BoolLiteral_$reflection()]]]);
}

export class AssetReference extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["SimpleAsset", "LeveragedAsset"];
    }
}

export function AssetReference_$reflection() {
    return union_type("AST.AssetReference", [], AssetReference, () => [[["Item", string_type]], [["Item1", string_type], ["Item2", float64_type]]]);
}

export class GreekType extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["Delta", "Gamma", "Theta", "Vega", "Rho"];
    }
}

export function GreekType_$reflection() {
    return union_type("AST.GreekType", [], GreekType, () => [[], [], [], [], []]);
}

export class OptionSpec extends Record {
    constructor(Underlying, DTE, GreekType, GreekValue) {
        super();
        this.Underlying = Underlying;
        this.DTE = (DTE | 0);
        this.GreekType = GreekType;
        this.GreekValue = GreekValue;
    }
}

export function OptionSpec_$reflection() {
    return record_type("AST.OptionSpec", [], OptionSpec, () => [["Underlying", AssetReference_$reflection()], ["DTE", int32_type], ["GreekType", GreekType_$reflection()], ["GreekValue", float64_type]]);
}

export class Instrument extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["Asset", "Option"];
    }
}

export function Instrument_$reflection() {
    return union_type("AST.Instrument", [], Instrument, () => [[["Item", AssetReference_$reflection()]], [["Item", OptionSpec_$reflection()]]]);
}

export class IndicatorType extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["SMA", "EMA", "RSI", "Vol", "Return", "PastPrice"];
    }
}

export function IndicatorType_$reflection() {
    return union_type("AST.IndicatorType", [], IndicatorType, () => [[], [], [], [], [], []]);
}

export class Indicator extends Record {
    constructor(Asset, IndicatorType, Period) {
        super();
        this.Asset = Asset;
        this.IndicatorType = IndicatorType;
        this.Period = Period;
    }
}

export function Indicator_$reflection() {
    return record_type("AST.Indicator", [], Indicator, () => [["Asset", string_type], ["IndicatorType", IndicatorType_$reflection()], ["Period", option_type(int32_type)]]);
}

export class PortfolioQuery extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["CashAvailable", "PortfolioValue", "PositionQuantity", "PositionValue"];
    }
}

export function PortfolioQuery_$reflection() {
    return union_type("AST.PortfolioQuery", [], PortfolioQuery, () => [[], [], [["Item", string_type]], [["Item", string_type]]]);
}

export class PropertyAccess extends Record {
    constructor(Object$, Property) {
        super();
        this.Object = Object$;
        this.Property = Property;
    }
}

export function PropertyAccess_$reflection() {
    return record_type("AST.PropertyAccess", [], PropertyAccess, () => [["Object", Expression_$reflection()], ["Property", string_type]]);
}

export class ArithmeticOp extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["Add", "Subtract", "Multiply", "Divide", "Modulo"];
    }
}

export function ArithmeticOp_$reflection() {
    return union_type("AST.ArithmeticOp", [], ArithmeticOp, () => [[], [], [], [], []]);
}

export class ComparisonOp extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["Greater", "Less", "GreaterEq", "LessEq", "Equal", "NotEqual"];
    }
}

export function ComparisonOp_$reflection() {
    return union_type("AST.ComparisonOp", [], ComparisonOp, () => [[], [], [], [], [], []]);
}

export class LogicalOp extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["And", "Or"];
    }
}

export function LogicalOp_$reflection() {
    return union_type("AST.LogicalOp", [], LogicalOp, () => [[], []]);
}

export class Expression extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["LiteralExpr", "IdentifierExpr", "AssetExpr", "OptionExpr", "PropertyAccessExpr", "IndicatorExpr", "PortfolioQueryExpr", "ArithmeticExpr", "UnaryMinusExpr", "ParenExpr"];
    }
}

export function Expression_$reflection() {
    return union_type("AST.Expression", [], Expression, () => [[["Item", Literal_$reflection()]], [["Item", string_type]], [["Item", AssetReference_$reflection()]], [["Item", OptionSpec_$reflection()]], [["Item", PropertyAccess_$reflection()]], [["Item", Indicator_$reflection()]], [["Item", PortfolioQuery_$reflection()]], [["Item1", ArithmeticOp_$reflection()], ["Item2", Expression_$reflection()], ["Item3", Expression_$reflection()]], [["Item", Expression_$reflection()]], [["Item", Expression_$reflection()]]]);
}

export class Condition extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["ComparisonCond", "LogicalCond", "NotCond", "ParenCond", "BooleanExpr"];
    }
}

export function Condition_$reflection() {
    return union_type("AST.Condition", [], Condition, () => [[["Item1", ComparisonOp_$reflection()], ["Item2", Expression_$reflection()], ["Item3", Expression_$reflection()]], [["Item1", LogicalOp_$reflection()], ["Item2", Condition_$reflection()], ["Item3", Condition_$reflection()]], [["Item", Condition_$reflection()]], [["Item", Condition_$reflection()]], [["Item", Expression_$reflection()]]]);
}

export class Quantity extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["LiteralQuantity", "IdentifierQuantity", "ExpressionQuantity"];
    }
}

export function Quantity_$reflection() {
    return union_type("AST.Quantity", [], Quantity, () => [[["Item", NumericLiteral_$reflection()]], [["Item", string_type]], [["Item", Expression_$reflection()]]]);
}

export class PositionComponent extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["BuyComponent", "SellComponent"];
    }
}

export function PositionComponent_$reflection() {
    return union_type("AST.PositionComponent", [], PositionComponent, () => [[["Item1", Quantity_$reflection()], ["Item2", Instrument_$reflection()]], [["Item1", Quantity_$reflection()], ["Item2", Instrument_$reflection()]]]);
}

export class PositionExpression extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["ComponentExpr", "CompoundExpr", "PositionReference"];
    }
}

export function PositionExpression_$reflection() {
    return union_type("AST.PositionExpression", [], PositionExpression, () => [[["Item", PositionComponent_$reflection()]], [["Item1", PositionExpression_$reflection()], ["Item2", PositionExpression_$reflection()]], [["Item", string_type]]]);
}

export class ActionTarget extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["AssetTarget", "IdentifierTarget"];
    }
}

export function ActionTarget_$reflection() {
    return union_type("AST.ActionTarget", [], ActionTarget, () => [[["Item", AssetReference_$reflection()]], [["Item", string_type]]]);
}

export class Action extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["Buy", "Sell", "BuyMax", "SellAll", "RebalanceTo"];
    }
}

export function Action_$reflection() {
    return union_type("AST.Action", [], Action, () => [[["Item1", Quantity_$reflection()], ["Item2", ActionTarget_$reflection()]], [["Item1", Quantity_$reflection()], ["Item2", ActionTarget_$reflection()]], [["Item", ActionTarget_$reflection()]], [["Item", ActionTarget_$reflection()]], [["Item1", float64_type], ["Item2", ActionTarget_$reflection()]]]);
}

export class Statement extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["DefineStatement", "SetStatement", "ActionStatement", "ConditionalStatement", "ForAnyPositionStatement"];
    }
}

export function Statement_$reflection() {
    return union_type("AST.Statement", [], Statement, () => [[["Item", DefineStmt_$reflection()]], [["Item", SetStmt_$reflection()]], [["Item", Action_$reflection()]], [["Item", ConditionalStmt_$reflection()]], [["Item", ForAnyPositionStmt_$reflection()]]]);
}

export class DefineStmt extends Record {
    constructor(Name, Value) {
        super();
        this.Name = Name;
        this.Value = Value;
    }
}

export function DefineStmt_$reflection() {
    return record_type("AST.DefineStmt", [], DefineStmt, () => [["Name", string_type], ["Value", DefinitionValue_$reflection()]]);
}

export class DefinitionValue extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["ExpressionValue", "PositionValue"];
    }
}

export function DefinitionValue_$reflection() {
    return union_type("AST.DefinitionValue", [], DefinitionValue, () => [[["Item", Expression_$reflection()]], [["Item", PositionExpression_$reflection()]]]);
}

export class SetStmt extends Record {
    constructor(Name, Value) {
        super();
        this.Name = Name;
        this.Value = Value;
    }
}

export function SetStmt_$reflection() {
    return record_type("AST.SetStmt", [], SetStmt, () => [["Name", string_type], ["Value", Expression_$reflection()]]);
}

export class ConditionalStmt extends Record {
    constructor(Condition, ThenBlock) {
        super();
        this.Condition = Condition;
        this.ThenBlock = ThenBlock;
    }
}

export function ConditionalStmt_$reflection() {
    return record_type("AST.ConditionalStmt", [], ConditionalStmt, () => [["Condition", Condition_$reflection()], ["ThenBlock", list_type(Statement_$reflection())]]);
}

export class ForAnyPositionStmt extends Record {
    constructor(PositionType, InstanceVariable, Block) {
        super();
        this.PositionType = PositionType;
        this.InstanceVariable = InstanceVariable;
        this.Block = Block;
    }
}

export function ForAnyPositionStmt_$reflection() {
    return record_type("AST.ForAnyPositionStmt", [], ForAnyPositionStmt, () => [["PositionType", string_type], ["InstanceVariable", string_type], ["Block", list_type(Statement_$reflection())]]);
}

export class Program extends Record {
    constructor(Statements) {
        super();
        this.Statements = Statements;
    }
}

export function Program_$reflection() {
    return record_type("AST.Program", [], Program, () => [["Statements", list_type(Statement_$reflection())]]);
}

