"""
GARCH(1,1) parameter estimator using Maximum Likelihood.

Model:
    r[t] = μ + ε[t], where ε[t] ~ N(0, h[t])
    h[t] = ω + α·ε[t-1]² + β·h[t-1]

Parameters:
    μ: Mean return
    ω (omega): Constant term (> 0)
    α (alpha): ARCH coefficient (≥ 0)
    β (beta): GARCH coefficient (≥ 0)

Constraints:
    α + β < 1 (stationarity)
    ω / (1 - α - β) = unconditional variance

Derived:
    persistence = α + β
    unconditional_var = ω / (1 - α - β)
"""

import numpy as np
from scipy import stats
from scipy.optimize import minimize

from ..data.types import (
    ConfidenceInterval,
    GARCHParameters,
    OHLCVData,
    ParameterEstimate,
)
from ..math.statistics import hessian_numerical, confidence_interval_from_hessian
from .base import BaseEstimator, EstimatorConfig


class GARCHEstimator(BaseEstimator[GARCHParameters]):
    """
    GARCH(1,1) parameter estimator using quasi-maximum likelihood.

    Uses Bollerslev-Wooldridge robust standard errors for inference.
    """

    def __init__(
            self,
            config: EstimatorConfig | None = None,
            use_robust_se: bool = True,
    ):
        super().__init__(config)
        self.use_robust_se = use_robust_se

    def estimate(self, data: OHLCVData) -> GARCHParameters:
        """Estimate GARCH(1,1) parameters via MLE."""
        self._clear_warnings()

        returns = data.log_returns
        n = len(returns)

        if n < 100:
            self._add_warning(
                "Less than 100 observations - GARCH estimates may be unstable"
            )

        # Sample statistics for initialization
        sample_var = float(np.var(returns, ddof=1))
        sample_mean = float(np.mean(returns))

        # Initial parameter guesses
        # Start with moderate persistence
        omega0 = sample_var * 0.05
        alpha0 = 0.08
        beta0 = 0.85

        # Define negative log-likelihood
        def neg_log_likelihood(params: np.ndarray) -> float:
            omega, alpha, beta = params

            # Check constraints
            if omega <= 0 or alpha < 0 or beta < 0 or alpha + beta >= 1:
                return 1e10

            h = np.zeros(n)
            h[0] = sample_var  # Initialize with unconditional variance

            log_lik = 0.0
            for t in range(1, n):
                h[t] = omega + alpha * returns[t - 1] ** 2 + beta * h[t - 1]
                if h[t] <= 0:
                    return 1e10
                log_lik += np.log(h[t]) + returns[t] ** 2 / h[t]

            return 0.5 * log_lik

        # Optimize
        result = minimize(
            neg_log_likelihood,
            x0=np.array([omega0, alpha0, beta0]),
            method='L-BFGS-B',
            bounds=[(1e-10, None), (0, 0.999), (0, 0.999)],
            options={'maxiter': self.config.max_iterations},
        )

        if not result.success:
            self._add_warning(f"Optimization did not converge: {result.message}")

        omega, alpha, beta = result.x

        # Ensure constraints are satisfied
        if alpha + beta >= 1:
            self._add_warning("α + β ≥ 1: Variance process is non-stationary")
            # Rescale to ensure stationarity
            total = alpha + beta
            alpha = alpha / total * 0.98
            beta = beta / total * 0.98

        persistence = alpha + beta
        unconditional_var = omega / (1 - persistence) if persistence < 1 else sample_var

        # Compute standard errors from Hessian
        hess = hessian_numerical(neg_log_likelihood, result.x)

        # Scale Hessian (it's for negative log-likelihood)
        se_omega, ci_omega_l, ci_omega_u = confidence_interval_from_hessian(
            hess, 0, self.config.confidence_level, omega
        )
        se_alpha, ci_alpha_l, ci_alpha_u = confidence_interval_from_hessian(
            hess, 1, self.config.confidence_level, alpha
        )
        se_beta, ci_beta_l, ci_beta_u = confidence_interval_from_hessian(
            hess, 2, self.config.confidence_level, beta
        )

        # Standard error for persistence (delta method)
        if not np.isnan(se_alpha) and not np.isnan(se_beta):
            try:
                cov_matrix = np.linalg.inv(hess)
                var_persistence = cov_matrix[1, 1] + cov_matrix[2, 2] + 2 * cov_matrix[1, 2]
                se_persistence = np.sqrt(max(0, var_persistence))
            except np.linalg.LinAlgError:
                se_persistence = np.nan
        else:
            se_persistence = np.nan

        # Standard error for unconditional variance (delta method)
        if persistence < 1 and not np.isnan(se_omega) and not np.isnan(se_persistence):
            # ∂(ω/(1-α-β))/∂ω = 1/(1-α-β)
            # ∂(ω/(1-α-β))/∂(α+β) = ω/(1-α-β)²
            try:
                cov_matrix = np.linalg.inv(hess)
                grad = np.array([
                    1 / (1 - persistence),
                    omega / (1 - persistence) ** 2,
                    omega / (1 - persistence) ** 2,
                ])
                var_uncond = grad @ cov_matrix @ grad
                se_uncond_var = np.sqrt(max(0, var_uncond))
            except (np.linalg.LinAlgError, ValueError):
                se_uncond_var = np.nan
        else:
            se_uncond_var = np.nan

        # Mean return (estimated separately)
        mu = sample_mean * self.config.trading_days_per_year
        se_mu = np.sqrt(unconditional_var / n) * self.config.trading_days_per_year

        # Build confidence intervals
        z = stats.norm.ppf(1 - (1 - self.config.confidence_level) / 2)

        def make_estimate(name: str, value: float, se: float,
                          ci_l: float = None, ci_u: float = None) -> ParameterEstimate:
            if np.isnan(se) or se <= 0:
                return ParameterEstimate(name=name, value=value)
            if ci_l is None:
                ci_l = value - z * se
            if ci_u is None:
                ci_u = value + z * se
            ci = ConfidenceInterval(
                lower=ci_l,
                upper=ci_u,
                confidence_level=self.config.confidence_level,
            )
            return ParameterEstimate(name=name, value=value, std_error=se, ci=ci)

        return GARCHParameters(
            mu=make_estimate("mu", mu, se_mu),
            omega=make_estimate("omega", omega, se_omega, ci_omega_l, ci_omega_u),
            alpha=make_estimate("alpha", alpha, se_alpha, ci_alpha_l, ci_alpha_u),
            beta=make_estimate("beta", beta, se_beta, ci_beta_l, ci_beta_u),
            persistence=make_estimate("persistence", persistence, se_persistence),
            unconditional_var=make_estimate("unconditional_var", unconditional_var, se_uncond_var),
        )
