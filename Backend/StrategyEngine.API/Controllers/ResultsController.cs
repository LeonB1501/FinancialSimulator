using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StrategyEngine.API.Data;
using StrategyEngine.API.Data.Entities;
using System.Text.Json;

namespace StrategyEngine.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ResultsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ResultsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpPost]
    public async Task<IActionResult> SaveResult([FromBody] JsonElement resultPayload)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        
        // 1. Extract basic info safely
        if (!resultPayload.TryGetProperty("strategyId", out var strategyIdProp))
            return BadRequest("Missing strategyId");

        // Assuming strategyId comes as string from frontend, parse to int if your DB uses int
        // Based on previous files, your Strategy.Id is int
        if (!int.TryParse(strategyIdProp.ToString(), out int strategyId))
            return BadRequest("Invalid strategyId format");

        // 2. Validate Ownership
        var strategy = await _context.Strategies.FindAsync(strategyId);
        if (strategy == null) return NotFound("Strategy not found");
        if (strategy.UserId != userId) return Forbid();

        // 3. Extract key metrics for columns (optional but good for sorting)
        double sharpe = 0;
        if (resultPayload.TryGetProperty("riskMetrics", out var risk) && 
            risk.TryGetProperty("sharpeRatio", out var sharpeObj) &&
            sharpeObj.TryGetProperty("median", out var sharpeVal))
        {
            sharpe = sharpeVal.GetDouble();
        }

        // 4. Create Entity
        var resultEntity = new SimulationResult
        {
            StrategyId = strategyId,
            UserId = userId!,
            ReportJson = resultPayload.ToString(), // Save full JSON
            CreatedAt = DateTime.UtcNow,
            SharpeRatio = sharpe
        };

        _context.SimulationResults.Add(resultEntity);
        await _context.SaveChangesAsync();

        return Ok(new { id = resultEntity.Id });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetResult(string id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        
        var result = await _context.SimulationResults
            .FirstOrDefaultAsync(r => r.Id == id);

        if (result == null) return NotFound();
        if (result.UserId != userId) return Forbid();

        // Return raw JSON directly
        return Content(result.ReportJson, "application/json");
    }
    
    [HttpGet("strategy/{strategyId}")]
    public async Task<IActionResult> GetLatestForStrategy(int strategyId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        
        var result = await _context.SimulationResults
            .Where(r => r.StrategyId == strategyId && r.UserId == userId)
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync();

        if (result == null) return NotFound();

        return Content(result.ReportJson, "application/json");
    }
}