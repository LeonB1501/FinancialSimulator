"""Core data types for the calibrator."""

from dataclasses import dataclass, field
from datetime import date
from enum import Enum, auto
from typing import Optional

import numpy as np
from numpy.typing import NDArray


class ModelType(Enum):
    """Supported stochastic model types."""
    GBM = auto()
    HESTON = auto()
    GARCH = auto()
    REGIME_SWITCHING = auto()
    BLOCK_BOOTSTRAP = auto()


@dataclass(frozen=True, slots=True)
class OHLCVBar:
    """Single OHLCV bar."""
    date: date
    open: float
    high: float
    low: float
    close: float
    volume: float

    def __post_init__(self) -> None:
        if self.high < self.low:
            raise ValueError(f"High ({self.high}) cannot be less than Low ({self.low})")
        if self.high < max(self.open, self.close):
            raise ValueError("High must be >= Open and Close")
        if self.low > min(self.open, self.close):
            raise ValueError("Low must be <= Open and Close")
        if self.volume < 0:
            raise ValueError("Volume cannot be negative")


@dataclass(frozen=True, slots=True)
class OHLCVData:
    """Complete OHLCV dataset with computed returns."""
    bars: tuple[OHLCVBar, ...]
    ticker: str

    # Precomputed arrays for efficiency
    opens: NDArray[np.float64] = field(repr=False)
    highs: NDArray[np.float64] = field(repr=False)
    lows: NDArray[np.float64] = field(repr=False)
    closes: NDArray[np.float64] = field(repr=False)
    volumes: NDArray[np.float64] = field(repr=False)
    log_returns: NDArray[np.float64] = field(repr=False)

    @classmethod
    def from_bars(cls, bars: list[OHLCVBar], ticker: str = "UNKNOWN") -> "OHLCVData":
        """Construct OHLCVData from a list of bars."""
        if len(bars) < 2:
            raise ValueError("Need at least 2 bars to compute returns")

        # Sort by date
        sorted_bars = tuple(sorted(bars, key=lambda b: b.date))

        opens = np.array([b.open for b in sorted_bars], dtype=np.float64)
        highs = np.array([b.high for b in sorted_bars], dtype=np.float64)
        lows = np.array([b.low for b in sorted_bars], dtype=np.float64)
        closes = np.array([b.close for b in sorted_bars], dtype=np.float64)
        volumes = np.array([b.volume for b in sorted_bars], dtype=np.float64)

        # Log returns: ln(C[t] / C[t-1])
        log_returns = np.diff(np.log(closes))

        return cls(
            bars=sorted_bars,
            ticker=ticker,
            opens=opens,
            highs=highs,
            lows=lows,
            closes=closes,
            volumes=volumes,
            log_returns=log_returns,
        )

    def __len__(self) -> int:
        return len(self.bars)

    @property
    def n_returns(self) -> int:
        """Number of return observations."""
        return len(self.log_returns)


@dataclass(frozen=True, slots=True)
class ConfidenceInterval:
    """Confidence interval for a parameter estimate."""
    lower: float
    upper: float
    confidence_level: float = 0.95

    @property
    def width(self) -> float:
        return self.upper - self.lower

    def contains(self, value: float) -> bool:
        return self.lower <= value <= self.upper


@dataclass(frozen=True, slots=True)
class ParameterEstimate:
    """Single parameter estimate with uncertainty."""
    name: str
    value: float
    std_error: Optional[float] = None
    ci: Optional[ConfidenceInterval] = None

    def to_dict(self) -> dict:
        result = {"name": self.name, "value": self.value}
        if self.std_error is not None:
            result["std_error"] = self.std_error
        if self.ci is not None:
            result["ci_lower"] = self.ci.lower
            result["ci_upper"] = self.ci.upper
            result["ci_level"] = self.ci.confidence_level
        return result


# Model-specific parameter containers

@dataclass(frozen=True, slots=True)
class GBMParameters:
    """GBM model parameters: dS = μS dt + σS dW"""
    mu: ParameterEstimate  # Drift (annualized)
    sigma: ParameterEstimate  # Volatility (annualized)

    model_type: ModelType = field(default=ModelType.GBM, repr=False)


@dataclass(frozen=True, slots=True)
class HestonParameters:
    """
    Heston stochastic volatility parameters:
    dS = μS dt + √V S dW₁
    dV = κ(θ - V) dt + σᵥ√V dW₂
    Corr(dW₁, dW₂) = ρ
    """
    mu: ParameterEstimate  # Drift
    v0: ParameterEstimate  # Initial variance
    kappa: ParameterEstimate  # Mean reversion speed
    theta: ParameterEstimate  # Long-run variance
    sigma_v: ParameterEstimate  # Vol of vol
    rho: ParameterEstimate  # Correlation

    model_type: ModelType = field(default=ModelType.HESTON, repr=False)


@dataclass(frozen=True, slots=True)
class GARCHParameters:
    """
    GARCH(1,1) parameters:
    r[t] = μ + ε[t], ε[t] ~ N(0, h[t])
    h[t] = ω + α·ε[t-1]² + β·h[t-1]
    """
    mu: ParameterEstimate  # Mean return
    omega: ParameterEstimate  # Constant term
    alpha: ParameterEstimate  # ARCH coefficient
    beta: ParameterEstimate  # GARCH coefficient
    persistence: ParameterEstimate  # α + β
    unconditional_var: ParameterEstimate  # ω / (1 - α - β)

    model_type: ModelType = field(default=ModelType.GARCH, repr=False)


@dataclass(frozen=True, slots=True)
class RegimeParameters:
    """Parameters for a single regime."""
    mu: ParameterEstimate
    sigma: ParameterEstimate


@dataclass(frozen=True, slots=True)
class RegimeSwitchingParameters:
    """
    Markov regime-switching model parameters.
    Each regime has its own (μ, σ).
    Transition matrix P[i,j] = P(S[t+1]=j | S[t]=i)
    """
    regimes: tuple[RegimeParameters, ...]
    transition_matrix: NDArray[np.float64]  # Shape: (n_regimes, n_regimes)
    stationary_distribution: NDArray[np.float64]  # Ergodic probabilities

    model_type: ModelType = field(default=ModelType.REGIME_SWITCHING, repr=False)

    @property
    def n_regimes(self) -> int:
        return len(self.regimes)


@dataclass(frozen=True, slots=True)
class BlockBootstrapParameters:
    """Block bootstrap parameters."""
    block_size: ParameterEstimate
    decorrelation_lag: ParameterEstimate

    model_type: ModelType = field(default=ModelType.BLOCK_BOOTSTRAP, repr=False)


@dataclass
class CalibrationResult:
    """Complete calibration result for all models."""
    ticker: str
    n_observations: int
    date_range: tuple[date, date]

    gbm: Optional[GBMParameters] = None
    heston: Optional[HestonParameters] = None
    garch: Optional[GARCHParameters] = None
    regime_switching: Optional[RegimeSwitchingParameters] = None
    block_bootstrap: Optional[BlockBootstrapParameters] = None

    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        result: dict = {
            "ticker": self.ticker,
            "n_observations": self.n_observations,
            "date_range": {
                "start": self.date_range[0].isoformat(),
                "end": self.date_range[1].isoformat(),
            },
            "models": {},
            "warnings": self.warnings,
        }

        if self.gbm:
            result["models"]["gbm"] = {
                "mu": self.gbm.mu.to_dict(),
                "sigma": self.gbm.sigma.to_dict(),
            }

        if self.heston:
            result["models"]["heston"] = {
                "mu": self.heston.mu.to_dict(),
                "v0": self.heston.v0.to_dict(),
                "kappa": self.heston.kappa.to_dict(),
                "theta": self.heston.theta.to_dict(),
                "sigma_v": self.heston.sigma_v.to_dict(),
                "rho": self.heston.rho.to_dict(),
            }

        if self.garch:
            result["models"]["garch"] = {
                "mu": self.garch.mu.to_dict(),
                "omega": self.garch.omega.to_dict(),
                "alpha": self.garch.alpha.to_dict(),
                "beta": self.garch.beta.to_dict(),
                "persistence": self.garch.persistence.to_dict(),
                "unconditional_var": self.garch.unconditional_var.to_dict(),
            }

        if self.regime_switching:
            rs = self.regime_switching
            result["models"]["regime_switching"] = {
                "n_regimes": rs.n_regimes,
                "regimes": [
                    {"mu": r.mu.to_dict(), "sigma": r.sigma.to_dict()}
                    for r in rs.regimes
                ],
                "transition_matrix": rs.transition_matrix.tolist(),
                "stationary_distribution": rs.stationary_distribution.tolist(),
            }

        if self.block_bootstrap:
            result["models"]["block_bootstrap"] = {
                "block_size": self.block_bootstrap.block_size.to_dict(),
                "decorrelation_lag": self.block_bootstrap.decorrelation_lag.to_dict(),
            }

        return result
