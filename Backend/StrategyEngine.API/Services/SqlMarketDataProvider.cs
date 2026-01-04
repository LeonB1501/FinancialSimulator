using Microsoft.EntityFrameworkCore;
using StrategyEngine.API.Data;
using System.Text.Json;
using StrategyEngine.API.DTOs;

namespace StrategyEngine.API.Services;

public class SqlMarketDataProvider : IMarketDataProvider
{
    private readonly AppDbContext _context;

    public SqlMarketDataProvider(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<string>> GetAvailableTickersAsync()
    {
        return await _context.MarketTickers
            .Select(t => t.Ticker)
            .ToListAsync();
    }

    public async Task<EngineTypes.PricePath?> GetHistoryAsync(string ticker)
    {
        var entity = await _context.MarketTickers
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Ticker.ToUpper() == ticker.ToUpper());

        if (entity == null) return null;

        try 
        {
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var dataPoints = JsonSerializer.Deserialize<EngineTypes.MarketDataPoint[]>(entity.HistoryJson, options);
            
            if (dataPoints == null || dataPoints.Length == 0) return null;

            return new EngineTypes.PricePath(entity.Ticker, dataPoints);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Error] Failed to parse history for {ticker}: {ex.Message}");
            return null;
        }
    }

    public async Task<string?> GetModelParametersAsync(string ticker, string modelType)
    {
        // Map frontend model names to DB model names if necessary
        // DB uses: "Heston", "GARCH", "GeometricBrownianMotion", "RegimeSwitching", "BlockedBootstrap"
        
        var entity = await _context.ModelParameters
            .AsNoTracking()
            .FirstOrDefaultAsync(p => 
                p.Ticker.ToUpper() == ticker.ToUpper() && 
                p.ModelType.ToUpper() == modelType.ToUpper());

        return entity?.ParamsJson;
    }
    
    // Add this implementation
    public async Task<List<CorrelationDto>> GetCorrelationsAsync(string[] tickers)
    {
        // Normalize to uppercase
        var normalized = tickers.Select(t => t.ToUpper()).ToHashSet();

        var correlations = await _context.AssetCorrelations // Cannot resolve symbol 'AssetCorrelations'
            .AsNoTracking()
            .Where(c => normalized.Contains(c.TickerA) && normalized.Contains(c.TickerB))
            .ToListAsync();

        return correlations
            .Select(c => new CorrelationDto(c.TickerA, c.TickerB, c.Value))
            .ToList();
    }
}