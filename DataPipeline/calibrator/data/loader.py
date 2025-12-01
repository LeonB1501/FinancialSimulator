"""Data loading utilities for OHLCV data."""

from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd

from .types import OHLCVBar, OHLCVData


class DataLoadError(Exception):
    """Raised when data loading fails."""
    pass


class OHLCVLoader:
    """
    Loads OHLCV data from various file formats.

    Supports automatic column detection and various date formats.
    """

    # Common column name variations
    COLUMN_ALIASES = {
        "date": ["date", "datetime", "timestamp", "time", "dt", "index"],
        "open": ["open", "o", "open_price", "opening"],
        "high": ["high", "h", "high_price", "max"],
        "low": ["low", "l", "low_price", "min"],
        "close": ["close", "c", "close_price", "closing", "adj_close", "adjusted_close"],
        "volume": ["volume", "v", "vol", "quantity"],
    }

    def __init__(
            self,
            date_column: Optional[str] = None,
            date_format: Optional[str] = None,
            column_mapping: Optional[dict[str, str]] = None,
    ):
        """
        Initialize loader with optional configuration.

        Args:
            date_column: Name of the date column (auto-detected if None)
            date_format: strptime format for dates (auto-detected if None)
            column_mapping: Custom mapping from standard names to column names
        """
        self.date_column = date_column
        self.date_format = date_format
        self.column_mapping = column_mapping or {}

    def load(self, path: str | Path, ticker: Optional[str] = None) -> OHLCVData:
        """
        Load OHLCV data from a file.

        Args:
            path: Path to the data file (CSV, Parquet, or Excel)
            ticker: Optional ticker symbol (defaults to filename)

        Returns:
            OHLCVData object with the loaded data
        """
        path = Path(path)

        if not path.exists():
            raise DataLoadError(f"File not found: {path}")

        ticker = ticker or path.stem.upper()

        # Load based on file extension
        suffix = path.suffix.lower()
        if suffix == ".csv":
            df = pd.read_csv(path)
        elif suffix == ".parquet":
            df = pd.read_parquet(path)
        elif suffix in (".xlsx", ".xls"):
            df = pd.read_excel(path)
        else:
            raise DataLoadError(f"Unsupported file format: {suffix}")

        return self._process_dataframe(df, ticker)

    def load_from_dataframe(self, df: pd.DataFrame, ticker: str = "UNKNOWN") -> OHLCVData:
        """Load OHLCV data from an existing DataFrame."""
        return self._process_dataframe(df.copy(), ticker)

    def _process_dataframe(self, df: pd.DataFrame, ticker: str) -> OHLCVData:
        """Process a DataFrame into OHLCVData."""
        # Normalize column names
        df.columns = df.columns.str.lower().str.strip()

        # Map columns to standard names
        column_map = self._detect_columns(df)

        # Extract and validate data
        bars = []
        errors = []

        for idx, row in df.iterrows():
            try:
                bar = self._row_to_bar(row, column_map)
                bars.append(bar)
            except (ValueError, KeyError) as e:
                errors.append(f"Row {idx}: {e}")

        if not bars:
            raise DataLoadError(f"No valid bars loaded. Errors: {errors[:5]}")

        if errors:
            # Log warning but continue if we have some data
            n_errors = len(errors)
            if n_errors > 5:
                error_summary = "\n".join(errors[:5]) + f"\n... and {n_errors - 5} more"
            else:
                error_summary = "\n".join(errors)
            print(f"Warning: {n_errors} rows skipped:\n{error_summary}")

        return OHLCVData.from_bars(bars, ticker)

    def _detect_columns(self, df: pd.DataFrame) -> dict[str, str]:
        """Detect which columns correspond to OHLCV fields."""
        column_map = {}
        columns_lower = {c.lower(): c for c in df.columns}

        for field, aliases in self.COLUMN_ALIASES.items():
            # Check custom mapping first
            if field in self.column_mapping:
                custom = self.column_mapping[field].lower()
                if custom in columns_lower:
                    column_map[field] = columns_lower[custom]
                    continue

            # Try aliases
            for alias in aliases:
                if alias in columns_lower:
                    column_map[field] = columns_lower[alias]
                    break

        # Check for date in index
        if "date" not in column_map and isinstance(df.index, pd.DatetimeIndex):
            column_map["date"] = "__index__"

        # Validate required columns
        required = {"date", "open", "high", "low", "close"}
        missing = required - set(column_map.keys())
        if missing:
            available = list(df.columns)
            raise DataLoadError(
                f"Missing required columns: {missing}. "
                f"Available columns: {available}"
            )

        # Volume is optional
        if "volume" not in column_map:
            column_map["volume"] = None

        return column_map

    def _row_to_bar(self, row: pd.Series, column_map: dict[str, str]) -> OHLCVBar:
        """Convert a DataFrame row to an OHLCVBar."""
        # Parse date
        if column_map["date"] == "__index__":
            date_val = row.name
        else:
            date_val = row[column_map["date"]]

        if isinstance(date_val, str):
            if self.date_format:
                parsed_date = datetime.strptime(date_val, self.date_format).date()
            else:
                parsed_date = pd.to_datetime(date_val).date()
        elif isinstance(date_val, (datetime, pd.Timestamp)):
            parsed_date = date_val.date()
        else:
            parsed_date = pd.to_datetime(date_val).date()

        # Extract OHLCV values
        open_price = float(row[column_map["open"]])
        high = float(row[column_map["high"]])
        low = float(row[column_map["low"]])
        close = float(row[column_map["close"]])

        if column_map["volume"] is not None:
            volume = float(row[column_map["volume"]])
        else:
            volume = 0.0

        return OHLCVBar(
            date=parsed_date,
            open=open_price,
            high=high,
            low=low,
            close=close,
            volume=volume,
        )


def load_ohlcv(
        path: str | Path,
        ticker: Optional[str] = None,
        **kwargs
) -> OHLCVData:
    """
    Convenience function to load OHLCV data.

    Args:
        path: Path to data file
        ticker: Optional ticker symbol
        **kwargs: Additional arguments passed to OHLCVLoader

    Returns:
        OHLCVData object
    """
    loader = OHLCVLoader(**kwargs)
    return loader.load(path, ticker)
