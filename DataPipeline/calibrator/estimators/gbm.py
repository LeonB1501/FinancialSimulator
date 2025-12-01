"""
Geometric Brownian Motion parameter estimator.

Model: dS = μS dt + σS dW

Parameters:
    μ (mu): Drift rate (annualized)
    σ (sigma): Volatility (annualized)
"""

import numpy as np
from scipy import stats

from ..data.types import (
    ConfidenceInterval,
    GBMParameters,
    OHLCVData,
    ParameterEstimate,
)
from ..math.volatility import (
    VolatilityEstimator,
    estimate_volatility,
    close_to_close_variance,
)
from .base import BaseEstimator, EstimatorConfig


class GBMEstimator(BaseEstimator[GBMParameters]):
    """
    Estimates GBM parameters using:
    - Yang-Zhang volatility estimator (or configurable alternative)
    - Sample mean of log returns for drift

    Includes proper uncertainty quantification.
    """

    def __init__(
            self,
            config: EstimatorConfig | None = None,
            volatility_method: VolatilityEstimator = VolatilityEstimator.YANG_ZHANG,
    ):
        super().__init__(config)
        self.volatility_method = volatility_method

    def estimate(self, data: OHLCVData) -> GBMParameters:
        """Estimate GBM parameters from OHLCV data."""
        self._clear_warnings()

        n = data.n_returns
        dt = 1.0 / self.config.trading_days_per_year

        # Estimate volatility using range-based estimator
        vol_estimate = estimate_volatility(
            data,
            self.volatility_method,
            self.config.trading_days_per_year,
        )

        sigma_annual = vol_estimate.annualized_volatility
        sigma_daily = vol_estimate.daily_volatility

        # Estimate drift from sample mean of log returns
        # μ = E[r] / dt + 0.5 * σ² (converting from log-return to drift)
        mean_log_return = float(np.mean(data.log_returns))
        mu_annual = mean_log_return * self.config.trading_days_per_year + 0.5 * sigma_annual ** 2

        # Standard errors
        # SE(σ) for range-based estimator (approximate)
        # Using efficiency factor to scale close-to-close SE
        se_sigma_cc = sigma_annual / np.sqrt(2 * n)
        se_sigma = se_sigma_cc / np.sqrt(vol_estimate.efficiency_vs_close)

        # SE(μ) - this is notoriously large
        # SE(mean return) = σ / √n, then annualize
        se_mean_return = sigma_daily / np.sqrt(n)
        se_mu = se_mean_return * self.config.trading_days_per_year

        # Add warning about drift uncertainty
        if se_mu > 0.5 * abs(mu_annual) and abs(mu_annual) > 0.01:
            self._add_warning(
                f"Drift estimate has high uncertainty (SE={se_mu:.2%} vs μ={mu_annual:.2%}). "
                "Consider using forward-looking estimates or risk-free rate instead."
            )

        # Confidence intervals
        z = stats.norm.ppf(1 - (1 - self.config.confidence_level) / 2)

        mu_ci = ConfidenceInterval(
            lower=mu_annual - z * se_mu,
            upper=mu_annual + z * se_mu,
            confidence_level=self.config.confidence_level,
        )

        sigma_ci = ConfidenceInterval(
            lower=max(0, sigma_annual - z * se_sigma),
            upper=sigma_annual + z * se_sigma,
            confidence_level=self.config.confidence_level,
        )

        return GBMParameters(
            mu=ParameterEstimate(
                name="mu",
                value=mu_annual,
                std_error=se_mu,
                ci=mu_ci,
            ),
            sigma=ParameterEstimate(
                name="sigma",
                value=sigma_annual,
                std_error=se_sigma,
                ci=sigma_ci,
            ),
        )
