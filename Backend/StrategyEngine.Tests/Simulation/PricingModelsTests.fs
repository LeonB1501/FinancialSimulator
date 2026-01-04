module PricingModelsTests

open Xunit
open AST
open EngineTypes
open PricingModels
open System

type PricingModelsSuite() =

    let makeOption (strike: float) (dte: int) (isCall: bool) =
        { Underlying = SimpleAsset "spy"; Strike = strike; ExpiryDay = dte; IsCall = isCall }

    let makeHistory (price: float) =
        [ { Ticker = "spy"; DailyData = [| { Price = price; Vol = 0.2 } |] } ]

    let r = 0.045 // Standard test rate

    // ============================================================================
    // Category 4: Option Pricing
    // ============================================================================

    [<Fact>]
    member _.``PM-4.1 Expired ITM Call has intrinsic value``() =
        let opt = makeOption 100.0 0 true
        let price = calculateOptionPrice opt 110.0 1.0 0 r
        Assert.Equal(10.0, price, 5)

    [<Fact>]
    member _.``PM-4.1 Expired OTM Call is worthless``() =
        let opt = makeOption 100.0 0 true
        let price = calculateOptionPrice opt 90.0 1.0 0 r
        Assert.Equal(0.0, price, 5)

    [<Fact>]
    member _.``PM-4.2 ATM Call Pricing (Standard)``() =
        let opt = makeOption 100.0 30 true
        let price = calculateOptionPrice opt 100.0 1.0 30 r
        Assert.True(price > 0.0)
        Assert.True(price < 10.0)

    [<Fact>]
    member _.``PM-4.3 Time Decay (Theta)``() =
        let optLong = makeOption 100.0 90 true
        let optShort = makeOption 100.0 30 true
        let pLong = calculateOptionPrice optLong 100.0 1.0 90 r
        let pShort = calculateOptionPrice optShort 100.0 1.0 30 r
        Assert.True(pLong > pShort)

    [<Fact>]
    member _.``PM-4.4 Volatility Impact (Vega)``() =
        let opt = makeOption 100.0 30 true
        let pLowVol = calculateOptionPrice opt 100.0 0.5 30 r
        let pHighVol = calculateOptionPrice opt 100.0 2.0 30 r
        Assert.True(pHighVol > pLowVol)

    [<Fact>]
    member _.``PM-4.5 Put-Call Parity``() =
        let S = 100.0
        let K = 100.0
        let dte = 365
        let vol = 1.0
        
        let call = makeOption K dte true
        let put = makeOption K dte false
        
        let cPrice = calculateOptionPrice call S vol dte r
        let pPrice = calculateOptionPrice put S vol dte r
        
        let lhs = cPrice - pPrice
        let rhs = S - K * Math.Exp(-r * 1.0)
        
        Assert.Equal(rhs, lhs, 2)

    // ============================================================================
    // Category 5: Greeks Calculation
    // ============================================================================

    [<Fact>]
    member _.``PM-5.1 Delta ATM Call``() =
        let opt = makeOption 100.0 30 true
        let history = makeHistory 100.0
        let d = delta opt history 0 r
        Assert.Equal(0.5, d, 1)

    [<Fact>]
    member _.``PM-5.1 Delta Deep ITM Call``() =
        let opt = makeOption 50.0 30 true
        let history = makeHistory 100.0
        let d = delta opt history 0 r
        Assert.True(d > 0.9)

    [<Fact>]
    member _.``PM-5.1 Delta Put Negative``() =
        let opt = makeOption 100.0 30 false
        let history = makeHistory 100.0
        let d = delta opt history 0 r
        Assert.True(d < 0.0)

    [<Fact>]
    member _.``PM-5.2 Gamma Highest ATM``() =
        let optATM = makeOption 100.0 30 true
        let optOTM = makeOption 150.0 30 true
        let history = makeHistory 100.0
        
        let gATM = gamma optATM history 0 r
        let gOTM = gamma optOTM history 0 r
        
        Assert.True(gATM > gOTM)

    [<Fact>]
    member _.``PM-5.3 Theta Negative for Long``() =
        let opt = makeOption 100.0 30 true
        let history = makeHistory 100.0
        let t = theta opt history 0 r
        Assert.True(t < 0.0)

    [<Fact>]
    member _.``PM-5.4 Vega Positive``() =
        let opt = makeOption 100.0 30 true
        let history = makeHistory 100.0
        let v = vega opt history 0 r
        Assert.True(v > 0.0)

    // ============================================================================
    // Category 6: Strike-from-Delta Solver
    // ============================================================================

    [<Fact>]
    member _.``PM-6.1 Find Strike 50 Delta Call (ATM)``() =
        let history = makeHistory 100.0
        let spec = { Underlying = SimpleAsset "spy"; DTE = 30; GreekType = Delta; GreekValue = 0.5 }
        
        let strike = findStrikeForDelta spec history 0 r
        Assert.Equal(101.0, strike, 0)

    [<Fact>]
    member _.``PM-6.1 Find Strike 30 Delta Call (OTM)``() =
        let history = makeHistory 100.0
        let spec = { Underlying = SimpleAsset "spy"; DTE = 30; GreekType = Delta; GreekValue = 0.3 }
        
        let strike = findStrikeForDelta spec history 0 r
        Assert.True(strike > 100.0)

    [<Fact>]
    member _.``PM-6.1 Find Strike 70 Delta Call (ITM)``() =
        let history = makeHistory 100.0
        let spec = { Underlying = SimpleAsset "spy"; DTE = 30; GreekType = Delta; GreekValue = 0.7 }
        
        let strike = findStrikeForDelta spec history 0 r
        Assert.True(strike < 100.0)

    [<Fact>]
    member _.``PM-6.1 Find Strike Negative Delta (Put)``() =
        let history = makeHistory 100.0
        let spec = { Underlying = SimpleAsset "spy"; DTE = 30; GreekType = Delta; GreekValue = -0.3 }
        
        let strike = findStrikeForDelta spec history 0 r
        Assert.True(strike < 100.0)

    [<Fact>]
    member _.``PM-6.4 Solver Roundtrip Verification``() =
        let history = makeHistory 100.0
        let targetDelta = 0.4
        let spec = { Underlying = SimpleAsset "spy"; DTE = 30; GreekType = Delta; GreekValue = targetDelta }
        
        let strike = findStrikeForDelta spec history 0 r
        let opt = makeOption strike 30 true
        let calculatedDelta = delta opt history 0 r
        
        Assert.Equal(targetDelta, calculatedDelta, 3)

    // ============================================================================
    // Category 9: Error Handling
    // ============================================================================

    [<Fact>]
    member _.``PM-9.1 Negative Time handled gracefully``() =
        let opt = makeOption 100.0 -5 true
        let p = calculateOptionPrice opt 100.0 1.0 -5 r
        Assert.Equal(0.0, p, 5)

    [<Fact>]
    member _.``PM-9.1 Zero Volatility handled``() =
        let opt = makeOption 90.0 30 true
        let p = calculateOptionPrice opt 100.0 0.0 30 r
        Assert.Equal(10.0, p, 0)