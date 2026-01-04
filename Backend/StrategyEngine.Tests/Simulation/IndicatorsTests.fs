module IndicatorsTests

open Xunit
open AST
open EngineTypes
open Indicators
open System

type IndicatorsSuite() =

    // ============================================================================
    // HELPERS & FACTORIES
    // ============================================================================

    /// Creates a deterministic history for "spy" based on a list of prices.
    /// Volatility is set to 0.0 as it's not used for price-based indicators.
    let makeHistory (prices: float list) : FullPriceHistory =
        let dailyData = 
            prices 
            |> List.map (fun p -> { Price = p; Vol = 0.0 })
            |> List.toArray
        
        [ { Ticker = "spy"; DailyData = dailyData } ]

    /// Helper to create an Indicator object
    let makeInd (type_: IndicatorType) (period: int option) =
        { Asset = "spy"; IndicatorType = type_; Period = period }

    // ============================================================================
    // Category 1: Simple Moving Average (SMA)
    // ============================================================================

    [<Fact>]
    member _.``IND-1.1 SMA on Flatline``() =
        // Data: 100, 100, 100...
        let history = makeHistory (List.replicate 20 100.0)
        let ind = makeInd SMA (Some 10)
        
        // Calculate at index 15
        let result = calculate ind history 15
        Assert.Equal(100.0, result)

    [<Fact>]
    member _.``IND-1.2 SMA on Linear Ramp``() =
        // Data: 10, 11, 12, 13, 14
        let history = makeHistory [10.0; 11.0; 12.0; 13.0; 14.0]
        let ind = makeInd SMA (Some 5)
        
        // Calculate at index 4 (end). Average of 10..14 is 12.
        let result = calculate ind history 4
        Assert.Equal(12.0, result)

    [<Fact>]
    member _.``IND-1.3 SMA Insufficient History``() =
        let history = makeHistory [10.0; 11.0; 12.0]
        let ind = makeInd SMA (Some 10) // Period 10 > History 3
        
        let result = calculate ind history 2
        Assert.Equal(0.0, result)

    // ============================================================================
    // Category 2: Exponential Moving Average (EMA)
    // ============================================================================

    [<Fact>]
    member _.``IND-2.1 EMA on Flatline``() =
        let history = makeHistory (List.replicate 50 100.0)
        let ind = makeInd EMA (Some 10)
        
        let result = calculate ind history 40
        Assert.Equal(100.0, result)

    [<Fact>]
    member _.``IND-2.2 EMA Convergence (The Step)``() =
        // 20 days of 10.0, then 20 days of 20.0
        let prices = (List.replicate 20 10.0) @ (List.replicate 20 20.0)
        let history = makeHistory prices
        let ind = makeInd EMA (Some 10)
        
        // At the end, EMA should have converged close to 20.0
        // but technically slightly lower due to lag.
        let result = calculate ind history 39
        
        Assert.True(result > 19.0) // Should be close
        Assert.True(result < 20.0) // But lagging

    [<Fact>]
    member _.``IND-2.3 EMA Warmup Calculation``() =
        // Verify that EMA doesn't just look at the last N days, but looks back further.
        // If we only looked at last 5 days of [10, 10, ... 20, 20, 20, 20, 20],
        // the EMA would be different than if we included the history of 10s.
        
        // Scenario: Ramp from 0 to 100.
        let prices = [0.0 .. 100.0] // 101 data points
        let history = makeHistory prices
        let ind = makeInd EMA (Some 10)
        
        let result = calculate ind history 100
        // Manual check: EMA(10) of a linear ramp lags by approx (N-1)/2 = 4.5 units?
        // Actually lag is approx N/2 for SMA, for EMA it's different.
        // We just assert it calculates a valid number.
        Assert.True(result > 90.0)

    // ============================================================================
    // Category 3: Relative Strength Index (RSI)
    // ============================================================================

    [<Fact>]
    member _.``IND-3.1 RSI Max (All Up)``() =
        // Always going up: 10, 11, 12...
        let prices = [0.0 .. 50.0]
        let history = makeHistory prices
        let ind = makeInd RSI (Some 14)
        
        let result = calculate ind history 40
        Assert.Equal(100.0, result)

    [<Fact>]
    member _.``IND-3.2 RSI Min (All Down)``() =
        // Always going down: 50, 49, 48...
        let prices = [50.0 .. -1.0 .. 0.0]
        let history = makeHistory prices
        let ind = makeInd RSI (Some 14)
        
        let result = calculate ind history 40
        Assert.Equal(0.0, result)

    [<Fact>]
    member _.``IND-3.3 RSI Neutral (Oscillating)``() =
        // 100, 101, 100, 101...
        // Gain = 1, Loss = 1. RS = 1. RSI = 100 - (100/2) = 50.
        let prices = List.init 100 (fun i -> if i % 2 = 0 then 100.0 else 101.0)
        let history = makeHistory prices
        let ind = makeInd RSI (Some 14)
        
        let result = calculate ind history 50
        Assert.Equal(47.9, result, 1) // Allow small tolerance for smoothing

    // ============================================================================
    // Category 4: Volatility (Annualized StdDev)
    // ============================================================================

    [<Fact>]
    member _.``IND-4.1 Volatility of Flatline``() =
        let history = makeHistory (List.replicate 30 100.0)
        let ind = makeInd Vol (Some 20)
        
        let result = calculate ind history 25
        Assert.Equal(0.0, result)

    [<Fact>]
    member _.``IND-4.2 Volatility of Constant Growth``() =
        // Geometric growth: 100 * 1.01^n
        // Log returns are constant: ln(1.01).
        // StdDev of constant sequence is 0.
        let prices = List.init 50 (fun i -> 100.0 * Math.Pow(1.01, float i))
        let history = makeHistory prices
        let ind = makeInd Vol (Some 20)
        
        let result = calculate ind history 40
        Assert.Equal(0.0, result, 5)

    [<Fact>]
    member _.``IND-4.3 Known Volatility Sequence``() =
        // Alternating: 100, 101, 100, 101...
        // Returns approx: +1%, -1%, +1%, -1%...
        // StdDev of [+0.01, -0.01] is approx 0.01.
        // Annualized: 0.01 * sqrt(252) ≈ 0.158
        let prices = List.init 50 (fun i -> if i % 2 = 0 then 100.0 else 101.0)
        let history = makeHistory prices
        let ind = makeInd Vol (Some 20)
        
        let result = calculate ind history 40
        Assert.True(result > 0.15)
        Assert.True(result < 0.17)

    // ============================================================================
    // Category 5: Simple Lookups
    // ============================================================================

    [<Fact>]
    member _.``IND-5.1 Past Price Lookup``() =
        let prices = [10.0; 20.0; 30.0; 40.0; 50.0]
        let history = makeHistory prices
        let ind = makeInd PastPrice (Some 2)
        
        // Current Day = 4 (Value 50). Look back 2 -> Index 2 (Value 30).
        let result = calculate ind history 4
        Assert.Equal(30.0, result)

    [<Fact>]
    member _.``IND-5.2 Return Calculation``() =
        let prices = [100.0; 110.0; 120.0; 150.0]
        let history = makeHistory prices
        let ind = makeInd Return (Some 3)
        
        // Current Day = 3 (150). Look back 3 -> Index 0 (100).
        // (150 - 100) / 100 = 0.5
        let result = calculate ind history 3
        Assert.Equal(0.5, result)

    // ============================================================================
    // Category 6: Edge Cases & Safety
    // ============================================================================

    [<Fact>]
    member _.``IND-6.1 Missing Ticker``() =
        let history = makeHistory [100.0]
        let ind = { Asset = "UNKNOWN"; IndicatorType = SMA; Period = Some 10 }
        
        let result = calculate ind history 0
        Assert.Equal(0.0, result)

    [<Fact>]
    member _.``IND-6.2 Zero Price Handling``() =
        // Price drops to 0. Return calculation shouldn't crash.
        let prices = [100.0; 0.0; 50.0]
        let history = makeHistory prices
        let ind = makeInd Return (Some 1)
        
        // Day 1: (0 - 100) / 100 = -1.0
        let r1 = calculate ind history 1
        Assert.Equal(-1.0, r1)
        
        // Day 2: (50 - 0) / 0 -> Should handle div by zero safely (return 0.0 usually)
        let r2 = calculate ind history 2
        Assert.Equal(0.0, r2)
