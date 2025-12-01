import time
import argparse
from fetcher import DataFetcher
from db import Database
from calibrator import Calibrator, CalibratorConfig
from correlations import calculate_and_save_correlations

# Configuration
TICKERS = ["SPY", "QQQ", "IWM", "DIA", "VIX", "TLT", "GLD"]


def run_calibration(fetcher: DataFetcher, db: Database):
    print("--- 🚀 Starting Parameter Calibration ---")

    # Configure Math Engine
    calib_config = CalibratorConfig(
        estimate_gbm=True,
        estimate_heston=True,
        estimate_garch=True,
        estimate_regime_switching=True,
        estimate_bootstrap=True,
        n_regimes=2
    )
    calibrator = Calibrator(calib_config)

    for ticker in TICKERS:
        process_single_ticker(ticker, fetcher, calibrator, db)
        time.sleep(1)  # Be nice to API


def process_single_ticker(ticker, fetcher, calibrator, db):
    try:
        # 1. Fetch
        data = fetcher.fetch_ticker(ticker)

        # 2. Save Raw History
        raw_history = []
        import pandas as pd
        import numpy as np

        series = pd.Series(data.closes)
        returns = series.pct_change()
        # Simple rolling vol for UI visualization
        rolling_vol = returns.rolling(20).std() * np.sqrt(252)
        rolling_vol = rolling_vol.fillna(0.2)

        for i in range(len(data.closes)):
            raw_history.append({
                "Price": round(data.closes[i], 4),
                "Vol": round(rolling_vol.iloc[i], 4)
            })

        db.save_market_data(ticker, raw_history)

        # 3. Calibrate
        print(f"   🧮 Calibrating models for {ticker}...")
        calibration_result = calibrator.calibrate(data)

        # 4. Save Parameters
        db.save_calibration_result(calibration_result)
        print(f"   ✨ Finished {ticker}")

    except Exception as e:
        print(f"   ❌ Error processing {ticker}: {e}")


def run_correlations(db: Database):
    print("--- 🔗 Starting Correlation Analysis ---")
    # This function handles its own fetching to ensure alignment
    calculate_and_save_correlations(TICKERS, db)


if __name__ == "__main__":
    # 1. Parse Arguments
    parser = argparse.ArgumentParser(description="Financial Strategy Engine Data Pipeline")
    parser.add_argument(
        "--mode",
        type=str,
        choices=["all", "calibration", "correlations"],
        default="all",
        help="Which part of the pipeline to run."
    )
    args = parser.parse_args()

    # 2. Init Shared Services
    start_time = time.time()
    db_instance = Database()
    fetcher_instance = DataFetcher()

    # 3. Execution Logic
    if args.mode in ["all", "calibration"]:
        run_calibration(fetcher_instance, db_instance)

    if args.mode in ["all", "correlations"]:
        run_correlations(db_instance)

    print(f"🏁 Pipeline Finished in {round(time.time() - start_time, 2)}s")