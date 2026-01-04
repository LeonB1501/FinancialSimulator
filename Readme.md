# Technical Documentation

QuantSim is a platform for Monte Carlo investment strategy testing. It enables users to define trading logic via a custom domain-specific language (DSL) and execute large-scale simulations using various stochastic models.

## 1. Executive Summary

QuantSim is designed to facilitate the analysis of complex investment strategies, including those involving options, leveraged ETFs, and multi-asset portfolios. The system utilizes a hybrid architecture where data calibration occurs on a backend server, while the actual simulation is offloaded to the client browser via WebAssembly. This design decision ensures user data privacy and reduces server-side compute overhead.

## 2. System Architecture

The application is composed of four primary layers:

- **Quantitative Pipeline (Python)**: Fetches historical market data from providers (e.g., Yahoo Finance) and performs Maximum Likelihood Estimation (MLE) to calibrate stochastic model parameters.
- **Backend Management API (.NET 8)**: Manages user authentication (Identity/JWT), persistence of strategy configurations, and serves calibrated market parameters and historical correlation matrices.
- **Simulation Engine (F#)**: A functional engine that implements the DSL interpreter, stochastic path generators, and the portfolio reconciler. It is compiled to JavaScript/WASM using Fable.
- **Frontend Interface (Angular 17)**: A reactive UI that manages the strategy-building wizard, provides an integrated development environment for the DSL using the Monaco Editor, and visualizes results using Chart.js.

## 3. The QuantSim DSL

The platform utilizes a custom, statically typed Domain-Specific Language for defining trading rules.

### 3.1 Formal Grammar (EBNF)
```ebnf
program = { statement } ;

statement = define_statement 
          | set_statement 
          | action_statement 
          | conditional_statement 
          | for_any_position_statement ;

define_statement = "define" identifier "as" definition_value ;
definition_value = position_expression | expression ;

set_statement = "set" identifier "to" expression ;

action_statement = action_verb action_params ;
action_verb = "buy" quantity 
            | "sell" quantity 
            | "buy_max" 
            | "sell_all" 
            | "rebalance_to" percentage ;
action_params = action_target ;
action_target = asset_reference | identifier ;

conditional_stmt = "when" condition ":" { statement } "end" ;

for_any_position_stmt = "for_any_position" identifier "as" identifier ":" { statement } "end" ;

position_expression = position_component { "and" position_component } ;
position_component = ( "buy" | "sell" ) quantity instrument ;
instrument = asset_reference | option_spec ;

expression = additive_expr ;
additive_expr = multiplicative_expr { ( "+" | "-" ) multiplicative_expr } ;
multiplicative_expr = unary_expr { ( "*" | "/" | "%" ) unary_expr } ;
unary_expr = [ "-" ] primary_expr ;
primary_expr = literal 
             | property_access 
             | portfolio_query 
             | indicator 
             | identifier 
             | "(" expression ")" ;

property_access = identifier { "." identifier } ;

condition = logical_or_cond ;
logical_or_cond = logical_and_cond { "or" logical_and_cond } ;
logical_and_cond = primary_cond { "and" primary_cond } ;
primary_cond = [ "not" ] ( comparison | "(" condition ")" ) ;

comparison = expression comparison_op expression ;
comparison_op = ">" | "<" | ">=" | "<=" | "==" | "!=" ;
```

### 3.2 Type System and Scoping

The interpreter enforces static type checking:

- **Num**: Encompasses Floats, Percentages, and Dollars. Automatic promotion occurs during arithmetic.
- **Bool**: Boolean values for conditional logic.
- **Asset**: Immutable references to tickers.
- **Position**: Definitions of multi-leg structures.
- **Instance**: Active holdings within a specific simulation run.

**Scoping Rules:**
- Variables defined within `when` or `for_any_position` blocks are local to those blocks.
- The language uses a stack-based scope resolution, preventing variable leakage across simulation steps.

## 4. Financial Simulation Models

QuantSim implements several stochastic processes to model asset price evolution:

### 4.1 Geometric Brownian Motion (GBM)

The standard model for price paths, assuming constant drift and volatility. It serves as the baseline for simplified equity modeling.

### 4.2 Heston Model

A stochastic volatility model that accounts for the "leverage effect" (negative correlation between returns and volatility). It is defined by:

- **κ (Kappa)**: Speed of mean reversion for variance.
- **θ (Theta)**: Long-run variance.
- **ρ (Rho)**: Correlation between asset price and its variance.

### 4.3 GARCH(1,1)

Generalized Autoregressive Conditional Heteroskedasticity models "volatility clustering," where large price movements tend to be followed by large movements. It is particularly effective for modeling "fat tails" in return distributions.

### 4.4 Markov Regime-Switching

This model transitions between multiple hidden states (e.g., "Bull" and "Bear" markets), each with its own mean return and volatility parameters, governed by a transition probability matrix.

### 4.5 Blocked Bootstrap

A non-parametric method that resamples contiguous blocks of historical data. This preserves temporal dependencies and autocorrelation present in actual market history without assuming a specific mathematical distribution.

## 5. Quantitative Data Pipeline

The Python-based data pipeline ensures that the simulation engine is supplied with realistic parameters.

### 5.1 Calibration

The pipeline uses the `scipy.optimize` suite to perform Maximum Likelihood Estimation (MLE) on historical OHLCV data. This process derives the optimal parameters for the Heston and GARCH models by maximizing the likelihood function of the observed returns.

### 5.2 Volatility Estimation

To provide robust variance inputs, the system implements range-based estimators which are more efficient than standard close-to-close calculations:

- **Yang-Zhang**: Handles both overnight jumps and intraday range.
- **Parkinson**: Utilizes the high-low range to estimate variance.

### 5.3 Correlation Alignment

For multi-asset simulations, the pipeline computes a Pearson correlation matrix. It performs an inner-join on historical dates to ensure only overlapping trading days are considered, ensuring the mathematical integrity of the Cholesky decomposition used during path generation.

## 6. Technical Implementation

### 6.1 Simulation Engine and Reconciler

The engine includes a "Reconciler" module that handles the physical realities of a portfolio:

- **Cash Reconciliation**: If a trade or tax payment requires more cash than is available, the reconciler identifies liquidation candidates based on seniority (e.g., closing soonest-to-expire options first).
- **Margin Modeling**: Implementation of stress-test scenarios to calculate buying power requirements for short positions and complex spreads.

### 6.2 WebAssembly (WASM) and WebWorkers

The F# engine is compiled to JavaScript using Fable. To prevent the simulation from freezing the UI thread during 100,000+ iterations, the engine runs inside a WebWorker. Communication is handled via asynchronous message passing, with progress callbacks updating the UI in real-time.

## 7. Local Development Guide

### 7.1 Prerequisites

- Docker Desktop
- .NET 8 SDK
- Node.js (v18+)
- Python 3.10+

### 7.2 Execution Sequence

1. **Database**: `docker-compose up -d`
2. **Engine Build**: `cd Backend/StrategyEngine && dotnet fable StrategyEngine.Fable.fsproj --outDir ../../Frontend/src/assets/fable_build`
3. **API**: `cd Backend/StrategyEngine.API && dotnet run`
4. **Data**: `cd DataPipeline && python main.py --mode all`
5. **UI**: `cd Frontend && npm install && npm start`

## 8. Deployment and Production

### 8.1 Environment Variables

Production deployments require the configuration of the following secrets:

- `Stripe:SecretKey` and `Stripe:WebhookSecret`
- `AiSettings:OpenAiKey`
- `JwtSettings:SecretKey`
- `ConnectionStrings:DefaultConnection`

### 8.2 Security

- The API enforces CORS policies restricted to the frontend domain.
- JWT tokens are used for stateless authentication.
- Stripe webhooks must be verified using the signature header to prevent spoofing of subscription events.

## 9. License

This project is Proprietary. All rights are reserved by [Your Name]. 
The source code is made available for review and educational purposes 
only. Commercial use, redistribution, or derivation of this work 
is strictly prohibited without prior written consent.