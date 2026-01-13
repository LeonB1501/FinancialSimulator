module SimulationEngine

open System
open AST
open EngineTypes
open Lexer
open Parser
open Elaborator
open PathGenerator
open StrategyEvaluator

let compileStrategy (dslCode: string) (validTickers: Set<string>) : Result<Program, string> =
    try
        let tokens = Lexer.lex validTickers dslCode
        let rawAst = Parser.run tokens
        Elaborator.elaborateProgram rawAst
    with
    | LexerError msg -> Error $"Lexer Error: {msg}"
    | ParseError msg -> Error $"Parser Error: {msg}"
    | ex -> Error $"Unknown Compilation Error: {ex.Message}"

let private runSingleIteration
    (program: Program)
    (configWithWarmup: SimulationConfiguration)
    (warmupDays: int)
    (initialCash: float)
    (baseSeed: int)
    (iterationIndex: int)
    : SimulationRunResult =

    let runSeed = baseSeed + iterationIndex

    let fullHistory = generatePaths configWithWarmup runSeed

    let rawResult = evaluate iterationIndex program configWithWarmup fullHistory initialCash

    let slicedEquityCurve =
        if warmupDays > 0 && rawResult.EquityCurve.Length > warmupDays then
            rawResult.EquityCurve.[warmupDays..]
        else
            rawResult.EquityCurve

    { rawResult with EquityCurve = slicedEquityCurve }

let runSimulationWithProgress
    (config: SimulationConfiguration)
    (dslCode: string)
    (initialCash: float)
    (baseSeed: int)
    (onProgress: int -> int -> unit)
    : Result<SimulationRunResult array, string> =

    let validTickers =
        config.Assets
        |> List.map (fun a -> a.Ticker)
        |> Set.ofList

    match compileStrategy dslCode validTickers with
    | Error msg -> Error msg
    | Ok program ->

        let requiredLookback = Elaborator.calculateMaxLookback program
        let warmupDays = if requiredLookback > 0 then requiredLookback + 10 else 0

        let totalDays = config.TradingDays + warmupDays
        let configWithWarmup = { config with TradingDays = totalDays }

        try
            let totalIterations = config.Iterations
            let results = Array.zeroCreate<SimulationRunResult> totalIterations

            let reportInterval = max 1 (min 10 (totalIterations / 100))

            for i in 1 .. totalIterations do
                results.[i - 1] <- runSingleIteration program configWithWarmup warmupDays initialCash baseSeed i

                if i % reportInterval = 0 || i = totalIterations then
                    onProgress i totalIterations

            Ok results

        with
        | ex -> Error $"Runtime Simulation Error: {ex.Message}"

let runSimulation
    (config: SimulationConfiguration)
    (dslCode: string)
    (initialCash: float)
    (baseSeed: int)
    : Result<SimulationRunResult array, string> =

    runSimulationWithProgress config dslCode initialCash baseSeed (fun _ _ -> ())