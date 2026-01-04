using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using StrategyEngine.API.Data.Entities;

namespace StrategyEngine.API.Data;

public class AppDbContext : IdentityDbContext<User>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Strategy> Strategies { get; set; }
    public DbSet<MarketTicker> MarketTickers { get; set; }
    public DbSet<ModelParameter> ModelParameters { get; set; }
    
    public DbSet<SimulationResult> SimulationResults { get; set; }

    
    // --- THIS IS THE MISSING LINE ---
    public DbSet<AssetCorrelation> AssetCorrelations { get; set; }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Strategy Config
        builder.Entity<Strategy>(entity =>
        {
            entity.HasIndex(s => s.UserId);
        });

        // Market Data Config
        builder.Entity<ModelParameter>(entity =>
        {
            entity.HasIndex(p => new { p.Ticker, p.ModelType }).IsUnique();
        });

        // Correlation Config
        builder.Entity<AssetCorrelation>(entity =>
        {
            // Ensure unique pair e.g., SPY+QQQ can only exist once
            entity.HasIndex(e => new { e.TickerA, e.TickerB }).IsUnique();
        });
    }
}