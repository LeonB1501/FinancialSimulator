using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StrategyEngine.API.Data.Entities;

public class MarketTicker
{
    [Key]
    [MaxLength(20)]
    public string Ticker { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    [Required]
    [Column(TypeName = "jsonb")]
    public string HistoryJson { get; set; } = "[]";

    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;

    public ICollection<ModelParameter> Parameters { get; set; } = new List<ModelParameter>();
}