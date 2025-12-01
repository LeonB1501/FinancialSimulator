"""
Heston stochastic volatility model parameter estimator.

Model:
    dS = μS dt + √V S dW₁
    dV = κ(θ - V) dt + σᵥ√V dW₂
    Corr(dW₁, dW₂) = ρ

Parameters:
    μ: Drift rate
    V₀: Initial variance
    κ (kappa): Mean reversion speed of variance
    θ (theta): Long-run variance
    σᵥ (sigma_v): Volatility of volatility
    ρ (rho): Correlation between price and variance innovations

Estimation approach:
    Two-stage method using variance proxy from OHLC data.
    Stage 1: Construct variance proxy using Parkinson estimator
    Stage 2: Regress variance changes on lagged variance to get κ, θ
    Stage 3: Estimate σᵥ from regression residuals
    Stage 4: Estimate ρ from return-variance correlation
"""

import numpy as np
from scipy import stats

from ..data.types import (
    ConfidenceInterval,
    HestonParameters,
    OHLCVData,
    ParameterEstimate,
)
from ..math.volatility import parkinson_variance
from ..math.statistics import linear_regression, correlation, bootstrap_statistic
from .base import BaseEstimator, EstimatorConfig


class HestonEstimator(BaseEstimator[HestonParameters]):
    """
    Two-stage Heston parameter estimator.

    This is an approximate method suitable for OHLCV data.
    For precise calibration, option-implied parameters are preferred.
    """

    def __init__(
            self,
            config: EstimatorConfig | None = None,
            variance_window: int = 1,  # Days for variance proxy (1 = daily Parkinson)
            v0_window: int = 20,  # Lookback for initial variance
    ):
        super().__init__(config)
        self.variance_window = variance_window
        self.v0_window = v0_window

    def estimate(self, data: OHLCVData) -> HestonParameters:
        """Estimate Heston parameters from OHLCV data."""
        self._clear_warnings()

        n = len(data)
        dt = 1.0 / self.config.trading_days_per_year

        if n < 60:
            self._add_warning(
                "Less than 60 observations - Heston estimates may be unreliable"
            )

        # Stage 1: Construct variance proxy using Parkinson
        # Daily variance: σ² = (ln(H/L))² / (4 ln 2)
        log_hl = np.log(data.highs / data.lows)
        var_proxy = (log_hl ** 2) / (4.0 * np.log(2.0))

        # Smooth if requested
        if self.variance_window > 1:
            kernel = np.ones(self.variance_window) / self.variance_window
            var_proxy = np.convolve(var_proxy, kernel, mode='valid')

        # Stage 2: Regress ΔV on V to get κ and θ
        # ΔV[t] = κ(θ - V[t])Δt + noise
        # => ΔV[t] = κθΔt - κΔt × V[t] + noise
        # => ΔV[t] = α + β × V[t] + noise
        # where α = κθΔt, β = -κΔt

        delta_v = np.diff(var_proxy)
        lag_v = var_proxy[:-1]

        if len(delta_v) < 10:
            raise ValueError("Insufficient data for Heston regression")

        alpha, beta, se_alpha, se_beta = linear_regression(lag_v, delta_v)

        # Extract κ and θ
        # β = -κΔt => κ = -β/Δt
        # α = κθΔt => θ = α/(κΔt) = α/(-β) = -α/β

        if beta >= 0:
            self._add_warning(
                "Variance process shows no mean reversion (β ≥ 0). "
                "Heston model may not be appropriate for this data."
            )
            # Use fallback values
            kappa = 1.0  # Moderate mean reversion
            theta = float(np.mean(var_proxy))
        else:
            kappa = -beta / dt
            theta = -alpha / beta

        # Ensure theta is positive
        if theta <= 0:
            self._add_warning("Estimated θ ≤ 0, using sample variance as fallback")
            theta = float(np.mean(var_proxy))

        # Ensure kappa is positive and reasonable
        kappa = max(0.1, min(kappa, 50.0))  # Clamp to reasonable range

        # Stage 3: Estimate σᵥ from regression residuals
        # Residuals ≈ σᵥ√V Δt × ε
        # Var(residuals) ≈ σᵥ² × V̄ × Δt
        predicted = alpha + beta * lag_v
        residuals = delta_v - predicted
        var_residuals = float(np.var(residuals, ddof=2))
        mean_v = float(np.mean(var_proxy))

        if mean_v > 0 and var_residuals > 0:
            sigma_v = np.sqrt(var_residuals / (mean_v * dt))
        else:
            sigma_v = 0.5  # Fallback
            self._add_warning("Could not estimate σᵥ reliably, using fallback value")

        # Stage 4: Estimate ρ from return-variance correlation
        # ρ ≈ Corr(r[t], ΔV[t])
        returns_aligned = data.log_returns[:len(delta_v)]
        rho = correlation(returns_aligned, delta_v)

        # Clamp rho to valid range
        rho = max(-0.99, min(0.99, rho))

        # Stage 5: Initial variance (recent average)
        v0 = float(np.mean(var_proxy[-self.v0_window:]))

        # Stage 6: Drift from returns
        mu = float(np.mean(data.log_returns)) * self.config.trading_days_per_year
        mu += 0.5 * theta  # Adjust for risk-neutral drift approximation

        # Compute standard errors and confidence intervals
        z = stats.norm.ppf(1 - (1 - self.config.confidence_level) / 2)

        # SE for κ and θ (propagated from regression)
        se_kappa = se_beta / dt
        se_theta = abs(theta) * np.sqrt(
            (se_alpha / alpha) ** 2 + (se_beta / beta) ** 2) if alpha != 0 and beta != 0 else np.nan

        # SE for rho (Fisher transformation)
        n_corr = len(returns_aligned)
        se_rho = 1.0 / np.sqrt(n_corr - 3) if n_corr > 3 else np.nan

        # Bootstrap for V0 and sigma_v
        def v0_stat(x):
            return np.mean(x[-min(self.v0_window, len(x)):])

        _, v0_ci_lower, v0_ci_upper = bootstrap_statistic(
            var_proxy, v0_stat,
            n_bootstrap=self.config.n_bootstrap,
            confidence_level=self.config.confidence_level,
        )
        se_v0 = (v0_ci_upper - v0_ci_lower) / (2 * z)

        # SE for mu (same as GBM)
        sigma_approx = np.sqrt(theta)
        se_mu = sigma_approx / np.sqrt(data.n_returns) * self.config.trading_days_per_year

        # Build parameter estimates
        def make_estimate(name: str, value: float, se: float) -> ParameterEstimate:
            if np.isnan(se) or se <= 0:
                return ParameterEstimate(name=name, value=value)
            ci = ConfidenceInterval(
                lower=value - z * se,
                upper=value + z * se,
                confidence_level=self.config.confidence_level,
            )
            return ParameterEstimate(name=name, value=value, std_error=se, ci=ci)

        return HestonParameters(
            mu=make_estimate("mu", mu, se_mu),
            v0=make_estimate("v0", v0, se_v0),
            kappa=make_estimate("kappa", kappa, se_kappa),
            theta=make_estimate("theta", theta, se_theta),
            sigma_v=make_estimate("sigma_v", sigma_v, np.nan),  # Bootstrap would be better
            rho=make_estimate("rho", rho, se_rho),
        )
