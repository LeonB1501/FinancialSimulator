using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using StrategyEngine; // Namespace where DebugInterop is
using StrategyEngine.API.DTOs; // Add this using directive

namespace StrategyEngine.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DebugController : ControllerBase
{
    [HttpPost("run")]
    public IActionResult RunDebug([FromBody] JsonElement json)
    {
        // 1. Receive the exact JSON the frontend intended for the worker
        var jsonString = json.GetRawText();

        // 2. Pass it to the F# Interop layer
        // This now returns an IDictionary<string, obj>
        var fsharpResult = DebugInterop.runDebugSimulation(jsonString);

        // 3. Map the dictionary to our C# DTO
        var response = new DebugSimulationResponse(
            (bool)fsharpResult["Success"],
            fsharpResult["Results"],
            (string?)fsharpResult["Error"]
        );

        // 4. Return the strongly-typed DTO. The serializer will now work correctly.
        return Ok(response);
    }
}