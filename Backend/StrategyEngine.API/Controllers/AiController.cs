using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using StrategyEngine.API.Data.Entities;
using StrategyEngine.API.DTOs;
using StrategyEngine.API.Services;

namespace StrategyEngine.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AiController : ControllerBase
{
    private readonly AiService _aiService;
    private readonly UserManager<User> _userManager;

    public AiController(AiService aiService, UserManager<User> userManager)
    {
        _aiService = aiService;
        _userManager = userManager;
    }

    [HttpPost("chat/stream")]
    public async Task ChatStream([FromBody] AiChatRequest request, CancellationToken ct)
    {
        Response.Headers.Append("Content-Type", "text/event-stream");

        var user = await _userManager.GetUserAsync(User);
        if (user == null || user.SubscriptionTier == "Free")
        {
            var errorEvent = new AiStreamEvent("error", "AI Chat is a Pro feature. Please upgrade to access Nanci.");
            var errorJson = JsonSerializer.Serialize(errorEvent);
            await Response.WriteAsync($"data: {errorJson}\n\n", ct);
            await Response.Body.FlushAsync(ct);
            return;
        }
        
        try 
        {
            await foreach (var evt in _aiService.StreamChatAsync(request, ct))
            {
                var json = JsonSerializer.Serialize(evt);
                await Response.WriteAsync($"data: {json}\n\n", ct);
                await Response.Body.FlushAsync(ct);
            }
        }
        catch (Exception ex) 
        {
            var err = JsonSerializer.Serialize(new AiStreamEvent("error", ex.Message));
            await Response.WriteAsync($"data: {err}\n\n", ct);
        }
    }
}