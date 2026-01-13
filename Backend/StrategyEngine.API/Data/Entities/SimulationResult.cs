using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StrategyEngine.API.Data.Entities;

public class SimulationResult
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    public int StrategyId { get; set; }

    [ForeignKey(nameof(StrategyId))]
    public Strategy? Strategy { get; set; }

    public string UserId { get; set; } = string.Empty;

    // Stores the entire 'SimulationResults' object from the frontend
    [Required]
    [Column(TypeName = "jsonb")]
    public string ReportJson { get; set; } = "{}";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Metadata for quick querying without parsing JSON
    public double NetProfit { get; set; }
    public double SharpeRatio { get; set; }
    public double MaxDrawdown { get; set; }
}