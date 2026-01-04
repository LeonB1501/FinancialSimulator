// PATH: StrategyEngine.Tests/ParserTests.fs
module ParserTests

open Xunit
open FsUnit.Xunit
open Tokens
open AST
open Parser

// --- Helper Functions ---

// Pretty-print AST for debugging
let rec prettyPrintExpression (expr: Expression) : string =
    match expr with
    | LiteralExpr(NumericLit(Number n)) -> $"Num({n})"
    | LiteralExpr(NumericLit(Percentage p)) -> $"Pct({p}%%)"
    | LiteralExpr(NumericLit(Dollar d)) -> $"${d}"
    | LiteralExpr(BoolLit(True)) -> "true"
    | LiteralExpr(BoolLit(False)) -> "false"
    | IdentifierExpr(id) -> $"Id({id})"
    | AssetExpr(SimpleAsset(a)) -> $"Asset({a})"
    | AssetExpr(LeveragedAsset(a, l)) -> $"Asset({a}_{l}x)"
    | OptionExpr(spec) -> $"Option({spec.Underlying}_{spec.DTE}dte)"
    | PropertyAccessExpr(pa) -> $"{prettyPrintExpression pa.Object}.{pa.Property}"
    | ArithmeticExpr(op, l, r) -> 
        let opStr = match op with Add -> "+" | Subtract -> "-" | Multiply -> "*" | Divide -> "/" | Modulo -> "%"
        $"({prettyPrintExpression l} {opStr} {prettyPrintExpression r})"
    | UnaryMinusExpr(e) -> $"-{prettyPrintExpression e}"
    | ParenExpr(e) -> $"({prettyPrintExpression e})"
    | IndicatorExpr(ind) -> $"{ind.Asset}_{ind.IndicatorType}"
    | PortfolioQueryExpr(q) -> $"Query({q})"

let rec prettyPrintCondition (cond: Condition) : string =
    match cond with
    | ComparisonCond(op, l, r) ->
        let opStr = match op with Greater -> ">" | Less -> "<" | GreaterEq -> ">=" | LessEq -> "<=" | Equal -> "==" | NotEqual -> "!="
        $"({prettyPrintExpression l} {opStr} {prettyPrintExpression r})"
    | LogicalCond(op, l, r) ->
        let opStr = match op with And -> "and" | Or -> "or"
        $"({prettyPrintCondition l} {opStr} {prettyPrintCondition r})"
    | NotCond(c) -> $"not({prettyPrintCondition c})"
    | ParenCond(c) -> $"({prettyPrintCondition c})"
    | BooleanExpr(e) -> prettyPrintExpression e

let rec prettyPrintStatement (stmt: Statement) : string =
    match stmt with
    | DefineStatement(def) -> $"define {def.Name} as ..."
    | SetStatement(set) -> $"set {set.Name} to ..."
    | ActionStatement(action) -> $"action: {action}"
    | ConditionalStatement(cond) -> $"when {prettyPrintCondition cond.Condition}: [{cond.ThenBlock.Length} stmts] end"
    | ForAnyPositionStatement(loop) -> $"for_any_position {loop.PositionType} as {loop.InstanceVariable}: [{loop.Block.Length} stmts] end"

let prettyPrintProgram (prog: Program) : string =
    let stmts = prog.Statements |> List.map prettyPrintStatement |> String.concat "\n  "
    $"Program:\n  {stmts}"

// Helper function to run the parser on a token list.
// This uses Parser.run which ensures all tokens are consumed.
let private runParser (tokens: Token list) : Program =
    try
        let result = Parser.run tokens
        printfn "✓ Parsed successfully:\n%s" (prettyPrintProgram result)
        result
    with
    | ParseError msg ->
        printfn "✗ Parse failed: %s" msg
        reraise()

// Helper for tests that expect parse errors
let private expectParseError (tokens: Token list) =
    try
        let result = Parser.run tokens
        printfn "✗ Expected ParseError but got:\n%s" (prettyPrintProgram result)
        failwith "Expected ParseError but parsing succeeded"
    with
    | ParseError msg ->
        printfn "✓ Got expected ParseError: %s" msg

type ParserSuite() =

    // --- Category: Basic Statements ---

    [<Fact>]
    member _.``PARSE-001 Simple Define statement should parse correctly``() =
        // DSL: define myVar as 123
        let tokens = [
            T_DEFINE
            T_IDENTIFIER "myVar"
            T_AS
            T_NUMBER 123.0
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "myVar"
                    Value = ExpressionValue(LiteralExpr(NumericLit(Number 123.0)))
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-004 Syntax Error from missing keyword should throw ParseError``() =
        // DSL: define x 10  (missing 'as')
        let tokens = [
            T_DEFINE
            T_IDENTIFIER "x"
            T_NUMBER 10.0
            T_EOF
        ]
        expectParseError tokens


    // --- Category: Expressions and Precedence ---

    [<Fact>]
    member _.``PARSE-005 Operator Precedence should be respected``() =
        // DSL: define result as 2 + 3 * 4
        let tokens = [
            T_DEFINE; T_IDENTIFIER "result"; T_AS;
            T_NUMBER 2.0; T_PLUS; T_NUMBER 3.0; T_MULTIPLY; T_NUMBER 4.0;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "result"
                    Value = ExpressionValue(
                        ArithmeticExpr(
                            Add,
                            LiteralExpr(NumericLit(Number 2.0)),
                            ArithmeticExpr(
                                Multiply,
                                LiteralExpr(NumericLit(Number 3.0)),
                                LiteralExpr(NumericLit(Number 4.0))
                            )
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-006 Parenthesis should override precedence``() =
        // DSL: define result as (2 + 3) * 4
        let tokens = [
            T_DEFINE; T_IDENTIFIER "result"; T_AS;
            T_LPAREN; T_NUMBER 2.0; T_PLUS; T_NUMBER 3.0; T_RPAREN;
            T_MULTIPLY; T_NUMBER 4.0;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "result"
                    Value = ExpressionValue(
                        ArithmeticExpr(
                            Multiply,
                            ParenExpr(
                                ArithmeticExpr(
                                    Add,
                                    LiteralExpr(NumericLit(Number 2.0)),
                                    LiteralExpr(NumericLit(Number 3.0))
                                )
                            ),
                            LiteralExpr(NumericLit(Number 4.0))
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-007 Left Associativity should be handled correctly``() =
        // DSL: define result as 10 - 5 - 2
        let tokens = [
            T_DEFINE; T_IDENTIFIER "result"; T_AS;
            T_NUMBER 10.0; T_MINUS; T_NUMBER 5.0; T_MINUS; T_NUMBER 2.0;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "result"
                    Value = ExpressionValue(
                        ArithmeticExpr(
                            Subtract,
                            ArithmeticExpr(
                                Subtract,
                                LiteralExpr(NumericLit(Number 10.0)),
                                LiteralExpr(NumericLit(Number 5.0))
                            ),
                            LiteralExpr(NumericLit(Number 2.0))
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    // --- Category: Conditions and Blocks ---

    [<Fact>]
    member _.``PARSE-009 Simple 'when' block with Asset in expression should parse``() =
        // DSL: when spy > 200: buy 100 spy end
        let tokens = [
            T_WHEN; T_ASSET_REFERENCE(SimpleAsset "spy"); T_GREATER; T_NUMBER 200.0; T_COLON;
            T_BUY; T_NUMBER 100.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ConditionalStatement {
                    Condition = ComparisonCond(
                        Greater,
                        AssetExpr(SimpleAsset "spy"),
                        LiteralExpr(NumericLit(Number 200.0))
                    )
                    ThenBlock = [
                        ActionStatement(
                            Buy(
                                LiteralQuantity(Number 100.0),
                                AssetTarget(SimpleAsset "spy")
                            )
                        )
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-012 Unclosed block should throw ParseError``() =
        // DSL: when true: buy 100 spy (missing 'end')
        let tokens = [
            T_WHEN; T_TRUE; T_COLON;
            T_BUY; T_NUMBER 100.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_EOF // EOF appears before END
        ]
        expectParseError tokens

    // --- Category: for_any_position Loops ---

    [<Fact>]
    member _.``PARSE-014 Property access in a loop should parse with explicit quantity``() =
        // DSL: for_any_position my_spread as cs: when cs.dte < 10: sell 1 cs end end
        let tokens = [
            T_FOR_ANY_POSITION; T_IDENTIFIER "my_spread"; T_AS; T_IDENTIFIER "cs"; T_COLON;
            T_WHEN; T_IDENTIFIER "cs"; T_DOT; T_IDENTIFIER "dte"; T_LESS; T_NUMBER 10.0; T_COLON;
            T_SELL; T_NUMBER 1.0; T_IDENTIFIER "cs";
            T_END;
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ForAnyPositionStatement {
                    PositionType = "my_spread"
                    InstanceVariable = "cs"
                    Block = [
                        ConditionalStatement {
                            Condition = ComparisonCond(
                                Less,
                                PropertyAccessExpr {
                                    Object = IdentifierExpr "cs"
                                    Property = "dte"
                                },
                                LiteralExpr(NumericLit(Number 10.0))
                            )
                            ThenBlock = [
                                ActionStatement(
                                    Sell(
                                        LiteralQuantity(Number 1.0),
                                        IdentifierTarget("cs")
                                    )
                                )
                            ]
                        }
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst
    
    // --- Category 1: Property Access Tests ---

    [<Fact>]
    member _.``PARSE-101 Single-level property access should parse``() =
        // DSL: define x as obj.prop
        let tokens = [
            T_DEFINE; T_IDENTIFIER "x"; T_AS;
            T_IDENTIFIER "obj"; T_DOT; T_IDENTIFIER "prop";
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "x"
                    Value = ExpressionValue(
                        PropertyAccessExpr {
                            Object = IdentifierExpr "obj"
                            Property = "prop"
                        }
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-102 Deep property chain should parse correctly``() =
        // DSL: define x as position.underlying.price.last
        let tokens = [
            T_DEFINE; T_IDENTIFIER "x"; T_AS;
            T_IDENTIFIER "position"; T_DOT; T_IDENTIFIER "underlying";
            T_DOT; T_IDENTIFIER "price"; T_DOT; T_IDENTIFIER "last";
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "x"
                    Value = ExpressionValue(
                        PropertyAccessExpr {
                            Object = PropertyAccessExpr {
                                Object = PropertyAccessExpr {
                                    Object = IdentifierExpr "position"
                                    Property = "underlying"
                                }
                                Property = "price"
                            }
                            Property = "last"
                        }
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-103 Property access in arithmetic expression should parse``() =
        // DSL: define x as obj.price * 2 + obj.quantity
        let tokens = [
            T_DEFINE; T_IDENTIFIER "x"; T_AS;
            T_IDENTIFIER "obj"; T_DOT; T_IDENTIFIER "price";
            T_MULTIPLY; T_NUMBER 2.0;
            T_PLUS;
            T_IDENTIFIER "obj"; T_DOT; T_IDENTIFIER "quantity";
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "x"
                    Value = ExpressionValue(
                        ArithmeticExpr(
                            Add,
                            ArithmeticExpr(
                                Multiply,
                                PropertyAccessExpr {
                                    Object = IdentifierExpr "obj"
                                    Property = "price"
                                },
                                LiteralExpr(NumericLit(Number 2.0))
                            ),
                            PropertyAccessExpr {
                                Object = IdentifierExpr "obj"
                                Property = "quantity"
                            }
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-104 Property access in conditions with multiple operators should parse``() =
        // DSL: when position.dte < 30 and position.delta > 0.5: buy 100 spy end
        let tokens = [
            T_WHEN;
            T_IDENTIFIER "position"; T_DOT; T_IDENTIFIER "dte";
            T_LESS; T_NUMBER 30.0;
            T_AND;
            T_IDENTIFIER "position"; T_DOT; T_IDENTIFIER "delta";
            T_GREATER; T_NUMBER 0.5;
            T_COLON;
            T_BUY; T_NUMBER 100.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ConditionalStatement {
                    Condition = LogicalCond(
                        And,
                        ComparisonCond(
                            Less,
                            PropertyAccessExpr {
                                Object = IdentifierExpr "position"
                                Property = "dte"
                            },
                            LiteralExpr(NumericLit(Number 30.0))
                        ),
                        ComparisonCond(
                            Greater,
                            PropertyAccessExpr {
                                Object = IdentifierExpr "position"
                                Property = "delta"
                            },
                            LiteralExpr(NumericLit(Number 0.5))
                        )
                    )
                    ThenBlock = [
                        ActionStatement(
                            Buy(
                                LiteralQuantity(Number 100.0),
                                AssetTarget(SimpleAsset "spy")
                            )
                        )
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-105 Property access on both sides of comparison should parse``() =
        // DSL: when pos1.value > pos2.value: sell_all spy end
        let tokens = [
            T_WHEN;
            T_IDENTIFIER "pos1"; T_DOT; T_IDENTIFIER "value";
            T_GREATER;
            T_IDENTIFIER "pos2"; T_DOT; T_IDENTIFIER "value";
            T_COLON;
            T_SELL_ALL; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ConditionalStatement {
                    Condition = ComparisonCond(
                        Greater,
                        PropertyAccessExpr {
                            Object = IdentifierExpr "pos1"
                            Property = "value"
                        },
                        PropertyAccessExpr {
                            Object = IdentifierExpr "pos2"
                            Property = "value"
                        }
                    )
                    ThenBlock = [
                        ActionStatement(
                            SellAll(AssetTarget(SimpleAsset "spy"))
                        )
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-106 Property access after parentheses should parse``() =
        // DSL: define x as (myObj).prop.subprop
        let tokens = [
            T_DEFINE; T_IDENTIFIER "x"; T_AS;
            T_LPAREN; T_IDENTIFIER "myObj"; T_RPAREN;
            T_DOT; T_IDENTIFIER "prop";
            T_DOT; T_IDENTIFIER "subprop";
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "x"
                    Value = ExpressionValue(
                        PropertyAccessExpr {
                            Object = PropertyAccessExpr {
                                Object = ParenExpr(IdentifierExpr "myObj")
                                Property = "prop"
                            }
                            Property = "subprop"
                        }
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst
       
       
       // --- Category 2: Operator Precedence & Associativity Tests ---

    [<Fact>]
    member _.``PARSE-201 Mixed precedence chain should parse correctly``() =
        // DSL: define x as 2 + 3 * 4 - 5 / 2
        let tokens = [
            T_DEFINE; T_IDENTIFIER "x"; T_AS;
            T_NUMBER 2.0; T_PLUS; T_NUMBER 3.0; T_MULTIPLY; T_NUMBER 4.0;
            T_MINUS; T_NUMBER 5.0; T_DIVIDE; T_NUMBER 2.0;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "x"
                    Value = ExpressionValue(
                        ArithmeticExpr(
                            Subtract,
                            ArithmeticExpr(
                                Add,
                                LiteralExpr(NumericLit(Number 2.0)),
                                ArithmeticExpr(
                                    Multiply,
                                    LiteralExpr(NumericLit(Number 3.0)),
                                    LiteralExpr(NumericLit(Number 4.0))
                                )
                            ),
                            ArithmeticExpr(
                                Divide,
                                LiteralExpr(NumericLit(Number 5.0)),
                                LiteralExpr(NumericLit(Number 2.0))
                            )
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-202 Unary minus with multiplication should parse correctly``() =
        // DSL: define x as -5 * 3
        let tokens = [
            T_DEFINE; T_IDENTIFIER "x"; T_AS;
            T_MINUS; T_NUMBER 5.0; T_MULTIPLY; T_NUMBER 3.0;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "x"
                    Value = ExpressionValue(
                        ArithmeticExpr(
                            Multiply,
                            UnaryMinusExpr(LiteralExpr(NumericLit(Number 5.0))),
                            LiteralExpr(NumericLit(Number 3.0))
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-203 Unary minus in middle of expression should parse correctly``() =
        // DSL: define x as 2 + -3
        let tokens = [
            T_DEFINE; T_IDENTIFIER "x"; T_AS;
            T_NUMBER 2.0; T_PLUS; T_MINUS; T_NUMBER 3.0;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "x"
                    Value = ExpressionValue(
                        ArithmeticExpr(
                            Add,
                            LiteralExpr(NumericLit(Number 2.0)),
                            UnaryMinusExpr(LiteralExpr(NumericLit(Number 3.0)))
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-204 Deep parenthesis nesting should parse correctly``() =
        // DSL: define x as ((2 + 3) * (4 - 1)) / 5
        let tokens = [
            T_DEFINE; T_IDENTIFIER "x"; T_AS;
            T_LPAREN; T_LPAREN; T_NUMBER 2.0; T_PLUS; T_NUMBER 3.0; T_RPAREN;
            T_MULTIPLY;
            T_LPAREN; T_NUMBER 4.0; T_MINUS; T_NUMBER 1.0; T_RPAREN; T_RPAREN;
            T_DIVIDE; T_NUMBER 5.0;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "x"
                    Value = ExpressionValue(
                        ArithmeticExpr(
                            Divide,
                            ParenExpr(
                                ArithmeticExpr(
                                    Multiply,
                                    ParenExpr(
                                        ArithmeticExpr(
                                            Add,
                                            LiteralExpr(NumericLit(Number 2.0)),
                                            LiteralExpr(NumericLit(Number 3.0))
                                        )
                                    ),
                                    ParenExpr(
                                        ArithmeticExpr(
                                            Subtract,
                                            LiteralExpr(NumericLit(Number 4.0)),
                                            LiteralExpr(NumericLit(Number 1.0))
                                        )
                                    )
                                )
                            ),
                            LiteralExpr(NumericLit(Number 5.0))
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-205 Modulo with other operators should parse correctly``() =
        // DSL: define x as 10 % 3 + 5 * 2
        let tokens = [
            T_DEFINE; T_IDENTIFIER "x"; T_AS;
            T_NUMBER 10.0; T_MODULO; T_NUMBER 3.0;
            T_PLUS; T_NUMBER 5.0; T_MULTIPLY; T_NUMBER 2.0;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "x"
                    Value = ExpressionValue(
                        ArithmeticExpr(
                            Add,
                            ArithmeticExpr(
                                Modulo,
                                LiteralExpr(NumericLit(Number 10.0)),
                                LiteralExpr(NumericLit(Number 3.0))
                            ),
                            ArithmeticExpr(
                                Multiply,
                                LiteralExpr(NumericLit(Number 5.0)),
                                LiteralExpr(NumericLit(Number 2.0))
                            )
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-206 Long left-associative chain should parse correctly``() =
        // DSL: define x as 1 + 2 + 3 + 4 + 5 + 6
        let tokens = [
            T_DEFINE; T_IDENTIFIER "x"; T_AS;
            T_NUMBER 1.0; T_PLUS; T_NUMBER 2.0; T_PLUS; T_NUMBER 3.0;
            T_PLUS; T_NUMBER 4.0; T_PLUS; T_NUMBER 5.0; T_PLUS; T_NUMBER 6.0;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "x"
                    Value = ExpressionValue(
                        ArithmeticExpr(
                            Add,
                            ArithmeticExpr(
                                Add,
                                ArithmeticExpr(
                                    Add,
                                    ArithmeticExpr(
                                        Add,
                                        ArithmeticExpr(
                                            Add,
                                            LiteralExpr(NumericLit(Number 1.0)),
                                            LiteralExpr(NumericLit(Number 2.0))
                                        ),
                                        LiteralExpr(NumericLit(Number 3.0))
                                    ),
                                    LiteralExpr(NumericLit(Number 4.0))
                                ),
                                LiteralExpr(NumericLit(Number 5.0))
                            ),
                            LiteralExpr(NumericLit(Number 6.0))
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-207 Division chain should be left-associative``() =
        // DSL: define x as 100 / 5 / 2
        // Should parse as (100 / 5) / 2 = 10, not 100 / (5 / 2) = 40
        let tokens = [
            T_DEFINE; T_IDENTIFIER "x"; T_AS;
            T_NUMBER 100.0; T_DIVIDE; T_NUMBER 5.0; T_DIVIDE; T_NUMBER 2.0;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "x"
                    Value = ExpressionValue(
                        ArithmeticExpr(
                            Divide,
                            ArithmeticExpr(
                                Divide,
                                LiteralExpr(NumericLit(Number 100.0)),
                                LiteralExpr(NumericLit(Number 5.0))
                            ),
                            LiteralExpr(NumericLit(Number 2.0))
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst
        
        // --- Category 3: Condition Complexity Tests ---
        
    [<Fact>]
    member _.``PARSE-301 Triple AND chain should parse correctly``() =
        // DSL: when a > 10 and b < 20 and c == 15: buy 100 spy end
        let tokens = [
            T_WHEN;
            T_IDENTIFIER "a"; T_GREATER; T_NUMBER 10.0;
            T_AND;
            T_IDENTIFIER "b"; T_LESS; T_NUMBER 20.0;
            T_AND;
            T_IDENTIFIER "c"; T_EQUAL; T_NUMBER 15.0;
            T_COLON;
            T_BUY; T_NUMBER 100.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ConditionalStatement {
                    Condition = LogicalCond(
                        And,
                        LogicalCond(
                            And,
                            ComparisonCond(
                                Greater,
                                IdentifierExpr "a",
                                LiteralExpr(NumericLit(Number 10.0))
                            ),
                            ComparisonCond(
                                Less,
                                IdentifierExpr "b",
                                LiteralExpr(NumericLit(Number 20.0))
                            )
                        ),
                        ComparisonCond(
                            Equal,
                            IdentifierExpr "c",
                            LiteralExpr(NumericLit(Number 15.0))
                        )
                    )
                    ThenBlock = [
                        ActionStatement(
                            Buy(
                                LiteralQuantity(Number 100.0),
                                AssetTarget(SimpleAsset "spy")
                            )
                        )
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-302 Triple OR chain should parse correctly``() =
        // DSL: when a > 10 or b > 10 or c > 10: sell_all spy end
        let tokens = [
            T_WHEN;
            T_IDENTIFIER "a"; T_GREATER; T_NUMBER 10.0;
            T_OR;
            T_IDENTIFIER "b"; T_GREATER; T_NUMBER 10.0;
            T_OR;
            T_IDENTIFIER "c"; T_GREATER; T_NUMBER 10.0;
            T_COLON;
            T_SELL_ALL; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ConditionalStatement {
                    Condition = LogicalCond(
                        Or,
                        LogicalCond(
                            Or,
                            ComparisonCond(
                                Greater,
                                IdentifierExpr "a",
                                LiteralExpr(NumericLit(Number 10.0))
                            ),
                            ComparisonCond(
                                Greater,
                                IdentifierExpr "b",
                                LiteralExpr(NumericLit(Number 10.0))
                            )
                        ),
                        ComparisonCond(
                            Greater,
                            IdentifierExpr "c",
                            LiteralExpr(NumericLit(Number 10.0))
                        )
                    )
                    ThenBlock = [
                        ActionStatement(
                            SellAll(AssetTarget(SimpleAsset "spy"))
                        )
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-303 Mixed AND-OR should respect precedence``() =
        // DSL: when a > 10 or b > 20 and c < 5: buy 100 spy end
        // AND should bind tighter than OR, so: a > 10 or (b > 20 and c < 5)
        let tokens = [
            T_WHEN;
            T_IDENTIFIER "a"; T_GREATER; T_NUMBER 10.0;
            T_OR;
            T_IDENTIFIER "b"; T_GREATER; T_NUMBER 20.0;
            T_AND;
            T_IDENTIFIER "c"; T_LESS; T_NUMBER 5.0;
            T_COLON;
            T_BUY; T_NUMBER 100.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ConditionalStatement {
                    Condition = LogicalCond(
                        Or,
                        ComparisonCond(
                            Greater,
                            IdentifierExpr "a",
                            LiteralExpr(NumericLit(Number 10.0))
                        ),
                        LogicalCond(
                            And,
                            ComparisonCond(
                                Greater,
                                IdentifierExpr "b",
                                LiteralExpr(NumericLit(Number 20.0))
                            ),
                            ComparisonCond(
                                Less,
                                IdentifierExpr "c",
                                LiteralExpr(NumericLit(Number 5.0))
                            )
                        )
                    )
                    ThenBlock = [
                        ActionStatement(
                            Buy(
                                LiteralQuantity(Number 100.0),
                                AssetTarget(SimpleAsset "spy")
                            )
                        )
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-304 Parenthesized logic should override precedence``() =
        // DSL: when (a > 10 or b > 20) and c < 5: buy 100 spy end
        let tokens = [
            T_WHEN;
            T_LPAREN;
            T_IDENTIFIER "a"; T_GREATER; T_NUMBER 10.0;
            T_OR;
            T_IDENTIFIER "b"; T_GREATER; T_NUMBER 20.0;
            T_RPAREN;
            T_AND;
            T_IDENTIFIER "c"; T_LESS; T_NUMBER 5.0;
            T_COLON;
            T_BUY; T_NUMBER 100.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ConditionalStatement {
                    Condition = LogicalCond(
                        And,
                        ParenCond(
                            LogicalCond(
                                Or,
                                ComparisonCond(
                                    Greater,
                                    IdentifierExpr "a",
                                    LiteralExpr(NumericLit(Number 10.0))
                                ),
                                ComparisonCond(
                                    Greater,
                                    IdentifierExpr "b",
                                    LiteralExpr(NumericLit(Number 20.0))
                                )
                            )
                        ),
                        ComparisonCond(
                            Less,
                            IdentifierExpr "c",
                            LiteralExpr(NumericLit(Number 5.0))
                        )
                    )
                    ThenBlock = [
                        ActionStatement(
                            Buy(
                                LiteralQuantity(Number 100.0),
                                AssetTarget(SimpleAsset "spy")
                            )
                        )
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-305 Double NOT should parse correctly``() =
        // DSL: when not not true: buy 100 spy end
        let tokens = [
            T_WHEN;
            T_NOT; T_NOT; T_TRUE;
            T_COLON;
            T_BUY; T_NUMBER 100.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ConditionalStatement {
                    Condition = NotCond(
                        NotCond(
                            BooleanExpr(LiteralExpr(BoolLit True))
                        )
                    )
                    ThenBlock = [
                        ActionStatement(
                            Buy(
                                LiteralQuantity(Number 100.0),
                                AssetTarget(SimpleAsset "spy")
                            )
                        )
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-306 NOT with AND should respect precedence``() =
        // DSL: when not a > 10 and b < 5: buy 100 spy end
        // Should parse as: (not (a > 10)) and (b < 5)
        let tokens = [
            T_WHEN;
            T_NOT; T_IDENTIFIER "a"; T_GREATER; T_NUMBER 10.0;
            T_AND;
            T_IDENTIFIER "b"; T_LESS; T_NUMBER 5.0;
            T_COLON;
            T_BUY; T_NUMBER 100.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ConditionalStatement {
                    Condition = LogicalCond(
                        And,
                        NotCond(
                            ComparisonCond(
                                Greater,
                                IdentifierExpr "a",
                                LiteralExpr(NumericLit(Number 10.0))
                            )
                        ),
                        ComparisonCond(
                            Less,
                            IdentifierExpr "b",
                            LiteralExpr(NumericLit(Number 5.0))
                        )
                    )
                    ThenBlock = [
                        ActionStatement(
                            Buy(
                                LiteralQuantity(Number 100.0),
                                AssetTarget(SimpleAsset "spy")
                            )
                        )
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-307 Complex nested logic should parse correctly``() =
        // DSL: when (a > 10 and b < 20) or (c > 30 and not d == 5): sell_all spy end
        let tokens = [
            T_WHEN;
            T_LPAREN;
            T_IDENTIFIER "a"; T_GREATER; T_NUMBER 10.0;
            T_AND;
            T_IDENTIFIER "b"; T_LESS; T_NUMBER 20.0;
            T_RPAREN;
            T_OR;
            T_LPAREN;
            T_IDENTIFIER "c"; T_GREATER; T_NUMBER 30.0;
            T_AND;
            T_NOT; T_IDENTIFIER "d"; T_EQUAL; T_NUMBER 5.0;
            T_RPAREN;
            T_COLON;
            T_SELL_ALL; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ConditionalStatement {
                    Condition = LogicalCond(
                        Or,
                        ParenCond(
                            LogicalCond(
                                And,
                                ComparisonCond(
                                    Greater,
                                    IdentifierExpr "a",
                                    LiteralExpr(NumericLit(Number 10.0))
                                ),
                                ComparisonCond(
                                    Less,
                                    IdentifierExpr "b",
                                    LiteralExpr(NumericLit(Number 20.0))
                                )
                            )
                        ),
                        ParenCond(
                            LogicalCond(
                                And,
                                ComparisonCond(
                                    Greater,
                                    IdentifierExpr "c",
                                    LiteralExpr(NumericLit(Number 30.0))
                                ),
                                NotCond(
                                    ComparisonCond(
                                        Equal,
                                        IdentifierExpr "d",
                                        LiteralExpr(NumericLit(Number 5.0))
                                    )
                                )
                            )
                        )
                    )
                    ThenBlock = [
                        ActionStatement(
                            SellAll(AssetTarget(SimpleAsset "spy"))
                        )
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-308 All comparison operators in one condition should parse``() =
        // DSL: when a > 1 and b < 2 and c >= 3 and d <= 4 and e == 5 and f != 6: buy 100 spy end
        let tokens = [
            T_WHEN;
            T_IDENTIFIER "a"; T_GREATER; T_NUMBER 1.0;
            T_AND;
            T_IDENTIFIER "b"; T_LESS; T_NUMBER 2.0;
            T_AND;
            T_IDENTIFIER "c"; T_GREATER_EQ; T_NUMBER 3.0;
            T_AND;
            T_IDENTIFIER "d"; T_LESS_EQ; T_NUMBER 4.0;
            T_AND;
            T_IDENTIFIER "e"; T_EQUAL; T_NUMBER 5.0;
            T_AND;
            T_IDENTIFIER "f"; T_NOT_EQUAL; T_NUMBER 6.0;
            T_COLON;
            T_BUY; T_NUMBER 100.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ConditionalStatement {
                    Condition = LogicalCond(
                        And,
                        LogicalCond(
                            And,
                            LogicalCond(
                                And,
                                LogicalCond(
                                    And,
                                    LogicalCond(
                                        And,
                                        ComparisonCond(Greater, IdentifierExpr "a", LiteralExpr(NumericLit(Number 1.0))),
                                        ComparisonCond(Less, IdentifierExpr "b", LiteralExpr(NumericLit(Number 2.0)))
                                    ),
                                    ComparisonCond(GreaterEq, IdentifierExpr "c", LiteralExpr(NumericLit(Number 3.0)))
                                ),
                                ComparisonCond(LessEq, IdentifierExpr "d", LiteralExpr(NumericLit(Number 4.0)))
                            ),
                            ComparisonCond(Equal, IdentifierExpr "e", LiteralExpr(NumericLit(Number 5.0)))
                        ),
                        ComparisonCond(NotEqual, IdentifierExpr "f", LiteralExpr(NumericLit(Number 6.0)))
                    )
                    ThenBlock = [
                        ActionStatement(
                            Buy(
                                LiteralQuantity(Number 100.0),
                                AssetTarget(SimpleAsset "spy")
                            )
                        )
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-309 Comparison with complex expressions on both sides should parse``() =
        // DSL: when spy * 1.1 > qqq + 50: buy_max spy end
        let tokens = [
            T_WHEN;
            T_ASSET_REFERENCE(SimpleAsset "spy"); T_MULTIPLY; T_NUMBER 1.1;
            T_GREATER;
            T_ASSET_REFERENCE(SimpleAsset "qqq"); T_PLUS; T_NUMBER 50.0;
            T_COLON;
            T_BUY_MAX; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ConditionalStatement {
                    Condition = ComparisonCond(
                        Greater,
                        ArithmeticExpr(
                            Multiply,
                            AssetExpr(SimpleAsset "spy"),
                            LiteralExpr(NumericLit(Number 1.1))
                        ),
                        ArithmeticExpr(
                            Add,
                            AssetExpr(SimpleAsset "qqq"),
                            LiteralExpr(NumericLit(Number 50.0))
                        )
                    )
                    ThenBlock = [
                        ActionStatement(
                            BuyMax(AssetTarget(SimpleAsset "spy"))
                        )
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst
        
    // --- Category 4: Nested Blocks Tests ---

    [<Fact>]
    member _.``PARSE-401 When inside when should parse correctly``() =
        // DSL: when a > 10: when b > 20: buy 100 spy end end
        let tokens = [
            T_WHEN; T_IDENTIFIER "a"; T_GREATER; T_NUMBER 10.0; T_COLON;
            T_WHEN; T_IDENTIFIER "b"; T_GREATER; T_NUMBER 20.0; T_COLON;
            T_BUY; T_NUMBER 100.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ConditionalStatement {
                    Condition = ComparisonCond(
                        Greater,
                        IdentifierExpr "a",
                        LiteralExpr(NumericLit(Number 10.0))
                    )
                    ThenBlock = [
                        ConditionalStatement {
                            Condition = ComparisonCond(
                                Greater,
                                IdentifierExpr "b",
                                LiteralExpr(NumericLit(Number 20.0))
                            )
                            ThenBlock = [
                                ActionStatement(
                                    Buy(
                                        LiteralQuantity(Number 100.0),
                                        AssetTarget(SimpleAsset "spy")
                                    )
                                )
                            ]
                        }
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-402 Triple nested when should parse correctly``() =
        // DSL: when a: when b: when c: sell_all spy end end end
        let tokens = [
            T_WHEN; T_IDENTIFIER "a"; T_COLON;
            T_WHEN; T_IDENTIFIER "b"; T_COLON;
            T_WHEN; T_IDENTIFIER "c"; T_COLON;
            T_SELL_ALL; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_END;
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ConditionalStatement {
                    Condition = BooleanExpr(IdentifierExpr "a")
                    ThenBlock = [
                        ConditionalStatement {
                            Condition = BooleanExpr(IdentifierExpr "b")
                            ThenBlock = [
                                ConditionalStatement {
                                    Condition = BooleanExpr(IdentifierExpr "c")
                                    ThenBlock = [
                                        ActionStatement(
                                            SellAll(AssetTarget(SimpleAsset "spy"))
                                        )
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-403 For inside when should parse correctly``() =
        // DSL: when spy > 200: for_any_position spreads as s: sell 1 s end end
        let tokens = [
            T_WHEN; T_ASSET_REFERENCE(SimpleAsset "spy"); T_GREATER; T_NUMBER 200.0; T_COLON;
            T_FOR_ANY_POSITION; T_IDENTIFIER "spreads"; T_AS; T_IDENTIFIER "s"; T_COLON;
            T_SELL; T_NUMBER 1.0; T_IDENTIFIER "s";
            T_END;
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ConditionalStatement {
                    Condition = ComparisonCond(
                        Greater,
                        AssetExpr(SimpleAsset "spy"),
                        LiteralExpr(NumericLit(Number 200.0))
                    )
                    ThenBlock = [
                        ForAnyPositionStatement {
                            PositionType = "spreads"
                            InstanceVariable = "s"
                            Block = [
                                ActionStatement(
                                    Sell(
                                        LiteralQuantity(Number 1.0),
                                        IdentifierTarget "s"
                                    )
                                )
                            ]
                        }
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-404 When inside for should parse correctly``() =
        // DSL: for_any_position spreads as s: when s.dte < 10: sell 1 s end end
        let tokens = [
            T_FOR_ANY_POSITION; T_IDENTIFIER "spreads"; T_AS; T_IDENTIFIER "s"; T_COLON;
            T_WHEN; T_IDENTIFIER "s"; T_DOT; T_IDENTIFIER "dte"; T_LESS; T_NUMBER 10.0; T_COLON;
            T_SELL; T_NUMBER 1.0; T_IDENTIFIER "s";
            T_END;
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ForAnyPositionStatement {
                    PositionType = "spreads"
                    InstanceVariable = "s"
                    Block = [
                        ConditionalStatement {
                            Condition = ComparisonCond(
                                Less,
                                PropertyAccessExpr {
                                    Object = IdentifierExpr "s"
                                    Property = "dte"
                                },
                                LiteralExpr(NumericLit(Number 10.0))
                            )
                            ThenBlock = [
                                ActionStatement(
                                    Sell(
                                        LiteralQuantity(Number 1.0),
                                        IdentifierTarget "s"
                                    )
                                )
                            ]
                        }
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-405 Multiple statements in block should parse correctly``() =
        // DSL: when spy > 200: buy 100 spy; sell 50 qqq; set x to 10; define y as x * 2 end
        let tokens = [
            T_WHEN; T_ASSET_REFERENCE(SimpleAsset "spy"); T_GREATER; T_NUMBER 200.0; T_COLON;
            T_BUY; T_NUMBER 100.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_SELL; T_NUMBER 50.0; T_ASSET_REFERENCE(SimpleAsset "qqq");
            T_SET; T_IDENTIFIER "x"; T_TO; T_NUMBER 10.0;
            T_DEFINE; T_IDENTIFIER "y"; T_AS; T_IDENTIFIER "x"; T_MULTIPLY; T_NUMBER 2.0;
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ConditionalStatement {
                    Condition = ComparisonCond(
                        Greater,
                        AssetExpr(SimpleAsset "spy"),
                        LiteralExpr(NumericLit(Number 200.0))
                    )
                    ThenBlock = [
                        ActionStatement(
                            Buy(
                                LiteralQuantity(Number 100.0),
                                AssetTarget(SimpleAsset "spy")
                            )
                        )
                        ActionStatement(
                            Sell(
                                LiteralQuantity(Number 50.0),
                                AssetTarget(SimpleAsset "qqq")
                            )
                        )
                        SetStatement {
                            Name = "x"
                            Value = LiteralExpr(NumericLit(Number 10.0))
                        }
                        DefineStatement {
                            Name = "y"
                            Value = ExpressionValue(
                                ArithmeticExpr(
                                    Multiply,
                                    IdentifierExpr "x",
                                    LiteralExpr(NumericLit(Number 2.0))
                                )
                            )
                        }
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-406 Empty block should parse correctly``() =
        // DSL: when true: end
        let tokens = [
            T_WHEN; T_TRUE; T_COLON;
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ConditionalStatement {
                    Condition = BooleanExpr(LiteralExpr(BoolLit True))
                    ThenBlock = []
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst
        
    // --- Category 5: Position Expressions Tests ---

    [<Fact>]
    member _.``PARSE-502 Buy-sell compound position should parse correctly``() =
        // DSL: define spread as buy 1 spy_30dte_delta_0.3 and sell 1 spy_60dte_delta_0.5
        let tokens = [
            T_DEFINE; T_IDENTIFIER "spread"; T_AS;
            T_BUY; T_NUMBER 1.0; 
            T_OPTION_SPEC {
                Underlying = SimpleAsset "spy"
                DTE = 30
                GreekType = Delta
                GreekValue = 0.3
            };
            T_AND;
            T_SELL; T_NUMBER 1.0;
            T_OPTION_SPEC {
                Underlying = SimpleAsset "spy"
                DTE = 60
                GreekType = Delta
                GreekValue = 0.5
            };
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "spread"
                    Value = PositionValue(
                        CompoundExpr(
                            ComponentExpr(
                                BuyComponent(
                                    LiteralQuantity(Number 1.0),
                                    Option {
                                        Underlying = SimpleAsset "spy"
                                        DTE = 30
                                        GreekType = Delta
                                        GreekValue = 0.3
                                    }
                                )
                            ),
                            ComponentExpr(
                                SellComponent(
                                    LiteralQuantity(Number 1.0),
                                    Option {
                                        Underlying = SimpleAsset "spy"
                                        DTE = 60
                                        GreekType = Delta
                                        GreekValue = 0.5
                                    }
                                )
                            )
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-503 Triple component position should parse correctly``() =
        // DSL: define iron_condor as buy 1 opt1 and sell 2 opt2 and buy 1 opt3
        let tokens = [
            T_DEFINE; T_IDENTIFIER "iron_condor"; T_AS;
            T_BUY; T_NUMBER 1.0;
            T_OPTION_SPEC {
                Underlying = SimpleAsset "spy"
                DTE = 30
                GreekType = Delta
                GreekValue = 0.2
            };
            T_AND;
            T_SELL; T_NUMBER 2.0;
            T_OPTION_SPEC {
                Underlying = SimpleAsset "spy"
                DTE = 30
                GreekType = Delta
                GreekValue = 0.3
            };
            T_AND;
            T_BUY; T_NUMBER 1.0;
            T_OPTION_SPEC {
                Underlying = SimpleAsset "spy"
                DTE = 30
                GreekType = Delta
                GreekValue = 0.4
            };
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "iron_condor"
                    Value = PositionValue(
                        CompoundExpr(
                            CompoundExpr(
                                ComponentExpr(
                                    BuyComponent(
                                        LiteralQuantity(Number 1.0),
                                        Option {
                                            Underlying = SimpleAsset "spy"
                                            DTE = 30
                                            GreekType = Delta
                                            GreekValue = 0.2
                                        }
                                    )
                                ),
                                ComponentExpr(
                                    SellComponent(
                                        LiteralQuantity(Number 2.0),
                                        Option {
                                            Underlying = SimpleAsset "spy"
                                            DTE = 30
                                            GreekType = Delta
                                            GreekValue = 0.3
                                        }
                                    )
                                )
                            ),
                            ComponentExpr(
                                BuyComponent(
                                    LiteralQuantity(Number 1.0),
                                    Option {
                                        Underlying = SimpleAsset "spy"
                                        DTE = 30
                                        GreekType = Delta
                                        GreekValue = 0.4
                                    }
                                )
                            )
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-504 Position reference in compound should parse correctly``() =
        // DSL: define combined as existing_pos and buy 10 spy
        let tokens = [
            T_DEFINE; T_IDENTIFIER "combined"; T_AS;
            T_IDENTIFIER "existing_pos";
            T_AND;
            T_BUY; T_NUMBER 10.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "combined"
                    Value = PositionValue(
                        CompoundExpr(
                            PositionReference "existing_pos",
                            ComponentExpr(
                                BuyComponent(
                                    LiteralQuantity(Number 10.0),
                                    Asset(SimpleAsset "spy")
                                )
                            )
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-505 Position with percentage quantity should parse correctly``() =
        // DSL: define pos as buy 50% spy
        let tokens = [
            T_DEFINE; T_IDENTIFIER "pos"; T_AS;
            T_BUY; T_PERCENTAGE 50.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "pos"
                    Value = PositionValue(
                        ComponentExpr(
                            BuyComponent(
                                LiteralQuantity(Percentage 50.0),
                                Asset(SimpleAsset "spy")
                            )
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-506 Position with dollar quantity should parse correctly``() =
        // DSL: define pos as buy $1000 spy
        let tokens = [
            T_DEFINE; T_IDENTIFIER "pos"; T_AS;
            T_BUY; T_DOLLAR 1000.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "pos"
                    Value = PositionValue(
                        ComponentExpr(
                            BuyComponent(
                                LiteralQuantity(Dollar 1000.0),
                                Asset(SimpleAsset "spy")
                            )
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-507 Position with identifier quantity should parse correctly``() =
        // DSL: define pos as buy myQuantity spy
        let tokens = [
            T_DEFINE; T_IDENTIFIER "pos"; T_AS;
            T_BUY; T_IDENTIFIER "myQuantity"; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "pos"
                    Value = PositionValue(
                        ComponentExpr(
                            BuyComponent(
                                IdentifierQuantity "myQuantity",
                                Asset(SimpleAsset "spy")
                            )
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-508 Leveraged asset in position should parse correctly``() =
        // DSL: define pos as buy 100 spy_3x
        let tokens = [
            T_DEFINE; T_IDENTIFIER "pos"; T_AS;
            T_BUY; T_NUMBER 100.0; T_ASSET_REFERENCE(LeveragedAsset("spy", 3.0));
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "pos"
                    Value = PositionValue(
                        ComponentExpr(
                            BuyComponent(
                                LiteralQuantity(Number 100.0),
                                Asset(LeveragedAsset("spy", 3.0))
                            )
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-509 Option in position should parse correctly``() =
        // DSL: define pos as buy 1 spy_30dte_delta_0.3
        let tokens = [
            T_DEFINE; T_IDENTIFIER "pos"; T_AS;
            T_BUY; T_NUMBER 1.0;
            T_OPTION_SPEC {
                Underlying = SimpleAsset "spy"
                DTE = 30
                GreekType = Delta
                GreekValue = 0.3
            };
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "pos"
                    Value = PositionValue(
                        ComponentExpr(
                            BuyComponent(
                                LiteralQuantity(Number 1.0),
                                Option {
                                    Underlying = SimpleAsset "spy"
                                    DTE = 30
                                    GreekType = Delta
                                    GreekValue = 0.3
                                }
                            )
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst
    // --- Category 6: Action Statements Tests ---

    [<Fact>]
    member _.``PARSE-601 All action types together should parse correctly``() =
        // DSL: buy 100 spy; sell 50 qqq; buy_max iwm; sell_all tsla; rebalance_to 60% spy
        let tokens = [
            T_BUY; T_NUMBER 100.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_SELL; T_NUMBER 50.0; T_ASSET_REFERENCE(SimpleAsset "qqq");
            T_BUY_MAX; T_ASSET_REFERENCE(SimpleAsset "iwm");
            T_SELL_ALL; T_ASSET_REFERENCE(SimpleAsset "tsla");
            T_REBALANCE_TO; T_PERCENTAGE 60.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ActionStatement(
                    Buy(
                        LiteralQuantity(Number 100.0),
                        AssetTarget(SimpleAsset "spy")
                    )
                )
                ActionStatement(
                    Sell(
                        LiteralQuantity(Number 50.0),
                        AssetTarget(SimpleAsset "qqq")
                    )
                )
                ActionStatement(
                    BuyMax(AssetTarget(SimpleAsset "iwm"))
                )
                ActionStatement(
                    SellAll(AssetTarget(SimpleAsset "tsla"))
                )
                ActionStatement(
                    RebalanceTo(60.0, AssetTarget(SimpleAsset "spy"))
                )
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-602 Action with identifier target should parse correctly``() =
        // DSL: buy 100 myPosition
        let tokens = [
            T_BUY; T_NUMBER 100.0; T_IDENTIFIER "myPosition";
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ActionStatement(
                    Buy(
                        LiteralQuantity(Number 100.0),
                        IdentifierTarget "myPosition"
                    )
                )
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-603 Action in loop should parse correctly``() =
        // DSL: for_any_position spreads as s: sell_all s end
        let tokens = [
            T_FOR_ANY_POSITION; T_IDENTIFIER "spreads"; T_AS; T_IDENTIFIER "s"; T_COLON;
            T_SELL_ALL; T_IDENTIFIER "s";
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ForAnyPositionStatement {
                    PositionType = "spreads"
                    InstanceVariable = "s"
                    Block = [
                        ActionStatement(
                            SellAll(IdentifierTarget "s")
                        )
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-604 Multiple actions in condition should parse correctly``() =
        // DSL: when spy > 200: buy 100 spy; sell 50 qqq; buy_max iwm end
        let tokens = [
            T_WHEN; T_ASSET_REFERENCE(SimpleAsset "spy"); T_GREATER; T_NUMBER 200.0; T_COLON;
            T_BUY; T_NUMBER 100.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_SELL; T_NUMBER 50.0; T_ASSET_REFERENCE(SimpleAsset "qqq");
            T_BUY_MAX; T_ASSET_REFERENCE(SimpleAsset "iwm");
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ConditionalStatement {
                    Condition = ComparisonCond(
                        Greater,
                        AssetExpr(SimpleAsset "spy"),
                        LiteralExpr(NumericLit(Number 200.0))
                    )
                    ThenBlock = [
                        ActionStatement(
                            Buy(
                                LiteralQuantity(Number 100.0),
                                AssetTarget(SimpleAsset "spy")
                            )
                        )
                        ActionStatement(
                            Sell(
                                LiteralQuantity(Number 50.0),
                                AssetTarget(SimpleAsset "qqq")
                            )
                        )
                        ActionStatement(
                            BuyMax(AssetTarget(SimpleAsset "iwm"))
                        )
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst
        
        
    // --- Category 7: Indicators Tests ---

    [<Fact>]
    member _.``PARSE-701 All indicator types should parse correctly``() =
        // DSL: define x as spy_sma_20 + spy_ema_50 + spy_rsi_14
        let tokens = [
            T_DEFINE; T_IDENTIFIER "x"; T_AS;
            T_INDICATOR { Asset = "spy"; TypeName = "sma"; Period = Some 20 };
            T_PLUS;
            T_INDICATOR { Asset = "spy"; TypeName = "ema"; Period = Some 50 };
            T_PLUS;
            T_INDICATOR { Asset = "spy"; TypeName = "rsi"; Period = Some 14 };
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "x"
                    Value = ExpressionValue(
                        ArithmeticExpr(
                            Add,
                            ArithmeticExpr(
                                Add,
                                IndicatorExpr {
                                    Asset = "spy"
                                    IndicatorType = SMA
                                    Period = Some 20
                                },
                                IndicatorExpr {
                                    Asset = "spy"
                                    IndicatorType = EMA
                                    Period = Some 50
                                }
                            ),
                            IndicatorExpr {
                                Asset = "spy"
                                IndicatorType = RSI
                                Period = Some 14
                            }
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-702 Indicator without period should parse correctly``() =
        // DSL: define x as spy_return
        let tokens = [
            T_DEFINE; T_IDENTIFIER "x"; T_AS;
            T_INDICATOR { Asset = "spy"; TypeName = "return"; Period = None };
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "x"
                    Value = ExpressionValue(
                        IndicatorExpr {
                            Asset = "spy"
                            IndicatorType = Return
                            Period = None
                        }
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-703 Indicator in comparison should parse correctly``() =
        // DSL: when spy_sma_20 > spy_ema_20: buy 100 spy end
        let tokens = [
            T_WHEN;
            T_INDICATOR { Asset = "spy"; TypeName = "sma"; Period = Some 20 };
            T_GREATER;
            T_INDICATOR { Asset = "spy"; TypeName = "ema"; Period = Some 20 };
            T_COLON;
            T_BUY; T_NUMBER 100.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ConditionalStatement {
                    Condition = ComparisonCond(
                        Greater,
                        IndicatorExpr {
                            Asset = "spy"
                            IndicatorType = SMA
                            Period = Some 20
                        },
                        IndicatorExpr {
                            Asset = "spy"
                            IndicatorType = EMA
                            Period = Some 20
                        }
                    )
                    ThenBlock = [
                        ActionStatement(
                            Buy(
                                LiteralQuantity(Number 100.0),
                                AssetTarget(SimpleAsset "spy")
                            )
                        )
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-704 Indicator in complex expression should parse correctly``() =
        // DSL: define signal as (spy_sma_50 - spy_sma_200) / spy_vol_20
        let tokens = [
            T_DEFINE; T_IDENTIFIER "signal"; T_AS;
            T_LPAREN;
            T_INDICATOR { Asset = "spy"; TypeName = "sma"; Period = Some 50 };
            T_MINUS;
            T_INDICATOR { Asset = "spy"; TypeName = "sma"; Period = Some 200 };
            T_RPAREN;
            T_DIVIDE;
            T_INDICATOR { Asset = "spy"; TypeName = "vol"; Period = Some 20 };
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "signal"
                    Value = ExpressionValue(
                        ArithmeticExpr(
                            Divide,
                            ParenExpr(
                                ArithmeticExpr(
                                    Subtract,
                                    IndicatorExpr {
                                        Asset = "spy"
                                        IndicatorType = SMA
                                        Period = Some 50
                                    },
                                    IndicatorExpr {
                                        Asset = "spy"
                                        IndicatorType = SMA
                                        Period = Some 200
                                    }
                                )
                            ),
                            IndicatorExpr {
                                Asset = "spy"
                                IndicatorType = Vol
                                Period = Some 20
                            }
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst
        
// --- Category 8: Portfolio Queries Tests ---

    [<Fact>]
    member _.``PARSE-801 All query types should parse correctly``() =
        // DSL: define a as cash_available; define b as portfolio_value; define c as position_quantity(my_spread); define d as position_value(my_hedge)
        let tokens = [
            T_DEFINE; T_IDENTIFIER "a"; T_AS; T_CASH_AVAILABLE;
            T_DEFINE; T_IDENTIFIER "b"; T_AS; T_PORTFOLIO_VALUE;
            T_DEFINE; T_IDENTIFIER "c"; T_AS; T_POSITION_QUANTITY; T_LPAREN; T_IDENTIFIER "my_spread"; T_RPAREN;
            T_DEFINE; T_IDENTIFIER "d"; T_AS; T_POSITION_VALUE; T_LPAREN; T_IDENTIFIER "my_hedge"; T_RPAREN;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "a"
                    Value = ExpressionValue(
                        PortfolioQueryExpr(CashAvailable)
                    )
                }
                DefineStatement {
                    Name = "b"
                    Value = ExpressionValue(
                        PortfolioQueryExpr(PortfolioValue)
                    )
                }
                DefineStatement {
                    Name = "c"
                    Value = ExpressionValue(
                        PortfolioQueryExpr(PortfolioQuery.PositionQuantity "my_spread")
                    )
                }
                DefineStatement {
                    Name = "d"
                    Value = ExpressionValue(
                        PortfolioQueryExpr(PortfolioQuery.PositionValue "my_hedge")
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-802 Query in comparison should parse correctly``() =
        // DSL: when portfolio_value > 1000000: buy_max spy end
        let tokens = [
            T_WHEN;
            T_PORTFOLIO_VALUE; T_GREATER; T_NUMBER 1000000.0;
            T_COLON;
            T_BUY_MAX; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ConditionalStatement {
                    Condition = ComparisonCond(
                        Greater,
                        PortfolioQueryExpr(PortfolioValue),
                        LiteralExpr(NumericLit(Number 1000000.0))
                    )
                    ThenBlock = [
                        ActionStatement(
                            BuyMax(AssetTarget(SimpleAsset "spy"))
                        )
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-803 Query in arithmetic should parse correctly``() =
        // DSL: define allocation as position_value(spy) / portfolio_value
        let tokens = [
            T_DEFINE; T_IDENTIFIER "allocation"; T_AS;
            T_POSITION_VALUE; T_LPAREN; T_IDENTIFIER "spy"; T_RPAREN;
            T_DIVIDE;
            T_PORTFOLIO_VALUE;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "allocation"
                    Value = ExpressionValue(
                        ArithmeticExpr(
                            Divide,
                            PortfolioQueryExpr(PortfolioQuery.PositionValue "spy"),
                            PortfolioQueryExpr(PortfolioValue)
                        )
                    )
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-804 Query with property access should parse correctly``() =
        // DSL: when position_quantity(my_pos) > threshold.max: sell_all my_pos end
        let tokens = [
            T_WHEN;
            T_POSITION_QUANTITY; T_LPAREN; T_IDENTIFIER "my_pos"; T_RPAREN;
            T_GREATER;
            T_IDENTIFIER "threshold"; T_DOT; T_IDENTIFIER "max";
            T_COLON;
            T_SELL_ALL; T_IDENTIFIER "my_pos";
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ConditionalStatement {
                    Condition = ComparisonCond(
                        Greater,
                        PortfolioQueryExpr(PortfolioQuery.PositionQuantity "my_pos"),
                        PropertyAccessExpr {
                            Object = IdentifierExpr "threshold"
                            Property = "max"
                        }
                    )
                    ThenBlock = [
                        ActionStatement(
                            SellAll(IdentifierTarget "my_pos")
                        )
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst
        
    // --- Category 9: Edge Cases & Error Conditions Tests ---

    [<Fact>]
    member _.``PARSE-901 Missing end in nested blocks should fail``() =
        // DSL: when a: when b: buy 100 spy end (missing second end)
        let tokens = [
            T_WHEN; T_IDENTIFIER "a"; T_COLON;
            T_WHEN; T_IDENTIFIER "b"; T_COLON;
            T_BUY; T_NUMBER 100.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_EOF
        ]
        expectParseError tokens

    [<Fact>]
    member _.``PARSE-902 Extra end should fail``() =
        // DSL: when a: buy 100 spy end end
        let tokens = [
            T_WHEN; T_IDENTIFIER "a"; T_COLON;
            T_BUY; T_NUMBER 100.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_END;
            T_EOF
        ]
        expectParseError tokens

    [<Fact>]
    member _.``PARSE-903 Invalid token after program should fail``() =
        // DSL: buy 100 spy (then some garbage)
        let tokens = [
            T_BUY; T_NUMBER 100.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_IDENTIFIER "extra_garbage";
            T_EOF
        ]
        expectParseError tokens

    [<Fact>]
    member _.``PARSE-904 Comparison without right side should fail``() =
        // DSL: when spy > (incomplete)
        let tokens = [
            T_WHEN; T_ASSET_REFERENCE(SimpleAsset "spy"); T_GREATER;
            T_COLON;
            T_BUY; T_NUMBER 100.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_EOF
        ]
        expectParseError tokens

    [<Fact>]
    member _.``PARSE-905 Expression starting with operator should fail``() =
        // DSL: define x as + 5
        let tokens = [
            T_DEFINE; T_IDENTIFIER "x"; T_AS;
            T_PLUS; T_NUMBER 5.0;
            T_EOF
        ]
        expectParseError tokens

    [<Fact>]
    member _.``PARSE-906 Arithmetic without right operand should fail``() =
        // DSL: define x as 5 +
        let tokens = [
            T_DEFINE; T_IDENTIFIER "x"; T_AS;
            T_NUMBER 5.0; T_PLUS;
            T_EOF
        ]
        expectParseError tokens

    [<Fact>]
    member _.``PARSE-907 Empty identifier should fail``() =
        // DSL: define as 10 (missing identifier name)
        let tokens = [
            T_DEFINE; T_AS; T_NUMBER 10.0;
            T_EOF
        ]
        expectParseError tokens

    [<Fact>]
    member _.``PARSE-908 Number as condition should fail``() =
        // DSL: when 123: buy 100 spy end
        let tokens = [
            T_WHEN; T_NUMBER 123.0; T_COLON;
            T_BUY; T_NUMBER 100.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_EOF
        ]
        expectParseError tokens

    [<Fact>]
    member _.``PARSE-909 Asset as condition should fail``() =
        // DSL: when spy: buy 100 spy end
        let tokens = [
            T_WHEN; T_ASSET_REFERENCE(SimpleAsset "spy"); T_COLON;
            T_BUY; T_NUMBER 100.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_EOF
        ]
        expectParseError tokens
        
    // --- Category 10: Real-World Complex Scenarios Tests ---

    [<Fact>]
    member _.``PARSE-1001 Momentum strategy should parse correctly``() =
        // DSL: 
        // define momentum as (spy - spy_sma_200) / spy_vol_20
        // when momentum > 2:
        //     rebalance_to 100% spy
        // end
        // when momentum < -2:
        //     rebalance_to 100% t_bills
        // end
        let tokens = [
            T_DEFINE; T_IDENTIFIER "momentum"; T_AS;
            T_LPAREN; T_ASSET_REFERENCE(SimpleAsset "spy"); T_MINUS;
            T_INDICATOR { Asset = "spy"; TypeName = "sma"; Period = Some 200 };
            T_RPAREN; T_DIVIDE;
            T_INDICATOR { Asset = "spy"; TypeName = "vol"; Period = Some 20 };
            
            T_WHEN; T_IDENTIFIER "momentum"; T_GREATER; T_NUMBER 2.0; T_COLON;
            T_REBALANCE_TO; T_PERCENTAGE 100.0; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            
            T_WHEN; T_IDENTIFIER "momentum"; T_LESS; T_MINUS; T_NUMBER 2.0; T_COLON;
            T_REBALANCE_TO; T_PERCENTAGE 100.0; T_ASSET_REFERENCE(SimpleAsset "t_bills");
            T_END;
            
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "momentum"
                    Value = ExpressionValue(
                        ArithmeticExpr(
                            Divide,
                            ParenExpr(
                                ArithmeticExpr(
                                    Subtract,
                                    AssetExpr(SimpleAsset "spy"),
                                    IndicatorExpr {
                                        Asset = "spy"
                                        IndicatorType = SMA
                                        Period = Some 200
                                    }
                                )
                            ),
                            IndicatorExpr {
                                Asset = "spy"
                                IndicatorType = Vol
                                Period = Some 20
                            }
                        )
                    )
                }
                ConditionalStatement {
                    Condition = ComparisonCond(
                        Greater,
                        IdentifierExpr "momentum",
                        LiteralExpr(NumericLit(Number 2.0))
                    )
                    ThenBlock = [
                        ActionStatement(
                            RebalanceTo(100.0, AssetTarget(SimpleAsset "spy"))
                        )
                    ]
                }
                ConditionalStatement {
                    Condition = ComparisonCond(
                        Less,
                        IdentifierExpr "momentum",
                        UnaryMinusExpr(LiteralExpr(NumericLit(Number 2.0)))
                    )
                    ThenBlock = [
                        ActionStatement(
                            RebalanceTo(100.0, AssetTarget(SimpleAsset "t_bills"))
                        )
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-1002 Delta hedging loop should parse correctly``() =
        // DSL:
        // for_any_position options as opt:
        //     when opt.delta > 0.6:
        //         define hedge_qty as opt.quantity * opt.delta
        //         sell hedge_qty spy
        //     end
        // end
        let tokens = [
            T_FOR_ANY_POSITION; T_IDENTIFIER "options"; T_AS; T_IDENTIFIER "opt"; T_COLON;
            T_WHEN; T_IDENTIFIER "opt"; T_DOT; T_IDENTIFIER "delta"; T_GREATER; T_NUMBER 0.6; T_COLON;
            T_DEFINE; T_IDENTIFIER "hedge_qty"; T_AS;
            T_IDENTIFIER "opt"; T_DOT; T_IDENTIFIER "quantity";
            T_MULTIPLY;
            T_IDENTIFIER "opt"; T_DOT; T_IDENTIFIER "delta";
            T_SELL; T_IDENTIFIER "hedge_qty"; T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            T_END;
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                ForAnyPositionStatement {
                    PositionType = "options"
                    InstanceVariable = "opt"
                    Block = [
                        ConditionalStatement {
                            Condition = ComparisonCond(
                                Greater,
                                PropertyAccessExpr {
                                    Object = IdentifierExpr "opt"
                                    Property = "delta"
                                },
                                LiteralExpr(NumericLit(Number 0.6))
                            )
                            ThenBlock = [
                                DefineStatement {
                                    Name = "hedge_qty"
                                    Value = ExpressionValue(
                                        ArithmeticExpr(
                                            Multiply,
                                            PropertyAccessExpr {
                                                Object = IdentifierExpr "opt"
                                                Property = "quantity"
                                            },
                                            PropertyAccessExpr {
                                                Object = IdentifierExpr "opt"
                                                Property = "delta"
                                            }
                                        )
                                    )
                                }
                                ActionStatement(
                                    Sell(
                                        IdentifierQuantity "hedge_qty",
                                        AssetTarget(SimpleAsset "spy")
                                    )
                                )
                            ]
                        }
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-1003 Multi-asset rebalancing should parse correctly``() =
        // DSL:
        // define spy_pct as position_value(spy) / portfolio_value
        // define qqq_pct as position_value(qqq) / portfolio_value
        // when spy_pct > 0.65:
        //     sell (spy_pct - 0.60) * portfolio_value spy
        // end
        // when qqq_pct < 0.35:
        //     buy (0.40 - qqq_pct) * portfolio_value qqq
        // end
        let tokens = [
            T_DEFINE; T_IDENTIFIER "spy_pct"; T_AS;
            T_POSITION_VALUE; T_LPAREN; T_IDENTIFIER "spy"; T_RPAREN;
            T_DIVIDE; T_PORTFOLIO_VALUE;
            
            T_DEFINE; T_IDENTIFIER "qqq_pct"; T_AS;
            T_POSITION_VALUE; T_LPAREN; T_IDENTIFIER "qqq"; T_RPAREN;
            T_DIVIDE; T_PORTFOLIO_VALUE;
            
            T_WHEN; T_IDENTIFIER "spy_pct"; T_GREATER; T_NUMBER 0.65; T_COLON;
            T_SELL;
            T_LPAREN; T_IDENTIFIER "spy_pct"; T_MINUS; T_NUMBER 0.60; T_RPAREN;
            T_MULTIPLY; T_PORTFOLIO_VALUE;
            T_ASSET_REFERENCE(SimpleAsset "spy");
            T_END;
            
            T_WHEN; T_IDENTIFIER "qqq_pct"; T_LESS; T_NUMBER 0.35; T_COLON;
            T_BUY;
            T_LPAREN; T_NUMBER 0.40; T_MINUS; T_IDENTIFIER "qqq_pct"; T_RPAREN;
            T_MULTIPLY; T_PORTFOLIO_VALUE;
            T_ASSET_REFERENCE(SimpleAsset "qqq");
            T_END;
            
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "spy_pct"
                    Value = ExpressionValue(
                        ArithmeticExpr(
                            Divide,
                            PortfolioQueryExpr(PortfolioQuery.PositionValue "spy"),
                            PortfolioQueryExpr(PortfolioValue)
                        )
                    )
                }
                DefineStatement {
                    Name = "qqq_pct"
                    Value = ExpressionValue(
                        ArithmeticExpr(
                            Divide,
                            PortfolioQueryExpr(PortfolioQuery.PositionValue "qqq"),
                            PortfolioQueryExpr(PortfolioValue)
                        )
                    )
                }
                ConditionalStatement {
                    Condition = ComparisonCond(
                        Greater,
                        IdentifierExpr "spy_pct",
                        LiteralExpr(NumericLit(Number 0.65))
                    )
                    ThenBlock = [
                        ActionStatement(
                            Sell(
                                ExpressionQuantity(
                                    ArithmeticExpr(
                                        Multiply,
                                        ParenExpr(
                                            ArithmeticExpr(
                                                Subtract,
                                                IdentifierExpr "spy_pct",
                                                LiteralExpr(NumericLit(Number 0.6))
                                            )
                                        ),
                                        PortfolioQueryExpr(PortfolioValue)
                                    )
                                ),
                                AssetTarget(SimpleAsset "spy")
                            )
                        )
                    ]
                }
                ConditionalStatement {
                    Condition = ComparisonCond(
                        Less,
                        IdentifierExpr "qqq_pct",
                        LiteralExpr(NumericLit(Number 0.35))
                    )
                    ThenBlock = [
                        ActionStatement(
                            Buy(
                                ExpressionQuantity(
                                    ArithmeticExpr(
                                        Multiply,
                                        ParenExpr(
                                            ArithmeticExpr(
                                                Subtract,
                                                LiteralExpr(NumericLit(Number 0.4)),
                                                IdentifierExpr "qqq_pct"
                                            )
                                        ),
                                        PortfolioQueryExpr(PortfolioValue)
                                    )
                                ),
                                AssetTarget(SimpleAsset "qqq")
                            )
                        )
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst

    [<Fact>]
    member _.``PARSE-1004 Spread management with position rolling should parse correctly``() =
        // DSL:
        // define my_spread as buy 1 spy_30dte_delta_0.3 and sell 1 spy_30dte_delta_0.5
        // for_any_position spreads as s:
        //     when s.dte < 7 or s.pnl.percent > 50%:
        //         sell_all s
        //         buy 1 my_spread
        //     end
        // end
        let tokens = [
            T_DEFINE; T_IDENTIFIER "my_spread"; T_AS;
            T_BUY; T_NUMBER 1.0;
            T_OPTION_SPEC {
                Underlying = SimpleAsset "spy"
                DTE = 30
                GreekType = Delta
                GreekValue = 0.3
            };
            T_AND;
            T_SELL; T_NUMBER 1.0;
            T_OPTION_SPEC {
                Underlying = SimpleAsset "spy"
                DTE = 30
                GreekType = Delta
                GreekValue = 0.5
            };
            
            T_FOR_ANY_POSITION; T_IDENTIFIER "spreads"; T_AS; T_IDENTIFIER "s"; T_COLON;
            T_WHEN;
            T_IDENTIFIER "s"; T_DOT; T_IDENTIFIER "dte"; T_LESS; T_NUMBER 7.0;
            T_OR;
            T_IDENTIFIER "s"; T_DOT; T_IDENTIFIER "pnl"; T_DOT; T_IDENTIFIER "percent";
            T_GREATER; T_PERCENTAGE 50.0;
            T_COLON;
            T_SELL_ALL; T_IDENTIFIER "s";
            T_BUY; T_NUMBER 1.0; T_IDENTIFIER "my_spread";
            T_END;
            T_END;
            
            T_EOF
        ]
        let expectedAst = {
            Statements = [
                DefineStatement {
                    Name = "my_spread"
                    Value = PositionValue(
                        CompoundExpr(
                            ComponentExpr(
                                BuyComponent(
                                    LiteralQuantity(Number 1.0),
                                    Option {
                                        Underlying = SimpleAsset "spy"
                                        DTE = 30
                                        GreekType = Delta
                                        GreekValue = 0.3
                                    }
                                )
                            ),
                            ComponentExpr(
                                SellComponent(
                                    LiteralQuantity(Number 1.0),
                                    Option {
                                        Underlying = SimpleAsset "spy"
                                        DTE = 30
                                        GreekType = Delta
                                        GreekValue = 0.5
                                    }
                                )
                            )
                        )
                    )
                }
                ForAnyPositionStatement {
                    PositionType = "spreads"
                    InstanceVariable = "s"
                    Block = [
                        ConditionalStatement {
                            Condition = LogicalCond(
                                Or,
                                ComparisonCond(
                                    Less,
                                    PropertyAccessExpr {
                                        Object = IdentifierExpr "s"
                                        Property = "dte"
                                    },
                                    LiteralExpr(NumericLit(Number 7.0))
                                ),
                                ComparisonCond(
                                    Greater,
                                    PropertyAccessExpr {
                                        Object = PropertyAccessExpr {
                                            Object = IdentifierExpr "s"
                                            Property = "pnl"
                                        }
                                        Property = "percent"
                                    },
                                    LiteralExpr(NumericLit(Percentage 50.0))
                                )
                            )
                            ThenBlock = [
                                ActionStatement(
                                    SellAll(IdentifierTarget "s")
                                )
                                ActionStatement(
                                    Buy(
                                        LiteralQuantity(Number 1.0),
                                        IdentifierTarget "my_spread"
                                    )
                                )
                            ]
                        }
                    ]
                }
            ]
        }
        let actualAst = runParser tokens
        actualAst |> should equal expectedAst