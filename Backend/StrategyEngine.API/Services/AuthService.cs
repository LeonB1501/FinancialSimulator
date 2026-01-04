using Microsoft.AspNetCore.Identity;
using StrategyEngine.API.Data.Entities;
using StrategyEngine.API.DTOs;

namespace StrategyEngine.API.Services;

public class AuthService
{
    private readonly UserManager<User> _userManager;
    private readonly JwtService _jwtService;

    public AuthService(UserManager<User> userManager, JwtService jwtService)
    {
        _userManager = userManager;
        _jwtService = jwtService;
    }

    public async Task<Result<AuthResponse>> RegisterAsync(RegisterRequest request)
    {
        var existingUser = await _userManager.FindByEmailAsync(request.Email);
        if (existingUser != null)
            return Result<AuthResponse>.Failure("Email already in use.");

        var user = new User 
        { 
            UserName = request.Email, 
            Email = request.Email,
            // Explicitly set creation date
            CreatedAt = DateTime.UtcNow,
            SubscriptionTier = "Free",
            SubscriptionStatus = "Inactive"
        };

        var result = await _userManager.CreateAsync(user, request.Password);

        if (!result.Succeeded)
            return Result<AuthResponse>.Failure(string.Join(", ", result.Errors.Select(e => e.Description)));

        var token = _jwtService.GenerateToken(user);
        
        // Map to DTO
        var userDto = new UserDto(
            user.Id, 
            user.Email!, 
            user.UserName!, 
            user.CreatedAt,
            user.SubscriptionTier,
            user.SubscriptionStatus
        );
        
        return Result<AuthResponse>.Success(new AuthResponse(userDto, token, 3600));
    }

    public async Task<Result<AuthResponse>> LoginAsync(LoginRequest request)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user == null)
            return Result<AuthResponse>.Failure("Invalid email or password.");

        var isValidPassword = await _userManager.CheckPasswordAsync(user, request.Password);
        if (!isValidPassword)
            return Result<AuthResponse>.Failure("Invalid email or password.");

        var token = _jwtService.GenerateToken(user);

        // Map to DTO
        var userDto = new UserDto(
            user.Id, 
            user.Email!, 
            user.UserName!, 
            user.CreatedAt,
            user.SubscriptionTier,
            user.SubscriptionStatus
        );

        return Result<AuthResponse>.Success(new AuthResponse(userDto, token, 3600));
    }
}

// Simple Result Helper
public class Result<T>
{
    public bool IsSuccess { get; private set; }
    public T? Data { get; private set; }
    public string? Error { get; private set; }

    public static Result<T> Success(T data) => new() { IsSuccess = true, Data = data };
    public static Result<T> Failure(string error) => new() { IsSuccess = false, Error = error };
}