using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StrategyEngine.API.Data.Entities;

public class Strategy
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string UserId { get; set; } = string.Empty;

    // Navigation property
    [ForeignKey(nameof(UserId))]
    public User? User { get; set; }

    // The raw DSL code written by the user
    [Required]
    public string DslScript { get; set; } = string.Empty;

    // The Simulation Configuration (Heston params, Correlations, etc.)
    // Stored as a JSON blob in Postgres.
    [Required]
    [Column(TypeName = "jsonb")]
    public string ConfigJson { get; set; } = "{}";

    // Metadata
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastModified { get; set; } = DateTime.UtcNow;
    public bool IsPublic { get; set; } = false; // For future social features
}