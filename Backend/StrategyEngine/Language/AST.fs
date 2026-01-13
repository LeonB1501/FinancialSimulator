module AST

[<StructuralEquality; NoComparison>]
type NumericLiteral =
    | Number of float | Percentage of float | Dollar of float

[<StructuralEquality; NoComparison>]
type BoolLiteral =
    | True | False

[<StructuralEquality; NoComparison>]
type Literal =
    | NumericLit of NumericLiteral | BoolLit of BoolLiteral

type Identifier = string

[<StructuralEquality; NoComparison>]
type AssetReference =
    | SimpleAsset of Identifier
    | LeveragedAsset of Identifier * float

[<StructuralEquality; NoComparison>]
type GreekType = Delta | Gamma | Theta | Vega | Rho

[<StructuralEquality; NoComparison>]
type OptionSpec = {
    Underlying: AssetReference
    DTE: int
    GreekType: GreekType
    GreekValue: float
}

[<StructuralEquality; NoComparison>]
type Instrument =
    | Asset of AssetReference | Option of OptionSpec

[<StructuralEquality; NoComparison>]
type IndicatorType = SMA | EMA | RSI | Vol | Return | PastPrice

[<StructuralEquality; NoComparison>]
type Indicator = {
    Asset: Identifier
    IndicatorType: IndicatorType
    Period: int option
}

[<StructuralEquality; NoComparison>]
type PortfolioQuery =
    | CashAvailable | PortfolioValue
    | PositionQuantity of Identifier | PositionValue of Identifier

[<StructuralEquality; NoComparison>]
type PropertyAccess = { Object: Expression; Property: Identifier }
and [<StructuralEquality; NoComparison>] ArithmeticOp = Add | Subtract | Multiply | Divide | Modulo
and [<StructuralEquality; NoComparison>] ComparisonOp = Greater | Less | GreaterEq | LessEq | Equal | NotEqual
and [<StructuralEquality; NoComparison>] LogicalOp = And | Or
and [<StructuralEquality; NoComparison>] Expression =
    | LiteralExpr of Literal
    | IdentifierExpr of Identifier
    | AssetExpr of AssetReference
    | OptionExpr of OptionSpec
    | PropertyAccessExpr of PropertyAccess
    | IndicatorExpr of Indicator
    | PortfolioQueryExpr of PortfolioQuery
    | ArithmeticExpr of ArithmeticOp * Expression * Expression
    | UnaryMinusExpr of Expression
    | ParenExpr of Expression
and [<StructuralEquality; NoComparison>] Condition =
    | ComparisonCond of ComparisonOp * Expression * Expression
    | LogicalCond of LogicalOp * Condition * Condition
    | NotCond of Condition
    | ParenCond of Condition
    | BooleanExpr of Expression

[<StructuralEquality; NoComparison>]
type Quantity =
    | LiteralQuantity of NumericLiteral
    | IdentifierQuantity of Identifier
    | ExpressionQuantity of Expression

[<StructuralEquality; NoComparison>]
type PositionComponent =
    | BuyComponent of Quantity * Instrument | SellComponent of Quantity * Instrument

[<StructuralEquality; NoComparison>]
type PositionExpression =
    | ComponentExpr of PositionComponent
    | CompoundExpr of PositionExpression * PositionExpression
    | PositionReference of Identifier

[<StructuralEquality; NoComparison>]
type ActionTarget =
    | AssetTarget of AssetReference
    | IdentifierTarget of Identifier

[<StructuralEquality; NoComparison>]
type Action =
    | Buy of Quantity * ActionTarget | Sell of Quantity * ActionTarget
    | BuyMax of ActionTarget | SellAll of ActionTarget
    | RebalanceTo of float * ActionTarget

[<StructuralEquality; NoComparison>]
type Statement =
    | DefineStatement of DefineStmt
    | SetStatement of SetStmt
    | ActionStatement of Action
    | ConditionalStatement of ConditionalStmt
    | ForAnyPositionStatement of ForAnyPositionStmt
and [<StructuralEquality; NoComparison>] DefineStmt = { Name: Identifier; Value: DefinitionValue }
and [<StructuralEquality; NoComparison>] DefinitionValue = ExpressionValue of Expression | PositionValue of PositionExpression
and [<StructuralEquality; NoComparison>] SetStmt = { Name: Identifier; Value: Expression }
and [<StructuralEquality; NoComparison>] ConditionalStmt = { Condition: Condition; ThenBlock: Statement list }
and [<StructuralEquality; NoComparison>] ForAnyPositionStmt = { PositionType: Identifier; InstanceVariable: Identifier; Block: Statement list }

[<StructuralEquality; NoComparison>]
type Program = {
    Statements: Statement list
}