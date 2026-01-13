"""Output formatting for calibration results."""

import json
from typing import TextIO
import sys

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from ..data.types import (
    CalibrationResult,
    ParameterEstimate,
    GBMParameters,
    HestonParameters,
    GARCHParameters,
    RegimeSwitchingParameters,
    BlockBootstrapParameters,
)


class ResultFormatter:
    """Formats calibration results for display or export."""

    def __init__(self, console: Console | None = None):
        self.console = console or Console()

    def print_results(self, result: CalibrationResult) -> None:
        """Print formatted results to console."""
        self.console.print()
        self.console.print(Panel(
            f"[bold]Calibration Results for {result.ticker}[/bold]\n"
            f"Observations: {result.n_observations}\n"
            f"Date Range: {result.date_range[0]} to {result.date_range[1]}",
            title="Summary",
        ))

        if result.gbm:
            self._print_gbm(result.gbm)

        if result.heston:
            self._print_heston(result.heston)

        if result.garch:
            self._print_garch(result.garch)

        if result.regime_switching:
            self._print_regime_switching(result.regime_switching)

        if result.block_bootstrap:
            self._print_bootstrap(result.block_bootstrap)

        if result.warnings:
            self.console.print()
            self.console.print("[yellow]Warnings:[/yellow]")
            for warning in result.warnings:
                self.console.print(f"  • {warning}")

    def _format_param(self, param: ParameterEstimate, fmt: str = ".4f") -> str:
        """Format a parameter estimate with CI."""
        value_str = f"{param.value:{fmt}}"
        if param.ci:
            ci_str = f"[{param.ci.lower:{fmt}}, {param.ci.upper:{fmt}}]"
            return f"{value_str} {ci_str}"
        return value_str

    def _format_param_pct(self, param: ParameterEstimate) -> str:
        """Format a parameter as percentage."""
        value_str = f"{param.value:.2%}"
        if param.ci:
            ci_str = f"[{param.ci.lower:.2%}, {param.ci.upper:.2%}]"
            return f"{value_str} {ci_str}"
        return value_str

    def _print_gbm(self, params: GBMParameters) -> None:
        """Print GBM parameters."""
        table = Table(title="Geometric Brownian Motion", show_header=True)
        table.add_column("Parameter", style="cyan")
        table.add_column("Value", style="green")
        table.add_column("95% CI", style="dim")

        table.add_row(
            "μ (drift)",
            f"{params.mu.value:.2%}",
            f"[{params.mu.ci.lower:.2%}, {params.mu.ci.upper:.2%}]" if params.mu.ci else "—",
        )
        table.add_row(
            "σ (volatility)",
            f"{params.sigma.value:.2%}",
            f"[{params.sigma.ci.lower:.2%}, {params.sigma.ci.upper:.2%}]" if params.sigma.ci else "—",
        )

        self.console.print()
        self.console.print(table)

    def _print_heston(self, params: HestonParameters) -> None:
        """Print Heston parameters."""
        table = Table(title="Heston Stochastic Volatility", show_header=True)
        table.add_column("Parameter", style="cyan")
        table.add_column("Value", style="green")
        table.add_column("95% CI", style="dim")

        table.add_row(
            "μ (drift)",
            f"{params.mu.value:.2%}",
            f"[{params.mu.ci.lower:.2%}, {params.mu.ci.upper:.2%}]" if params.mu.ci else "—",
        )
        table.add_row(
            "V₀ (initial var)",
            f"{params.v0.value:.6f}",
            f"[{params.v0.ci.lower:.6f}, {params.v0.ci.upper:.6f}]" if params.v0.ci else "—",
        )
        table.add_row(
            "κ (mean rev.)",
            f"{params.kappa.value:.4f}",
            f"[{params.kappa.ci.lower:.4f}, {params.kappa.ci.upper:.4f}]" if params.kappa.ci else "—",
        )
        table.add_row(
            "θ (long-run var)",
            f"{params.theta.value:.6f}",
            f"[{params.theta.ci.lower:.6f}, {params.theta.ci.upper:.6f}]" if params.theta.ci else "—",
        )
        table.add_row(
            "σᵥ (vol of vol)",
            f"{params.sigma_v.value:.4f}",
            f"[{params.sigma_v.ci.lower:.4f}, {params.sigma_v.ci.upper:.4f}]" if params.sigma_v.ci else "—",
        )
        table.add_row(
            "ρ (correlation)",
            f"{params.rho.value:.4f}",
            f"[{params.rho.ci.lower:.4f}, {params.rho.ci.upper:.4f}]" if params.rho.ci else "—",
        )

        self.console.print()
        self.console.print(table)

    def _print_garch(self, params: GARCHParameters) -> None:
        """Print GARCH parameters."""
        table = Table(title="GARCH(1,1)", show_header=True)
        table.add_column("Parameter", style="cyan")
        table.add_column("Value", style="green")
        table.add_column("95% CI", style="dim")

        table.add_row(
            "μ (mean return)",
            f"{params.mu.value:.2%}",
            f"[{params.mu.ci.lower:.2%}, {params.mu.ci.upper:.2%}]" if params.mu.ci else "—",
        )
        table.add_row(
            "ω (constant)",
            f"{params.omega.value:.2e}",
            f"[{params.omega.ci.lower:.2e}, {params.omega.ci.upper:.2e}]" if params.omega.ci else "—",
        )
        table.add_row(
            "α (ARCH)",
            f"{params.alpha.value:.4f}",
            f"[{params.alpha.ci.lower:.4f}, {params.alpha.ci.upper:.4f}]" if params.alpha.ci else "—",
        )
        table.add_row(
            "β (GARCH)",
            f"{params.beta.value:.4f}",
            f"[{params.beta.ci.lower:.4f}, {params.beta.ci.upper:.4f}]" if params.beta.ci else "—",
        )
        table.add_row(
            "α + β (persistence)",
            f"{params.persistence.value:.4f}",
            f"[{params.persistence.ci.lower:.4f}, {params.persistence.ci.upper:.4f}]" if params.persistence.ci else "—",
        )
        table.add_row(
            "Unconditional σ",
            f"{100 * (params.unconditional_var.value ** 0.5) * (252 ** 0.5):.2f}%",
            "—",
        )

        self.console.print()
        self.console.print(table)

    def _print_regime_switching(self, params: RegimeSwitchingParameters) -> None:
        """Print regime-switching parameters."""
        table = Table(title=f"Regime-Switching ({params.n_regimes} regimes)", show_header=True)
        table.add_column("Regime", style="cyan")
        table.add_column("μ (annual)", style="green")
        table.add_column("σ (annual)", style="green")
        table.add_column("Stationary Prob", style="yellow")

        regime_names = ["Low Vol", "High Vol"] if params.n_regimes == 2 else [f"Regime {i}" for i in
                                                                              range(params.n_regimes)]

        for i, (regime, name) in enumerate(zip(params.regimes, regime_names)):
            table.add_row(
                name,
                f"{regime.mu.value:.2%}",
                f"{regime.sigma.value:.2%}",
                f"{params.stationary_distribution[i]:.1%}",
            )

        self.console.print()
        self.console.print(table)

        # Transition matrix
        trans_table = Table(title="Transition Matrix", show_header=True)
        trans_table.add_column("From \\ To", style="cyan")
        for name in regime_names:
            trans_table.add_column(name, style="green")

        for i, name in enumerate(regime_names):
            row = [name] + [f"{params.transition_matrix[i, j]:.3f}" for j in range(params.n_regimes)]
            trans_table.add_row(*row)

        self.console.print(trans_table)

    def _print_bootstrap(self, params: BlockBootstrapParameters) -> None:
        """Print block bootstrap parameters."""
        table = Table(title="Block Bootstrap", show_header=True)
        table.add_column("Parameter", style="cyan")
        table.add_column("Value", style="green")
        table.add_column("95% CI", style="dim")

        table.add_row(
            "Block Size",
            f"{int(params.block_size.value)}",
            f"[{int(params.block_size.ci.lower)}, {int(params.block_size.ci.upper)}]" if params.block_size.ci else "—",
        )
        table.add_row(
            "Decorrelation Lag",
            f"{int(params.decorrelation_lag.value)}",
            f"[{int(params.decorrelation_lag.ci.lower)}, {int(params.decorrelation_lag.ci.upper)}]" if params.decorrelation_lag.ci else "—",
        )

        self.console.print()
        self.console.print(table)

    def to_json(self, result: CalibrationResult, indent: int = 2) -> str:
        """Convert result to JSON string."""
        return json.dumps(result.to_dict(), indent=indent, default=str)

    def write_json(self, result: CalibrationResult, file: TextIO | str) -> None:
        """Write result to JSON file."""
        if isinstance(file, str):
            with open(file, 'w') as f:
                f.write(self.to_json(result))
        else:
            file.write(self.to_json(result))
