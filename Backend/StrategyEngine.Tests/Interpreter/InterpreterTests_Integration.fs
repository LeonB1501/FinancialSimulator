module InterpreterTests_Integration

open Xunit
open FsUnit.Xunit
open AST
open EngineTypes
open Interpreter
open Lexer
open Parser
open System

// ============================================================================
// TEST FIXTURE (Integration Level)
// ============================================================================
module Fixture =
    let emptyPortfolio = { 
        Cash = 100000.0; 
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
        [ { Ticker = "spy"; DailyData = [| { Price = price; Vol = 0.2 } |] } 
          { Ticker = "qqq"; DailyData = [| { Price = price; Vol = 0.2 } |] } ]

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

    let run (code: string) (state: EvaluationState) (history: FullPriceHistory) =
        printfn "--- RUNNING DSL ---"
        printfn "Code: %s" code
        
        let tickers = Set.ofList ["spy"; "qqq"; "t_bills"]
        let tokens = Lexer.lex tickers code
        let program = Parser.run tokens
        
        try
            let finalState = Interpreter.interpretStep program state history zeroCosts zeroTax
            finalState
        with ex ->
            printfn "INTERPRETER ERROR: %s" ex.Message
            reraise()

    let assertCash expected state =
        Assert.Equal(expected, state.Portfolio.Cash)

    let assertPositionCount expected state =
        Assert.Equal(expected, state.Portfolio.Positions.Length)

// ============================================================================
// Category 15: Multi-Statement Programs
// ============================================================================
type MultiStatementSuite() =
    
    [<Fact>]
    member _.``INT-15.1 Sequential Execution``() =
        let code = """
            define capital as $10000
            define allocation as 0.5
            define target_val as capital * allocation
            
            buy (target_val / spy) spy
        """
        
        let state = Fixture.makeState 10000.0
        let finalState = Fixture.run code state (Fixture.makeHistory 100.0)
        
        Fixture.assertCash 5000.0 finalState
        Fixture.assertPositionCount 1 finalState
        Assert.Equal(50.0, finalState.Portfolio.Positions.Head.Quantity)

    [<Fact>]
    member _.``INT-15.2 State Propagation``() =
        let code = """
            buy 10 spy
            buy 10 qqq
        """
        
        let state = Fixture.makeState 5000.0
        let finalState = Fixture.run code state (Fixture.makeHistory 100.0)
        
        Fixture.assertCash 3000.0 finalState
        Fixture.assertPositionCount 2 finalState

    [<Fact>]
    member _.``INT-15.3 Complex Flow with Conditionals``() =
        let code = """
            define limit as $150
            
            when spy < limit:
                buy 10 spy
            end
            
            when spy > limit:
                buy 10 qqq
            end
        """
        
        let state = Fixture.makeState 5000.0
        let finalState = Fixture.run code state (Fixture.makeHistory 100.0)
        
        Fixture.assertPositionCount 1 finalState
        let pos = finalState.Portfolio.Positions.Head
        
        match pos.Instrument with
        | ResolvedAsset(SimpleAsset "spy") -> ()
        | _ -> failwith "Expected SPY position"

// ============================================================================
// Category 16: Option Specifications and Greeks
// ============================================================================
type OptionsIntegrationSuite() =

    [<Fact>]
    member _.``INT-16.1 Buy Option via DSL``() =
        let code = """
            define my_opt as buy 1 spy_30dte_50delta
            buy 1 my_opt
        """
        
        let state = Fixture.makeState 10000.0
        let finalState = Fixture.run code state (Fixture.makeHistory 100.0)
        
        Fixture.assertPositionCount 1 finalState
        let pos = finalState.Portfolio.Positions.Head
        
        match pos.Instrument with
        | ResolvedOption opt ->
            Assert.Equal(30, opt.ExpiryDay)
            Assert.True(opt.IsCall)
            Assert.InRange(opt.Strike, 95.0, 105.0)
        | _ -> failwith "Expected Option position"

    [<Fact>]
    member _.``INT-16.1 Buy Put Option (Negative Delta)``() =
        let code = """
            define my_put as buy 1 spy_30dte_minus30delta
            buy 1 my_put
        """
        
        let state = Fixture.makeState 10000.0
        let finalState = Fixture.run code state (Fixture.makeHistory 100.0)
        
        let pos = finalState.Portfolio.Positions.Head
        match pos.Instrument with
        | ResolvedOption opt ->
            Assert.False(opt.IsCall)
            Assert.True(opt.Strike < 100.0) 
        | _ -> failwith "Expected Option position"

    [<Fact>]
    member _.``INT-16.3 Option Pricing Integration``() =
        let code = """
            define my_opt as buy 1 spy_30dte_50delta
            buy 1 my_opt
        """
        
        let state = Fixture.makeState 10000.0
        let finalState = Fixture.run code state (Fixture.makeHistory 100.0)
        
        let cashUsed = 1000.0 - finalState.Portfolio.Cash
        Assert.True(cashUsed > 200.0)
        Assert.True(cashUsed < 400.0)

// ============================================================================
// Category 17: Composite Positions and GroupId
// ============================================================================
type CompositesIntegrationSuite() =

    [<Fact>]
    member _.``INT-17.1 Define and Buy Composite``() =
        let code = """
            define spread as buy 1 spy_30dte_50delta and sell 1 spy_30dte_60delta
            buy 1 spread
        """
        
        let state = Fixture.makeState 10000.0
        let finalState = Fixture.run code state (Fixture.makeHistory 100.0)
        
        Fixture.assertPositionCount 2 finalState
        
        let p1 = finalState.Portfolio.Positions.[0]
        let p2 = finalState.Portfolio.Positions.[1]
        
        Assert.True(p1.GroupId.IsSome)
        Assert.Equal(p1.GroupId, p2.GroupId)
        
        let quantities = [p1.Quantity; p2.Quantity] |> List.sort
        Assert.Equal(-1.0, quantities.[0])
        Assert.Equal(1.0, quantities.[1])

    [<Fact>]
    member _.``INT-17.1 Multiple Composite Purchases``() =
        let code = """
            define spread as buy 1 spy_30dte_50delta and sell 1 spy_30dte_60delta
            buy 1 spread
            buy 1 spread
        """
        
        let state = Fixture.makeState 10000.0
        let finalState = Fixture.run code state (Fixture.makeHistory 100.0)
        
        Fixture.assertPositionCount 4 finalState
        
        let groups = 
            finalState.Portfolio.Positions 
            |> List.groupBy (fun p -> p.GroupId)
        
        Assert.Equal(2, groups.Length)
        groups |> List.iter (fun (_, legs) -> Assert.Equal(2, legs.Length))

    [<Fact>]
    member _.``INT-17.3 Loop over Composite (Parent Only)``() =
        let code = """
            define spread as buy 1 spy_30dte_50delta and sell 1 spy_30dte_60delta
            buy 2 spread
            
            define count as 0
            for_any_position spread as s:
                set count to count + 1
            end
        """
        
        let state = Fixture.makeState 10000.0
        let finalState = Fixture.run code state (Fixture.makeHistory 100.0)
        
        match finalState.GlobalScope.["count"] with
        | V_Float 2.0 -> ()
        | v -> failwith $"Expected count 2.0, got {v}"

    [<Fact>]
    member _.``INT-17.4 Sell Composite via Loop``() =
        let code = """
            define spread as buy 1 spy_30dte_50delta and sell 1 spy_30dte_60delta
            buy 1 spread
            
            for_any_position spread as s:
                sell 1 s
            end
        """
        
        let state = Fixture.makeState 10000.0
        let finalState = Fixture.run code state (Fixture.makeHistory 100.0)
        
        Fixture.assertPositionCount 0 finalState
        Assert.Equal(10000.0, finalState.Portfolio.Cash, 2)