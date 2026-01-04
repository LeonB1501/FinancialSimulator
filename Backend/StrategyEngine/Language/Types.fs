// PATH: StrategyEngine/Language/Types.fs
module Types

open AST

[<StructuralEquality; NoComparison>]
type T_PositionInfo = {
    Name: Identifier
}

[<StructuralEquality; NoComparison>]
type T_Type =
    | T_Float
    | T_Percent
    | T_Dollar
    | T_Bool
    | T_Asset
    | T_Position of T_PositionInfo
    | T_Instance of T_PositionInfo
    | T_Unit
    | T_Error of string
