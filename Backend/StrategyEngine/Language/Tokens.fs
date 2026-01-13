module Tokens

open AST

[<StructuralEquality; NoComparison>]
type IndicatorData = {
    Asset: string
    TypeName: string
    Period: int option
}

[<StructuralEquality; NoComparison>]
type Token =
    | T_WHEN | T_END | T_FOR_ANY_POSITION | T_AS
    | T_BUY | T_SELL | T_BUY_MAX | T_SELL_ALL | T_REBALANCE_TO
    | T_DEFINE | T_SET | T_TO
    | T_TRUE | T_FALSE | T_T_BILLS
    | T_AND | T_OR | T_NOT
    | T_CASH_AVAILABLE | T_PORTFOLIO_VALUE
    | T_POSITION_QUANTITY | T_POSITION_VALUE
    
    | T_ASSET_REFERENCE of AssetReference
    | T_OPTION_SPEC of OptionSpec
    | T_INDICATOR of IndicatorData
    
    | T_IDENTIFIER of string
    
    | T_NUMBER of float
    | T_PERCENTAGE of float
    | T_DOLLAR of float
    
    | T_PLUS | T_MINUS | T_MULTIPLY | T_DIVIDE | T_MODULO
    | T_GREATER | T_LESS | T_GREATER_EQ | T_LESS_EQ | T_EQUAL | T_NOT_EQUAL
    | T_COLON | T_DOT | T_LPAREN | T_RPAREN
    
    | T_EOF