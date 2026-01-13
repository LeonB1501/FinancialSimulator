using Microsoft.AspNetCore.Identity;

namespace StrategyEngine.API.Data.Entities;

public class User : IdentityUser
{
    // Initialize with UtcNow so existing rows (if any) get a valid date during migration
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow; 
    
    // --- Subscription Fields ---
    
    // "Free" or "Pro"
    public string SubscriptionTier { get; set; } = "Free";
    
    // "Inactive", "Active", "PastDue", "Canceled"
    public string SubscriptionStatus { get; set; } = "Inactive";
    
    // Link to Stripe
    public string? StripeCustomerId { get; set; }
    
    // When the current period ends (for grace periods)
    public DateTime? SubscriptionEndsAt { get; set; }

    public ICollection<Strategy> Strategies { get; set; } = new List<Strategy>();
}