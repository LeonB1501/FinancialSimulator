module SimulationEngine

open System
open AST
open EngineTypes
open Lexer
open Parser
open Elaborator
open PathGenerator
open StrategyEvaluator

// ============================================================================
// COMPILATION PHASE
// ============================================================================

let compileStrategy (dslCode: string) (validTickers: Set<string>) : Result<Program, string> =
    try
        let tokens = Lexer.lex validTickers dslCode
        let rawAst = Parser.run tokens
        Elaborator.elaborateProgram rawAst
    with
    | LexerError msg -> Error $"Lexer Error: {msg}"
    | ParseError msg -> Error $"Parser Error: {msg}"
    | ex -> Error $"Unknown Compilation Error: {ex.Message}"

// ============================================================================
// ORCHESTRATION PHASE
// ============================================================================

/// Run a single iteration of the simulation
let private runSingleIteration
    (program: Program)
    (configWithWarmup: SimulationConfiguration)
    (warmupDays: int)
    (initialCash: float)
    (baseSeed: int)
    (iterationIndex: int)
    : SimulationRunResult =

    let runSeed = baseSeed + iterationIndex

    // A. Generate Path (Duration = UserDays + Warmup)
    let fullHistory = generatePaths configWithWarmup runSeed

    // B. Evaluate Strategy
    let rawResult = evaluate iterationIndex program configWithWarmup fullHistory initialCash

    // C. Slice Results - Remove warmup period from equity curve
    let slicedEquityCurve =
        if warmupDays > 0 && rawResult.EquityCurve.Length > warmupDays then
            rawResult.EquityCurve.[warmupDays..]
        else
            rawResult.EquityCurve

    { rawResult with EquityCurve = slicedEquityCurve }

/// Run simulation with progress callback support
/// The onProgress callback receives (completedIterations, totalIterations)
let runSimulationWithProgress
    (config: SimulationConfiguration)
    (dslCode: string)
    (initialCash: float)
    (baseSeed: int)
    (onProgress: int -> int -> unit)
    : Result<SimulationRunResult array, string> =

    // 1. Extract Valid Tickers
    let validTickers =
        config.Assets
        |> List.map (fun a -> a.Ticker)
        |> Set.ofList

    // 2. Compile Strategy
    match compileStrategy dslCode validTickers with
    | Error msg -> Error msg
    | Ok program ->

        // 3. Calculate Warmup Period
        let requiredLookback = Elaborator.calculateMaxLookback program
        let warmupDays = if requiredLookback > 0 then requiredLookback + 10 else 0

        // 4. Adjust Config for Warmup
        let totalDays = config.TradingDays + warmupDays
        let configWithWarmup = { config with TradingDays = totalDays }

        try
            let totalIterations = config.Iterations
            let results = Array.zeroCreate<SimulationRunResult> totalIterations

            // Calculate progress reporting interval (report every 1% or every 10 iterations, whichever is larger)
            let reportInterval = max 1 (min 10 (totalIterations / 100))

            // Run iterations with progress reporting
            for i in 1 .. totalIterations do
                results.[i - 1] <- runSingleIteration program configWithWarmup warmupDays initialCash baseSeed i

                // Report progress at intervals
                if i % reportInterval = 0 || i = totalIterations then
                    onProgress i totalIterations

            Ok results

        with
        | ex -> Error $"Runtime Simulation Error: {ex.Message}"

/// Original runSimulation without progress callback (for backward compatibility)
let runSimulation
    (config: SimulationConfiguration)
    (dslCode: string)
    (initialCash: float)
    (baseSeed: int)
    : Result<SimulationRunResult array, string> =

    // Use the progress version with a no-op callback
    runSimulationWithProgress config dslCode initialCash baseSeed (fun _ _ -> ())