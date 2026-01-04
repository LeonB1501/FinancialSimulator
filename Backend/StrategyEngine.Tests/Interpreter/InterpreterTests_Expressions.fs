module InterpreterTests_Expressions

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

    let eval (expr: Expression) =
        let state = makeState 10000.0
        let history = makeHistory 100.0
        let stmt = DefineStatement { Name = "result"; Value = ExpressionValue expr }
        let prog = { Statements = [stmt] }
        let finalState = interpretStep prog state history zeroCosts zeroTax
        finalState.GlobalScope.["result"]

// ============================================================================
// Category 1: Literals & Arithmetic
// ============================================================================
type ExpressionSuite() =
    
    let assertFloat expected actual =
        match actual with
        | V_Float f -> Assert.Equal(expected, f)
        | _ -> failwith $"Expected V_Float {expected}, got {actual}"

    let assertDollar expected actual =
        match actual with
        | V_Dollar d -> Assert.Equal(expected, d)
        | _ -> failwith $"Expected V_Dollar {expected}, got {actual}"

    let assertPercent expected actual =
        match actual with
        | V_Percent p -> Assert.Equal(expected, p)
        | _ -> failwith $"Expected V_Percent {expected}, got {actual}"

    let assertBool expected actual =
        match actual with
        | V_Bool b -> Assert.Equal(expected, b)
        | _ -> failwith $"Expected V_Bool {expected}, got {actual}"

    [<Fact>]
    member _.``INT-1.1 Numeric Literals``() =
        Fixture.eval (LiteralExpr(NumericLit(Number 42.0))) |> assertFloat 42.0
        Fixture.eval (LiteralExpr(NumericLit(Percentage 25.0))) |> assertPercent 25.0
        Fixture.eval (LiteralExpr(NumericLit(Dollar 100.50))) |> assertDollar 100.50

    [<Fact>]
    member _.``INT-1.2 Boolean Literals``() =
        Fixture.eval (LiteralExpr(BoolLit True)) |> assertBool true
        Fixture.eval (LiteralExpr(BoolLit False)) |> assertBool false

    [<Fact>]
    member _.``INT-1.3 Arithmetic Homogeneous``() =
        Fixture.eval (ArithmeticExpr(Add, LiteralExpr(NumericLit(Number 5.0)), LiteralExpr(NumericLit(Number 3.0))))
        |> assertFloat 8.0
        
        Fixture.eval (ArithmeticExpr(Subtract, LiteralExpr(NumericLit(Dollar 100.0)), LiteralExpr(NumericLit(Dollar 30.0))))
        |> assertDollar 70.0

    [<Fact>]
    member _.``INT-1.4 Arithmetic Mixed Types``() =
        Fixture.eval (ArithmeticExpr(Multiply, LiteralExpr(NumericLit(Number 10.0)), LiteralExpr(NumericLit(Percentage 25.0))))
        |> assertPercent 250.0 

        Fixture.eval (ArithmeticExpr(Multiply, LiteralExpr(NumericLit(Number 2.0)), LiteralExpr(NumericLit(Dollar 50.0))))
        |> assertDollar 100.0

    [<Fact>]
    member _.``INT-1.5 Division by Zero``() =
        let expr = ArithmeticExpr(Divide, LiteralExpr(NumericLit(Number 10.0)), LiteralExpr(NumericLit(Number 0.0)))
        Assert.Throws<InterpreterError>(fun () -> Fixture.eval expr |> ignore) |> ignore

    [<Fact>]
    member _.``INT-1.6 Precedence (Parentheses)``() =
        let inner = ArithmeticExpr(Add, LiteralExpr(NumericLit(Number 2.0)), LiteralExpr(NumericLit(Number 3.0)))
        let expr = ArithmeticExpr(Multiply, ParenExpr(inner), LiteralExpr(NumericLit(Number 4.0)))
        Fixture.eval expr |> assertFloat 20.0

// ============================================================================
// Category 2: Variable Binding & Scoping
// ============================================================================
type VariableSuite() =
    
    [<Fact>]
    member _.``INT-2.1 Global Variable Definition``() =
        let stmt = DefineStatement { Name = "x"; Value = ExpressionValue(LiteralExpr(NumericLit(Number 42.0))) }
        let state = Fixture.makeState 1000.0
        let finalState = interpretStep { Statements = [stmt] } state (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        match finalState.GlobalScope.["x"] with
        | V_Float 42.0 -> ()
        | v -> failwith $"Expected 42.0, got {v}"

    [<Fact>]
    member _.``INT-2.1 Define Variable Referencing Another``() =
        let s1 = DefineStatement { Name = "x"; Value = ExpressionValue(LiteralExpr(NumericLit(Number 10.0))) }
        let s2 = DefineStatement { Name = "y"; Value = ExpressionValue(ArithmeticExpr(Add, IdentifierExpr "x", LiteralExpr(NumericLit(Number 5.0)))) }
        
        let state = Fixture.makeState 1000.0
        let finalState = interpretStep { Statements = [s1; s2] } state (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        match finalState.GlobalScope.["y"] with
        | V_Float 15.0 -> ()
        | v -> failwith $"Expected 15.0, got {v}"

    [<Fact>]
    member _.``INT-2.3 Set Variable``() =
        let s1 = DefineStatement { Name = "x"; Value = ExpressionValue(LiteralExpr(NumericLit(Number 10.0))) }
        let s2 = SetStatement { Name = "x"; Value = LiteralExpr(NumericLit(Number 20.0)) }
        
        let state = Fixture.makeState 1000.0
        let finalState = interpretStep { Statements = [s1; s2] } state (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        match finalState.GlobalScope.["x"] with
        | V_Float 20.0 -> ()
        | v -> failwith $"Expected 20.0, got {v}"

    [<Fact>]
    member _.``INT-2.3 Set Unbound Variable Fails``() =
        let s1 = SetStatement { Name = "z"; Value = LiteralExpr(NumericLit(Number 10.0)) }
        let state = Fixture.makeState 1000.0
        Assert.Throws<InterpreterError>(fun () -> interpretStep { Statements = [s1] } state (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax |> ignore) |> ignore

    [<Fact>]
    member _.``INT-2.2 Local Scope Shadowing``() =
        let s1 = DefineStatement { Name = "x"; Value = ExpressionValue(LiteralExpr(NumericLit(Number 10.0))) }
        let blockStmt = DefineStatement { Name = "x"; Value = ExpressionValue(LiteralExpr(NumericLit(Number 20.0))) }
        let s2 = ConditionalStatement { 
            Condition = BooleanExpr(LiteralExpr(BoolLit True)); 
            ThenBlock = [blockStmt] 
        }
        
        let state = Fixture.makeState 1000.0
        let finalState = interpretStep { Statements = [s1; s2] } state (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        match finalState.GlobalScope.["x"] with
        | V_Float 10.0 -> ()
        | V_Float 20.0 -> failwith "Local variable leaked into global scope!"
        | v -> failwith $"Unexpected value {v}"

// ============================================================================
// Category 5: Asset Expressions
// ============================================================================
type AssetSuite() =
    
    let assertDollar expected actual =
        match actual with
        | V_Dollar d -> Assert.Equal(expected, d)
        | _ -> failwith $"Expected V_Dollar {expected}, got {actual}"

    [<Fact>]
    member _.``INT-5.1 Simple Asset Reference``() =
        let expr = AssetExpr(SimpleAsset "spy")
        let history = Fixture.makeHistory 400.0
        let state = Fixture.makeState 10000.0
        
        let stmt = DefineStatement { Name = "res"; Value = ExpressionValue expr }
        let finalState = interpretStep { Statements = [stmt] } state history Fixture.zeroCosts Fixture.zeroTax
        
        finalState.GlobalScope.["res"] |> assertDollar 400.0

    [<Fact>]
    member _.``INT-5.2 Leveraged Asset Reference``() =
        let expr = AssetExpr(LeveragedAsset("spy", 3.0))
        let history = [ { Ticker = "3x_spy"; DailyData = [| { Price = 120.0; Vol = 0.6 } |] } ]
        let state = Fixture.makeState 10000.0
        
        let stmt = DefineStatement { Name = "res"; Value = ExpressionValue expr }
        let finalState = interpretStep { Statements = [stmt] } state history Fixture.zeroCosts Fixture.zeroTax
        
        finalState.GlobalScope.["res"] |> assertDollar 120.0

    [<Fact>]
    member _.``INT-5.3 Asset in Arithmetic``() =
        let expr = ArithmeticExpr(Add, AssetExpr(SimpleAsset "spy"), LiteralExpr(NumericLit(Dollar 10.0)))
        let history = Fixture.makeHistory 400.0
        let state = Fixture.makeState 10000.0
        
        let stmt = DefineStatement { Name = "res"; Value = ExpressionValue expr }
        let finalState = interpretStep { Statements = [stmt] } state history Fixture.zeroCosts Fixture.zeroTax
        
        finalState.GlobalScope.["res"] |> assertDollar 410.0

// ============================================================================
// Category 6: Indicator Expressions
// ============================================================================
type IndicatorSuite() =
    
    let assertFloat expected actual =
        match actual with
        | V_Float f -> Assert.Equal(expected, f)
        | _ -> failwith $"Expected V_Float {expected}, got {actual}"

    let makeHistorySeries (prices: float list) =
        let data = prices |> List.map (fun p -> { Price = p; Vol = 0.0 }) |> List.toArray
        [ { Ticker = "spy"; DailyData = data } ]

    [<Fact>]
    member _.``INT-6.1 SMA Indicator``() =
        let prices = [100.0; 102.0; 104.0; 106.0]
        let history = makeHistorySeries prices
        let state = { Fixture.makeState 10000.0 with CurrentDay = 3 }
        
        let expr = IndicatorExpr { Asset = "spy"; IndicatorType = SMA; Period = Some 3 }
        
        let stmt = DefineStatement { Name = "res"; Value = ExpressionValue expr }
        let finalState = interpretStep { Statements = [stmt] } state history Fixture.zeroCosts Fixture.zeroTax
        
        finalState.GlobalScope.["res"] |> assertFloat 104.0

    [<Fact>]
    member _.``INT-6.5 Return Indicator``() =
        let prices = [100.0; 110.0]
        let history = makeHistorySeries prices
        let state = { Fixture.makeState 10000.0 with CurrentDay = 1 }
        
        let expr = IndicatorExpr { Asset = "spy"; IndicatorType = Return; Period = Some 1 }
        
        let stmt = DefineStatement { Name = "res"; Value = ExpressionValue expr }
        let finalState = interpretStep { Statements = [stmt] } state history Fixture.zeroCosts Fixture.zeroTax
        
        finalState.GlobalScope.["res"] |> assertFloat 0.10

    [<Fact>]
    member _.``INT-6.8 Missing Ticker Returns Zero``() =
        let history = Fixture.makeHistory 100.0
        let state = Fixture.makeState 10000.0
        let expr = IndicatorExpr { Asset = "unknown"; IndicatorType = SMA; Period = Some 10 }
        
        let stmt = DefineStatement { Name = "res"; Value = ExpressionValue expr }
        let finalState = interpretStep { Statements = [stmt] } state history Fixture.zeroCosts Fixture.zeroTax
        
        finalState.GlobalScope.["res"] |> assertFloat 0.0

// ============================================================================
// Category 7: Portfolio Query Expressions
// ============================================================================
type PortfolioQuerySuite() =
    
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

    let assertDollar expected actual =
        match actual with
        | V_Dollar d -> Assert.Equal(expected, d)
        | _ -> failwith $"Expected V_Dollar {expected}, got {actual}"

    let assertFloat expected actual =
        match actual with
        | V_Float f -> Assert.Equal(expected, f)
        | _ -> failwith $"Expected V_Float {expected}, got {actual}"

    [<Fact>]
    member _.``INT-7.1 Cash Available``() =
        let state = Fixture.makeState 5500.0
        let expr = PortfolioQueryExpr(CashAvailable)
        
        let stmt = DefineStatement { Name = "res"; Value = ExpressionValue expr }
        let finalState = interpretStep { Statements = [stmt] } state (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        finalState.GlobalScope.["res"] |> assertDollar 5500.0

    [<Fact>]
    member _.``INT-7.2 Portfolio Value``() =
        let pos = makePosition 10.0 "long_spy"
        let state = Fixture.makeState 1000.0
        let stateWithPos = { state with Portfolio = { state.Portfolio with Positions = [pos] } }
        let history = Fixture.makeHistory 150.0
        
        let expr = PortfolioQueryExpr(PortfolioValue)
        let stmt = DefineStatement { Name = "res"; Value = ExpressionValue expr }
        let finalState = interpretStep { Statements = [stmt] } stateWithPos history Fixture.zeroCosts Fixture.zeroTax
        
        finalState.GlobalScope.["res"] |> assertDollar 2500.0

    [<Fact>]
    member _.``INT-7.3 Position Quantity``() =
        let pos1 = makePosition 10.0 "strat_A"
        let pos2 = makePosition 20.0 "strat_B"
        let state = Fixture.makeState 0.0
        let stateWithPos = { state with Portfolio = { state.Portfolio with Positions = [pos1; pos2] } }
        
        let expr = PortfolioQueryExpr(PositionQuantity "spy")
        let stmt = DefineStatement { Name = "res"; Value = ExpressionValue expr }
        let finalState = interpretStep { Statements = [stmt] } stateWithPos (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        finalState.GlobalScope.["res"] |> assertFloat 30.0

    [<Fact>]
    member _.``INT-7.4 Position Value``() =
        let pos = makePosition 10.0 "strat_A"
        let state = Fixture.makeState 0.0
        let stateWithPos = { state with Portfolio = { state.Portfolio with Positions = [pos] } }
        let history = Fixture.makeHistory 200.0
        
        let expr = PortfolioQueryExpr(AST.PortfolioQuery.PositionValue "strat_A")
        let stmt = DefineStatement { Name = "res"; Value = ExpressionValue expr }
        let finalState = interpretStep { Statements = [stmt] } stateWithPos history Fixture.zeroCosts Fixture.zeroTax
        
        finalState.GlobalScope.["res"] |> assertDollar 2000.0

// ============================================================================
// Category 8: Property Access
// ============================================================================
type PropertyAccessSuite() =
    
    let makeGuid () = Guid.NewGuid()
    let spy = ResolvedAsset(SimpleAsset "spy")
    
    let evalProperty (instance: PositionInstance) (propName: string) (history: FullPriceHistory) =
        let state = Fixture.makeState 10000.0
        let scope = Map.ofList ["p", V_Instance instance]
        let stateWithVar = { state with GlobalScope = scope }
        
        let expr = PropertyAccessExpr { Object = IdentifierExpr "p"; Property = propName }
        let stmt = DefineStatement { Name = "res"; Value = ExpressionValue expr }
        let finalState = interpretStep { Statements = [stmt] } stateWithVar history Fixture.zeroCosts Fixture.zeroTax
        finalState.GlobalScope.["res"]

    let assertFloat expected actual =
        match actual with
        | V_Float f -> Assert.Equal(expected, f)
        | _ -> failwith $"Expected V_Float {expected}, got {actual}"

    let assertDollar expected actual =
        match actual with
        | V_Dollar d -> Assert.Equal(expected, d)
        | _ -> failwith $"Expected V_Dollar {expected}, got {actual}"

    [<Fact>]
    member _.``INT-8.1 Asset Quantity Property``() =
        let pos = { 
            Id = makeGuid(); GroupId = None; DefinitionName = "test"; ComponentName = None; ParentId = None;
            BuyPrice = 100.0; BuyDate = 5; Quantity = 50.0; Instrument = spy 
        }
        
        evalProperty pos "quantity" (Fixture.makeHistory 100.0) |> assertFloat 50.0

    [<Fact>]
    member _.``INT-8.1 Asset Buy Price Property``() =
        let pos = { 
            Id = makeGuid(); GroupId = None; DefinitionName = "test"; ComponentName = None; ParentId = None;
            BuyPrice = 123.45; BuyDate = 5; Quantity = 50.0; Instrument = spy 
        }
        
        evalProperty pos "buy_price" (Fixture.makeHistory 100.0) |> assertDollar 123.45

    [<Fact>]
    member _.``INT-8.1 Asset Current Value Property``() =
        let pos = { 
            Id = makeGuid(); GroupId = None; DefinitionName = "test"; ComponentName = None; ParentId = None;
            BuyPrice = 100.0; BuyDate = 0; Quantity = 10.0; Instrument = spy 
        }
        
        evalProperty pos "value" (Fixture.makeHistory 200.0) |> assertDollar 2000.0

    [<Fact>]
    member _.``INT-8.2 Option Delta Property``() =
        let opt = ResolvedOption { Underlying = SimpleAsset "spy"; Strike = 100.0; ExpiryDay = 30; IsCall = true }
        let pos = { 
            Id = makeGuid(); GroupId = None; DefinitionName = "test"; ComponentName = None; ParentId = None;
            BuyPrice = 5.0; BuyDate = 0; Quantity = 1.0; Instrument = opt 
        }
        
        let result = evalProperty pos "delta" (Fixture.makeHistory 100.0)
        
        match result with
        | V_Float d -> Assert.InRange(d, 0.4, 0.6)
        | _ -> failwith "Expected float delta"

    [<Fact>]
    member _.``INT-8.4 Property on Non-Instance Fails``() =
        let state = Fixture.makeState 10000.0
        let s1 = DefineStatement { Name = "x"; Value = ExpressionValue(LiteralExpr(NumericLit(Number 10.0))) }
        let s2 = DefineStatement { 
            Name = "res"; 
            Value = ExpressionValue(PropertyAccessExpr { Object = IdentifierExpr "x"; Property = "quantity" }) 
        }
        
        Assert.Throws<InterpreterError>(fun () -> 
            interpretStep { Statements = [s1; s2] } state (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax |> ignore
        ) |> ignore