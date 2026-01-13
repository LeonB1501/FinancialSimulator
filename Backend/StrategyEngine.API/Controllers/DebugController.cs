using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using StrategyEngine;
using StrategyEngine.API.DTOs; 

namespace StrategyEngine.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DebugController : ControllerBase
{
    [HttpPost("run")]
    public IActionResult RunDebug([FromBody] JsonElement json)
    {
        var jsonString = json.GetRawText();

        var fsharpResult = DebugInterop.runDebugSimulation(jsonString);

        var response = new DebugSimulationResponse(
            (bool)fsharpResult["Success"],
            fsharpResult["Results"],
            (string?)fsharpResult["Error"]
        );

        return Ok(response);
    }
}