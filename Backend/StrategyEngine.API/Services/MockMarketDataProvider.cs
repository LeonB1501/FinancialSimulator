using StrategyEngine.API.DTOs; // Add this namespace
using StrategyEngine.API.Services;

namespace StrategyEngine.API.Services;

public class MockMarketDataProvider : IMarketDataProvider
{
    // Hardcoded list of "supported" assets for the MVP
    private static readonly string[] _tickers = { "spy", "qqq", "iwm", "dia", "vix" };

    public Task<IEnumerable<string>> GetAvailableTickersAsync()
    {
        return Task.FromResult(_tickers.AsEnumerable());
    }

    public Task<EngineTypes.PricePath?> GetHistoryAsync(string ticker)
    {
        if (!_tickers.Contains(ticker.ToLower()))
        {
            return Task.FromResult<EngineTypes.PricePath?>(null);
        }

        var data = GenerateMockData(ticker);
        var path = new EngineTypes.PricePath(ticker, data);
        return Task.FromResult<EngineTypes.PricePath?>(path);
    }

    public Task<string?> GetModelParametersAsync(string ticker, string modelType)
    {
        return Task.FromResult<string?>("{}"); 
    }

    // --- NEW METHOD TO FIX BUILD ERROR ---
    public Task<List<CorrelationDto>> GetCorrelationsAsync(string[] tickers)
    {
        var results = new List<CorrelationDto>();
        
        // Generate dummy 0.5 correlations for any pair requested
        for (int i = 0; i < tickers.Length; i++)
        {
            for (int j = i + 1; j < tickers.Length; j++)
            {
                results.Add(new CorrelationDto(tickers[i], tickers[j], 0.5));
            }
        }

        return Task.FromResult(results);
    }
    // -------------------------------------

    private EngineTypes.MarketDataPoint[] GenerateMockData(string ticker)
    {
        var random = new Random(ticker.GetHashCode());
        var days = 252 * 5; 
        var price = 100.0;
        var vol = 0.20; 
        
        var result = new EngineTypes.MarketDataPoint[days];
        
        for (int i = 0; i < days; i++)
        {
            var change = (random.NextDouble() - 0.5) * 0.02; 
            price = price * (1.0 + change);
            var volChange = (random.NextDouble() - 0.5) * 0.05;
            vol = Math.Max(0.05, vol + volChange);

            result[i] = new EngineTypes.MarketDataPoint(price, vol);
        }

        return result;
    }
}