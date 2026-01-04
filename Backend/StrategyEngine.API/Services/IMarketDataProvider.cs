using StrategyEngine.API.DTOs; // Ensure this using exists

namespace StrategyEngine.API.Services;

public interface IMarketDataProvider
{
    // Returns list of supported symbols (e.g. ["SPY", "QQQ"])
    Task<IEnumerable<string>> GetAvailableTickersAsync();

    // Returns the price/vol history for a specific asset
    Task<EngineTypes.PricePath?> GetHistoryAsync(string ticker);

    // Returns the calibrated parameters for a specific ticker and model
    Task<string?> GetModelParametersAsync(string ticker, string modelType);

    // NEW: Get Correlations
    Task<List<CorrelationDto>> GetCorrelationsAsync(string[] tickers);
}