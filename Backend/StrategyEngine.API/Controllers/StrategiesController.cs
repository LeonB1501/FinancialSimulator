using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StrategyEngine.API.Data;
using StrategyEngine.API.DTOs;
using StrategyEngine.API.Services;

namespace StrategyEngine.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class StrategiesController : ControllerBase
{
    private readonly StrategyService _service;
    private readonly AppDbContext _context;
    private readonly IMarketDataProvider _marketDataProvider;

    public StrategiesController(StrategyService service, AppDbContext context, IMarketDataProvider marketDataProvider)
    {
        _service = service;
        _context = context;
        _marketDataProvider = marketDataProvider;
    }

    private string GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateStrategyRequest request)
    {
        var result = await _service.CreateStrategyAsync(GetUserId(), request);
        if (!result.IsSuccess) return BadRequest(new { error = result.Error });
        return Ok(result.Data);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _service.GetUserStrategiesAsync(GetUserId());
        return Ok(result.Data);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(int id)
    {
        var result = await _service.GetStrategyAsync(id, GetUserId());
        if (!result.IsSuccess) return NotFound(new { error = result.Error });
        return Ok(result.Data);
    }

    [HttpPatch("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateStrategyRequest request)
    {
        var userId = GetUserId();
        var strategy = await _context.Strategies.FindAsync(id);

        if (strategy == null) return NotFound(new { error = "Strategy not found" });
        if (strategy.UserId != userId) return Forbid();

        if (request.Name != null) strategy.Name = request.Name;
        if (request.DslScript != null) strategy.DslScript = request.DslScript;
        if (request.ConfigJson != null) strategy.ConfigJson = request.ConfigJson;
        if (request.IsPublic.HasValue) strategy.IsPublic = request.IsPublic.Value;

        strategy.LastModified = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var latestResultId = await _context.SimulationResults
            .Where(r => r.StrategyId == id)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => r.Id)
            .FirstOrDefaultAsync();

        return Ok(new StrategyResponse(
            strategy.Id,
            strategy.Name,
            strategy.DslScript,
            strategy.ConfigJson,
            strategy.IsPublic,
            strategy.CreatedAt,
            strategy.LastModified,
            latestResultId
        ));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await _service.DeleteStrategyAsync(id, GetUserId());
        if (!result.IsSuccess) return BadRequest(new { error = result.Error });
        return NoContent();
    }

    // ============================================
    // HISTORIC BACKTEST ENDPOINT
    // ============================================

    [HttpPost("{id}/run-historic")]
    public async Task<IActionResult> RunHistoricBacktest(int id, [FromBody] HistoricBacktestRequest request)
    {
        var userId = GetUserId();
        
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return Unauthorized();

        if (user.SubscriptionTier == "Free")
        {
            return StatusCode(403, new { error = "Historic backtesting is a Pro feature. Please upgrade your account." });
        }

        var strategy = await _context.Strategies.FindAsync(id);

        if (strategy == null) return NotFound(new { error = "Strategy not found" });
        if (strategy.UserId != userId) return Forbid();

        try
        {
            // 1. Parse strategy config
            var configJson = JsonDocument.Parse(strategy.ConfigJson);
            var tickers = new List<string>();
            
            if (configJson.RootElement.TryGetProperty("indices", out var indicesElement))
            {
                foreach (var idx in indicesElement.EnumerateArray())
                {
                    if (idx.TryGetProperty("symbol", out var symbol))
                    {
                        tickers.Add(symbol.GetString()?.ToLower() ?? "");
                    }
                }
            }

            // 2. Extract Costs & Tax (Prioritize Request, Fallback to Strategy Config)
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            ExecutionCosts? executionCosts = request.ExecutionCosts;
            if (executionCosts == null && configJson.RootElement.TryGetProperty("executionCosts", out var costsElement))
            {
                executionCosts = JsonSerializer.Deserialize<ExecutionCosts>(costsElement.GetRawText(), options);
            }

            TaxConfig? taxConfig = request.TaxConfig;
            if (taxConfig == null && configJson.RootElement.TryGetProperty("taxConfig", out var taxElement))
            {
                taxConfig = JsonSerializer.Deserialize<TaxConfig>(taxElement.GetRawText(), options);
            }

            var benchmarkTicker = request.BenchmarkTicker.ToLower();
            if (!tickers.Contains(benchmarkTicker))
            {
                tickers.Add(benchmarkTicker);
            }

            // 3. Fetch historical data
            var marketData = new Dictionary<string, object>();
            
            foreach (var ticker in tickers.Where(t => !string.IsNullOrEmpty(t)))
            {
                var pricePath = await _marketDataProvider.GetHistoryAsync(ticker);
                if (pricePath != null)
                {
                    marketData[ticker] = pricePath.DailyData;
                }
            }

            if (marketData.Count == 0)
            {
                return BadRequest(new { error = "No historical data found for the specified tickers. Please ensure the data pipeline has run." });
            }

            var totalDays = marketData.Values.Cast<EngineTypes.MarketDataPoint[]>().Min(d => d.Length);
            var daysDiff = (request.EndDate - request.StartDate).Days;
            var tradingDaysInPeriod = (int)(daysDiff * 252.0 / 365.0);
            
            var startIndex = 0;
            var endIndex = Math.Min(tradingDaysInPeriod, totalDays - 1);

            // 4. Build F# request
            var historicRequest = new
            {
                Assets = tickers.Where(t => !string.IsNullOrEmpty(t)).ToList(),
                MarketData = marketData.Select(kv => new object[] { kv.Key, kv.Value }).ToArray(),
                StartIndex = startIndex,
                EndIndex = endIndex,
                Granularity = 5,
                RiskFreeRate = 0.04,
                BenchmarkTicker = benchmarkTicker,
                DslCode = strategy.DslScript,
                InitialCash = 100000.0,
                StartDate = request.StartDate,
                ExecutionCosts = executionCosts,
                Tax = taxConfig // <--- Pass Tax Config to F#
            };

            var jsonInput = JsonSerializer.Serialize(historicRequest);
            
            // 5. Call F# engine
            var result = StrategyEngine.DebugInterop.runHistoricBacktest(jsonInput);

            var success = (bool)result["Success"];
            if (!success)
            {
                var error = result["Error"]?.ToString() ?? "Unknown error";
                return BadRequest(new HistoricBacktestResponse(
                    Success: false,
                    Error: error,
                    EquityCurve: null,
                    BenchmarkCurve: null,
                    DrawdownCurve: null,
                    Dates: null,
                    Transactions: null,
                    TotalReturn: 0,
                    BenchmarkReturn: 0,
                    MaxDrawdown: 0,
                    SharpeRatio: 0,
                    Volatility: 0,
                    TotalCommission: 0,
                    TotalSlippage: 0,
                    TotalTax: 0
                ));
            }

            // 6. Extract results
            var resultData = result["Result"];
            var resultJson = JsonSerializer.Serialize(resultData);
            var parsedResult = JsonDocument.Parse(resultJson).RootElement;

            var equityCurve = parsedResult.GetProperty("EquityCurve").EnumerateArray()
                .Select(e => e.GetDouble()).ToArray();
            var benchmarkCurve = parsedResult.GetProperty("BenchmarkCurve").EnumerateArray()
                .Select(e => e.GetDouble()).ToArray();
            var drawdownCurve = parsedResult.GetProperty("DrawdownCurve").EnumerateArray()
                .Select(e => e.GetDouble()).ToArray();

            var dates = Enumerable.Range(0, equityCurve.Length)
                .Select(i => request.StartDate.AddDays(i * 365.0 / 252.0))
                .ToArray();

            var transactions = parsedResult.GetProperty("Transactions").EnumerateArray()
                .Select(t => new HistoricTransactionDto(
                    Day: t.GetProperty("Date").GetInt32(),
                    Date: request.StartDate.AddDays(t.GetProperty("Date").GetInt32() * 365.0 / 252.0),
                    Ticker: t.GetProperty("Ticker").GetString() ?? "",
                    Type: t.GetProperty("Type").GetString() ?? "",
                    Quantity: t.GetProperty("Quantity").GetDouble(),
                    Price: t.GetProperty("Price").GetDouble(),
                    Value: t.GetProperty("Value").GetDouble(),
                    Tag: t.TryGetProperty("Tag", out var tagProp) ? tagProp.GetString() : null,
                    Commission: t.TryGetProperty("Commission", out var commProp) ? commProp.GetDouble() : 0.0,
                    Slippage: t.TryGetProperty("Slippage", out var slipProp) ? slipProp.GetDouble() : 0.0,
                    Tax: t.TryGetProperty("Tax", out var taxProp) ? taxProp.GetDouble() : 0.0
                )).ToArray();

            return Ok(new HistoricBacktestResponse(
                Success: true,
                Error: null,
                EquityCurve: equityCurve,
                BenchmarkCurve: benchmarkCurve,
                DrawdownCurve: drawdownCurve,
                Dates: dates,
                Transactions: transactions,
                TotalReturn: parsedResult.GetProperty("TotalReturn").GetDouble(),
                BenchmarkReturn: parsedResult.GetProperty("BenchmarkReturn").GetDouble(),
                MaxDrawdown: parsedResult.GetProperty("MaxDrawdown").GetDouble(),
                SharpeRatio: parsedResult.GetProperty("SharpeRatio").GetDouble(),
                Volatility: parsedResult.GetProperty("Volatility").GetDouble(),
                TotalCommission: parsedResult.TryGetProperty("TotalCommission", out var tc) ? tc.GetDouble() : 0,
                TotalSlippage: parsedResult.TryGetProperty("TotalSlippage", out var ts) ? ts.GetDouble() : 0,
                TotalTax: parsedResult.TryGetProperty("TotalTax", out var tt) ? tt.GetDouble() : 0
            ));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = $"Historic backtest failed: {ex.Message}" });
        }
    }
}