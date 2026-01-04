using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StrategyEngine.API.Data.Entities;

public class MarketTicker
{
    [Key]
    [MaxLength(20)]
    public string Ticker { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    // Stores the array of { Price, Vol } for the entire history.
    // We use JSONB because fetching 5000 rows individually is slow, 
    // and the Simulation Engine needs the whole array anyway.
    [Required]
    [Column(TypeName = "jsonb")]
    public string HistoryJson { get; set; } = "[]";

    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<ModelParameter> Parameters { get; set; } = new List<ModelParameter>();
}