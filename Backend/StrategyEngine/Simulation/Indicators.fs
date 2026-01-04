module Indicators

open AST
open EngineTypes
open System

// ============================================================================
// DATA EXTRACTION HELPERS
// ============================================================================

/// Extracts the price array for a specific ticker from the history
let private getPriceSeries (ticker: string) (history: FullPriceHistory) : float array option =
    history 
    |> List.tryFind (fun p -> p.Ticker = ticker)
    |> Option.map (fun p -> p.DailyData |> Array.map (fun d -> d.Price))

// ============================================================================
// INDICATOR MATH
// ============================================================================

let private calculateSMA (data: float array) (period: int) (currentDay: int) : float =
    if currentDay < period - 1 then 0.0
    else
        let startIdx = currentDay - period + 1
        let slice = data.[startIdx .. currentDay]
        Array.average slice

let private calculateEMA (data: float array) (period: int) (currentDay: int) : float =
    if currentDay < period - 1 then 0.0
    else
        // EMA requires a "warmup" to converge. 
        // We start calculating 3x periods back (or at index 0) to approximate the infinite series.
        let warmupPeriod = period * 3
        let startIdx = Math.Max(0, currentDay - warmupPeriod)
        
        // Initialize with SMA of the first 'period' elements relative to startIdx
        // (Or just the first price if we are really early)
        let mutable ema = data.[startIdx] 
        
        // Multiplier
        let k = 2.0 / (float period + 1.0)

        for i in startIdx + 1 .. currentDay do
            ema <- (data.[i] * k) + (ema * (1.0 - k))
        
        ema

let private calculateRSI (data: float array) (period: int) (currentDay: int) : float =
    if currentDay < period then 0.0
    else
        // RSI also needs warmup for the Wilder's Smoothing method
        let warmup = period * 3
        let startIdx = Math.Max(1, currentDay - warmup)
        
        let mutable avgGain = 0.0
        let mutable avgLoss = 0.0

        // 1. Initial SMA calculation for the first 'period'
        for i in startIdx .. (startIdx + period - 1) do
            let change = data.[i] - data.[i-1]
            if change > 0.0 then avgGain <- avgGain + change
            else avgLoss <- avgLoss + abs(change)
        
        avgGain <- avgGain / float period
        avgLoss <- avgLoss / float period

        // 2. Wilder's Smoothing for the rest
        for i in (startIdx + period) .. currentDay do
            let change = data.[i] - data.[i-1]
            let gain = if change > 0.0 then change else 0.0
            let loss = if change < 0.0 then abs(change) else 0.0
            
            avgGain <- ((avgGain * float(period - 1)) + gain) / float period
            avgLoss <- ((avgLoss * float(period - 1)) + loss) / float period

        if avgLoss = 0.0 then 100.0
        else
            let rs = avgGain / avgLoss
            100.0 - (100.0 / (1.0 + rs))

let private calculateVol (data: float array) (period: int) (currentDay: int) : float =
    if currentDay < period then 0.0
    else
        // Annualized Standard Deviation of Log Returns
        let startIdx = currentDay - period + 1
        let returns = 
            [| for i in startIdx .. currentDay do
                 if data.[i-1] <> 0.0 then 
                     yield Math.Log(data.[i] / data.[i-1])
                 else 
                     yield 0.0 |]
        
        let mean = Array.average returns
        let sumSqDiff = returns |> Array.sumBy (fun r -> Math.Pow(r - mean, 2.0))
        let stdDev = Math.Sqrt(sumSqDiff / float (period - 1))
        
        // Annualize (assuming 252 trading days)
        stdDev * Math.Sqrt(252.0)

let private calculateReturn (data: float array) (period: int) (currentDay: int) : float =
    if currentDay < period then 0.0
    else
        let currentPrice = data.[currentDay]
        let pastPrice = data.[currentDay - period]
        if pastPrice = 0.0 then 0.0
        else (currentPrice - pastPrice) / pastPrice

let private calculatePastPrice (data: float array) (period: int) (currentDay: int) : float =
    if currentDay < period then 0.0
    else data.[currentDay - period]

// ============================================================================
// PUBLIC API
// ============================================================================

let calculate (indicator: Indicator) (history: FullPriceHistory) (currentDay: int) : float =
    let prices = getPriceSeries indicator.Asset history
    
    match prices with
    | None -> 
        // Ticker not found in history
        // In a real app, we might log a warning or throw. 
        // For now, safe default to avoid crashing simulation.
        0.0
    | Some data ->
        // Default periods if not specified
        let p = 
            match indicator.Period with
            | Some v -> v
            | None -> 
                match indicator.IndicatorType with
                | SMA | EMA | Vol -> 20
                | RSI -> 14
                | Return | PastPrice -> 1

        match indicator.IndicatorType with
        | SMA -> calculateSMA data p currentDay
        | EMA -> calculateEMA data p currentDay
        | RSI -> calculateRSI data p currentDay
        | Vol -> calculateVol data p currentDay
        | Return -> calculateReturn data p currentDay
        | PastPrice -> calculatePastPrice data p currentDay