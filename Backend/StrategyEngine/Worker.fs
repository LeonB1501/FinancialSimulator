module Worker

open Fable.Core
open Thoth.Json
open EngineTypes
open SimulationEngine
open Lexer
open Parser
open Elaborator
open StrategyEngine.Analytics.Types
open StrategyEngine.Analytics.Metrics
open StrategyEngine.Analytics.Aggregator

// ============================================================================
// PUBLIC API EXPOSED TO JAVASCRIPT
// ============================================================================

type SimulationRequest = {
    Config: SimulationConfiguration
    DslCode: string
    InitialCash: float
    BaseSeed: int
    Analysis: AnalysisConfiguration
}

type SimulationResponse = {
    Success: bool
    Error: string option
    Report: SimulationReport option
    RawResults: SimulationRunResult array option
}

type ValidationRequest = {
    DslCode: string
    // We need the tickers to validate asset references in the Elaborator
    ValidTickers: string list
}

type ValidationError = {
    Line: int
    Column: int
    Message: string
}

type ValidationResponse = {
    IsValid: bool
    Errors: ValidationError list
}

[<Emit("console.log($0)")>]
let log (msg: string) : unit = jsNative

/// Original wrapper without progress callback (for backward compatibility)
let runSimulationWrapper (jsonInput: string) : string =
    match Decode.Auto.fromString<SimulationRequest>(jsonInput) with
    | Error err ->
        let response = { Success = false; Error = Some $"JSON Parse Error: {err}"; Report = None; RawResults = None }
        Encode.Auto.toString(0, response)

    | Ok req ->
        match runSimulation req.Config req.DslCode req.InitialCash req.BaseSeed with
        | Ok results ->
            // 1. Calculate Metrics for every single run
            let singleMetrics =
                results
                |> Array.map (fun r -> calculateSingleRun r req.Analysis)

            // 2. Aggregate into a Report
            // Pass StartDate from config
            let report = aggregate results singleMetrics req.Analysis req.Config.StartDate

            let response = {
                Success = true
                Error = None
                Report = Some report
                RawResults = Some results
            }
            Encode.Auto.toString(0, response)

        | Error errMsg ->
            let response = { Success = false; Error = Some errMsg; Report = None; RawResults = None }
            Encode.Auto.toString(0, response)

/// New wrapper with progress callback support
/// The onProgress callback is a JavaScript function: (completed: number, total: number) => void
let runSimulationWithProgressWrapper (jsonInput: string) (onProgress: System.Func<int, int, unit>) : string =
    match Decode.Auto.fromString<SimulationRequest>(jsonInput) with
    | Error err ->
        let response = { Success = false; Error = Some $"JSON Parse Error: {err}"; Report = None; RawResults = None }
        Encode.Auto.toString(0, response)

    | Ok req ->
        // Convert the System.Func to an F# function
        let progressCallback (completed: int) (total: int) : unit =
            onProgress.Invoke(completed, total)

        match runSimulationWithProgress req.Config req.DslCode req.InitialCash req.BaseSeed progressCallback with
        | Ok results ->
            // 1. Calculate Metrics for every single run
            let singleMetrics =
                results
                |> Array.map (fun r -> calculateSingleRun r req.Analysis)

            // 2. Aggregate into a Report
            let report = aggregate results singleMetrics req.Analysis req.Config.StartDate

            let response = {
                Success = true
                Error = None
                Report = Some report
                RawResults = Some results
            }
            Encode.Auto.toString(0, response)

        | Error errMsg ->
            let response = { Success = false; Error = Some errMsg; Report = None; RawResults = None }
            Encode.Auto.toString(0, response)

let validateStrategyWrapper (jsonInput: string) : string =
    match Decode.Auto.fromString<ValidationRequest>(jsonInput) with
    | Error err -> 
        let response = { 
            IsValid = false
            Errors = [{ Line = 1; Column = 1; Message = $"JSON Parse Error: {err}" }] 
        }
        Encode.Auto.toString(0, response)
    
    | Ok req ->
        let tickerSet = Set.ofList req.ValidTickers
        
        // We use the existing compileStrategy function from SimulationEngine
        match SimulationEngine.compileStrategy req.DslCode tickerSet with
        | Ok _ ->
            let response = { IsValid = true; Errors = [] }
            Encode.Auto.toString(0, response)
            
        | Error errMsg ->
            // Currently, your F# exceptions return simple strings.
            // In the future, you can enhance Lexer/Parser to return Line/Col info.
            // For now, we default to Line 1, Column 1.
            let response = { 
                IsValid = false
                Errors = [{ Line = 1; Column = 1; Message = errMsg }] 
            }
            Encode.Auto.toString(0, response)