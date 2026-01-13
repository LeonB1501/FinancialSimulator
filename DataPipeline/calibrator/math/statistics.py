"""Statistical utilities for parameter estimation."""

from typing import Optional

import numpy as np
from numpy.typing import NDArray
from scipy import stats
from scipy.optimize import minimize, OptimizeResult


def linear_regression(
        x: NDArray[np.float64],
        y: NDArray[np.float64],
) -> tuple[float, float, float, float]:
    """
    Simple linear regression: y = alpha + beta * x + epsilon

    Returns:
        (alpha, beta, se_alpha, se_beta)
    """
    n = len(x)
    if n < 3:
        raise ValueError("Need at least 3 observations for regression")

    x_mean = np.mean(x)
    y_mean = np.mean(y)

    # Compute coefficients
    ss_xx = np.sum((x - x_mean) ** 2)
    ss_xy = np.sum((x - x_mean) * (y - y_mean))

    beta = ss_xy / ss_xx
    alpha = y_mean - beta * x_mean

    # Residuals and standard errors
    y_pred = alpha + beta * x
    residuals = y - y_pred
    mse = np.sum(residuals ** 2) / (n - 2)

    se_beta = np.sqrt(mse / ss_xx)
    se_alpha = np.sqrt(mse * (1.0 / n + x_mean ** 2 / ss_xx))

    return float(alpha), float(beta), float(se_alpha), float(se_beta)


def autocorrelation(
        x: NDArray[np.float64],
        max_lag: Optional[int] = None,
) -> NDArray[np.float64]:
    """
    Compute autocorrelation function.

    Args:
        x: Time series
        max_lag: Maximum lag to compute (default: len(x) // 4)

    Returns:
        Array of autocorrelations from lag 0 to max_lag
    """
    n = len(x)
    if max_lag is None:
        max_lag = min(n // 4, 100)

    x_centered = x - np.mean(x)
    var = np.var(x, ddof=0)

    if var < 1e-10:
        return np.zeros(max_lag + 1)

    acf = np.zeros(max_lag + 1)
    acf[0] = 1.0

    for lag in range(1, max_lag + 1):
        acf[lag] = np.sum(x_centered[:-lag] * x_centered[lag:]) / ((n - lag) * var)

    return acf


def ljung_box_test(
        x: NDArray[np.float64],
        lags: int = 10,
) -> tuple[float, float]:
    """
    Ljung-Box test for autocorrelation.

    Returns:
        (Q statistic, p-value)
    """
    n = len(x)
    acf = autocorrelation(x, lags)

    # Q = n(n+2) * Σ(ρ²_k / (n-k)) for k=1..lags
    q_stat = 0.0
    for k in range(1, lags + 1):
        q_stat += (acf[k] ** 2) / (n - k)
    q_stat *= n * (n + 2)

    p_value = 1.0 - stats.chi2.cdf(q_stat, lags)

    return float(q_stat), float(p_value)


def find_decorrelation_lag(
        x: NDArray[np.float64],
        significance_level: float = 0.05,
        max_lag: int = 100,
) -> int:
    """
    Find the lag at which autocorrelation becomes insignificant.

    Uses Bartlett's formula for significance threshold.

    Returns:
        Lag at which ACF drops below significance threshold
    """
    n = len(x)
    acf = autocorrelation(x, max_lag)

    # Bartlett's threshold (approximate 95% CI)
    threshold = stats.norm.ppf(1 - significance_level / 2) / np.sqrt(n)

    for lag in range(1, max_lag + 1):
        if abs(acf[lag]) < threshold:
            return lag

    return max_lag


def correlation(x: NDArray[np.float64], y: NDArray[np.float64]) -> float:
    """Pearson correlation coefficient."""
    return float(np.corrcoef(x, y)[0, 1])


def hessian_numerical(
        func,
        x: NDArray[np.float64],
        epsilon: float = 1e-5,
) -> NDArray[np.float64]:
    """
    Compute numerical Hessian using central differences.

    Args:
        func: Function to differentiate (scalar output)
        x: Point at which to evaluate Hessian
        epsilon: Step size for finite differences

    Returns:
        Hessian matrix
    """
    n = len(x)
    hessian = np.zeros((n, n))

    f0 = func(x)

    for i in range(n):
        for j in range(i, n):
            x_pp = x.copy()
            x_pm = x.copy()
            x_mp = x.copy()
            x_mm = x.copy()

            x_pp[i] += epsilon
            x_pp[j] += epsilon

            x_pm[i] += epsilon
            x_pm[j] -= epsilon

            x_mp[i] -= epsilon
            x_mp[j] += epsilon

            x_mm[i] -= epsilon
            x_mm[j] -= epsilon

            hessian[i, j] = (func(x_pp) - func(x_pm) - func(x_mp) + func(x_mm)) / (4 * epsilon ** 2)
            hessian[j, i] = hessian[i, j]

    return hessian


def confidence_interval_from_hessian(
        hessian: NDArray[np.float64],
        param_idx: int,
        confidence_level: float = 0.95,
        param_value: float = 0.0,
) -> tuple[float, float, float]:
    """
    Compute confidence interval from inverse Hessian (Fisher information).

    Returns:
        (standard_error, ci_lower, ci_upper)
    """
    try:
        cov_matrix = np.linalg.inv(hessian)
        variance = cov_matrix[param_idx, param_idx]

        if variance < 0:
            # Hessian not positive definite at optimum
            return np.nan, np.nan, np.nan

        std_error = np.sqrt(variance)
    except np.linalg.LinAlgError:
        return np.nan, np.nan, np.nan

    z = stats.norm.ppf(1 - (1 - confidence_level) / 2)
    ci_lower = param_value - z * std_error
    ci_upper = param_value + z * std_error

    return float(std_error), float(ci_lower), float(ci_upper)


def kmeans_1d(
        x: NDArray[np.float64],
        k: int,
        max_iter: int = 100,
        n_init: int = 10,
) -> tuple[NDArray[np.int64], NDArray[np.float64]]:
    """
    1D k-means clustering (optimized for univariate data).

    Args:
        x: Data points
        k: Number of clusters
        max_iter: Maximum iterations per initialization
        n_init: Number of random initializations

    Returns:
        (labels, centroids)
    """
    n = len(x)
    best_labels = None
    best_centroids = None
    best_inertia = np.inf

    for _ in range(n_init):
        # Random initialization using k-means++
        centroids = np.zeros(k)
        centroids[0] = x[np.random.randint(n)]

        for c in range(1, k):
            distances = np.min([np.abs(x - centroids[j]) for j in range(c)], axis=0)
            probs = distances ** 2
            probs /= probs.sum()
            centroids[c] = x[np.random.choice(n, p=probs)]

        # Iterate
        for _ in range(max_iter):
            # Assign labels
            distances = np.abs(x[:, np.newaxis] - centroids)
            labels = np.argmin(distances, axis=1)

            # Update centroids
            new_centroids = np.array([
                x[labels == c].mean() if np.sum(labels == c) > 0 else centroids[c]
                for c in range(k)
            ])

            if np.allclose(centroids, new_centroids):
                break
            centroids = new_centroids

        # Compute inertia
        inertia = sum(
            np.sum((x[labels == c] - centroids[c]) ** 2)
            for c in range(k)
        )

        if inertia < best_inertia:
            best_inertia = inertia
            best_labels = labels
            best_centroids = centroids

    # Sort centroids and relabel
    sort_idx = np.argsort(best_centroids)
    sorted_centroids = best_centroids[sort_idx]
    label_map = {old: new for new, old in enumerate(sort_idx)}
    sorted_labels = np.array([label_map[l] for l in best_labels])

    return sorted_labels, sorted_centroids


def bootstrap_statistic(
        x: NDArray[np.float64],
        statistic_func,
        n_bootstrap: int = 1000,
        confidence_level: float = 0.95,
        block_size: Optional[int] = None,
) -> tuple[float, float, float]:
    """
    Bootstrap confidence interval for a statistic.

    Args:
        x: Data
        statistic_func: Function computing the statistic
        n_bootstrap: Number of bootstrap samples
        confidence_level: Confidence level for interval
        block_size: If provided, use block bootstrap

    Returns:
        (point_estimate, ci_lower, ci_upper)
    """
    n = len(x)
    point_estimate = statistic_func(x)

    bootstrap_values = np.zeros(n_bootstrap)

    for b in range(n_bootstrap):
        if block_size is None:
            # Standard bootstrap
            indices = np.random.randint(0, n, size=n)
        else:
            # Block bootstrap
            n_blocks = (n + block_size - 1) // block_size
            indices = []
            for _ in range(n_blocks):
                start = np.random.randint(0, n - block_size + 1)
                indices.extend(range(start, start + block_size))
            indices = np.array(indices[:n])

        sample = x[indices]
        bootstrap_values[b] = statistic_func(sample)

    alpha = 1 - confidence_level
    ci_lower = np.percentile(bootstrap_values, 100 * alpha / 2)
    ci_upper = np.percentile(bootstrap_values, 100 * (1 - alpha / 2))

    return float(point_estimate), float(ci_lower), float(ci_upper)


def constrained_minimize(
        func,
        x0: NDArray[np.float64],
        bounds: list[tuple[float, float]],
        method: str = "L-BFGS-B",
        **kwargs,
) -> OptimizeResult:
    """
    Minimize a function with bounds constraints.

    Wrapper around scipy.optimize.minimize with sensible defaults.
    """
    return minimize(
        func,
        x0,
        method=method,
        bounds=bounds,
        options={"maxiter": 1000, "disp": False},
        **kwargs,
    )
