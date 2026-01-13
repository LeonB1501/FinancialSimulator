using StrategyEngine.API.DTOs;

namespace StrategyEngine.API.Services;

public interface IMarketDataProvider
{
    Task<IEnumerable<string>> GetAvailableTickersAsync();

    Task<EngineTypes.PricePath?> GetHistoryAsync(string ticker);

    Task<string?> GetModelParametersAsync(string ticker, string modelType);

    Task<List<CorrelationDto>> GetCorrelationsAsync(string[] tickers);
}