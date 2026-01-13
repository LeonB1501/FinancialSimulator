using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StrategyEngine.API.Data.Entities;

[Table("AssetCorrelations")]
public class AssetCorrelation
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(20)]
    public string TickerA { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string TickerB { get; set; } = string.Empty;

    public double Value { get; set; }

    public DateTime CalculatedAt { get; set; } = DateTime.UtcNow;
}