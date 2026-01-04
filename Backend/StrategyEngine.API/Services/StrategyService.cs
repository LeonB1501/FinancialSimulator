using Microsoft.EntityFrameworkCore;
using StrategyEngine.API.Data;
using StrategyEngine.API.Data.Entities;
using StrategyEngine.API.DTOs;
// Import F# Types
using Microsoft.FSharp.Collections; // For F# List conversion if needed

namespace StrategyEngine.API.Services;

public class StrategyService
{
    private readonly AppDbContext _context;

    public StrategyService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Result<StrategyResponse>> CreateStrategyAsync(string userId, CreateStrategyRequest request)
    {
        // --- 1. Enforce Subscription Limits ---
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return Result<StrategyResponse>.Failure("User not found");

        if (user.SubscriptionTier == "Free")
        {
            var currentCount = await _context.Strategies.CountAsync(s => s.UserId == userId);
            if (currentCount >= 5)
            {
                return Result<StrategyResponse>.Failure("Strategy limit reached (Max 5). Upgrade to Pro to create unlimited strategies.");
            }
        }

        // --- 2. Validate DSL Syntax using F# Engine ---
        var dummyTickers = Microsoft.FSharp.Collections.SetModule.OfSeq(new[] { "spy", "qqq", "iwm", "t_bills" }); 
        
        var validationResult = global::SimulationEngine.compileStrategy(request.DslScript, dummyTickers);
        
        if (validationResult.IsError)
        {
            return Result<StrategyResponse>.Failure($"DSL Syntax Error: {validationResult.ErrorValue}");
        }

        // --- 3. Save to DB ---
        var strategy = new Strategy
        {
            UserId = userId,
            Name = request.Name,
            DslScript = request.DslScript,
            ConfigJson = request.ConfigJson,
            IsPublic = request.IsPublic
        };

        _context.Strategies.Add(strategy);
        await _context.SaveChangesAsync();

        return Result<StrategyResponse>.Success(MapToResponse(strategy, null));
    }

    public async Task<Result<List<StrategyResponse>>> GetUserStrategiesAsync(string userId)
    {
        // Efficiently fetch strategies AND their latest result ID in one query
        var query = from s in _context.Strategies
                    where s.UserId == userId
                    let latestResultId = _context.SimulationResults
                        .Where(r => r.StrategyId == s.Id)
                        .OrderByDescending(r => r.CreatedAt)
                        .Select(r => r.Id)
                        .FirstOrDefault()
                    orderby s.LastModified descending
                    select new { Strategy = s, LatestResultId = latestResultId };

        var items = await query.ToListAsync();

        var responses = items
            .Select(i => MapToResponse(i.Strategy, i.LatestResultId))
            .ToList();

        return Result<List<StrategyResponse>>.Success(responses);
    }

    public async Task<Result<StrategyResponse>> GetStrategyAsync(int id, string userId)
    {
        var strategy = await _context.Strategies.FindAsync(id);
        
        if (strategy == null) return Result<StrategyResponse>.Failure("Strategy not found");
        
        if (strategy.UserId != userId && !strategy.IsPublic) 
            return Result<StrategyResponse>.Failure("Access denied");

        // Fetch latest result ID separately for single item
        var latestResultId = await _context.SimulationResults
            .Where(r => r.StrategyId == id)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => r.Id)
            .FirstOrDefaultAsync();

        return Result<StrategyResponse>.Success(MapToResponse(strategy, latestResultId));
    }

    public async Task<Result<bool>> DeleteStrategyAsync(int id, string userId)
    {
        var strategy = await _context.Strategies.FindAsync(id);
        if (strategy == null) return Result<bool>.Failure("Strategy not found");
        if (strategy.UserId != userId) return Result<bool>.Failure("Access denied");

        _context.Strategies.Remove(strategy);
        await _context.SaveChangesAsync();
        return Result<bool>.Success(true);
    }

    private static StrategyResponse MapToResponse(Strategy s, string? latestResultId) => 
        new(s.Id, s.Name, s.DslScript, s.ConfigJson, s.IsPublic, s.CreatedAt, s.LastModified, latestResultId);
}