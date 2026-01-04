using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Stripe;
using Stripe.Checkout;
using StrategyEngine.API.Data;
using StrategyEngine.API.Data.Entities;

namespace StrategyEngine.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly UserManager<User> _userManager;
    private readonly AppDbContext _context;

    public PaymentController(
        IConfiguration config, 
        UserManager<User> userManager,
        AppDbContext context)
    {
        _config = config;
        _userManager = userManager;
        _context = context;
        
        // Initialize Stripe
        StripeConfiguration.ApiKey = _config["Stripe:SecretKey"];
    }

    public record CheckoutRequest(string Interval); // "month" or "year"

    [HttpPost("checkout")]
    [Authorize]
    public async Task<IActionResult> CreateCheckoutSession([FromBody] CheckoutRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await _userManager.FindByIdAsync(userId!);

        if (user == null) return Unauthorized();

        var priceId = request.Interval == "year" 
            ? _config["Stripe:PriceIdYearly"] 
            : _config["Stripe:PriceIdMonthly"];

        var frontendUrl = _config["FrontendUrl"];

        var options = new SessionCreateOptions
        {
            SuccessUrl = $"{frontendUrl}/payment/success",
            CancelUrl = $"{frontendUrl}/upgrade",
            PaymentMethodTypes = new List<string> { "card" },
            Mode = "subscription",
            LineItems = new List<SessionLineItemOptions>
            {
                new SessionLineItemOptions
                {
                    Price = priceId,
                    Quantity = 1,
                },
            },
            // CRITICAL: Pass the User ID so the webhook knows who paid
            ClientReferenceId = user.Id,
            CustomerEmail = user.Email,
            // Allow promotion codes (optional)
            AllowPromotionCodes = true,
            SubscriptionData = new SessionSubscriptionDataOptions
            {
                // 7-day trial
                TrialPeriodDays = 7
            }
        };

        var service = new SessionService();
        Session session = await service.CreateAsync(options);

        return Ok(new { sessionUrl = session.Url });
    }

    [HttpPost("portal")]
    [Authorize]
    public async Task<IActionResult> CreatePortalSession()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await _userManager.FindByIdAsync(userId!);

        if (user == null || string.IsNullOrEmpty(user.StripeCustomerId))
            return BadRequest("No billing account found.");

        var frontendUrl = _config["FrontendUrl"];

        var options = new Stripe.BillingPortal.SessionCreateOptions
        {
            Customer = user.StripeCustomerId,
            ReturnUrl = $"{frontendUrl}/dashboard",
        };

        var service = new Stripe.BillingPortal.SessionService();
        var session = await service.CreateAsync(options);

        return Ok(new { url = session.Url });
    }

    [HttpPost("webhook")]
    [AllowAnonymous] // Stripe calls this, not the user
    public async Task<IActionResult> Webhook()
    {
        var json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();
        var webhookSecret = _config["Stripe:WebhookSecret"];

        try
        {
            var stripeEvent = EventUtility.ConstructEvent(
                json,
                Request.Headers["Stripe-Signature"],
                webhookSecret
            );

            // FIX: Use string literals to avoid namespace/version conflicts
            if (stripeEvent.Type == "checkout.session.completed")
            {
                // Explicitly cast to Stripe.Checkout.Session to avoid ambiguity
                var session = stripeEvent.Data.Object as Stripe.Checkout.Session;
                await HandleCheckoutSuccess(session!);
            }
            else if (stripeEvent.Type == "customer.subscription.deleted")
            {
                var subscription = stripeEvent.Data.Object as Subscription;
                await HandleSubscriptionCancelled(subscription!);
            }

            return Ok();
        }
        catch (StripeException e)
        {
            Console.WriteLine($"Stripe Webhook Error: {e.Message}");
            return BadRequest();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"General Webhook Error: {ex.Message}");
            return StatusCode(500);
        }
    }

    private async Task HandleCheckoutSuccess(Stripe.Checkout.Session session)
    {
        var userId = session.ClientReferenceId;
        var customerId = session.CustomerId;
        
        if (string.IsNullOrEmpty(userId)) return;

        var user = await _userManager.FindByIdAsync(userId);
        if (user != null)
        {
            user.StripeCustomerId = customerId;
            user.SubscriptionTier = "Pro";
            user.SubscriptionStatus = "Active";
            
            await _userManager.UpdateAsync(user);
        }
    }

    private async Task HandleSubscriptionCancelled(Subscription subscription)
    {
        // Find user by Stripe Customer ID
        var user = _context.Users.FirstOrDefault(u => u.StripeCustomerId == subscription.CustomerId);
        
        if (user != null)
        {
            user.SubscriptionStatus = "Canceled";
            user.SubscriptionTier = "Free"; // Downgrade immediately or at period end depending on logic
            
            await _userManager.UpdateAsync(user);
        }
    }
}