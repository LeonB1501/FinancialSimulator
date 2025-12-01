"""Base class for parameter estimators."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Generic, TypeVar

from ..data.types import OHLCVData

T = TypeVar("T")  # Parameter type


@dataclass
class EstimatorConfig:
    """Configuration for parameter estimation."""

    # Annualization
    trading_days_per_year: float = 252.0

    # Confidence intervals
    confidence_level: float = 0.95
    n_bootstrap: int = 1000

    # Optimization
    max_iterations: int = 1000
    tolerance: float = 1e-6

    # Model-specific
    n_regimes: int = 2  # For regime-switching


class BaseEstimator(ABC, Generic[T]):
    """
    Abstract base class for parameter estimators.

    Each model has its own estimator that implements this interface.
    """

    def __init__(self, config: EstimatorConfig | None = None):
        self.config = config or EstimatorConfig()
        self._warnings: list[str] = []

    @abstractmethod
    def estimate(self, data: OHLCVData) -> T:
        """
        Estimate model parameters from OHLCV data.

        Args:
            data: OHLCV data to calibrate from

        Returns:
            Model-specific parameter object with uncertainty estimates
        """
        pass

    @property
    def warnings(self) -> list[str]:
        """Get any warnings generated during estimation."""
        return self._warnings.copy()

    def _add_warning(self, message: str) -> None:
        """Add a warning message."""
        self._warnings.append(message)

    def _clear_warnings(self) -> None:
        """Clear all warnings."""
        self._warnings.clear()
