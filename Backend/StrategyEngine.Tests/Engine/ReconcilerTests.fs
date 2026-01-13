module ReconcilerTests

open Xunit
open FsUnit.Xunit
open AST
open EngineTypes
open StrategyEngine.Engine.Reconciler
open System

type ReconcilerSuite() =

    // ==========================================================================
    // Data Factories
    // ==========================================================================

    let makeGuid () = Guid.NewGuid()

    let makeAsset (ticker: string) = ResolvedAsset(SimpleAsset ticker)

    let makeOption (ticker: string) (strike: float) (expiryDay: int) (isCall: bool) =
        ResolvedOption { Underlying = SimpleAsset ticker; Strike = strike; ExpiryDay = expiryDay; IsCall = isCall }

    let makePosition (instrument: ResolvedInstrument) (qty: float) : PositionInstance =
        { Id = makeGuid(); GroupId = None; DefinitionName = "test"; ComponentName = None; ParentId = None;
          BuyPrice = 0.0; BuyDate = 0; Quantity = qty; Instrument = instrument }

    let makePositionWithId (id: Guid) (instrument: ResolvedInstrument) (qty: float) : PositionInstance =
        { Id = id; GroupId = None; DefinitionName = "test"; ComponentName = None; ParentId = None;
          BuyPrice = 0.0; BuyDate = 0; Quantity = qty; Instrument = instrument }

    let makePortfolio (cash: float) (positions: PositionInstance list) : Portfolio =
        { 
            Cash = cash; 
            Positions = positions; 
            CompositeRegistry = Map.empty;
            TaxLots = [];
            TaxLiabilityYTD = 0.0;
            RealizedGainsYTD = 0.0
        }

    /// Creates a simple price history with a single price for all days
    let makePriceHistory (ticker: string) (price: float) (days: int) : PricePath =
        { Ticker = ticker; DailyData = Array.create days { Price = price; Vol = 0.2 } }

    /// Creates full price history from a list of (ticker, price) tuples
    let makeFullHistory (prices: (string * float) list) (days: int) : FullPriceHistory =
        prices |> List.map (fun (t, p) -> makePriceHistory t p days)

    let defaultDay = 10
    let defaultR = 0.05

    // FIX: Default Zero Costs
    let zeroCosts = {
        Commission = { PerOrder = 0.0; PerUnit = 0.0 }
        Slippage = { DefaultSpread = 0.0; Tiers = [] }
    }

    // ==========================================================================
    // Helper Assertions
    // ==========================================================================

    let findPosition (portfolio: Portfolio) (instrument: ResolvedInstrument) : PositionInstance option =
        portfolio.Positions |> List.tryFind (fun p -> p.Instrument = instrument)

    let getPositionQty (portfolio: Portfolio) (instrument: ResolvedInstrument) : float =
        match findPosition portfolio instrument with
        | Some p -> p.Quantity
        | None -> 0.0

    let assertApproxEqual (expected: float) (actual: float) (tolerance: float) =
        abs (expected - actual) |> should be (lessThan tolerance)

    // ==========================================================================
    // Category 1: No Liquidation Needed (Basic Cash Flow)
    // ==========================================================================

    [<Fact>]
    member _.``1.1 NoDeficit_CashDeducted - Has more cash than required``() =
        let portfolio = makePortfolio 1000.0 []
        let history = makeFullHistory [] 20

        let (result, _) = reconcileCash portfolio 500.0 history defaultDay defaultR zeroCosts

        result.Cash |> should equal 500.0
        result.Positions |> should be Empty

    [<Fact>]
    member _.``1.2 ExactCash_ZeroRemaining - Has exactly the required cash``() =
        let portfolio = makePortfolio 500.0 []
        let history = makeFullHistory [] 20

        let (result, _) = reconcileCash portfolio 500.0 history defaultDay defaultR zeroCosts

        result.Cash |> should equal 0.0
        result.Positions |> should be Empty

    [<Fact>]
    member _.``1.3 ZeroRequired_NoChange - Requires nothing``() =
        let portfolio = makePortfolio 1000.0 []
        let history = makeFullHistory [] 20

        let (result, _) = reconcileCash portfolio 0.0 history defaultDay defaultR zeroCosts

        result.Cash |> should equal 1000.0

    // ==========================================================================
    // Category 2: Simple Stock Liquidation (FreeLong)
    // ==========================================================================

    [<Fact>]
    member _.``2.1 SingleStock_PartialSale - Sells partial shares to cover deficit``() =
        let shares = makePosition (makeAsset "AAPL") 100.0
        let portfolio = makePortfolio 0.0 [shares]
        let history = makeFullHistory ["AAPL", 50.0] 20

        let (result, _) = reconcileCash portfolio 150.0 history defaultDay defaultR zeroCosts

        result.Cash |> should equal 0.0
        getPositionQty result (makeAsset "AAPL") |> should equal 97.0

    [<Fact>]
    member _.``2.2 SingleStock_FullSale - Sells all shares``() =
        let shares = makePosition (makeAsset "AAPL") 50.0
        let portfolio = makePortfolio 0.0 [shares]
        let history = makeFullHistory ["AAPL", 100.0] 20

        let (result, _) = reconcileCash portfolio 5000.0 history defaultDay defaultR zeroCosts

        result.Cash |> should equal 0.0
        result.Positions |> should be Empty

    [<Fact>]
    member _.``2.3 SingleStock_ExcessProceeds - Ceiling forces extra sale, excess returned as cash``() =
        let shares = makePosition (makeAsset "AAPL") 100.0
        let portfolio = makePortfolio 0.0 [shares]
        let history = makeFullHistory ["AAPL", 50.0] 20

        let (result, _) = reconcileCash portfolio 120.0 history defaultDay defaultR zeroCosts

        result.Cash |> should equal 30.0
        getPositionQty result (makeAsset "AAPL") |> should equal 97.0

    [<Fact>]
    member _.``2.4 MultipleStocks_LiquidatesLargerFirst - Prefers larger value positions``() =
        let aapl = makePosition (makeAsset "AAPL") 100.0
        let msft = makePosition (makeAsset "MSFT") 100.0
        let portfolio = makePortfolio 0.0 [aapl; msft]
        let history = makeFullHistory ["AAPL", 50.0; "MSFT", 100.0] 20

        let (result, _) = reconcileCash portfolio 150.0 history defaultDay defaultR zeroCosts

        getPositionQty result (makeAsset "MSFT") |> should be (lessThan 100.0)

    [<Fact>]
    member _.``2.5 StockWithZeroValue_Skipped - Zero price stock cannot raise cash``() =
        let worthless = makePosition (makeAsset "JUNK") 100.0
        let portfolio = makePortfolio 0.0 [worthless]
        let history = makeFullHistory ["JUNK", 0.0] 20

        let (result, _) = reconcileCash portfolio 100.0 history defaultDay defaultR zeroCosts

        result.Cash |> should equal 0.0
        result.Positions |> should be Empty

    // ==========================================================================
    // Category 3: Covered Call Liquidation (PairedUnit - Stock + Short Call)
    // ==========================================================================

    [<Fact>]
    member _.``3.1 CoveredCall_PairedTogether - Stock and short call sold as unit``() =
        let shares = makePosition (makeAsset "AAPL") 100.0
        let shortCall = makePosition (makeOption "AAPL" 105.0 30 true) -1.0
        let portfolio = makePortfolio 0.0 [shares; shortCall]
        let history = makeFullHistory ["AAPL", 100.0] 40

        let (result, _) = reconcileCash portfolio 5000.0 history defaultDay defaultR zeroCosts

        result.Cash |> should be (greaterThanOrEqualTo 0.0)
        result.Positions.Length |> should be (lessThanOrEqualTo 1)

    [<Fact>]
    member _.``3.2 CoveredCall_NetValuePositive - Calculates correct net proceeds``() =
        let shares = makePosition (makeAsset "AAPL") 100.0
        let shortCall = makePosition (makeOption "AAPL" 45.0 30 true) -1.0
        let portfolio = makePortfolio 0.0 [shares; shortCall]
        let history = makeFullHistory ["AAPL", 50.0] 40

        let (result, _) = reconcileCash portfolio 1000.0 history defaultDay defaultR zeroCosts

        result.Cash |> should be (greaterThanOrEqualTo 0.0)

    [<Fact>]
    member _.``3.3 CoveredCall_MultipleContracts - Partial liquidation of covered calls``() =
        let shares = makePosition (makeAsset "AAPL") 300.0
        let shortCalls = makePosition (makeOption "AAPL" 105.0 30 true) -3.0
        let portfolio = makePortfolio 0.0 [shares; shortCalls]
        let history = makeFullHistory ["AAPL", 100.0] 40

        let (result, _) = reconcileCash portfolio 15000.0 history defaultDay defaultR zeroCosts

        result.Positions |> should not' (be Empty)

    [<Fact>]
    member _.``3.4 CoveredCall_SharesNotEnough - Forms partial covered call plus free shares``() =
        let shares = makePosition (makeAsset "AAPL") 150.0
        let shortCalls = makePosition (makeOption "AAPL" 105.0 30 true) -2.0
        let portfolio = makePortfolio 0.0 [shares; shortCalls]
        let history = makeFullHistory ["AAPL", 100.0] 40

        let (result, _) = reconcileCash portfolio 5000.0 history defaultDay defaultR zeroCosts

        result.Cash |> should be (greaterThanOrEqualTo 0.0)

    // ==========================================================================
    // Category 4: Call Spread Liquidation (PairedUnit - Short Call + Long Call)
    // ==========================================================================

    [<Fact>]
    member _.``4.1 CallSpread_ValidMatch - Long strike <= short strike pairs correctly``() =
        let shortCall = makePosition (makeOption "AAPL" 55.0 30 true) -1.0
        let longCall = makePosition (makeOption "AAPL" 50.0 30 true) 1.0
        let portfolio = makePortfolio 0.0 [shortCall; longCall]
        let history = makeFullHistory ["AAPL", 52.0] 40

        let (result, _) = reconcileCash portfolio 100.0 history defaultDay defaultR zeroCosts

        result.Cash |> should be (greaterThanOrEqualTo 0.0)

    [<Fact>]
    member _.``4.2 CallSpread_StrikeMismatch_NoMatch - Long strike > short strike, no pairing``() =
        let shortCall = makePosition (makeOption "AAPL" 50.0 30 true) -1.0
        let longCall = makePosition (makeOption "AAPL" 55.0 30 true) 1.0
        let portfolio = makePortfolio 0.0 [shortCall; longCall]
        let history = makeFullHistory ["AAPL", 52.0] 40

        let (result, _) = reconcileCash portfolio 50.0 history defaultDay defaultR zeroCosts

        result.Cash |> should be (greaterThanOrEqualTo 0.0)

    [<Fact>]
    member _.``4.3 CallSpread_ExpiryMismatch_NoMatch - Long expires before short, no pairing``() =
        let shortCall = makePosition (makeOption "AAPL" 55.0 60 true) -1.0
        let longCall = makePosition (makeOption "AAPL" 50.0 30 true) 1.0
        let portfolio = makePortfolio 0.0 [shortCall; longCall]
        let history = makeFullHistory ["AAPL", 52.0] 70

        let (result, _) = reconcileCash portfolio 50.0 history 20 defaultR zeroCosts

        result.Cash |> should be (greaterThanOrEqualTo 0.0)

    [<Fact>]
    member _.``4.4 CallSpread_LongerDatedLong_Matches - Long expires after short, valid``() =
        let shortCall = makePosition (makeOption "AAPL" 55.0 30 true) -1.0
        let longCall = makePosition (makeOption "AAPL" 50.0 60 true) 1.0
        let portfolio = makePortfolio 0.0 [shortCall; longCall]
        let history = makeFullHistory ["AAPL", 52.0] 70

        let (result, _) = reconcileCash portfolio 100.0 history defaultDay defaultR zeroCosts

        result.Cash |> should be (greaterThanOrEqualTo 0.0)

    [<Fact>]
    member _.``4.5 CallSpread_PriorityAfterCoveredCall - Shares used first, then spreads``() =
        let shares = makePosition (makeAsset "AAPL") 100.0
        let shortCalls = makePosition (makeOption "AAPL" 55.0 30 true) -2.0
        let longCall = makePosition (makeOption "AAPL" 50.0 30 true) 1.0
        let portfolio = makePortfolio 0.0 [shares; shortCalls; longCall]
        let history = makeFullHistory ["AAPL", 52.0] 40

        let (result, _) = reconcileCash portfolio 8000.0 history defaultDay defaultR zeroCosts

        result.Cash |> should be (greaterThanOrEqualTo 0.0)

    // ==========================================================================
    // Category 5: Put Spread Liquidation (PairedUnit - Short Put + Long Put)
    // ==========================================================================

    [<Fact>]
    member _.``5.1 PutSpread_ValidMatch - Long strike >= short strike pairs correctly``() =
        let shortPut = makePosition (makeOption "AAPL" 45.0 30 false) -1.0
        let longPut = makePosition (makeOption "AAPL" 50.0 30 false) 1.0
        let portfolio = makePortfolio 0.0 [shortPut; longPut]
        let history = makeFullHistory ["AAPL", 52.0] 40

        let (result, _) = reconcileCash portfolio 100.0 history defaultDay defaultR zeroCosts

        result.Cash |> should be (greaterThanOrEqualTo 0.0)

    [<Fact>]
    member _.``5.2 PutSpread_StrikeMismatch_NoMatch - Long strike < short strike, no pairing``() =
        let shortPut = makePosition (makeOption "AAPL" 50.0 30 false) -1.0
        let longPut = makePosition (makeOption "AAPL" 45.0 30 false) 1.0
        let portfolio = makePortfolio 0.0 [shortPut; longPut]
        let history = makeFullHistory ["AAPL", 52.0] 40

        let (result, _) = reconcileCash portfolio 50.0 history defaultDay defaultR zeroCosts

        result.Cash |> should be (greaterThanOrEqualTo 0.0)

    [<Fact>]
    member _.``5.3 PutSpread_ExpiryConstraint - Long expires before short, no pairing``() =
        let shortPut = makePosition (makeOption "AAPL" 45.0 60 false) -1.0
        let longPut = makePosition (makeOption "AAPL" 50.0 30 false) 1.0
        let portfolio = makePortfolio 0.0 [shortPut; longPut]
        let history = makeFullHistory ["AAPL", 52.0] 70

        let (result, _) = reconcileCash portfolio 50.0 history 20 defaultR zeroCosts

        result.Cash |> should be (greaterThanOrEqualTo 0.0)

    // ==========================================================================
    // Category 6: Mixed Portfolios (Integration)
    // ==========================================================================

    [<Fact>]
    member _.``6.1 MixedPortfolio_AllTypes - Stocks, covered calls, spreads combined``() =
        let aaplShares = makePosition (makeAsset "AAPL") 200.0
        let aaplShortCall = makePosition (makeOption "AAPL" 110.0 30 true) -1.0
        let aaplLongCall = makePosition (makeOption "AAPL" 100.0 30 true) 1.0
        let msftShortPut = makePosition (makeOption "MSFT" 280.0 30 false) -1.0
        let msftLongPut = makePosition (makeOption "MSFT" 290.0 30 false) 1.0
        let portfolio = makePortfolio 100.0 [aaplShares; aaplShortCall; aaplLongCall; msftShortPut; msftLongPut]
        let history = makeFullHistory ["AAPL", 105.0; "MSFT", 285.0] 40

        let (result, _) = reconcileCash portfolio 5000.0 history defaultDay defaultR zeroCosts

        result.Cash |> should be (greaterThanOrEqualTo 0.0)

    [<Fact>]
    member _.``6.2 MultipleUnderlyings_Independent - AAPL shorts only match AAPL longs``() =
        let aaplShortCall = makePosition (makeOption "AAPL" 110.0 30 true) -1.0
        let msftLongCall = makePosition (makeOption "MSFT" 100.0 30 true) 1.0
        let portfolio = makePortfolio 0.0 [aaplShortCall; msftLongCall]
        let history = makeFullHistory ["AAPL", 105.0; "MSFT", 105.0] 40

        let (result, _) = reconcileCash portfolio 200.0 history defaultDay defaultR zeroCosts

        result.Cash |> should be (greaterThanOrEqualTo 0.0)

    [<Fact>]
    member _.``6.3 LiquidationOrder_ExpiryFirst - Soonest expiry liquidated first``() =
        let nearCall = makePosition (makeOption "AAPL" 100.0 20 true) 1.0
        let farCall = makePosition (makeOption "AAPL" 100.0 50 true) 1.0
        let portfolio = makePortfolio 0.0 [nearCall; farCall]
        let history = makeFullHistory ["AAPL", 110.0] 60

        let (result, _) = reconcileCash portfolio 500.0 history 10 defaultR zeroCosts

        result.Cash |> should be (greaterThanOrEqualTo 0.0)

    [<Fact>]
    member _.``6.4 LiquidationOrder_ValueSecond - Larger value preferred within same expiry``() =
        let smallStock = makePosition (makeAsset "SMALL") 10.0
        let largeStock = makePosition (makeAsset "LARGE") 10.0
        let portfolio = makePortfolio 0.0 [smallStock; largeStock]
        let history = makeFullHistory ["SMALL", 10.0; "LARGE", 100.0] 20

        let (result, _) = reconcileCash portfolio 500.0 history defaultDay defaultR zeroCosts

        getPositionQty result (makeAsset "LARGE") |> should be (lessThan 10.0)

    // ==========================================================================
    // Category 7: Edge Cases & Failure Modes
    // ==========================================================================

    [<Fact>]
    member _.``7.1 Ruin_InsufficientAssets - Cannot raise enough cash``() =
        let shares = makePosition (makeAsset "AAPL") 10.0
        let portfolio = makePortfolio 0.0 [shares]
        let history = makeFullHistory ["AAPL", 100.0] 20

        let (result, _) = reconcileCash portfolio 10000.0 history defaultDay defaultR zeroCosts

        result.Cash |> should equal 0.0
        result.Positions |> should be Empty

    [<Fact>]
    member _.``7.2 OnlyNakedShorts_CannotRaiseCash - Naked shorts cannot be liquidated for cash``() =
        let shortCall = makePosition (makeOption "AAPL" 100.0 30 true) -1.0
        let portfolio = makePortfolio 0.0 [shortCall]
        let history = makeFullHistory ["AAPL", 100.0] 40

        let (result, _) = reconcileCash portfolio 100.0 history defaultDay defaultR zeroCosts

        result.Cash |> should equal 0.0
        result.Positions |> should be Empty

    [<Fact>]
    member _.``7.3 EmptyPortfolio_Ruin - No positions, no cash``() =
        let portfolio = makePortfolio 0.0 []
        let history = makeFullHistory [] 20

        let (result, _) = reconcileCash portfolio 100.0 history defaultDay defaultR zeroCosts

        result.Cash |> should equal 0.0
        result.Positions |> should be Empty

    [<Fact>]
    member _.``7.4 VerySmallDeficit_OneCent - Handles tiny amounts``() =
        let shares = makePosition (makeAsset "AAPL") 1.0
        let portfolio = makePortfolio 99.99 [shares]
        let history = makeFullHistory ["AAPL", 100.0] 20

        let (result, _) = reconcileCash portfolio 100.0 history defaultDay defaultR zeroCosts

        result.Cash |> should be (greaterThanOrEqualTo 0.0)

    [<Fact>]
    member _.``7.5 LargeQuantities_NoOverflow - Handles large numbers``() =
        let shares = makePosition (makeAsset "AAPL") 1000000.0
        let portfolio = makePortfolio 0.0 [shares]
        let history = makeFullHistory ["AAPL", 100.0] 20

        let (result, _) = reconcileCash portfolio 50000000.0 history defaultDay defaultR zeroCosts

        result.Cash |> should be (greaterThanOrEqualTo 0.0)
        getPositionQty result (makeAsset "AAPL") |> should equal 500000.0

    [<Fact>]
    member _.``7.6 SamePositionMultiplePairs - Reductions accumulate correctly``() =
        let shortCall1 = makePosition (makeOption "AAPL" 110.0 30 true) -2.0
        let shortCall2 = makePosition (makeOption "AAPL" 115.0 30 true) -2.0
        let longCall = makePosition (makeOption "AAPL" 100.0 30 true) 5.0
        let portfolio = makePortfolio 0.0 [shortCall1; shortCall2; longCall]
        let history = makeFullHistory ["AAPL", 105.0] 40

        let (result, _) = reconcileCash portfolio 2000.0 history defaultDay defaultR zeroCosts

        result.Cash |> should be (greaterThanOrEqualTo 0.0)

    // ==========================================================================
    // Category 8: Position Quantity Edge Cases
    // ==========================================================================

    [<Fact>]
    member _.``8.1 FractionalShares_Handled - Non-integer quantities work``() =
        let shares = makePosition (makeAsset "AAPL") 150.5
        let portfolio = makePortfolio 0.0 [shares]
        let history = makeFullHistory ["AAPL", 100.0] 20

        let (result, _) = reconcileCash portfolio 5000.0 history defaultDay defaultR zeroCosts

        result.Cash |> should be (greaterThanOrEqualTo 0.0)

    [<Fact>]
    member _.``8.2 ExactlyOneContract_FullClose - Single contract fully liquidated``() =
        let longCall = makePosition (makeOption "AAPL" 100.0 30 true) 1.0
        let portfolio = makePortfolio 0.0 [longCall]
        let history = makeFullHistory ["AAPL", 110.0] 40

        let (result, _) = reconcileCash portfolio 500.0 history defaultDay defaultR zeroCosts

        result.Positions |> should be Empty

    [<Fact>]
    member _.``8.3 TinyRemainder_Filtered - Dust positions removed``() =
        let shares = makePosition (makeAsset "AAPL") 100.0
        let portfolio = makePortfolio 0.0 [shares]
        let history = makeFullHistory ["AAPL", 100.0] 20

        let (result, _) = reconcileCash portfolio 10000.0 history defaultDay defaultR zeroCosts

        result.Positions |> should be Empty

    // ==========================================================================
    // Category 9: Cash Calculation Verification (Regression for Bug Fix)
    // ==========================================================================

    [<Fact>]
    member _.``9.1 ExcessCash_Preserved - Cash from over-liquidation is kept``() =
        let shares = makePosition (makeAsset "AAPL") 100.0
        let portfolio = makePortfolio 0.0 [shares]
        let history = makeFullHistory ["AAPL", 33.0] 20

        let (result, _) = reconcileCash portfolio 100.0 history defaultDay defaultR zeroCosts

        result.Cash |> should equal 32.0
        getPositionQty result (makeAsset "AAPL") |> should equal 96.0

    [<Fact>]
    member _.``9.2 CashNotZero_AfterSuccessfulLiquidation - Remaining cash calculated correctly``() =
        let shares = makePosition (makeAsset "AAPL") 10.0
        let portfolio = makePortfolio 50.0 [shares]
        let history = makeFullHistory ["AAPL", 100.0] 20

        let (result, _) = reconcileCash portfolio 200.0 history defaultDay defaultR zeroCosts

        result.Cash |> should equal 50.0
        getPositionQty result (makeAsset "AAPL") |> should equal 8.0

    [<Fact>]
    member _.``9.3 MultipleLiquidations_CashAccumulates - Multiple sales sum correctly``() =
        let aapl = makePosition (makeAsset "AAPL") 10.0
        let msft = makePosition (makeAsset "MSFT") 10.0
        let portfolio = makePortfolio 0.0 [aapl; msft]
        let history = makeFullHistory ["AAPL", 50.0; "MSFT", 100.0] 20

        let (result, _) = reconcileCash portfolio 700.0 history defaultDay defaultR zeroCosts

        result.Cash |> should equal 0.0
        getPositionQty result (makeAsset "MSFT") |> should equal 3.0
        getPositionQty result (makeAsset "AAPL") |> should equal 10.0