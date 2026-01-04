using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using StrategyEngine.API.Data.Entities;
using StrategyEngine.API.DTOs;
using StrategyEngine.API.Services;

namespace StrategyEngine.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;
    private readonly UserManager<User> _userManager;
    private readonly JwtService _jwtService;
    private readonly IConfiguration _configuration;

    public AuthController(
        AuthService authService, 
        UserManager<User> userManager, 
        JwtService jwtService,
        IConfiguration configuration)
    {
        _authService = authService;
        _userManager = userManager;
        _jwtService = jwtService;
        _configuration = configuration;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var result = await _authService.RegisterAsync(request);
        if (!result.IsSuccess) return BadRequest(new { error = result.Error });
        return Ok(result.Data);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await _authService.LoginAsync(request);
        if (!result.IsSuccess) return Unauthorized(new { error = result.Error });
        return Ok(result.Data);
    }

    // --- NEW: SSO ENDPOINTS ---

    [HttpGet("google")]
    public IActionResult GoogleLogin()
    {
        var properties = new AuthenticationProperties { RedirectUri = Url.Action("GoogleResponse") };
        return Challenge(properties, GoogleDefaults.AuthenticationScheme);
    }

    [HttpGet("google-response")]
    public async Task<IActionResult> GoogleResponse()
    {
        // 1. Get the login info from the cookie set by the Google Middleware
        var result = await HttpContext.AuthenticateAsync(GoogleDefaults.AuthenticationScheme);
        
        if (!result.Succeeded)
            return BadRequest(new { error = "External authentication error" });

        // 2. Extract User Info
        var claims = result.Principal.Identities.FirstOrDefault()?.Claims;
        var email = claims?.FirstOrDefault(c => c.Type == ClaimTypes.Email)?.Value;
        var name = claims?.FirstOrDefault(c => c.Type == ClaimTypes.Name)?.Value;

        if (string.IsNullOrEmpty(email))
            return BadRequest(new { error = "Email not found from provider" });

        // 3. Find or Create User in DB
        var user = await _userManager.FindByEmailAsync(email);
        if (user == null)
        {
            user = new User
            {
                UserName = email,
                Email = email,
                CreatedAt = DateTime.UtcNow,
                EmailConfirmed = true, // Trusted source
                SubscriptionTier = "Free",
                SubscriptionStatus = "Inactive"
            };
            var createResult = await _userManager.CreateAsync(user);
            if (!createResult.Succeeded)
                return BadRequest(new { error = "Could not create user" });
        }

        // 4. Generate YOUR App's JWT
        var token = _jwtService.GenerateToken(user);

        // 5. Redirect back to Frontend with Token
        var frontendUrl = _configuration["FrontendUrl"];
        return Redirect($"{frontendUrl}/auth/callback?token={token}");
    }
    
    [HttpGet("me")]
    [Authorize] // Requires the JWT we just issued
    public async Task<IActionResult> GetCurrentUser()
    {
        var email = User.FindFirstValue(ClaimTypes.Email);
        var user = await _userManager.FindByEmailAsync(email!);
        
        if (user == null) return NotFound();

        return Ok(new UserDto(
            user.Id, 
            user.Email!, 
            user.UserName!, 
            user.CreatedAt,
            user.SubscriptionTier,
            user.SubscriptionStatus
        ));
    }
}