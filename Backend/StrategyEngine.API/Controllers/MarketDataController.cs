using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using StrategyEngine.API.Services;

namespace StrategyEngine.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
public class MarketDataController : ControllerBase
{
    private readonly IMarketDataProvider _provider;
    private readonly IMemoryCache _cache;

    public MarketDataController(IMarketDataProvider provider, IMemoryCache cache)
    {
        _provider = provider;
        _cache = cache;
    }

    [HttpGet("tickers")]
    public async Task<IActionResult> GetTickers()
    {
        var tickers = await _provider.GetAvailableTickersAsync();
        return Ok(tickers);
    }

    [HttpGet("{ticker}")]
    public async Task<IActionResult> GetHistory(string ticker)
    {
        ticker = ticker.ToLower();
        var cacheKey = $"market_data_{ticker}";

        if (_cache.TryGetValue(cacheKey, out var cachedData))
        {
            return Ok(cachedData);
        }

        var history = await _provider.GetHistoryAsync(ticker);

        if (history == null)
        {
            return NotFound(new { error = $"Ticker '{ticker}' not found." });
        }

        _cache.Set(cacheKey, history, TimeSpan.FromHours(1));
        return Ok(history);
    }

    // NEW: Get Calibrated Parameters
    [HttpGet("{ticker}/params/{modelType}")]
    public async Task<IActionResult> GetParameters(string ticker, string modelType)
    {
        // Normalize model type string from frontend to DB format
        // Frontend sends: "heston", "gbm", "garch"
        // DB expects: "Heston", "GeometricBrownianMotion", "Garch"
        
        string dbModelType = modelType.ToLower() switch
        {
            "heston" => "Heston",
            "gbm" => "GeometricBrownianMotion",
            "garch" => "Garch",
            "regime_switching" => "RegimeSwitching",
            "blocked_bootstrap" => "BlockedBootstrap",
            _ => modelType
        };

        var paramsJson = await _provider.GetModelParametersAsync(ticker, dbModelType);

        if (paramsJson == null)
        {
            // Return empty object or default if not found, so frontend doesn't crash
            return Ok(new { });
        }

        // Return as ContentResult to avoid double-serialization of the JSON string
        return Content(paramsJson, "application/json");
    }
    
    [HttpGet("correlations")]
    public async Task<IActionResult> GetCorrelations([FromQuery] string[] tickers)
    {
        if (tickers == null || tickers.Length < 2) return Ok(new List<object>());
    
        // Assuming you updated the interface to return the DTO or mapped it here
        var result = await ((SqlMarketDataProvider)_provider).GetCorrelationsAsync(tickers);
        return Ok(result);
    }
}