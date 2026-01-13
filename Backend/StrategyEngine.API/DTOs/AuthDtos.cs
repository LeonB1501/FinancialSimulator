using System.ComponentModel.DataAnnotations;

namespace StrategyEngine.API.DTOs;

public record RegisterRequest(
    [Required, EmailAddress] string Email, 
    [Required, MinLength(6)] string Password
);

public record LoginRequest(
    [Required, EmailAddress] string Email, 
    [Required] string Password
);

// NEW: The shape of the user object sent to frontend
public record UserDto(
    string Id,
    string Email,
    string Name,
    DateTime CreatedAt,
    // New Subscription Fields
    string SubscriptionTier,
    string SubscriptionStatus
);

// UPDATED: Now returns UserDto instead of just string Email
public record AuthResponse(
    UserDto User, 
    string Token, 
    int ExpiresInSeconds
);