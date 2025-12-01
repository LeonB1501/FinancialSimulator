"""
OHLCV Calibrator - Parameter estimation for stochastic models.

This package provides tools for estimating parameters of various
stochastic models from OHLCV (Open, High, Low, Close, Volume) data:

- Geometric Brownian Motion (GBM)
- Heston Stochastic Volatility
- GARCH(1,1)
- Markov Regime-Switching
- Block Bootstrap

Example usage:

    from calibrator import Calibrator, load_ohlcv

    # Load data
    data = load_ohlcv("path/to/data.csv", ticker="SPY")

    # Calibrate all models
    calibrator = Calibrator()
    result = calibrator.calibrate(data)

    # Access results
    print(f"GBM volatility: {result.gbm.sigma.value:.2%}")
    print(f"GARCH persistence: {result.garch.persistence.value:.4f}")
"""

__version__ = "0.1.0"

from .core import Calibrator, CalibratorConfig
from .data import (
    load_ohlcv,
    OHLCVData,
    OHLCVBar,
    CalibrationResult,
    ModelType,
)
from .output import ResultFormatter

__all__ = [
    "Calibrator",
    "CalibratorConfig",
    "load_ohlcv",
    "OHLCVData",
    "OHLCVBar",
    "CalibrationResult",
    "ModelType",
    "ResultFormatter",
]
