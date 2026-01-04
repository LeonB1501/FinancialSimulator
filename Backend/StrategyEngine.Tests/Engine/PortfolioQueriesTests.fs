module PortfolioQueriesTests

open Xunit
open FsUnit.Xunit
open AST
open EngineTypes
open PortfolioQueries
open System

type PortfolioQueriesSuite() =

    let makeGuid () = Guid.NewGuid()
    let currentDay = 0
    let r = 0.0 // Dummy risk free rate

    let spy = ResolvedAsset(SimpleAsset "spy")
    let spy3x = ResolvedAsset(LeveragedAsset("spy", 3.0))
    let callOption = ResolvedOption { Underlying = SimpleAsset "spy"; Strike = 100.0; ExpiryDay = 30; IsCall = true }

    let makeHistory (spyPrice: float) =
        [ { Ticker = "spy"; DailyData = [| { Price = spyPrice; Vol = 0.2 } |] } ]

    let makePortfolio (cash: float) (positions: PositionInstance list) =
        { 
            Cash = cash; 
            Positions = positions; 
            CompositeRegistry = Map.empty;
            TaxLots = [];
            TaxLiabilityYTD = 0.0;
            RealizedGainsYTD = 0.0
        }

    let makePosition (instrument: ResolvedInstrument) (qty: float) (defName: string) =
        { 
            Id = makeGuid()
            GroupId = None
            DefinitionName = defName
            ComponentName = None
            ParentId = None
            BuyPrice = 100.0
            BuyDate = 0
            Quantity = qty
            Instrument = instrument 
        }

    // ============================================================================
    // Category 1: Portfolio Value (Cash + Positions)
    // ============================================================================

    [<Fact>]
    member _.``PQ-1.1 Portfolio Value (Cash Only)``() =
        let portfolio = makePortfolio 10000.0 []
        let history = makeHistory 100.0
        
        let value = calculatePortfolioValue portfolio history currentDay r
        Assert.Equal(10000.0, value)

    [<Fact>]
    member _.``PQ-1.2 Portfolio Value (Cash + Assets)``() =
        let pos = makePosition spy 10.0 "long_spy"
        let portfolio = makePortfolio 1000.0 [pos]
        let history = makeHistory 150.0 
        
        let value = calculatePortfolioValue portfolio history currentDay r
        Assert.Equal(2500.0, value)

    [<Fact>]
    member _.``PQ-1.3 Portfolio Value (Short Positions)``() =
        let pos = makePosition spy -10.0 "short_spy"
        let portfolio = makePortfolio 5000.0 [pos]
        let history = makeHistory 150.0
        
        let value = calculatePortfolioValue portfolio history currentDay r
        Assert.Equal(3500.0, value)

    // ============================================================================
    // Category 2: Position Quantity
    // ============================================================================

    [<Fact>]
    member _.``PQ-2.1 Quantity by Definition Name``() =
        let p1 = makePosition spy 10.0 "strat_A"
        let p2 = makePosition spy 20.0 "strat_B"
        let portfolio = makePortfolio 0.0 [p1; p2]
        
        let qtyA = calculatePositionQuantity portfolio "strat_A"
        let qtyB = calculatePositionQuantity portfolio "strat_B"
        
        Assert.Equal(10.0, qtyA)
        Assert.Equal(20.0, qtyB)

    [<Fact>]
    member _.``PQ-2.2 Quantity by Asset Ticker``() =
        let p1 = makePosition spy 10.0 "strat_A"
        let p2 = makePosition spy 20.0 "strat_B"
        let portfolio = makePortfolio 0.0 [p1; p2]
        
        let totalSpy = calculatePositionQuantity portfolio "spy"
        Assert.Equal(30.0, totalSpy)

    [<Fact>]
    member _.``PQ-2.3 Quantity by Leveraged Ticker``() =
        let p1 = makePosition spy3x 50.0 "lev_strat"
        let portfolio = makePortfolio 0.0 [p1]
        
        let qty = calculatePositionQuantity portfolio "spy_3x"
        Assert.Equal(50.0, qty)

    [<Fact>]
    member _.``PQ-2.4 Quantity with No Match``() =
        let p1 = makePosition spy 10.0 "strat_A"
        let portfolio = makePortfolio 0.0 [p1]
        
        let qty = calculatePositionQuantity portfolio "qqq"
        Assert.Equal(0.0, qty)

    // ============================================================================
    // Category 3: Position Value
    // ============================================================================

    [<Fact>]
    member _.``PQ-3.1 Position Value by Definition``() =
        let p1 = makePosition spy 10.0 "my_holdings"
        let portfolio = makePortfolio 0.0 [p1]
        let history = makeHistory 200.0
        
        let valA = calculatePositionValue portfolio "my_holdings" history currentDay r
        Assert.Equal(2000.0, valA)

    [<Fact>]
    member _.``PQ-3.2 Position Value by Ticker (Aggregated)``() =
        let p1 = makePosition spy 10.0 "strat_A"
        let p2 = makePosition spy 5.0 "strat_B"
        let portfolio = makePortfolio 0.0 [p1; p2]
        let history = makeHistory 100.0
        
        let valSpy = calculatePositionValue portfolio "spy" history currentDay r
        Assert.Equal(1500.0, valSpy)

    [<Fact>]
    member _.``PQ-3.3 Position Value of Options``() =
        let p1 = makePosition callOption 1.0 "long_call"
        let portfolio = makePortfolio 0.0 [p1]
        let history = makeHistory 100.0
        
        let valCall = calculatePositionValue portfolio "long_call" history currentDay r
        
        Assert.True(valCall > 0.0)
        Assert.True(valCall < 1000.0)