import yfinance as yf
import pandas as pd
from calibrator.data import OHLCVData, OHLCVLoader


class DataFetcher:
    def __init__(self):
        self.loader = OHLCVLoader()

    def fetch_ticker(self, ticker_symbol: str, period="10y") -> OHLCVData:
        """
        Downloads data from Yahoo Finance and converts it to OHLCVData.
        """
        print(f"⬇️ Downloading {ticker_symbol}...")

        # 1. Download from Yahoo
        ticker = yf.Ticker(ticker_symbol)
        df = ticker.history(period=period)

        if df.empty:
            raise ValueError(f"No data found for {ticker_symbol}")

        # 2. Clean up DataFrame for the Loader
        # yfinance returns columns like "Open", "High", etc.
        # The loader expects lower case or standard names.
        df.reset_index(inplace=True)

        # Ensure timezone naive dates (Postgres preference usually, but loader handles it)
        if 'Date' in df.columns:
            df['Date'] = pd.to_datetime(df['Date']).dt.date

        # 3. Convert using the library's loader
        # This validates the data structure automatically
        try:
            ohlcv_data = self.loader.load_from_dataframe(df, ticker=ticker_symbol)
            print(f"   ✅ Loaded {len(ohlcv_data)} bars.")
            return ohlcv_data
        except Exception as e:
            print(f"   ❌ Conversion failed: {e}")
            raise e