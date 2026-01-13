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
        print(f"Downloading {ticker_symbol}...")

        ticker = yf.Ticker(ticker_symbol)
        df = ticker.history(period=period)

        if df.empty:
            raise ValueError(f"No data found for {ticker_symbol}")

        df.reset_index(inplace=True)

        if 'Date' in df.columns:
            df['Date'] = pd.to_datetime(df['Date']).dt.date

        try:
            ohlcv_data = self.loader.load_from_dataframe(df, ticker=ticker_symbol)
            print(f"Loaded {len(ohlcv_data)} bars.")
            return ohlcv_data
        except Exception as e:
            print(f"Conversion failed: {e}")
            raise e