module RiskManagerTests

open Xunit
open FsUnit.Xunit
open AST
open EngineTypes
open RiskManager
open System

type RiskManagerSuite() =

    // --- Data Factories ---
    let makeGuid () = Guid.NewGuid()
    let makeAsset (ticker: string) = ResolvedAsset(SimpleAsset ticker)
    let makeLeveragedAsset (ticker: string) (leverage: float) = ResolvedAsset(LeveragedAsset(ticker, leverage))
    let makeOption (ticker: string) (strike: float) (expiryDay: int) (isCall: bool) =
        ResolvedOption { Underlying = SimpleAsset ticker; Strike = strike; ExpiryDay = expiryDay; IsCall = isCall }

    let makePosition (instrument: ResolvedInstrument) (qty: float) (buyPrice: float) (groupId: Guid option) =
        { Id = makeGuid(); GroupId = groupId; DefinitionName = "test_pos"; ComponentName = None; ParentId = None;
          BuyPrice = buyPrice; BuyDate = 0; Quantity = qty; Instrument = instrument }

    let makePortfolio (cash: float) (positions: PositionInstance list) =
        { 
            Cash = cash; 
            Positions = positions; 
            CompositeRegistry = Map.empty;
            TaxLots = [];
            TaxLiabilityYTD = 0.0;
            RealizedGainsYTD = 0.0
        }

    let makeMarketData (prices: (string * float) list) =
        prices |> List.map (fun (t, p) -> t, { Price = p; Vol = 0.2 }) |> Map.ofList

    let makeBuyTrade (instrument: ResolvedInstrument) (qty: float) =
        PrimitiveBuy { Instrument = instrument; Quantity = qty; ComponentName = None; DefinitionName = None }

    let makeSellTrade (instrument: ResolvedInstrument) (qty: float) =
        PrimitiveSell { Instrument = instrument; Quantity = qty; ComponentName = None; DefinitionName = None }

    let currentDay = 0
    let r = 0.0 // Dummy risk free rate for risk checks

    let assertOk result = 
        match result with 
        | Ok _ -> () 
        | Error e -> failwith $"Expected Ok, but got Error: {e}"

    // ============================================================================
    // Category 1: Basic Validation
    // ============================================================================

    [<Fact>]
    member _.``RM-1.1 Simple Long Stock Purchase should pass``() =
        let portfolio = makePortfolio 100000.0 []
        let marketData = makeMarketData ["spy", 500.0]
        let trade = makeBuyTrade (makeAsset "spy") 100.0 
        validateTrades [trade] portfolio marketData currentDay r |> assertOk

    [<Fact>]
    member _.``RM-1.2 Overleveraged Stock Purchase should fail``() =
        let portfolio = makePortfolio 10000.0 [] 
        let marketData = makeMarketData ["spy", 500.0]
        let trade = makeBuyTrade (makeAsset "spy") 100.0 
        match validateTrades [trade] portfolio marketData currentDay r with
        | Ok _ -> failwith "Expected failure"
        | Error msg -> msg |> should haveSubstring "Insufficient Buying Power"

    [<Fact>]
    member _.``RM-1.3 Leveraged ETF Purchase (3x) should pass``() =
        let portfolio = makePortfolio 100000.0 []
        let marketData = makeMarketData ["spxl", 150.0] 
        let trade = makeBuyTrade (makeLeveragedAsset "spxl" 3.0) 100.0
        validateTrades [trade] portfolio marketData currentDay r |> assertOk

    [<Fact>]
    member _.``RM-1.4 Leveraged ETF at Max Risk should pass``() =
        let portfolio = makePortfolio 30000.0 []
        let marketData = makeMarketData ["spxl", 150.0]
        let trade = makeBuyTrade (makeLeveragedAsset "spxl" 3.0) 100.0
        validateTrades [trade] portfolio marketData currentDay r |> assertOk

    [<Fact>]
    member _.``RM-1.5 Naked Short Stock should fail``() =
        let portfolio = makePortfolio 10000.0 []
        let marketData = makeMarketData ["spy", 500.0]
        let trade = makeSellTrade (makeAsset "spy") 1000.0 
        match validateTrades [trade] portfolio marketData currentDay r with
        | Ok _ -> failwith "Expected failure"
        | Error msg -> msg |> should haveSubstring "Insufficient"

    // ============================================================================
    // Category 2: Options
    // ============================================================================

    [<Fact>]
    member _.``RM-2.1 Long Call Purchase should pass``() =
        let portfolio = makePortfolio 50000.0 []
        let marketData = makeMarketData ["spy", 500.0]
        let option = makeOption "spy" 510.0 (currentDay + 45) true
        let trade = makeBuyTrade option 1.0
        validateTrades [trade] portfolio marketData currentDay r |> assertOk

    [<Fact>]
    member _.``RM-2.2 Naked Short Call should fail``() =
        let portfolio = makePortfolio 10000.0 [] 
        let marketData = makeMarketData ["spy", 500.0]
        let option = makeOption "spy" 520.0 (currentDay + 45) true
        let trade = makeSellTrade option 1.0
        match validateTrades [trade] portfolio marketData currentDay r with
        | Ok _ -> failwith "Expected failure"
        | Error msg -> msg |> should haveSubstring "Insufficient"

    [<Fact>]
    member _.``RM-2.3 Covered Call should pass``() =
        let shares = makePosition (makeAsset "spy") 100.0 500.0 None
        let portfolio = makePortfolio 10000.0 [shares]
        let marketData = makeMarketData ["spy", 500.0]
        let option = makeOption "spy" 520.0 (currentDay + 45) true
        let trade = makeSellTrade option 1.0
        validateTrades [trade] portfolio marketData currentDay r |> assertOk

    [<Fact>]
    member _.``RM-2.4 Cash-Secured Put should pass``() =
        let portfolio = makePortfolio 50000.0 []
        let marketData = makeMarketData ["spy", 500.0]
        let option = makeOption "spy" 480.0 (currentDay + 45) false
        let trade = makeSellTrade option 1.0
        validateTrades [trade] portfolio marketData currentDay r |> assertOk

    [<Fact>]
    member _.``RM-2.5 Naked Short Put should fail``() =
        let portfolio = makePortfolio 10000.0 []
        let marketData = makeMarketData ["spy", 500.0]
        let option = makeOption "spy" 480.0 (currentDay + 45) false
        let trade = makeSellTrade option 1.0
        match validateTrades [trade] portfolio marketData currentDay r with
        | Ok _ -> failwith "Expected failure"
        | Error msg -> msg |> should haveSubstring "Insufficient"

    // ============================================================================
    // Category 3: Spreads
    // ============================================================================

    [<Fact>]
    member _.``RM-3.1 Bull Call Spread should pass``() =
        let portfolio = makePortfolio 5000.0 []
        let marketData = makeMarketData ["spy", 500.0]
        let trades = [
            makeBuyTrade (makeOption "spy" 500.0 (currentDay + 30) true) 1.0
            makeSellTrade (makeOption "spy" 520.0 (currentDay + 30) true) 1.0
        ]
        validateTrades trades portfolio marketData currentDay r |> assertOk

    [<Fact>]
    member _.``RM-3.3 Iron Condor should pass``() =
        let portfolio = makePortfolio 5000.0 []
        let marketData = makeMarketData ["spy", 500.0]
        let trades = [
            makeSellTrade (makeOption "spy" 470.0 (currentDay+30) false) 1.0
            makeBuyTrade  (makeOption "spy" 460.0 (currentDay+30) false) 1.0
            makeSellTrade (makeOption "spy" 530.0 (currentDay+30) true) 1.0
            makeBuyTrade  (makeOption "spy" 540.0 (currentDay+30) true) 1.0
        ]
        validateTrades trades portfolio marketData currentDay r |> assertOk

    [<Fact>]
    member _.``RM-3.4 Multiple Iron Condors should pass``() =
        let portfolio = makePortfolio 20000.0 []
        let marketData = makeMarketData ["spy", 500.0]
        let trades = [
            makeSellTrade (makeOption "spy" 470.0 (currentDay+30) false) 10.0
            makeBuyTrade  (makeOption "spy" 460.0 (currentDay+30) false) 10.0
            makeSellTrade (makeOption "spy" 530.0 (currentDay+30) true) 10.0
            makeBuyTrade  (makeOption "spy" 540.0 (currentDay+30) true) 10.0
        ]
        validateTrades trades portfolio marketData currentDay r |> assertOk

    [<Fact>]
    member _.``RM-3.5 Calendar Spread should pass``() =
        let portfolio = makePortfolio 5000.0 []
        let marketData = makeMarketData ["spy", 500.0]
        let trades = [
            makeBuyTrade (makeOption "spy" 510.0 (currentDay + 90) true) 1.0
            makeSellTrade (makeOption "spy" 510.0 (currentDay + 30) true) 1.0
        ]
        validateTrades trades portfolio marketData currentDay r |> assertOk

    // ============================================================================
    // Category 4: Composite Positions
    // ============================================================================

    [<Fact>]
    member _.``RM-4.1 Buy Composite, Sell Composite (Happy Path)``() =
        let gid = makeGuid()
        let longLeg = { makePosition (makeOption "spy" 510.0 (currentDay + 90) true) 1.0 800.0 (Some gid) with BuyDate = 1 }
        let shortLeg = { makePosition (makeOption "spy" 510.0 (currentDay + 30) true) 1.0 300.0 (Some gid) with BuyDate = 1 }
        let portfolio = makePortfolio 1000.0 [longLeg; shortLeg]
        let marketData = makeMarketData ["spy", 500.0]
        let marketDataWithIwm = marketData |> Map.add "iwm" { Price = 200.0; Vol = 0.2 }
        let target = AssetTarget(SimpleAsset "iwm") 
        
        let result = analyzeAndPlanRebalance target 100.0 portfolio marketDataWithIwm currentDay r

        match result with
        | { IsAchievable = true; PreparatoryTrades = trades } ->
            trades.Length |> should equal 2
        | _ -> failwith $"Expected rebalance plan, got: {result}"

    [<Fact>]
    member _.``RM-4.2 Buy Multiple Composites, Sell One (FIFO)``() =
        let g1 = makeGuid()
        let g2 = makeGuid()
        let pos1 = { makePosition (makeOption "spy" 500.0 (currentDay+30) true) 1.0 10.0 (Some g1) with BuyDate = 1 }
        let pos2 = { makePosition (makeOption "spy" 500.0 (currentDay+30) true) 1.0 10.0 (Some g2) with BuyDate = 5 }
        let portfolio = makePortfolio 100.0 [pos1; pos2] 
        let marketData = makeMarketData ["spy", 500.0; "iwm", 100.0]
        let target = AssetTarget(SimpleAsset "iwm")
        
        let result = analyzeAndPlanRebalance target 100.0 portfolio marketData currentDay r

        match result with
        | { IsAchievable = true; PreparatoryTrades = trades } ->
            trades.Length |> should be (greaterThanOrEqualTo 1)
        | _ -> failwith "Expected plan"

    [<Fact>]
    member _.``RM-4.4 Nested Composite (Treated as Flat Atomic Unit)``() =
        let gid = makeGuid()
        let leg1 = makePosition (makeOption "spy" 460.0 30 false) 1.0 1.0 (Some gid)
        let leg2 = makePosition (makeOption "spy" 470.0 30 false) 1.0 1.0 (Some gid)
        let leg3 = makePosition (makeOption "spy" 530.0 30 true) 1.0 1.0 (Some gid)
        let leg4 = makePosition (makeOption "spy" 540.0 30 true) 1.0 1.0 (Some gid)
        let portfolio = makePortfolio 100.0 [leg1; leg2; leg3; leg4]
        let marketData = makeMarketData ["spy", 500.0; "iwm", 100.0]
        
        let result = analyzeAndPlanRebalance (AssetTarget(SimpleAsset "iwm")) 200.0 portfolio marketData currentDay r

        match result with
        | { IsAchievable = true; PreparatoryTrades = trades } ->
            trades.Length |> should equal 4
        | _ -> failwith "Expected plan"

    // ============================================================================
    // Category 5: Rebalancing
    // ============================================================================

    [<Fact>]
    member _.``RM-5.1 Simple Rebalance with Sufficient Cash``() =
        let portfolio = makePortfolio 100000.0 []
        let marketData = makeMarketData ["spy", 500.0]
        let target = AssetTarget(SimpleAsset "spy")
        let result = analyzeAndPlanRebalance target 50.0 portfolio marketData currentDay r
        match result with
        | { IsAchievable = true; PreparatoryTrades = trades } -> trades |> should be Empty
        | _ -> failwith "Should be achievable"

    [<Fact>]
    member _.``RM-5.2 Rebalance Requiring Preparatory Sales``() =
        let qqqPos = makePosition (makeAsset "qqq") 900.0 100.0 None
        let portfolio = makePortfolio 10000.0 [qqqPos]
        let marketData = makeMarketData ["spy", 500.0; "qqq", 100.0]
        let target = AssetTarget(SimpleAsset "spy")
        let result = analyzeAndPlanRebalance target 60.0 portfolio marketData currentDay r
        match result with
        | { IsAchievable = true; PreparatoryTrades = trades } -> trades |> should not' (be Empty)
        | _ -> failwith "Should be achievable"

    [<Fact>]
    member _.``RM-5.4 Rebalance to High-Risk Target (Should Fail)``() =
        let portfolio = makePortfolio 50000.0 []
        let marketData = makeMarketData ["spy", 500.0]
        let target = AssetTarget(SimpleAsset "spy")
        let result = analyzeAndPlanRebalance target 300.0 portfolio marketData currentDay r
        match result with
        | { IsAchievable = false; DebugReason = reason } -> 
            reason |> should haveSubstring "Cannot raise"
        | _ -> failwith "Should fail"

    [<Fact>]
    member _.``RM-5.5 Rebalance Requiring Multiple Sales``() =
        let posA = makePosition (makeAsset "a") 100.0 100.0 None
        let posB = makePosition (makeAsset "b") 100.0 100.0 None
        let portfolio = makePortfolio 0.0 [posA; posB]
        let marketData = makeMarketData ["a", 100.0; "b", 100.0; "spy", 100.0]
        let target = AssetTarget(SimpleAsset "spy")
        let result = analyzeAndPlanRebalance target 75.0 portfolio marketData currentDay r
        match result with
        | { IsAchievable = true; PreparatoryTrades = trades } -> trades.Length |> should equal 2
        | _ -> failwith "Should sell both"

    // ============================================================================
    // Category 6: Edge Cases
    // ============================================================================

    [<Fact>]
    member _.``RM-6.1 Zero Quantity Trade``() =
        let portfolio = makePortfolio 10000.0 []
        let marketData = makeMarketData ["spy", 500.0]
        let trade = makeBuyTrade (makeAsset "spy") 0.0
        validateTrades [trade] portfolio marketData currentDay r |> assertOk

    [<Fact>]
    member _.``RM-6.2 Negative Quantity (Short via Buy)``() =
        let portfolio = makePortfolio 10000.0 []
        let marketData = makeMarketData ["spy", 500.0]
        let trade = makeBuyTrade (makeAsset "spy") -10.0
        validateTrades [trade] portfolio marketData currentDay r |> assertOk

    [<Fact>]
    member _.``RM-6.4 Extremely High Leverage (10x)``() =
        let portfolio = makePortfolio 50000.0 []
        let marketData = makeMarketData ["spy", 100.0]
        let trade = makeBuyTrade (makeLeveragedAsset "spy" 10.0) 100.0 
        validateTrades [trade] portfolio marketData currentDay r |> assertOk

    [<Fact>]
    member _.``RM-6.6 Multiple Underlyings (Conservative Correlation)``() =
        let portfolio = makePortfolio 50000.0 []
        let marketData = makeMarketData ["spy", 500.0; "qqq", 500.0]
        let trades = [
            makeBuyTrade (makeAsset "spy") 100.0
            makeSellTrade (makeAsset "qqq") 100.0
        ]
        match validateTrades trades portfolio marketData currentDay r with
        | Error msg -> msg |> should haveSubstring "Insufficient"
        | Ok _ -> failwith "Expected failure"

    [<Fact>]
    member _.``RM-6.8 Missing Market Data``() =
        let portfolio = makePortfolio 10000.0 []
        let marketData = Map.empty
        let trade = makeBuyTrade (makeAsset "spy") 10.0
        Assert.Throws<System.Collections.Generic.KeyNotFoundException>(fun () -> 
            validateTrades [trade] portfolio marketData currentDay r |> ignore
        ) |> ignore

    [<Fact>]
    member _.``RM-6.10 calculateMaxQuantity Returns Zero when undercapitalized``() =
        let portfolio = makePortfolio 100.0 [] 
        let marketData = makeMarketData ["spy", 500.0]
        let trade = makeBuyTrade (makeAsset "spy") 1.0 
        let qty = calculateMaxQuantity [trade] portfolio marketData currentDay r
        qty |> should equal 0

    [<Fact>]
    member _.``RM-6.11 calculateMaxQuantity with BP-Positive Trade``() =
        let shares = makePosition (makeAsset "spy") 100.0 500.0 None
        let portfolio = 1000.0 |> makePortfolio <| [shares]
        let marketData = makeMarketData ["spy", 500.0]
        let trade = makeSellTrade (makeOption "spy" 520.0 (currentDay+30) true) 1.0
        let qty = calculateMaxQuantity [trade] portfolio marketData currentDay r
        qty |> should equal 10000

    // ============================================================================
    // Category 7: Stress Test
    // ============================================================================

    [<Fact>]
    member _.``RM-7.3 Worst-Case Selection Logic (Iron Condor)``() =
        let portfolio = makePortfolio 2000.0 []
        let marketData = makeMarketData ["spy", 500.0]
        let trades = [
            makeSellTrade (makeOption "spy" 470.0 (currentDay+30) false) 1.0
            makeBuyTrade  (makeOption "spy" 460.0 (currentDay+30) false) 1.0
            makeSellTrade (makeOption "spy" 530.0 (currentDay+30) true) 1.0
            makeBuyTrade  (makeOption "spy" 540.0 (currentDay+30) true) 1.0
        ]
        validateTrades trades portfolio marketData currentDay r |> assertOk
        
        let tightPortfolio = makePortfolio 1500.0 []
        validateTrades trades tightPortfolio marketData currentDay r |> assertOk