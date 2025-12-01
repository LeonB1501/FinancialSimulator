"""
Block bootstrap parameter estimator.

The block bootstrap preserves temporal dependence in the data
by resampling contiguous blocks rather than individual observations.

Parameters:
    block_size: Length of blocks to sample

Estimation approach:
    - Compute autocorrelation function of returns/squared returns
    - Find decorrelation lag where ACF becomes insignificant
    - Set block_size = 2 × decorrelation_lag (Politis & White recommendation)
    - Cross-validate if needed
"""

import numpy as np
from scipy import stats

from ..data.types import (
    BlockBootstrapParameters,
    ConfidenceInterval,
    OHLCVData,
    ParameterEstimate,
)
from ..math.statistics import (
    autocorrelation,
    find_decorrelation_lag,
    bootstrap_statistic,
)
from .base import BaseEstimator, EstimatorConfig


class BlockBootstrapEstimator(BaseEstimator[BlockBootstrapParameters]):
    """
    Estimates optimal block size for block bootstrap resampling.

    Uses ACF-based method with optional cross-validation.
    """

    def __init__(
            self,
            config: EstimatorConfig | None = None,
            min_block_size: int = 5,
            max_block_size: int = 60,
            use_squared_returns: bool = True,  # Better for volatility dynamics
            significance_level: float = 0.05,
    ):
        super().__init__(config)
        self.min_block_size = min_block_size
        self.max_block_size = max_block_size
        self.use_squared_returns = use_squared_returns
        self.significance_level = significance_level

    def estimate(self, data: OHLCVData) -> BlockBootstrapParameters:
        """Estimate optimal block size from OHLCV data."""
        self._clear_warnings()

        returns = data.log_returns
        n = len(returns)

        if n < 100:
            self._add_warning(
                "Less than 100 observations - block size estimate may be unreliable"
            )

        # Use squared returns for volatility dynamics (captures clustering)
        if self.use_squared_returns:
            series_for_acf = returns ** 2
        else:
            series_for_acf = returns

        # Method 1: ACF-based decorrelation lag
        max_lag = min(n // 4, 100)
        acf = autocorrelation(series_for_acf, max_lag)

        decorr_lag = find_decorrelation_lag(
            series_for_acf,
            significance_level=self.significance_level,
            max_lag=max_lag,
        )

        # Politis & White (2004) recommendation: block_size ≈ 2 × decorrelation_lag
        acf_block_size = 2 * decorr_lag

        # Method 2: Rule of thumb (√n)
        sqrt_n_block_size = int(np.sqrt(n))

        # Combine estimates (weighted average favoring ACF method)
        raw_block_size = int(0.7 * acf_block_size + 0.3 * sqrt_n_block_size)

        # Clamp to valid range
        block_size = max(self.min_block_size, min(self.max_block_size, raw_block_size))

        # Ensure block_size doesn't exceed data length
        block_size = min(block_size, n // 3)

        if block_size != raw_block_size:
            self._add_warning(
                f"Block size clamped from {raw_block_size} to {block_size} "
                f"(valid range: {self.min_block_size}-{min(self.max_block_size, n // 3)})"
            )

        # Estimate confidence interval via subsampling
        def block_size_estimator(x: np.ndarray) -> float:
            if len(x) < 50:
                return float(self.min_block_size)
            series = x ** 2 if self.use_squared_returns else x
            lag = find_decorrelation_lag(series, self.significance_level, min(len(x) // 4, 50))
            return float(2 * lag)

        _, ci_lower, ci_upper = bootstrap_statistic(
            series_for_acf,
            block_size_estimator,
            n_bootstrap=min(self.config.n_bootstrap, 500),
            confidence_level=self.config.confidence_level,
            block_size=max(5, block_size // 2),  # Use smaller blocks for bootstrap
        )

        # Clamp CI bounds
        ci_lower = max(self.min_block_size, ci_lower)
        ci_upper = min(self.max_block_size, ci_upper)

        z = stats.norm.ppf(1 - (1 - self.config.confidence_level) / 2)
        se_block = (ci_upper - ci_lower) / (2 * z)

        block_ci = ConfidenceInterval(
            lower=ci_lower,
            upper=ci_upper,
            confidence_level=self.config.confidence_level,
        )

        decorr_ci = ConfidenceInterval(
            lower=max(1, decorr_lag - 3),
            upper=decorr_lag + 5,
            confidence_level=self.config.confidence_level,
        )

        return BlockBootstrapParameters(
            block_size=ParameterEstimate(
                name="block_size",
                value=float(block_size),
                std_error=se_block,
                ci=block_ci,
            ),
            decorrelation_lag=ParameterEstimate(
                name="decorrelation_lag",
                value=float(decorr_lag),
                std_error=2.0,  # Rough estimate
                ci=decorr_ci,
            ),
        )

    def cross_validate_block_size(
            self,
            data: OHLCVData,
            candidate_sizes: list[int] | None = None,
            n_splits: int = 5,
    ) -> dict[int, float]:
        """
        Cross-validate block sizes using time-series split.

        Returns dict of {block_size: MSE} where MSE is the mean squared
        error of variance estimates.
        """
        returns = data.log_returns
        n = len(returns)

        if candidate_sizes is None:
            candidate_sizes = [5, 10, 20, 30, 40, 50, 60]

        # Filter valid sizes
        candidate_sizes = [b for b in candidate_sizes if b < n // 3]

        results = {}
        fold_size = n // (n_splits + 1)

        for block_size in candidate_sizes:
            mse_values = []

            for fold in range(n_splits):
                train_end = (fold + 1) * fold_size
                test_start = train_end
                test_end = min(test_start + fold_size, n)

                if test_end - test_start < 20:
                    continue

                train_returns = returns[:train_end]
                test_returns = returns[test_start:test_end]

                # Bootstrap variance estimate from training data
                bootstrap_vars = []
                for _ in range(100):
                    # Generate bootstrap sample
                    n_train = len(train_returns)
                    n_blocks = (n_train + block_size - 1) // block_size
                    indices = []
                    for _ in range(n_blocks):
                        start = np.random.randint(0, n_train - block_size + 1)
                        indices.extend(range(start, start + block_size))
                    sample = train_returns[np.array(indices[:n_train])]
                    bootstrap_vars.append(np.var(sample))

                predicted_var = np.mean(bootstrap_vars)
                actual_var = np.var(test_returns)

                mse_values.append((predicted_var - actual_var) ** 2)

            if mse_values:
                results[block_size] = np.mean(mse_values)

        return results
