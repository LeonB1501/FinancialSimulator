using System.ComponentModel.DataAnnotations;

namespace StrategyEngine.API.DTOs;

public record CreateStrategyRequest(
    [Required] string Name,
    [Required] string DslScript,
    [Required] string ConfigJson, // Passed as raw JSON string
    bool IsPublic
);

public record UpdateStrategyRequest(
    string? Name,
    string? DslScript,
    string? ConfigJson,
    bool? IsPublic
);

public record StrategyResponse(
    int Id,
    string Name,
    string DslScript,
    string ConfigJson,
    bool IsPublic,
    DateTime CreatedAt,
    DateTime LastModified,
    string? LatestResultId // <--- ADDED: Link to the most recent simulation run
);