using System.Text.Json.Serialization;

namespace StrategyEngine.API.DTOs;

public record AiChatRequest(
    string UserMessage,
    string CurrentDslCode,
    List<AiChatMessage> History,
    StrategyContext? Context
);

public record AiChatMessage(
    string Role, 
    string Content
);

public record StrategyContext(
    string Mode,
    string Model,
    // FIX: Rename Tickers -> Indices to match Frontend JSON
    List<string> Indices, 
    Dictionary<string, object> Parameters 
);

public record AiChatResponse(
    string Message,
    string? NewDslCode,
    bool IsCodeUpdate
);