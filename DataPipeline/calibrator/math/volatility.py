"""
Range-based volatility estimators.

These estimators use OHLC data to estimate volatility more efficiently
than close-to-close estimators.

References:
- Parkinson (1980): "The Extreme Value Method for Estimating the Variance of the Rate of Return"
- Garman & Klass (1980): "On the Estimation of Security Price Volatilities from Historical Data"
- Rogers & Satchell (1991): "Estimating Variance from High, Low and Closing Prices"
- Yang & Zhang (2000): "Drift Independent Volatility Estimation"
"""

from dataclasses import dataclass
from enum import Enum, auto
from typing import Optional

import numpy as np
from numpy.typing import NDArray

from ..data.types import OHLCVData


class VolatilityEstimator(Enum):
    """Available volatility estimation methods."""
    CLOSE_TO_CLOSE = auto()
    PARKINSON = auto()
    GARMAN_KLASS = auto()
    ROGERS_SATCHELL = auto()
    YANG_ZHANG = auto()


@dataclass(frozen=True, slots=True)
class VolatilityEstimate:
    """Result of volatility estimation."""
    daily_variance: float
    annualized_volatility: float
    estimator: VolatilityEstimator
    efficiency_vs_close: float  # Relative efficiency compared to close-to-close

    @property
    def daily_volatility(self) -> float:
        return np.sqrt(self.daily_variance)


def close_to_close_variance(log_returns: NDArray[np.float64]) -> float:
    """
    Standard close-to-close variance estimator.

    σ² = (1/n) × Σ(r[t] - r̄)²
    """
    return float(np.var(log_returns, ddof=1))


def parkinson_variance(highs: NDArray[np.float64], lows: NDArray[np.float64]) -> float:
    """
    Parkinson (1980) range-based variance estimator.

    σ²_P = (1/n) × Σ[ (1/(4×ln(2))) × (ln(H[t]/L[t]))² ]

    Approximately 5× more efficient than close-to-close.
    Assumes continuous trading, no drift, no jumps.
    """
    log_hl = np.log(highs / lows)
    factor = 1.0 / (4.0 * np.log(2.0))
    return float(factor * np.mean(log_hl ** 2))


def garman_klass_variance(
        opens: NDArray[np.float64],
        highs: NDArray[np.float64],
        lows: NDArray[np.float64],
        closes: NDArray[np.float64],
) -> float:
    """
    Garman-Klass (1980) OHLC variance estimator.

    σ²_GK = (1/n) × Σ[ 0.5×(ln(H/L))² - (2ln(2)-1)×(ln(C/O))² ]

    Approximately 8× more efficient than close-to-close.
    Handles opening jumps better than Parkinson.
    """
    log_hl = np.log(highs / lows)
    log_co = np.log(closes / opens)

    term1 = 0.5 * (log_hl ** 2)
    term2 = (2.0 * np.log(2.0) - 1.0) * (log_co ** 2)

    return float(np.mean(term1 - term2))


def rogers_satchell_variance(
        opens: NDArray[np.float64],
        highs: NDArray[np.float64],
        lows: NDArray[np.float64],
        closes: NDArray[np.float64],
) -> float:
    """
    Rogers-Satchell (1991) drift-independent variance estimator.

    σ²_RS = (1/n) × Σ[ ln(H/C)×ln(H/O) + ln(L/C)×ln(L/O) ]

    Works even with strong trends (drift-independent).
    """
    log_hc = np.log(highs / closes)
    log_ho = np.log(highs / opens)
    log_lc = np.log(lows / closes)
    log_lo = np.log(lows / opens)

    return float(np.mean(log_hc * log_ho + log_lc * log_lo))


def yang_zhang_variance(
        opens: NDArray[np.float64],
        highs: NDArray[np.float64],
        lows: NDArray[np.float64],
        closes: NDArray[np.float64],
        prev_closes: Optional[NDArray[np.float64]] = None,
) -> float:
    """
    Yang-Zhang (2000) combined variance estimator.

    σ²_YZ = σ²_overnight + k×σ²_open + (1-k)×σ²_RS

    where:
        σ²_overnight = Var(ln(O[t]/C[t-1]))
        σ²_open = Var(ln(O[t]/O_mean))  -- opening variance
        k = 0.34 / (1.34 + (n+1)/(n-1))

    Combines overnight, opening, and intraday components.
    Most comprehensive estimator for equity markets.
    """
    n = len(opens)

    if prev_closes is None:
        # Use closes shifted by 1 as proxy for previous closes
        prev_closes = np.roll(closes, 1)
        # Exclude first observation where we don't have true previous close
        opens = opens[1:]
        highs = highs[1:]
        lows = lows[1:]
        closes = closes[1:]
        prev_closes = prev_closes[1:]
        n = n - 1

    if n < 2:
        raise ValueError("Need at least 2 observations for Yang-Zhang")

    # Overnight variance: ln(O[t] / C[t-1])
    log_overnight = np.log(opens / prev_closes)
    overnight_mean = np.mean(log_overnight)
    var_overnight = np.sum((log_overnight - overnight_mean) ** 2) / (n - 1)

    # Open-to-close variance: ln(C[t] / O[t])
    log_open_close = np.log(closes / opens)
    open_close_mean = np.mean(log_open_close)
    var_open_close = np.sum((log_open_close - open_close_mean) ** 2) / (n - 1)

    # Rogers-Satchell variance
    var_rs = rogers_satchell_variance(opens, highs, lows, closes)

    # Optimal weighting factor
    k = 0.34 / (1.34 + (n + 1) / (n - 1))

    return float(var_overnight + k * var_open_close + (1 - k) * var_rs)


def estimate_volatility(
        data: OHLCVData,
        method: VolatilityEstimator = VolatilityEstimator.YANG_ZHANG,
        trading_days_per_year: float = 252.0,
) -> VolatilityEstimate:
    """
    Estimate volatility using the specified method.

    Args:
        data: OHLCV data
        method: Estimation method to use
        trading_days_per_year: Annualization factor

    Returns:
        VolatilityEstimate with daily variance and annualized volatility
    """
    efficiency_map = {
        VolatilityEstimator.CLOSE_TO_CLOSE: 1.0,
        VolatilityEstimator.PARKINSON: 5.2,
        VolatilityEstimator.GARMAN_KLASS: 7.4,
        VolatilityEstimator.ROGERS_SATCHELL: 6.0,
        VolatilityEstimator.YANG_ZHANG: 8.0,
    }

    if method == VolatilityEstimator.CLOSE_TO_CLOSE:
        daily_var = close_to_close_variance(data.log_returns)
    elif method == VolatilityEstimator.PARKINSON:
        daily_var = parkinson_variance(data.highs, data.lows)
    elif method == VolatilityEstimator.GARMAN_KLASS:
        daily_var = garman_klass_variance(data.opens, data.highs, data.lows, data.closes)
    elif method == VolatilityEstimator.ROGERS_SATCHELL:
        daily_var = rogers_satchell_variance(data.opens, data.highs, data.lows, data.closes)
    elif method == VolatilityEstimator.YANG_ZHANG:
        daily_var = yang_zhang_variance(data.opens, data.highs, data.lows, data.closes)
    else:
        raise ValueError(f"Unknown estimator: {method}")

    # Ensure non-negative (numerical issues can cause tiny negatives)
    daily_var = max(0.0, daily_var)

    annualized_vol = np.sqrt(daily_var * trading_days_per_year)

    return VolatilityEstimate(
        daily_variance=daily_var,
        annualized_volatility=annualized_vol,
        estimator=method,
        efficiency_vs_close=efficiency_map[method],
    )


def estimate_all_volatilities(
        data: OHLCVData,
        trading_days_per_year: float = 252.0,
) -> dict[VolatilityEstimator, VolatilityEstimate]:
    """
    Compute volatility estimates using all available methods.

    Useful for comparing estimators and detecting anomalies.
    """
    results = {}
    for method in VolatilityEstimator:
        try:
            results[method] = estimate_volatility(data, method, trading_days_per_year)
        except (ValueError, RuntimeWarning):
            continue
    return results
