using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
// REMOVED: using SimulationEngine; <--- Caused the error

namespace StrategyEngine.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DslController : ControllerBase
{
    public record ValidateDslRequest(string Code);
    public record DslError(int Line, int Column, string Message);
    public record ValidateDslResponse(bool IsValid, List<DslError> Errors);

    [HttpPost("validate")]
    public IActionResult Validate([FromBody] ValidateDslRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
            return Ok(new ValidateDslResponse(true, new List<DslError>()));

        var dummyTickers = Microsoft.FSharp.Collections.SetModule.OfSeq(new[] { "spy", "qqq", "t_bills", "agg" });

        try
        {
            // Call the F# Engine directly. 
            // If SimulationEngine is global, this works. 
            // If it's inside a namespace in F#, you'd prefix it (e.g. StrategyEngine.SimulationEngine).
            // Based on your files, it's top-level.
            var result = SimulationEngine.compileStrategy(request.Code, dummyTickers);

            if (result.IsError)
            {
                var errorMsg = result.ErrorValue;
                // Map generic errors to line 1 for now since F# MVP lexer returns strings
                return Ok(new ValidateDslResponse(false, new List<DslError>
                {
                    new DslError(1, 1, errorMsg) 
                }));
            }

            return Ok(new ValidateDslResponse(true, new List<DslError>()));
        }
        catch (Exception ex)
        {
            return Ok(new ValidateDslResponse(false, new List<DslError>
            {
                new DslError(1, 1, $"System Error: {ex.Message}")
            }));
        }
    }
}