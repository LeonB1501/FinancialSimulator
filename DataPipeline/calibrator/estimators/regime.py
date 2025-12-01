"""
Markov regime-switching model parameter estimator.

Model:
    r[t] | S[t]=i ~ N(μᵢ, σᵢ²)
    P(S[t+1]=j | S[t]=i) = Pᵢⱼ

Parameters per regime:
    μᵢ: Mean return in regime i
    σᵢ: Volatility in regime i

Transition matrix P:
    Pᵢⱼ = probability of transitioning from regime i to regime j

Estimation:
    Expectation-Maximization (EM) algorithm / Baum-Welch
"""

import numpy as np
from scipy import stats

from ..data.types import (
    ConfidenceInterval,
    OHLCVData,
    ParameterEstimate,
    RegimeParameters,
    RegimeSwitchingParameters,
)
from ..math.statistics import kmeans_1d, bootstrap_statistic
from .base import BaseEstimator, EstimatorConfig


class RegimeSwitchingEstimator(BaseEstimator[RegimeSwitchingParameters]):
    """
    Markov regime-switching estimator using EM algorithm.

    Supports 2+ regimes with automatic initialization via k-means.
    """

    def __init__(
            self,
            config: EstimatorConfig | None = None,
            n_regimes: int = 2,
            n_init: int = 10,  # Number of random restarts
            em_tolerance: float = 1e-6,
            em_max_iter: int = 200,
    ):
        super().__init__(config)
        self.n_regimes = n_regimes
        self.n_init = n_init
        self.em_tolerance = em_tolerance
        self.em_max_iter = em_max_iter

    def estimate(self, data: OHLCVData) -> RegimeSwitchingParameters:
        """Estimate regime-switching parameters using EM."""
        self._clear_warnings()

        returns = data.log_returns
        n = len(returns)
        k = self.n_regimes

        if n < 50 * k:
            self._add_warning(
                f"Limited data for {k} regimes ({n} obs). "
                "Consider using fewer regimes."
            )

        # Run EM with multiple initializations
        best_log_lik = -np.inf
        best_result = None

        for init_idx in range(self.n_init):
            try:
                result = self._run_em(returns, seed=init_idx)
                if result['log_likelihood'] > best_log_lik:
                    best_log_lik = result['log_likelihood']
                    best_result = result
            except (ValueError, np.linalg.LinAlgError):
                continue

        if best_result is None:
            raise ValueError("EM algorithm failed to converge in all initializations")

        # Extract results
        means = best_result['means']
        stds = best_result['stds']
        transition = best_result['transition']
        smoothed_probs = best_result['smoothed_probs']

        # Sort regimes by volatility (low to high)
        sort_idx = np.argsort(stds)
        means = means[sort_idx]
        stds = stds[sort_idx]
        transition = transition[sort_idx][:, sort_idx]

        # Compute stationary distribution
        stationary = self._compute_stationary_distribution(transition)

        # Bootstrap for confidence intervals
        z = stats.norm.ppf(1 - (1 - self.config.confidence_level) / 2)

        # Effective sample size per regime
        eff_n = np.sum(smoothed_probs, axis=0)

        regimes = []
        for i in range(k):
            mu_annual = means[i] * self.config.trading_days_per_year
            sigma_annual = stds[i] * np.sqrt(self.config.trading_days_per_year)

            # Standard errors (approximate)
            se_mu = stds[i] / np.sqrt(max(1, eff_n[sort_idx[i]])) * self.config.trading_days_per_year
            se_sigma = stds[i] / np.sqrt(2 * max(1, eff_n[sort_idx[i]])) * np.sqrt(self.config.trading_days_per_year)

            mu_ci = ConfidenceInterval(
                lower=mu_annual - z * se_mu,
                upper=mu_annual + z * se_mu,
                confidence_level=self.config.confidence_level,
            )
            sigma_ci = ConfidenceInterval(
                lower=max(0.001, sigma_annual - z * se_sigma),
                upper=sigma_annual + z * se_sigma,
                confidence_level=self.config.confidence_level,
            )

            regimes.append(RegimeParameters(
                mu=ParameterEstimate(
                    name=f"mu_{i}",
                    value=mu_annual,
                    std_error=se_mu,
                    ci=mu_ci,
                ),
                sigma=ParameterEstimate(
                    name=f"sigma_{i}",
                    value=sigma_annual,
                    std_error=se_sigma,
                    ci=sigma_ci,
                ),
            ))

        return RegimeSwitchingParameters(
            regimes=tuple(regimes),
            transition_matrix=transition,
            stationary_distribution=stationary,
        )

    def _run_em(self, returns: np.ndarray, seed: int = 0) -> dict:
        """Run single EM iteration with given seed."""
        np.random.seed(seed)
        n = len(returns)
        k = self.n_regimes

        # Initialize with k-means
        labels, centroids = kmeans_1d(returns, k)

        means = centroids.copy()
        stds = np.array([
            np.std(returns[labels == i], ddof=1) if np.sum(labels == i) > 1
            else np.std(returns) * 0.5
            for i in range(k)
        ])

        # Ensure positive stds
        stds = np.maximum(stds, 1e-6)

        # Initialize transition matrix (slight diagonal bias)
        transition = np.full((k, k), 1.0 / k)
        for i in range(k):
            transition[i, i] += 0.3
        transition = transition / transition.sum(axis=1, keepdims=True)

        # Initial state probabilities
        pi = np.ones(k) / k

        prev_log_lik = -np.inf

        for iteration in range(self.em_max_iter):
            # E-step: Forward-Backward
            filtered, smoothed, xi, log_lik = self._forward_backward(
                returns, means, stds, transition, pi
            )

            # Check convergence
            if abs(log_lik - prev_log_lik) < self.em_tolerance:
                break
            prev_log_lik = log_lik

            # M-step: Update parameters
            # Update means
            gamma_sum = smoothed.sum(axis=0)
            for i in range(k):
                if gamma_sum[i] > 1e-10:
                    means[i] = np.sum(smoothed[:, i] * returns) / gamma_sum[i]

            # Update stds
            for i in range(k):
                if gamma_sum[i] > 1e-10:
                    variance = np.sum(smoothed[:, i] * (returns - means[i]) ** 2) / gamma_sum[i]
                    stds[i] = np.sqrt(max(variance, 1e-10))

            # Update transition matrix
            for i in range(k):
                xi_sum_i = xi[:, i, :].sum()
                if xi_sum_i > 1e-10:
                    transition[i, :] = xi[:, i, :].sum(axis=0) / xi_sum_i

            # Update initial distribution
            pi = smoothed[0, :]

        return {
            'means': means,
            'stds': stds,
            'transition': transition,
            'smoothed_probs': smoothed,
            'log_likelihood': log_lik,
            'iterations': iteration + 1,
        }

    def _forward_backward(
            self,
            returns: np.ndarray,
            means: np.ndarray,
            stds: np.ndarray,
            transition: np.ndarray,
            pi: np.ndarray,
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, float]:
        """
        Forward-backward algorithm for HMM.

        Uses log-space to prevent underflow.
        """
        n = len(returns)
        k = len(means)

        # Emission probabilities (log-space)
        log_emission = np.zeros((n, k))
        for i in range(k):
            log_emission[:, i] = stats.norm.logpdf(returns, means[i], stds[i])

        # Forward pass (log-space)
        log_alpha = np.zeros((n, k))
        log_alpha[0, :] = np.log(pi + 1e-300) + log_emission[0, :]

        log_transition = np.log(transition + 1e-300)

        for t in range(1, n):
            for j in range(k):
                log_alpha[t, j] = (
                        self._logsumexp(log_alpha[t - 1, :] + log_transition[:, j])
                        + log_emission[t, j]
                )

        # Log-likelihood
        log_lik = self._logsumexp(log_alpha[-1, :])

        # Backward pass (log-space)
        log_beta = np.zeros((n, k))
        log_beta[-1, :] = 0  # log(1) = 0

        for t in range(n - 2, -1, -1):
            for i in range(k):
                log_beta[t, i] = self._logsumexp(
                    log_transition[i, :] + log_emission[t + 1, :] + log_beta[t + 1, :]
                )

        # Smoothed probabilities (gamma)
        log_gamma = log_alpha + log_beta
        log_gamma = log_gamma - self._logsumexp(log_gamma, axis=1, keepdims=True)
        gamma = np.exp(log_gamma)

        # Transition probabilities (xi)
        xi = np.zeros((n - 1, k, k))
        for t in range(n - 1):
            for i in range(k):
                for j in range(k):
                    xi[t, i, j] = np.exp(
                        log_alpha[t, i] + log_transition[i, j] +
                        log_emission[t + 1, j] + log_beta[t + 1, j] - log_lik
                    )

        # Filtered probabilities (alpha normalized)
        log_c = self._logsumexp(log_alpha, axis=1, keepdims=True)
        filtered = np.exp(log_alpha - log_c)

        return filtered, gamma, xi, log_lik

    @staticmethod
    def _logsumexp(x: np.ndarray, axis=None, keepdims=False) -> np.ndarray:
        """Numerically stable log-sum-exp."""
        x_max = np.max(x, axis=axis, keepdims=True)
        result = x_max + np.log(np.sum(np.exp(x - x_max), axis=axis, keepdims=True))
        if not keepdims:
            result = np.squeeze(result, axis=axis)
        return result

    @staticmethod
    def _compute_stationary_distribution(transition: np.ndarray) -> np.ndarray:
        """
        Compute stationary distribution of Markov chain.

        Solves π P = π, sum(π) = 1
        """
        k = transition.shape[0]

        # Solve (P' - I) π = 0 with constraint sum(π) = 1
        A = transition.T - np.eye(k)
        A = np.vstack([A, np.ones(k)])
        b = np.zeros(k + 1)
        b[-1] = 1

        # Least squares solution
        pi, _, _, _ = np.linalg.lstsq(A, b, rcond=None)

        # Ensure non-negative and normalized
        pi = np.maximum(pi, 0)
        pi = pi / pi.sum()

        return pi
