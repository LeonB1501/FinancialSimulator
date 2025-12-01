import { Union, Record } from "../fable_modules/fable-library-js.4.27.0/Types.js";
import { union_type, float64_type, record_type, option_type, int32_type, string_type } from "../fable_modules/fable-library-js.4.27.0/Reflection.js";
import { OptionSpec_$reflection, AssetReference_$reflection } from "./AST.js";

export class IndicatorData extends Record {
    constructor(Asset, TypeName, Period) {
        super();
        this.Asset = Asset;
        this.TypeName = TypeName;
        this.Period = Period;
    }
}

export function IndicatorData_$reflection() {
    return record_type("Tokens.IndicatorData", [], IndicatorData, () => [["Asset", string_type], ["TypeName", string_type], ["Period", option_type(int32_type)]]);
}

export class Token extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["T_WHEN", "T_END", "T_FOR_ANY_POSITION", "T_AS", "T_BUY", "T_SELL", "T_BUY_MAX", "T_SELL_ALL", "T_REBALANCE_TO", "T_DEFINE", "T_SET", "T_TO", "T_TRUE", "T_FALSE", "T_T_BILLS", "T_AND", "T_OR", "T_NOT", "T_CASH_AVAILABLE", "T_PORTFOLIO_VALUE", "T_POSITION_QUANTITY", "T_POSITION_VALUE", "T_ASSET_REFERENCE", "T_OPTION_SPEC", "T_INDICATOR", "T_IDENTIFIER", "T_NUMBER", "T_PERCENTAGE", "T_DOLLAR", "T_PLUS", "T_MINUS", "T_MULTIPLY", "T_DIVIDE", "T_MODULO", "T_GREATER", "T_LESS", "T_GREATER_EQ", "T_LESS_EQ", "T_EQUAL", "T_NOT_EQUAL", "T_COLON", "T_DOT", "T_LPAREN", "T_RPAREN", "T_EOF"];
    }
}

export function Token_$reflection() {
    return union_type("Tokens.Token", [], Token, () => [[], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [["Item", AssetReference_$reflection()]], [["Item", OptionSpec_$reflection()]], [["Item", IndicatorData_$reflection()]], [["Item", string_type]], [["Item", float64_type]], [["Item", float64_type]], [["Item", float64_type]], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], []]);
}

