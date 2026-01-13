import time
import pandas as pd
from fetcher import DataFetcher
from db import Database


def calculate_and_save_correlations(tickers: list[str], db: Database):
    """
    Fetches history for all tickers, aligns dates, computes correlation matrix,
    and saves to DB.
    """
    print(f"🔗 Starting Correlation Analysis for {len(tickers)} assets...")

    fetcher = DataFetcher()
    price_series = {}

    for ticker in tickers:
        try:
            data = fetcher.fetch_ticker(ticker)

            dates = [b.date for b in data.bars]
            series = pd.Series(data.closes, index=pd.to_datetime(dates), name=ticker)
            price_series[ticker] = series

            time.sleep(0.5)
        except Exception as e:
            print(f"   ⚠️ Skipping {ticker} for correlation: {e}")

    if len(price_series) < 2:
        print("   ⚠️ Not enough data to calculate correlations.")
        return

    df = pd.DataFrame(price_series)
    df = df.dropna()

    print(f"   📊 Computing matrix on {len(df)} overlapping data points...")

    returns = df.pct_change().dropna()
    corr_matrix = returns.corr()

    payload = []
    processed_pairs = set()

    for t1 in corr_matrix.columns:
        for t2 in corr_matrix.columns:
            if t1 == t2: continue

            pair = tuple(sorted([t1, t2]))
            if pair in processed_pairs: continue

            val = corr_matrix.loc[t1, t2]

            payload.append({
                "TickerA": t1,
                "TickerB": t2,
                "Value": float(val)
            })
            processed_pairs.add(pair)

    db.save_correlations(payload)


if __name__ == "__main__":
    db_instance = Database()
    target_tickers = ["SPY", "QQQ", "IWM", "DIA", "VIX", "TLT", "GLD"]

    calculate_and_save_correlations(target_tickers, db_instance)