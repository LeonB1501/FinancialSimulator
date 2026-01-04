module InterpreterTests_Actions

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

    let withPosition (qty: float) (defName: string) (state: EvaluationState) =
        let pos = { 
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
        { state with Portfolio = { state.Portfolio with Positions = pos :: state.Portfolio.Positions } }

// ============================================================================
// Category 9: Position Definition and Reference
// ============================================================================
type PositionDefinitionSuite() =

    [<Fact>]
    member _.``INT-9.1 Define Simple Position``() =
        let def = DefineStatement { 
            Name = "my_pos"; 
            Value = PositionValue(
                ComponentExpr(BuyComponent(LiteralQuantity(Number 10.0), Asset(SimpleAsset "spy")))
            ) 
        }
        
        let finalState = interpretStep { Statements = [def] } (Fixture.makeState 1000.0) (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        match finalState.GlobalScope.["my_pos"] with
        | V_Position _ -> ()
        | v -> failwith $"Expected V_Position, got {v}"

    [<Fact>]
    member _.``INT-9.2 Define Compound Position``() =
        let comp1 = ComponentExpr(BuyComponent(LiteralQuantity(Number 1.0), Asset(SimpleAsset "spy")))
        let comp2 = ComponentExpr(SellComponent(LiteralQuantity(Number 1.0), Asset(SimpleAsset "spy")))
        
        let def = DefineStatement { 
            Name = "spread"; 
            Value = PositionValue(CompoundExpr(comp1, comp2))
        }
        
        let finalState = interpretStep { Statements = [def] } (Fixture.makeState 1000.0) (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        match finalState.GlobalScope.["spread"] with
        | V_Position (CompoundExpr _) -> () 
        | v -> failwith $"Expected Compound V_Position, got {v}"

    [<Fact>]
    member _.``INT-9.4 Position with Variable Quantity``() =
        let defQty = DefineStatement { Name = "qty"; Value = ExpressionValue(LiteralExpr(NumericLit(Number 50.0))) }
        let defPos = DefineStatement { 
            Name = "my_pos"; 
            Value = PositionValue(
                ComponentExpr(BuyComponent(IdentifierQuantity("qty"), Asset(SimpleAsset "spy")))
            ) 
        }
        
        let finalState = interpretStep { Statements = [defQty; defPos] } (Fixture.makeState 1000.0) (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        match finalState.GlobalScope.["my_pos"] with
        | V_Position (ComponentExpr(BuyComponent(IdentifierQuantity "qty", _))) -> ()
        | v -> failwith $"Expected IdentifierQuantity, got {v}"

// ============================================================================
// Category 10: Buy Actions
// ============================================================================
type BuyActionSuite() =

    [<Fact>]
    member _.``INT-10.1 Simple Buy Action``() =
        let action = ActionStatement(Buy(LiteralQuantity(Number 10.0), AssetTarget(SimpleAsset "spy")))
        
        let finalState = interpretStep { Statements = [action] } (Fixture.makeState 10000.0) (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        Assert.Equal(9000.0, finalState.Portfolio.Cash)
        Assert.Equal(1, finalState.Portfolio.Positions.Length)
        Assert.Equal(10.0, finalState.Portfolio.Positions.Head.Quantity)

    [<Fact>]
    member _.``INT-10.3 Buy Position Definition``() =
        let def = DefineStatement { 
            Name = "my_pos"; 
            Value = PositionValue(ComponentExpr(BuyComponent(LiteralQuantity(Number 5.0), Asset(SimpleAsset "spy")))) 
        }
        let buy = ActionStatement(Buy(LiteralQuantity(Number 2.0), IdentifierTarget "my_pos"))
        
        let finalState = interpretStep { Statements = [def; buy] } (Fixture.makeState 10000.0) (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        Assert.Equal(9000.0, finalState.Portfolio.Cash)
        Assert.Equal(10.0, finalState.Portfolio.Positions.Head.Quantity)

    [<Fact>]
    member _.``INT-10.4 Buy with Variable Quantity``() =
        let def = DefineStatement { Name = "q"; Value = ExpressionValue(LiteralExpr(NumericLit(Number 20.0))) }
        let buy = ActionStatement(Buy(IdentifierQuantity "q", AssetTarget(SimpleAsset "spy")))
        
        let finalState = interpretStep { Statements = [def; buy] } (Fixture.makeState 10000.0) (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        Assert.Equal(8000.0, finalState.Portfolio.Cash)
        Assert.Equal(20.0, finalState.Portfolio.Positions.Head.Quantity)

    [<Fact>]
    member _.``INT-10.5 Buy Fails Risk Validation``() =
        let action = ActionStatement(Buy(LiteralQuantity(Number 100.0), AssetTarget(SimpleAsset "spy")))
        let initialState = Fixture.makeState 100.0
        
        let finalState = interpretStep { Statements = [action] } initialState (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        Assert.Equal(100.0, finalState.Portfolio.Cash)
        Assert.Empty(finalState.Portfolio.Positions)

// ============================================================================
// Category 11: Sell Actions
// ============================================================================
type SellActionSuite() =

    [<Fact>]
    member _.``INT-11.1 Simple Sell Action (Close Long)``() =
        let initialState = Fixture.makeState 0.0 |> Fixture.withPosition 10.0 "long"
        let action = ActionStatement(Sell(LiteralQuantity(Number 10.0), AssetTarget(SimpleAsset "spy")))
        
        let finalState = interpretStep { Statements = [action] } initialState (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        Assert.Equal(1000.0, finalState.Portfolio.Cash)
        Assert.Empty(finalState.Portfolio.Positions)

    [<Fact>]
    member _.``INT-11.1 Simple Sell Action (Open Short)``() =
        let action = ActionStatement(Sell(LiteralQuantity(Number 10.0), AssetTarget(SimpleAsset "spy")))
        let finalState = interpretStep { Statements = [action] } (Fixture.makeState 10000.0) (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        Assert.Equal(11000.0, finalState.Portfolio.Cash)
        Assert.Equal(1, finalState.Portfolio.Positions.Length)
        Assert.Equal(-10.0, finalState.Portfolio.Positions.Head.Quantity)

    [<Fact>]
    member _.``INT-11.3 Sell Position Definition``() =
        let initialState = Fixture.makeState 0.0 |> Fixture.withPosition 20.0 "existing"
        
        let def = DefineStatement { 
            Name = "my_pos"; 
            Value = PositionValue(ComponentExpr(BuyComponent(LiteralQuantity(Number 5.0), Asset(SimpleAsset "spy")))) 
        }
        let sell = ActionStatement(Sell(LiteralQuantity(Number 2.0), IdentifierTarget "my_pos"))
        
        let finalState = interpretStep { Statements = [def; sell] } initialState (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        Assert.Equal(1000.0, finalState.Portfolio.Cash)
        Assert.Equal(10.0, finalState.Portfolio.Positions.Head.Quantity)


    [<Fact>]
    member _.``INT-11.5 Sell FIFO Logic``() =
        let state = Fixture.makeState 0.0
        
        let makePos qty date = 
            { 
                Id = Fixture.makeGuid()
                GroupId = None
                DefinitionName = "fifo_test"
                ComponentName = None
                ParentId = None
                BuyPrice = 100.0
                BuyDate = date
                Quantity = qty
                Instrument = ResolvedAsset(SimpleAsset "spy") 
            }

        let p1 = makePos 10.0 1
        let p2 = makePos 10.0 5
        
        let stateWithPos = { state with Portfolio = { state.Portfolio with Positions = [p1; p2] } }
        
        let action = ActionStatement(Sell(LiteralQuantity(Number 15.0), AssetTarget(SimpleAsset "spy")))
        let finalState = interpretStep { Statements = [action] } stateWithPos (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        Assert.Equal(1, finalState.Portfolio.Positions.Length)
        let remaining = finalState.Portfolio.Positions.Head
        Assert.Equal(5.0, remaining.Quantity)
        Assert.Equal(5, remaining.BuyDate)
        
// ============================================================================
// Category 12: SellAll Action
// ============================================================================
type SellAllActionSuite() =

    let makeFullPos (qty: float) (defName: string) (instrument: ResolvedInstrument) (buyDate: int) = 
        { 
            Id = Fixture.makeGuid()
            GroupId = None
            DefinitionName = defName
            ComponentName = None
            ParentId = None
            BuyPrice = 100.0
            BuyDate = buyDate
            Quantity = qty
            Instrument = instrument 
        }

    [<Fact>]
    member _.``INT-12.1 SellAll Simple Asset``() =
        let state = Fixture.makeState 0.0
        let spyInst = ResolvedAsset(SimpleAsset "spy")
        
        let p1 = makeFullPos 10.0 "A" spyInst 0
        let p2 = makeFullPos 20.0 "B" spyInst 1
        
        let stateWithPos = { state with Portfolio = { state.Portfolio with Positions = [p1; p2] } }
        
        let action = ActionStatement(SellAll(AssetTarget(SimpleAsset "spy")))
        let finalState = interpretStep { Statements = [action] } stateWithPos (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        Assert.Empty(finalState.Portfolio.Positions)
        Assert.Equal(3000.0, finalState.Portfolio.Cash)

    [<Fact>]
    member _.``INT-12.1 SellAll Nonexistent Asset``() =
        let state = Fixture.makeState 0.0 |> Fixture.withPosition 10.0 "spy_pos"
        let action = ActionStatement(SellAll(AssetTarget(SimpleAsset "qqq")))
        
        let finalState = interpretStep { Statements = [action] } state (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        Assert.Equal(1, finalState.Portfolio.Positions.Length)
        Assert.Equal(10.0, finalState.Portfolio.Positions.Head.Quantity)

    [<Fact>]
    member _.``INT-12.2 SellAll Position Definition``() =
        let state = Fixture.makeState 0.0
        let spyInst = ResolvedAsset(SimpleAsset "spy")
        
        let p1 = makeFullPos 10.0 "my_strat" spyInst 0
        let p2 = makeFullPos 10.0 "other_strat" spyInst 0
        
        let posExpr = ComponentExpr(BuyComponent(LiteralQuantity(Number 1.0), Asset(SimpleAsset "spy")))
        let scope = Map.ofList ["my_strat", V_Position posExpr]
        
        let stateWithPos = { 
            state with 
                Portfolio = { state.Portfolio with Positions = [p1; p2] }
                GlobalScope = scope 
        }
        
        let action = ActionStatement(SellAll(IdentifierTarget "my_strat"))
        let finalState = interpretStep { Statements = [action] } stateWithPos (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        Assert.Equal(1, finalState.Portfolio.Positions.Length)
        Assert.Equal("other_strat", finalState.Portfolio.Positions.Head.DefinitionName)
        Assert.Equal(1000.0, finalState.Portfolio.Cash)
        
// ============================================================================
// Category 13: BuyMax Action
// ============================================================================
type BuyMaxActionSuite() =

    [<Fact>]
    member _.``INT-13.1 BuyMax Simple Asset``() =
        let state = Fixture.makeState 550.0
        let action = ActionStatement(BuyMax(AssetTarget(SimpleAsset "spy")))
        
        let finalState = interpretStep { Statements = [action] } state (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        Assert.Equal(1, finalState.Portfolio.Positions.Length)
        let qty = finalState.Portfolio.Positions.Head.Quantity
        Assert.Equal(5.0, qty)
        Assert.Equal(50.0, finalState.Portfolio.Cash)

    [<Fact>]
    member _.``INT-13.3 BuyMax Position Definition``() =
        let def = DefineStatement { 
            Name = "my_pos"; 
            Value = PositionValue(ComponentExpr(BuyComponent(LiteralQuantity(Number 2.0), Asset(SimpleAsset "spy")))) 
        }
        let action = ActionStatement(BuyMax(IdentifierTarget "my_pos"))
        
        let finalState = interpretStep { Statements = [def; action] } (Fixture.makeState 1050.0) (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        Assert.Equal(1, finalState.Portfolio.Positions.Length)
        Assert.Equal(10.0, finalState.Portfolio.Positions.Head.Quantity)
        Assert.Equal(50.0, finalState.Portfolio.Cash)

    [<Fact>]
    member _.``INT-13.4 BuyMax with Insufficient Cash``() =
        let state = Fixture.makeState 50.0
        let action = ActionStatement(BuyMax(AssetTarget(SimpleAsset "spy")))
        
        let finalState = interpretStep { Statements = [action] } state (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        Assert.Empty(finalState.Portfolio.Positions)
        Assert.Equal(50.0, finalState.Portfolio.Cash)

// ============================================================================
// Category 14: RebalanceTo Action
// ============================================================================
type RebalanceActionSuite() =

    [<Fact>]
    member _.``INT-14.1 Rebalance Increase (Buy)``() =
        let state = Fixture.makeState 10000.0
        let action = ActionStatement(RebalanceTo(50.0, AssetTarget(SimpleAsset "spy")))
        
        let finalState = interpretStep { Statements = [action] } state (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        Assert.Equal(1, finalState.Portfolio.Positions.Length)
        Assert.Equal(50.0, finalState.Portfolio.Positions.Head.Quantity)
        Assert.Equal(5000.0, finalState.Portfolio.Cash)

    [<Fact>]
    member _.``INT-14.1 Rebalance Decrease (Sell)``() =
        let state = Fixture.makeState 0.0 |> Fixture.withPosition 100.0 "existing"
        let action = ActionStatement(RebalanceTo(40.0, AssetTarget(SimpleAsset "spy")))
        
        let finalState = interpretStep { Statements = [action] } state (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        Assert.Equal(1, finalState.Portfolio.Positions.Length)
        Assert.Equal(40.0, finalState.Portfolio.Positions.Head.Quantity)
        Assert.Equal(6000.0, finalState.Portfolio.Cash)

    [<Fact>]
    member _.``INT-14.2 Rebalance to 0% (Liquidate)``() =
        let state = Fixture.makeState 0.0 |> Fixture.withPosition 100.0 "existing"
        let action = ActionStatement(RebalanceTo(0.0, AssetTarget(SimpleAsset "spy")))
        
        let finalState = interpretStep { Statements = [action] } state (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        Assert.Empty(finalState.Portfolio.Positions)
        Assert.Equal(10000.0, finalState.Portfolio.Cash)

    [<Fact>]
    member _.``INT-14.2 Rebalance to 100% (All In)``() =
        let state = Fixture.makeState 10000.0
        let action = ActionStatement(RebalanceTo(100.0, AssetTarget(SimpleAsset "spy")))
        
        let finalState = interpretStep { Statements = [action] } state (Fixture.makeHistory 100.0) Fixture.zeroCosts Fixture.zeroTax
        
        Assert.Equal(1, finalState.Portfolio.Positions.Length)
        Assert.Equal(100.0, finalState.Portfolio.Positions.Head.Quantity)
        Assert.Equal(0.0, finalState.Portfolio.Cash)