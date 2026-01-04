module StrategyEngine.DebugInterop

open System
open System.Collections.Generic
open System.Text.Json
open EngineTypes
open Microsoft.FSharp.Collections

// ============================================================================
// C# COMPATIBLE DTOs
// ============================================================================

type DtoModelParam = {
    Kappa: float; Theta: float; Sigma: float; Rho: float; V0: float; Mu: float; Epsilon: float;
    Omega: float; Alpha: float; Beta: float; InitialVol: float;
    BlockSize: int; HistoricalDataId: string
}

type DtoAsset = {
    Ticker: string
    InitialPrice: float
    Model: JsonElement 
}

type DtoCommission = {
    PerOrder: float
    PerUnit: float
}

type DtoVolatilityTier = {
    MinVol: float
    MaxVol: float
    Spread: float
}

type DtoSlippage = {
    DefaultSpread: float
    Tiers: DtoVolatilityTier array 
}

type DtoExecutionCosts = {
    Commission: DtoCommission
    Slippage: DtoSlippage
}

// NEW: Tax DTO
type DtoTaxConfig = {
    PaymentMode: string // "Immediate" or "Periodic"
    SettlementFrequency: int option
    ShortTermRate: float
    LongTermRate: float
    LongTermThreshold: int
    WealthTaxRate: float
}

type DtoConfig = {
    Assets: DtoAsset list
    Correlations: JsonElement 
    TradingDays: int
    Iterations: int
    RiskFreeRate: float
    Granularity: int
    HistoricalData: JsonElement 
    StartDate: DateTime
    Scenario: JsonElement
    ExecutionCosts: DtoExecutionCosts option 
    Tax: DtoTaxConfig option // <--- Added Tax field
}

type DtoRequest = {
    Config: DtoConfig
    DslCode: string
    InitialCash: float
    BaseSeed: int
}

// ============================================================================
// PARSING LOGIC
// ============================================================================

let private parseModel (elem: JsonElement) : SimulationModel =
    if elem.ValueKind = JsonValueKind.Array then
        let arr = elem.EnumerateArray() |> Seq.toArray
        let caseName = arr.[0].GetString()
        match caseName with
        | "GeometricBrownianMotion" ->
            let mu = arr.[1].GetDouble()
            let sigma = arr.[2].GetDouble()
            GeometricBrownianMotion(mu, sigma)
        | "Heston" ->
            let p = JsonSerializer.Deserialize<DtoModelParam>(arr.[1].GetRawText())
            Heston { Kappa=p.Kappa; Theta=p.Theta; Sigma=p.Sigma; Rho=p.Rho; V0=p.V0; Mu=p.Mu; Epsilon=p.Epsilon }
        | "Garch" ->
            let p = JsonSerializer.Deserialize<DtoModelParam>(arr.[1].GetRawText())
            Garch { Omega=p.Omega; Alpha=p.Alpha; Beta=p.Beta; Mu=p.Mu; InitialVol=p.InitialVol }
        | "BlockedBootstrap" ->
            let p = JsonSerializer.Deserialize<DtoModelParam>(arr.[1].GetRawText())
            BlockedBootstrap { BlockSize=p.BlockSize; HistoricalDataId=p.HistoricalDataId }
        | "RegimeSwitching" ->
            GeometricBrownianMotion(0.05, 0.15) // Placeholder for complex object mapping if needed
        | _ -> failwith $"Unknown Model Case: {caseName}"
    else
        failwith "Model definition must be an array [Case, Args]"

let private parseScenario (elem: JsonElement) : FinancialScenario =
    if elem.ValueKind = JsonValueKind.Array then
        let arr = elem.EnumerateArray() |> Seq.toArray
        let caseName = arr.[0].GetString()
        match caseName with
        | "NoScenario" -> NoScenario
        | "Accumulation" ->
            let args = arr.[1]
            let p = JsonSerializer.Deserialize<AccumulationParams>(args.GetRawText())
            Accumulation p
        | "Retirement" ->
            let args = arr.[1]
            let p = JsonSerializer.Deserialize<RetirementParams>(args.GetRawText())
            Retirement p
        | _ -> NoScenario
    else
        NoScenario

let private parseExecutionCosts (dto: DtoExecutionCosts option) : ExecutionCosts =
    match dto with
    | Some c -> 
        let tiers = 
            if isNull (box c.Slippage.Tiers) then []
            else c.Slippage.Tiers |> Array.toList

        {
            Commission = { PerOrder = c.Commission.PerOrder; PerUnit = c.Commission.PerUnit }
            Slippage = {
                DefaultSpread = c.Slippage.DefaultSpread
                Tiers = tiers |> List.map (fun t -> 
                    { MinVol = t.MinVol; MaxVol = t.MaxVol; Spread = t.Spread }
                )
            }
        }
    | None ->
        {
            Commission = { PerOrder = 0.0; PerUnit = 0.0 }
            Slippage = { DefaultSpread = 0.0; Tiers = [] }
        }

let private parseTaxConfig (dto: DtoTaxConfig option) : TaxConfig =
    match dto with
    | Some t ->
        let mode = 
            match t.PaymentMode.ToLower() with
            | "immediate" -> ImmediateWithholding
            | _ -> PeriodicSettlement(t.SettlementFrequency |> Option.defaultValue 252)
        {
            PaymentMode = mode
            ShortTermRate = t.ShortTermRate
            LongTermRate = t.LongTermRate
            LongTermThreshold = t.LongTermThreshold
            WealthTaxRate = t.WealthTaxRate
        }
    | None ->
        // Default to tax-free
        {
            PaymentMode = PeriodicSettlement(252)
            ShortTermRate = 0.0
            LongTermRate = 0.0
            LongTermThreshold = 365
            WealthTaxRate = 0.0
        }

// ============================================================================
// DEBUG SIMULATION RUNNER
// ============================================================================

let runDebugSimulation (jsonInput: string) : IDictionary<string, obj> =
    try
        let opts = JsonSerializerOptions(PropertyNameCaseInsensitive = true)
        let req = JsonSerializer.Deserialize<DtoRequest>(jsonInput, opts)
        
        let assets : AssetDefinition list = 
            req.Config.Assets 
            |> List.map (fun a -> 
                { 
                    Ticker = a.Ticker
                    InitialPrice = a.InitialPrice
                    Model = parseModel a.Model 
                } : AssetDefinition
            )

        let corrMap = 
            if req.Config.Correlations.ValueKind = JsonValueKind.Array then
                req.Config.Correlations.EnumerateArray()
                |> Seq.map (fun item -> 
                    let pairArr = item.[0].EnumerateArray() |> Seq.toArray
                    let t1 = pairArr.[0].GetString()
                    let t2 = pairArr.[1].GetString()
                    let v = item.[1].GetDouble()
                    ((t1, t2), v)
                )
                |> Map.ofSeq
            else
                Map.empty

        let histMap = 
            let elem = req.Config.HistoricalData
            if elem.ValueKind = JsonValueKind.Array then
                elem.EnumerateArray()
                |> Seq.map (fun tuple ->
                    let arr = tuple.EnumerateArray() |> Seq.toArray
                    let ticker = arr.[0].GetString()
                    let points = JsonSerializer.Deserialize<MarketDataPoint array>(arr.[1].GetRawText(), opts)
                    (ticker, points)
                )
                |> Map.ofSeq
            elif elem.ValueKind = JsonValueKind.Object then
                JsonSerializer.Deserialize<Dictionary<string, MarketDataPoint array>>(elem.GetRawText(), opts)
                |> Seq.map (fun kv -> (kv.Key, kv.Value))
                |> Map.ofSeq
            else
                Map.empty

        let config : SimulationConfiguration = {
            Assets = assets
            Correlations = corrMap
            TradingDays = req.Config.TradingDays
            Iterations = req.Config.Iterations
            RiskFreeRate = req.Config.RiskFreeRate
            Granularity = req.Config.Granularity
            HistoricalData = histMap
            StartDate = req.Config.StartDate
            Scenario = parseScenario req.Config.Scenario
            ExecutionCosts = parseExecutionCosts req.Config.ExecutionCosts
            Tax = parseTaxConfig req.Config.Tax // <--- Populated Tax Field
        }

        match SimulationEngine.runSimulation config req.DslCode req.InitialCash req.BaseSeed with
        | Ok results -> 
            let serializableResults =
                results
                |> Array.map (fun r ->
                    {|
                        RunId = r.RunId
                        EquityCurve = r.EquityCurve
                    |}
                )

            dict [
                "Success", box true
                "Results", box serializableResults
                "Error",   box null
            ]
        | Error msg -> 
            dict [
                "Success", box false
                "Results", box null
                "Error",   box msg
            ]

    with ex ->
        dict [
            "Success", box false
            "Results", box null
            "Error",   box (ex.ToString())
        ]

// ============================================================================
// HISTORIC BACKTEST INTEROP
// ============================================================================

type DtoHistoricRequest = {
    Assets: string list
    MarketData: JsonElement
    StartIndex: int
    EndIndex: int
    Granularity: int
    RiskFreeRate: float
    BenchmarkTicker: string
    DslCode: string
    InitialCash: float
    StartDate: DateTime
    ExecutionCosts: DtoExecutionCosts option
    Tax: DtoTaxConfig option
}

type DtoTransaction = {
    Date: int
    Ticker: string
    Type: string
    Quantity: float
    Price: float
    Value: float
    Tag: string option
    Commission: float
    Slippage: float
    Tax: float // <--- Added
}

type DtoHistoricResult = {
    EquityCurve: float array
    BenchmarkCurve: float array
    Transactions: DtoTransaction array
    DrawdownCurve: float array
    TotalReturn: float
    BenchmarkReturn: float
    MaxDrawdown: float
    SharpeRatio: float
    Volatility: float
    // NEW: Total Costs (Optional, but useful to pass back)
    TotalCommission: float
    TotalSlippage: float
    TotalTax: float
}

let runHistoricBacktest (jsonInput: string) : IDictionary<string, obj> =
    try
        let opts = JsonSerializerOptions(PropertyNameCaseInsensitive = true)
        let req = JsonSerializer.Deserialize<DtoHistoricRequest>(jsonInput, opts)
        
        let marketData = 
            let elem = req.MarketData
            if elem.ValueKind = JsonValueKind.Array then
                elem.EnumerateArray()
                |> Seq.map (fun tuple ->
                    let arr = tuple.EnumerateArray() |> Seq.toArray
                    let ticker = arr.[0].GetString()
                    let points = JsonSerializer.Deserialize<EngineTypes.MarketDataPoint array>(arr.[1].GetRawText(), opts)
                    (ticker, { EngineTypes.PricePath.Ticker = ticker; DailyData = points })
                )
                |> Map.ofSeq
            elif elem.ValueKind = JsonValueKind.Object then
                JsonSerializer.Deserialize<Dictionary<string, EngineTypes.MarketDataPoint array>>(elem.GetRawText(), opts)
                |> Seq.map (fun kv -> (kv.Key, { EngineTypes.PricePath.Ticker = kv.Key; DailyData = kv.Value }))
                |> Map.ofSeq
            else
                Map.empty
        
        let config : HistoricSimulator.HistoricConfiguration = {
            Assets = req.Assets
            MarketData = marketData
            StartIndex = req.StartIndex
            EndIndex = req.EndIndex
            Granularity = req.Granularity
            RiskFreeRate = req.RiskFreeRate
            BenchmarkTicker = req.BenchmarkTicker
            ExecutionCosts = parseExecutionCosts req.ExecutionCosts
            Tax = parseTaxConfig req.Tax
        }
        
        let validTickers = req.Assets |> Set.ofList
        match SimulationEngine.compileStrategy req.DslCode validTickers with
        | Error msg ->
            dict [
                "Success", box false
                "Result", box null
                "Error", box msg
            ]
        | Ok program ->
            match HistoricSimulator.runHistoric config program req.InitialCash req.StartDate with
            | Ok result ->
                // Calculate totals for response
                let totalComm = result.Transactions |> List.sumBy (fun t -> t.Commission)
                let totalSlip = result.Transactions |> List.sumBy (fun t -> t.Slippage)
                let totalTax = result.Transactions |> List.sumBy (fun t -> t.Tax)

                let dtoResult : DtoHistoricResult = {
                    EquityCurve = result.EquityCurve
                    BenchmarkCurve = result.BenchmarkCurve
                    Transactions = 
                        result.Transactions 
                        |> List.map (fun t -> {
                            Date = t.Date
                            Ticker = t.Ticker
                            Type = t.Type
                            Quantity = t.Quantity
                            Price = t.Price
                            Value = t.Value
                            Tag = t.Tag
                            Commission = t.Commission
                            Slippage = t.Slippage
                            Tax = t.Tax // <--- Mapped
                        })
                        |> List.toArray
                    DrawdownCurve = result.DrawdownCurve
                    TotalReturn = result.TotalReturn
                    BenchmarkReturn = result.BenchmarkReturn
                    MaxDrawdown = result.MaxDrawdown
                    SharpeRatio = result.SharpeRatio
                    Volatility = result.Volatility
                    TotalCommission = totalComm
                    TotalSlippage = totalSlip
                    TotalTax = totalTax
                }
                dict [
                    "Success", box true
                    "Result", box dtoResult
                    "Error", box null
                ]
            | Error msg ->
                dict [
                    "Success", box false
                    "Result", box null
                    "Error", box msg
                ]
    with ex ->
        dict [
            "Success", box false
            "Result", box null
            "Error", box (ex.ToString())
        ]