using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using OpenAI.Chat;
using StrategyEngine.API.DTOs;

namespace StrategyEngine.API.Services;

public class AiService
{
    private readonly ChatClient _client;

    public AiService(IConfiguration config)
    {
        var apiKey = config["AiSettings:OpenAiKey"];
        var model = config["AiSettings:Model"] ?? "gpt-4o";
        _client = new ChatClient(model, apiKey);
    }

    public async IAsyncEnumerable<AiStreamEvent> StreamChatAsync(
        AiChatRequest request, 
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var messages = new List<ChatMessage>();

        // 1. Inject the Master System Prompt (Grammar + Rules)
        messages.Add(new SystemChatMessage(DslDocumentation.SystemPrompt));

        // 2. Inject the Strategy Context (The "Real Time" Data)
        if (request.Context != null)
        {
            var ctx = request.Context;
            
            // Format parameters for readability
            var paramsStr = string.Join(", ", ctx.Parameters.Select(kv => $"{kv.Key}: {kv.Value}"));
            
            var contextMsg = $@"
### CURRENT SIMULATION CONTEXT
- **Goal**: {ctx.Mode} (e.g., Accumulation vs Retirement)
- **Stochastic Model**: {ctx.Model}
- **Available Tickers**: {string.Join(", ", ctx.Indices)}  <-- UPDATED HERE
- **Global Parameters**: {paramsStr}

**CONSTRAINT**: You may ONLY use the tickers listed above. If the user asks for a ticker not in this list, explain that it must be added to the Model Configuration first.
";
            messages.Add(new SystemChatMessage(contextMsg));
        }

        // 3. Inject Current Code (if any)
        if (!string.IsNullOrWhiteSpace(request.CurrentDslCode))
        {
            messages.Add(new SystemChatMessage($"### CURRENT EDITOR CODE:\n{request.CurrentDslCode}"));
        }

        // 4. Inject Chat History
        foreach (var msg in request.History)
        {
            if (msg.Role == "user") messages.Add(new UserChatMessage(msg.Content));
            else messages.Add(new AssistantChatMessage(msg.Content));
        }

        // 5. Add Latest User Message
        messages.Add(new UserChatMessage(request.UserMessage));

        // 6. Define Tools (Code Editor Update)
        var tools = new List<ChatTool>
        {
            ChatTool.CreateFunctionTool(
                "update_editor",
                "Overwrites the DSL editor with new strategy code. Use this whenever the user asks to write, change, or fix code.",
                BinaryData.FromObjectAsJson(new
                {
                    type = "object",
                    properties = new
                    {
                        code = new { type = "string", description = "The complete, valid DSL code." },
                        explanation = new { type = "string", description = "A very brief summary of changes." }
                    },
                    required = new[] { "code" }
                })
            )
        };

        var options = new ChatCompletionOptions { Tools = { tools[0] } };

        // 7. Stream Response
        var accumulator = new StringBuilder(); 
        var isCollectingFunction = false;

        await foreach (var update in _client.CompleteChatStreamingAsync(messages, options, ct))
        {
            // Handle Text Content
            if (update.ContentUpdate.Count > 0)
            {
                foreach (var contentPart in update.ContentUpdate)
                {
                    yield return new AiStreamEvent("token", contentPart.Text);
                }
            }

            // Handle Tool Calls (Accumulate JSON)
            if (update.ToolCallUpdates.Count > 0)
            {
                isCollectingFunction = true;
                foreach (var toolUpdate in update.ToolCallUpdates)
                {
                    if (toolUpdate.FunctionArgumentsUpdate != null)
                    {
                        accumulator.Append(toolUpdate.FunctionArgumentsUpdate);
                    }
                }
            }
        }

        // 8. Execute Tool Call if detected
        if (isCollectingFunction)
        {
            var jsonString = accumulator.ToString();
            AiStreamEvent? resultEvent = null;

            try 
            {
                using var doc = JsonDocument.Parse(jsonString);
                var root = doc.RootElement;
                
                if (root.TryGetProperty("code", out var codeProp))
                {
                    var code = codeProp.GetString();
                    resultEvent = new AiStreamEvent("code_update", code);
                }
            }
            catch 
            {
                resultEvent = new AiStreamEvent("error", "Failed to generate code.");
            }

            if (resultEvent != null)
            {
                yield return resultEvent;
            }
        }
    }
}

// Helper DTO
public record AiStreamEvent(string Type, string? Content);