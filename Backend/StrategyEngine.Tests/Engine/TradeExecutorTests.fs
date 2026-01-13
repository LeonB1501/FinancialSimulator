module TradeExecutorTests

open Xunit
open FsUnit.Xunit
open AST
open EngineTypes
open TradeExecutor
open System

type TradeExecutorSuite() =

    // ============================================================================
    // HELPERS & FACTORIES
    // ============================================================================

    let makeGuid () = Guid.NewGuid()
    let currentDay = 0
    let r = 0.0 // Dummy risk free rate

    let zeroCosts = {
        Commission = { PerOrder = 0.0; PerUnit = 0.0 }
        Slippage = { DefaultSpread = 0.0; Tiers = [] }
    }

    // NEW: Dummy Tax Config
    let zeroTax = {
        PaymentMode = PeriodicSettlement 252
        ShortTermRate = 0.0
        LongTermRate = 0.0
        LongTermThreshold = 365
        WealthTaxRate = 0.0
    }

    // --- Assets ---
    let spy = ResolvedAsset(SimpleAsset "spy")
    let callOption = ResolvedOption { Underlying = SimpleAsset "spy"; Strike = 100.0; ExpiryDay = 30; IsCall = true }

    // --- History ---
    let makeHistory (price: float) =
        [ { Ticker = "spy"; DailyData = [| { Price = price; Vol = 0.2 } |] } ]

    // --- Portfolio ---
    let makePortfolio (cash: float) (positions: PositionInstance list) =
        { 
            Cash = cash; 
            Positions = positions; 
            CompositeRegistry = Map.empty;
            // NEW: Tax Fields
            TaxLots = []
            TaxLiabilityYTD = 0.0
            RealizedGainsYTD = 0.0
        }

    let makePosition (instrument: ResolvedInstrument) (qty: float) (buyDate: int) (groupId: Guid option) : PositionInstance =
        { Id = makeGuid(); GroupId = groupId; DefinitionName = "test"; ComponentName = None; ParentId = None;
          BuyPrice = 100.0; BuyDate = buyDate; Quantity = qty; Instrument = instrument }

    // --- Trades ---
    let makeBuy (instrument: ResolvedInstrument) (qty: float) (defName: string option) =
        PrimitiveBuy { 
            Instrument = instrument; Quantity = qty; 
            ComponentName = None; DefinitionName = defName 
        }

    let makeSell (instrument: ResolvedInstrument) (qty: float) (defName: string option) =
        PrimitiveSell { 
            Instrument = instrument; Quantity = qty; 
            ComponentName = None; DefinitionName = defName 
        }

    let makeRebalance (instrument: ResolvedInstrument) (pct: float) =
        PrimitiveRebalance { Instrument = instrument; TargetPercent = pct }

    // ============================================================================
    // Category 1: Basic Long Equity Operations
    // ============================================================================

    [<Fact>]
    member _.``TE-1.1 Simple Buy (Opening Long)``() =
        let portfolio = makePortfolio 10000.0 []
        let history = makeHistory 100.0
        let trade = makeBuy spy 10.0 None

        let (result, _) = executeTrades [trade] portfolio history currentDay r zeroCosts zeroTax

        Assert.Equal(9000.0, result.Cash)
        Assert.Equal(1, result.Positions.Length)
        Assert.Equal(10.0, result.Positions.Head.Quantity)

    [<Fact>]
    member _.``TE-1.2 Simple Sell (Closing Long)``() =
        let pos = makePosition spy 10.0 0 None
        let portfolio = makePortfolio 0.0 [pos]
        let history = makeHistory 110.0
        let trade = makeSell spy 10.0 None

        let (result, _) = executeTrades [trade] portfolio history currentDay r zeroCosts zeroTax

        Assert.Equal(1100.0, result.Cash)
        Assert.Empty(result.Positions)

    [<Fact>]
    member _.``TE-1.3 Partial Sell``() =
        let pos = makePosition spy 100.0 0 None
        let portfolio = makePortfolio 0.0 [pos]
        let history = makeHistory 100.0
        let trade = makeSell spy 40.0 None

        let (result, _) = executeTrades [trade] portfolio history currentDay r zeroCosts zeroTax

        Assert.Equal(4000.0, result.Cash)
        Assert.Equal(1, result.Positions.Length)
        Assert.Equal(60.0, result.Positions.Head.Quantity)

    // ============================================================================
    // Category 2: Short Selling & Covering
    // ============================================================================

    [<Fact>]
    member _.``TE-2.1 Sell Short (Opening Short)``() =
        let portfolio = makePortfolio 10000.0 []
        let history = makeHistory 100.0
        let trade = makeSell spy 10.0 None

        let (result, _) = executeTrades [trade] portfolio history currentDay r zeroCosts zeroTax

        Assert.Equal(11000.0, result.Cash)
        Assert.Equal(1, result.Positions.Length)
        Assert.Equal(-10.0, result.Positions.Head.Quantity)

    [<Fact>]
    member _.``TE-2.2 Buy to Cover (Closing Short)``() =
        let pos = makePosition spy -10.0 0 None
        let portfolio = makePortfolio 11000.0 [pos]
        let history = makeHistory 90.0
        let trade = makeBuy spy 10.0 None

        let (result, _) = executeTrades [trade] portfolio history currentDay r zeroCosts zeroTax

        Assert.Equal(10100.0, result.Cash)
        Assert.Empty(result.Positions)

    [<Fact>]
    member _.``TE-2.3 Partial Cover``() =
        let pos = makePosition spy -100.0 0 None
        let portfolio = makePortfolio 20000.0 [pos]
        let history = makeHistory 100.0
        let trade = makeBuy spy 40.0 None

        let (result, _) = executeTrades [trade] portfolio history currentDay r zeroCosts zeroTax

        Assert.Equal(16000.0, result.Cash)
        Assert.Equal(1, result.Positions.Length)
        Assert.Equal(-60.0, result.Positions.Head.Quantity)

    [<Fact>]
    member _.``TE-2.4 Flip Position (Short to Long)``() =
        let pos = makePosition spy -10.0 0 None
        let portfolio = makePortfolio 5000.0 [pos]
        let history = makeHistory 100.0
        let trade = makeBuy spy 20.0 None

        let (result, _) = executeTrades [trade] portfolio history currentDay r zeroCosts zeroTax

        Assert.Equal(3000.0, result.Cash)
        Assert.Equal(1, result.Positions.Length)
        Assert.Equal(10.0, result.Positions.Head.Quantity)

    // ============================================================================
    // Category 3: FIFO Logic
    // ============================================================================

    [<Fact>]
    member _.``TE-3.1 FIFO Sell (Longs)``() =
        let posA = makePosition spy 10.0 1 None
        let posB = makePosition spy 10.0 5 None
        let portfolio = makePortfolio 0.0 [posA; posB]
        let history = makeHistory 100.0
        let trade = makeSell spy 15.0 None

        let (result, _) = executeTrades [trade] portfolio history currentDay r zeroCosts zeroTax

        Assert.Equal(1, result.Positions.Length)
        let remaining = result.Positions.Head
        Assert.Equal(5.0, remaining.Quantity)
        Assert.Equal(5, remaining.BuyDate)

    [<Fact>]
    member _.``TE-3.2 FIFO Cover (Shorts)``() =
        let posA = makePosition spy -10.0 1 None
        let posB = makePosition spy -10.0 5 None
        let portfolio = makePortfolio 10000.0 [posA; posB]
        let history = makeHistory 100.0
        let trade = makeBuy spy 15.0 None

        let (result, _) = executeTrades [trade] portfolio history currentDay r zeroCosts zeroTax

        Assert.Equal(1, result.Positions.Length)
        let remaining = result.Positions.Head
        Assert.Equal(-5.0, remaining.Quantity)
        Assert.Equal(5, remaining.BuyDate)

    // ============================================================================
    // Category 4: Composite Integrity (GroupIds)
    // ============================================================================

    [<Fact>]
    member _.``TE-4.1 Composite Buy (All Longs)``() =
        let portfolio = makePortfolio 10000.0 []
        let history = makeHistory 100.0
        
        let t1 = makeBuy spy 10.0 (Some "iron_condor")
        let t2 = makeBuy callOption 1.0 (Some "iron_condor")

        let (result, _) = executeTrades [t1; t2] portfolio history currentDay r zeroCosts zeroTax

        Assert.Equal(2, result.Positions.Length)
        let p1 = result.Positions.[0]
        let p2 = result.Positions.[1]
        
        Assert.True(p1.GroupId.IsSome)
        Assert.Equal(p1.GroupId, p2.GroupId)

    [<Fact>]
    member _.``TE-4.3 Mixed Composite (Reverse Covered Call)``() =
        let portfolio = makePortfolio 10000.0 []
        let history = makeHistory 100.0
        
        let t1 = makeSell spy 100.0 (Some "reverse_cc")
        let t2 = makeBuy callOption 1.0 (Some "reverse_cc")

        let (result, _) = executeTrades [t1; t2] portfolio history currentDay r zeroCosts zeroTax

        Assert.Equal(2, result.Positions.Length)
        
        let shortStock = result.Positions |> List.find (fun p -> p.Quantity < 0.0)
        let longCall = result.Positions |> List.find (fun p -> p.Quantity > 0.0)

        Assert.Equal(-100.0, shortStock.Quantity)
        Assert.True(shortStock.GroupId.IsSome)
        Assert.Equal(shortStock.GroupId, longCall.GroupId)

    [<Fact>]
    member _.``TE-4.4 Composite Interaction with Existing Inventory``() =
        let pos = makePosition spy 100.0 0 None
        let portfolio = makePortfolio 0.0 [pos]
        let history = makeHistory 100.0
        
        let t1 = makeSell spy 100.0 (Some "reverse_cc")
        let t2 = makeBuy callOption 1.0 (Some "reverse_cc")

        let (result, _) = executeTrades [t1; t2] portfolio history currentDay r zeroCosts zeroTax

        Assert.Equal(1, result.Positions.Length)
        let remaining = result.Positions.Head
        Assert.Equal(callOption, remaining.Instrument)
        Assert.True(remaining.GroupId.IsSome)

    // ============================================================================
    // Category 5: Rebalancing
    // ============================================================================

    [<Fact>]
    member _.``TE-5.1 Rebalance from Cash (Buy)``() =
        let portfolio = makePortfolio 10000.0 []
        let history = makeHistory 100.0
        let trade = makeRebalance spy 50.0 

        let (result, _) = executeTrades [trade] portfolio history currentDay r zeroCosts zeroTax

        Assert.Equal(5000.0, result.Cash)
        Assert.Equal(1, result.Positions.Length)
        Assert.Equal(50.0, result.Positions.Head.Quantity)

    [<Fact>]
    member _.``TE-5.2 Rebalance to Reduce (Sell)``() =
        let pos = makePosition spy 100.0 0 None
        let portfolio = makePortfolio 0.0 [pos]
        let history = makeHistory 100.0
        
        let trade = makeRebalance spy 40.0

        let (result, _) = executeTrades [trade] portfolio history currentDay r zeroCosts zeroTax

        Assert.Equal(6000.0, result.Cash)
        Assert.Equal(1, result.Positions.Length)
        Assert.Equal(40.0, result.Positions.Head.Quantity)

    [<Fact>]
    member _.``TE-5.3 Rebalance from Short to Long``() =
        let pos = makePosition spy -100.0 0 None
        let portfolio = makePortfolio 20000.0 [pos]
        let history = makeHistory 100.0
        
        let trade = makeRebalance spy 50.0

        let (result, _) = executeTrades [trade] portfolio history currentDay r zeroCosts zeroTax

        Assert.Equal(5000.0, result.Cash)
        Assert.Equal(1, result.Positions.Length)
        Assert.Equal(50.0, result.Positions.Head.Quantity)