"""
Main calibrator that orchestrates all model estimators.
"""

from dataclasses import dataclass, field
from typing import Callable

from .data.types import (
    CalibrationResult,
    OHLCVData,
    ModelType,
)
from .estimators import (
    EstimatorConfig,
    GBMEstimator,
    HestonEstimator,
    GARCHEstimator,
    RegimeSwitchingEstimator,
    BlockBootstrapEstimator,
)


@dataclass
class CalibratorConfig:
    """Configuration for the main calibrator."""

    # Which models to estimate
    estimate_gbm: bool = True
    estimate_heston: bool = True
    estimate_garch: bool = True
    estimate_regime_switching: bool = True
    estimate_bootstrap: bool = True

    # Shared estimator config
    trading_days_per_year: float = 252.0
    confidence_level: float = 0.95
    n_bootstrap: int = 1000

    # Model-specific
    n_regimes: int = 2

    def to_estimator_config(self) -> EstimatorConfig:
        """Convert to EstimatorConfig."""
        return EstimatorConfig(
            trading_days_per_year=self.trading_days_per_year,
            confidence_level=self.confidence_level,
            n_bootstrap=self.n_bootstrap,
            n_regimes=self.n_regimes,
        )


class Calibrator:
    """
    Main calibrator that estimates parameters for all stochastic models.

    Usage:
        calibrator = Calibrator()
        result = calibrator.calibrate(ohlcv_data)
    """

    def __init__(
            self,
            config: CalibratorConfig | None = None,
            progress_callback: Callable[[str], None] | None = None,
    ):
        """
        Initialize calibrator.

        Args:
            config: Calibration configuration
            progress_callback: Optional callback for progress updates
        """
        self.config = config or CalibratorConfig()
        self.progress_callback = progress_callback or (lambda x: None)

        # Initialize estimators
        est_config = self.config.to_estimator_config()

        self._gbm_estimator = GBMEstimator(est_config)
        self._heston_estimator = HestonEstimator(est_config)
        self._garch_estimator = GARCHEstimator(est_config)
        self._regime_estimator = RegimeSwitchingEstimator(
            est_config,
            n_regimes=self.config.n_regimes
        )
        self._bootstrap_estimator = BlockBootstrapEstimator(est_config)

    def calibrate(self, data: OHLCVData) -> CalibrationResult:
        """
        Calibrate all configured models to the data.

        Args:
            data: OHLCV data to calibrate from

        Returns:
            CalibrationResult with all parameter estimates
        """
        warnings = []

        result = CalibrationResult(
            ticker=data.ticker,
            n_observations=len(data),
            date_range=(data.bars[0].date, data.bars[-1].date),
        )

        # GBM
        if self.config.estimate_gbm:
            self.progress_callback("Estimating GBM parameters...")
            try:
                result.gbm = self._gbm_estimator.estimate(data)
                warnings.extend(self._gbm_estimator.warnings)
            except Exception as e:
                warnings.append(f"GBM estimation failed: {e}")

        # Heston
        if self.config.estimate_heston:
            self.progress_callback("Estimating Heston parameters...")
            try:
                result.heston = self._heston_estimator.estimate(data)
                warnings.extend(self._heston_estimator.warnings)
            except Exception as e:
                warnings.append(f"Heston estimation failed: {e}")

        # GARCH
        if self.config.estimate_garch:
            self.progress_callback("Estimating GARCH parameters...")
            try:
                result.garch = self._garch_estimator.estimate(data)
                warnings.extend(self._garch_estimator.warnings)
            except Exception as e:
                warnings.append(f"GARCH estimation failed: {e}")

        # Regime-Switching
        if self.config.estimate_regime_switching:
            self.progress_callback("Estimating regime-switching parameters...")
            try:
                result.regime_switching = self._regime_estimator.estimate(data)
                warnings.extend(self._regime_estimator.warnings)
            except Exception as e:
                warnings.append(f"Regime-switching estimation failed: {e}")

        # Block Bootstrap
        if self.config.estimate_bootstrap:
            self.progress_callback("Estimating block bootstrap parameters...")
            try:
                result.block_bootstrap = self._bootstrap_estimator.estimate(data)
                warnings.extend(self._bootstrap_estimator.warnings)
            except Exception as e:
                warnings.append(f"Block bootstrap estimation failed: {e}")

        result.warnings = warnings
        self.progress_callback("Calibration complete.")

        return result

    def calibrate_single(
            self,
            data: OHLCVData,
            model: ModelType
    ) -> CalibrationResult:
        """
        Calibrate a single model.

        Args:
            data: OHLCV data
            model: Which model to calibrate

        Returns:
            CalibrationResult with only the specified model
        """
        result = CalibrationResult(
            ticker=data.ticker,
            n_observations=len(data),
            date_range=(data.bars[0].date, data.bars[-1].date),
        )

        warnings = []

        try:
            if model == ModelType.GBM:
                result.gbm = self._gbm_estimator.estimate(data)
                warnings.extend(self._gbm_estimator.warnings)
            elif model == ModelType.HESTON:
                result.heston = self._heston_estimator.estimate(data)
                warnings.extend(self._heston_estimator.warnings)
            elif model == ModelType.GARCH:
                result.garch = self._garch_estimator.estimate(data)
                warnings.extend(self._garch_estimator.warnings)
            elif model == ModelType.REGIME_SWITCHING:
                result.regime_switching = self._regime_estimator.estimate(data)
                warnings.extend(self._regime_estimator.warnings)
            elif model == ModelType.BLOCK_BOOTSTRAP:
                result.block_bootstrap = self._bootstrap_estimator.estimate(data)
                warnings.extend(self._bootstrap_estimator.warnings)
        except Exception as e:
            warnings.append(f"{model.name} estimation failed: {e}")

        result.warnings = warnings
        return result
