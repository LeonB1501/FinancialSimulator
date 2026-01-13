using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StrategyEngine.API.Data.Entities;

public class ModelParameter
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(20)]
    public string Ticker { get; set; } = string.Empty;

    [ForeignKey(nameof(Ticker))]
    public MarketTicker? MarketTicker { get; set; }

    // "Heston", "GARCH", "RegimeSwitching"
    [Required]
    [MaxLength(50)]
    public string ModelType { get; set; } = string.Empty;

    // Stores { Kappa: 2.0, Theta: 0.04 ... }
    [Required]
    [Column(TypeName = "jsonb")]
    public string ParamsJson { get; set; } = "{}";

    public DateTime CalibratedAt { get; set; } = DateTime.UtcNow;
}