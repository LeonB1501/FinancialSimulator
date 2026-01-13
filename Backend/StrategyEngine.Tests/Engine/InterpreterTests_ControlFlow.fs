module InterpreterTests_ControlFlow

open Xunit
open FsUnit.Xunit
open AST
open EngineTypes
open Interpreter
open System

// ============================================================================
// TEST FIXTURE
// ============================================================================
module Fixture =
    let emptyPortfolio = { 
        Cash = 10000.0; 
        Positions = []; 
        CompositeRegistry = Map.empty;
        TaxLots = [];
        TaxLiabilityYTD = 0.0;
        RealizedGainsYTD = 0.0
    }
    
    let makeState (cash: float) = 
        { 
            CurrentDay = 0
            Portfolio = { emptyPortfolio with Cash = cash }
            ScopeStack = []
            GlobalScope = Map.empty
            RiskFreeRate = 0.0
            TransactionHistory = []
        }

    let makeHistory (price: float) = 
        [ { Ticker = "spy"; DailyData = [| { Price = price; Vol = 0.2 } |] } ]

    let makeGuid () = Guid.NewGuid()
    let spy = ResolvedAsset(SimpleAsset "spy")

    let makePosition (qty: float) (defName: string) =
        { 
            Id = makeGuid()
            GroupId = None
            DefinitionName = defName
            ComponentName = None
            ParentId = None
            BuyPrice = 100.0
            BuyDate = 0
            Quantity = qty
            Instrument = spy 
        }

    let zeroCosts = {
        Commission = { PerOrder = 0.0; PerUnit = 0.0 }
        Slippage = { DefaultSpread = 0.0; Tiers = [] }
    }

    let zeroTax = {
        PaymentMode = PeriodicSettlement 252
        ShortTermRate = 0.0
        LongTermRate = 0.0
        LongTermThreshold = 365
        WealthTaxRate = 0.0
    }

// ============================================================================
// Category 3: Conditional Statements (when)
// ============================================================================
type ConditionalSuite() =

    let assertVarExists (name: string) (expectedVal: float) (state: EvaluationState) =
        match state.GlobalScope.TryFind name with
        | Some (V_Float v) -> Assert.Equal(expectedVal, v)
        | Some _ -> failwith $"Variable {name} has wrong type"
        | None -> failwith $"Variable {name} not found"

    [<Fact>]
    member _.``INT-3.1 Basic True Condition``() =
        let def = DefineStatement { Name = "x"; Value = ExpressionValue(LiteralExpr(NumericLit(Number 0.0))) }
        let stmt = ConditionalStatement {
            Condition = BooleanExpr(LiteralExpr(BoolLit True))
            ThenBlock = [ SetStatement { Name = "x"; Value = LiteralExpr(NumericLit(Number 1.0)) } ]
        }
        
        let finalState = interpretStep { Statements = [def; stmt] } (Fixture.makeState 1000.0) (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        assertVarExists "x" 1.0 finalState

    [<Fact>]
    member _.``INT-3.1 Basic False Condition``() =
        let def = DefineStatement { Name = "x"; Value = ExpressionValue(LiteralExpr(NumericLit(Number 0.0))) }
        let stmt = ConditionalStatement {
            Condition = BooleanExpr(LiteralExpr(BoolLit False))
            ThenBlock = [ SetStatement { Name = "x"; Value = LiteralExpr(NumericLit(Number 1.0)) } ]
        }
        
        let finalState = interpretStep { Statements = [def; stmt] } (Fixture.makeState 1000.0) (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        assertVarExists "x" 0.0 finalState

    [<Fact>]
    member _.``INT-3.2 Comparison Operator``() =
        let def = DefineStatement { Name = "x"; Value = ExpressionValue(LiteralExpr(NumericLit(Number 0.0))) }
        let cond = ComparisonCond(Greater, LiteralExpr(NumericLit(Number 10.0)), LiteralExpr(NumericLit(Number 5.0)))
        let stmt = ConditionalStatement {
            Condition = cond
            ThenBlock = [ SetStatement { Name = "x"; Value = LiteralExpr(NumericLit(Number 1.0)) } ]
        }
        
        let finalState = interpretStep { Statements = [def; stmt] } (Fixture.makeState 1000.0) (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        assertVarExists "x" 1.0 finalState

    [<Fact>]
    member _.``INT-3.4 Logical AND``() =
        let def = DefineStatement { Name = "x"; Value = ExpressionValue(LiteralExpr(NumericLit(Number 0.0))) }
        let cond = LogicalCond(And, BooleanExpr(LiteralExpr(BoolLit True)), BooleanExpr(LiteralExpr(BoolLit False)))
        let stmt = ConditionalStatement {
            Condition = cond
            ThenBlock = [ SetStatement { Name = "x"; Value = LiteralExpr(NumericLit(Number 1.0)) } ]
        }
        
        let finalState = interpretStep { Statements = [def; stmt] } (Fixture.makeState 1000.0) (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        assertVarExists "x" 0.0 finalState

    [<Fact>]
    member _.``INT-3.4 Logical OR``() =
        let def = DefineStatement { Name = "x"; Value = ExpressionValue(LiteralExpr(NumericLit(Number 0.0))) }
        let cond = LogicalCond(Or, BooleanExpr(LiteralExpr(BoolLit True)), BooleanExpr(LiteralExpr(BoolLit False)))
        let stmt = ConditionalStatement {
            Condition = cond
            ThenBlock = [ SetStatement { Name = "x"; Value = LiteralExpr(NumericLit(Number 1.0)) } ]
        }
        
        let finalState = interpretStep { Statements = [def; stmt] } (Fixture.makeState 1000.0) (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        assertVarExists "x" 1.0 finalState

    [<Fact>]
    member _.``INT-3.7 Nested Conditionals``() =
        let def = DefineStatement { Name = "x"; Value = ExpressionValue(LiteralExpr(NumericLit(Number 0.0))) }
        let inner = ConditionalStatement {
            Condition = BooleanExpr(LiteralExpr(BoolLit True))
            ThenBlock = [ SetStatement { Name = "x"; Value = LiteralExpr(NumericLit(Number 1.0)) } ]
        }
        let outer = ConditionalStatement {
            Condition = BooleanExpr(LiteralExpr(BoolLit True))
            ThenBlock = [ inner ]
        }

        let finalState = interpretStep { Statements = [def; outer] } (Fixture.makeState 1000.0) (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        assertVarExists "x" 1.0 finalState

    [<Fact>]
    member _.``INT-3.8 Conditional Modifying Global``() =
        let def = DefineStatement { Name = "x"; Value = ExpressionValue(LiteralExpr(NumericLit(Number 10.0))) }
        let cond = ConditionalStatement {
            Condition = BooleanExpr(LiteralExpr(BoolLit True))
            ThenBlock = [ SetStatement { Name = "x"; Value = LiteralExpr(NumericLit(Number 20.0)) } ]
        }

        let finalState = interpretStep { Statements = [def; cond] } (Fixture.makeState 1000.0) (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        assertVarExists "x" 20.0 finalState

// ============================================================================
// Category 4: Loop Statements (for_any_position)
// ============================================================================
type LoopSuite() =
    
    let assertVarExists (name: string) (expectedVal: float) (state: EvaluationState) =
        match state.GlobalScope.TryFind name with
        | Some (V_Float v) -> Assert.Equal(expectedVal, v)
        | Some _ -> failwith $"Variable {name} has wrong type"
        | None -> failwith $"Variable {name} not found"

    [<Fact>]
    member _.``INT-4.1 Loop Over Empty Portfolio``() =
        let def = DefineStatement { Name = "x"; Value = ExpressionValue(LiteralExpr(NumericLit(Number 0.0))) }
        let loop = ForAnyPositionStatement {
            PositionType = "spy"
            InstanceVariable = "p"
            Block = [ SetStatement { Name = "x"; Value = LiteralExpr(NumericLit(Number 1.0)) } ]
        }
        
        let state = Fixture.makeState 1000.0
        let finalState = interpretStep { Statements = [def; loop] } state (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        assertVarExists "x" 0.0 finalState

    [<Fact>]
    member _.``INT-4.1 Loop Over Single Position``() =
        let p1 = Fixture.makePosition 10.0 "strat"
        let state = Fixture.makeState 1000.0
        let stateWithPos = { state with Portfolio = { state.Portfolio with Positions = [p1] } }

        let defSum = DefineStatement { Name = "sum"; Value = ExpressionValue(LiteralExpr(NumericLit(Number 0.0))) }
        let loop = ForAnyPositionStatement {
            PositionType = "strat"
            InstanceVariable = "p"
            Block = [ 
                SetStatement { 
                    Name = "sum"; 
                    Value = ArithmeticExpr(Add, IdentifierExpr "sum", LiteralExpr(NumericLit(Number 10.0))) 
                } 
            ]
        }

        let finalState = interpretStep { Statements = [defSum; loop] } stateWithPos (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        assertVarExists "sum" 10.0 finalState

    [<Fact>]
    member _.``INT-4.1 Loop Over Multiple Positions``() =
        let p1 = Fixture.makePosition 10.0 "strat"
        let p2 = Fixture.makePosition 10.0 "strat"
        let p3 = Fixture.makePosition 10.0 "strat"
        let state = Fixture.makeState 1000.0
        let stateWithPos = { state with Portfolio = { state.Portfolio with Positions = [p1; p2; p3] } }

        let defSum = DefineStatement { Name = "sum"; Value = ExpressionValue(LiteralExpr(NumericLit(Number 0.0))) }
        let loop = ForAnyPositionStatement {
            PositionType = "strat"
            InstanceVariable = "p"
            Block = [ 
                SetStatement { 
                    Name = "sum"; 
                    Value = ArithmeticExpr(Add, IdentifierExpr "sum", LiteralExpr(NumericLit(Number 10.0))) 
                } 
            ]
        }

        let finalState = interpretStep { Statements = [defSum; loop] } stateWithPos (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        assertVarExists "sum" 30.0 finalState

    [<Fact>]
    member _.``INT-4.2 Loop Variable Scoping``() =
        let p1 = Fixture.makePosition 50.0 "strat"
        let state = Fixture.makeState 1000.0
        let stateWithPos = { state with Portfolio = { state.Portfolio with Positions = [p1] } }

        let loop = ForAnyPositionStatement {
            PositionType = "strat"
            InstanceVariable = "p"
            Block = [ 
                DefineStatement { 
                    Name = "x"; 
                    Value = ExpressionValue(PropertyAccessExpr { Object = IdentifierExpr "p"; Property = "quantity" }) 
                } 
            ]
        }

        let finalState = interpretStep { Statements = [loop] } stateWithPos (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        Assert.False(finalState.GlobalScope.ContainsKey "x")

    [<Fact>]
    member _.``INT-4.3 Loop Filtering``() =
        let p1 = Fixture.makePosition 10.0 "strat_A"
        let p2 = Fixture.makePosition 10.0 "strat_B"
        let state = Fixture.makeState 1000.0
        let stateWithPos = { state with Portfolio = { state.Portfolio with Positions = [p1; p2] } }

        let defSum = DefineStatement { Name = "count"; Value = ExpressionValue(LiteralExpr(NumericLit(Number 0.0))) }
        let loop = ForAnyPositionStatement {
            PositionType = "strat_A"
            InstanceVariable = "p"
            Block = [ 
                SetStatement { 
                    Name = "count"; 
                    Value = ArithmeticExpr(Add, IdentifierExpr "count", LiteralExpr(NumericLit(Number 1.0))) 
                } 
            ]
        }

        let finalState = interpretStep { Statements = [defSum; loop] } stateWithPos (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        assertVarExists "count" 1.0 finalState

    [<Fact>]
    member _.``INT-4.6 Loop with Conditional``() =
        let p1 = Fixture.makePosition 10.0 "strat"
        let p2 = Fixture.makePosition 50.0 "strat"
        let state = Fixture.makeState 1000.0
        let stateWithPos = { state with Portfolio = { state.Portfolio with Positions = [p1; p2] } }

        let defSum = DefineStatement { Name = "sum"; Value = ExpressionValue(LiteralExpr(NumericLit(Number 0.0))) }
        let loop = ForAnyPositionStatement {
            PositionType = "strat"
            InstanceVariable = "p"
            Block = [
                ConditionalStatement {
                    Condition = ComparisonCond(
                        Greater, 
                        PropertyAccessExpr { Object = IdentifierExpr "p"; Property = "quantity" }, 
                        LiteralExpr(NumericLit(Number 20.0))
                    )
                    ThenBlock = [
                        SetStatement { 
                            Name = "sum"; 
                            Value = ArithmeticExpr(Add, IdentifierExpr "sum", LiteralExpr(NumericLit(Number 1.0))) 
                        } 
                    ]
                }
            ]
        }

        let finalState = interpretStep { Statements = [defSum; loop] } stateWithPos (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        assertVarExists "sum" 1.0 finalState