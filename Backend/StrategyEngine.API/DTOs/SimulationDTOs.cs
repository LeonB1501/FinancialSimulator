using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace StrategyEngine.API.DTOs;

// ============================================
// CONFIGURATION DTOs (Shared)
// ============================================

public record CommissionModel(
    [property: JsonPropertyName("perOrder")]
    double PerOrder, 
    [property: JsonPropertyName("perUnit")]
    double PerUnit
);

public record VolatilityTier(
    [property: JsonPropertyName("minVol")]
    double MinVol, 
    [property: JsonPropertyName("maxVol")]
    double MaxVol, 
    [property: JsonPropertyName("spread")]
    double Spread
);

public record SlippageModel(
    [property: JsonPropertyName("defaultSpread")]
    double DefaultSpread, 
    [property: JsonPropertyName("volatilityTiers")]
    List<VolatilityTier> Tiers
);

public record ExecutionCosts(
    [property: JsonPropertyName("commission")]
    CommissionModel Commission, 
    [property: JsonPropertyName("slippage")]
    SlippageModel Slippage
);

// NEW: Tax DTOs
public record TaxConfig(
    [property: JsonPropertyName("paymentMode")]
    string PaymentMode, // "Immediate" or "Periodic"
    
    [property: JsonPropertyName("settlementFrequency")]
    int? SettlementFrequency,
    
    [property: JsonPropertyName("shortTermRate")]
    double ShortTermRate,
    
    [property: JsonPropertyName("longTermRate")]
    double LongTermRate,
    
    [property: JsonPropertyName("longTermThreshold")]
    int LongTermThreshold,
    
    [property: JsonPropertyName("wealthTaxRate")]
    double WealthTaxRate
);

// ============================================
// DEBUG SIMULATION DTOs
// ============================================

public record DebugSimulationResponse(
    bool Success,
    object? Results, 
    string? Error
);

// ============================================
// HISTORIC BACKTEST DTOs
// ============================================

public record HistoricBacktestRequest(
    DateTime StartDate,
    DateTime EndDate,
    string BenchmarkTicker = "spy",
    ExecutionCosts? ExecutionCosts = null,
    TaxConfig? TaxConfig = null // <--- Added
);

public record HistoricTransactionDto(
    int Day,
    DateTime Date,
    string Ticker,
    string Type,
    double Quantity,
    double Price,
    double Value,
    string? Tag,
    double Commission,
    double Slippage,
    double Tax // <--- Added
);

public record HistoricBacktestResponse(
    bool Success,
    string? Error,
    double[]? EquityCurve,
    double[]? BenchmarkCurve,
    double[]? DrawdownCurve,
    DateTime[]? Dates,
    HistoricTransactionDto[]? Transactions,
    double TotalReturn,
    double BenchmarkReturn,
    double MaxDrawdown,
    double SharpeRatio,
    double Volatility,
    // NEW: Cost Totals
    double TotalCommission,
    double TotalSlippage,
    double TotalTax
);