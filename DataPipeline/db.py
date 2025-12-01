import json
import datetime
from sqlalchemy import create_engine, text
from calibrator.data import CalibrationResult

# Connection String
DB_URL = "postgresql+psycopg2://admin:password@localhost:5432/strategy_engine"

class Database:
    def __init__(self):
        self.engine = create_engine(DB_URL)

    def save_market_data(self, ticker: str, data_points: list[dict]):
        """
        Saves raw price history to MarketTickers table.
        """
        json_data = json.dumps(data_points)

        # FIX: Changed :history::jsonb to CAST(:history AS jsonb)
        sql = text("""
                   INSERT INTO "MarketTickers" ("Ticker", "FullName", "HistoryJson", "LastUpdated")
                   VALUES (:ticker, :name, CAST(:history AS jsonb), :updated) 
                   ON CONFLICT ("Ticker") 
                   DO UPDATE SET
                       "HistoryJson" = EXCLUDED."HistoryJson",
                       "LastUpdated" = EXCLUDED."LastUpdated";
                   """)

        with self.engine.begin() as conn:
            conn.execute(sql, {
                "ticker": ticker.upper(),
                "name": ticker.upper(),
                "history": json_data,
                "updated": datetime.datetime.utcnow()
            })

    def save_calibration_result(self, result: CalibrationResult):
        """
        Saves calibrated model parameters to ModelParameters table.
        """
        result_dict = result.to_dict()

        with self.engine.begin() as conn:
            for model_type, params in result_dict["models"].items():
                model_name = self._format_model_name(model_type)
                params_json = json.dumps(params)

                # FIX: Changed :params::jsonb to CAST(:params AS jsonb)
                sql = text("""
                           INSERT INTO "ModelParameters" ("Ticker", "ModelType", "ParamsJson", "CalibratedAt")
                           VALUES (:ticker, :model, CAST(:params AS jsonb), :calibrated) 
                           ON CONFLICT ("Ticker", "ModelType")
                           DO UPDATE SET
                               "ParamsJson" = EXCLUDED."ParamsJson",
                               "CalibratedAt" = EXCLUDED."CalibratedAt";
                           """)

                conn.execute(sql, {
                    "ticker": result.ticker.upper(),
                    "model": model_name,
                    "params": params_json,
                    "calibrated": datetime.datetime.utcnow()
                })

        print(f"   💾 Saved parameters for {result.ticker}")

    def _format_model_name(self, key: str) -> str:
        if key == "gbm": return "GeometricBrownianMotion"
        if key == "heston": return "Heston"
        if key == "garch": return "Garch"
        if key == "regime_switching": return "RegimeSwitching"
        if key == "block_bootstrap": return "BlockedBootstrap"
        return key.capitalize()

    def save_correlations(self, correlations: list[dict]):
        """
        Saves pairwise correlations. Expects list of { "TickerA", "TickerB", "Value" }
        """
        if not correlations:
            return

        # Sort Tickers alphabetically to ensure A < B (Unique Constraint)
        # and avoid duplicates like SPY-QQQ vs QQQ-SPY
        cleaned_data = []
        seen = set()

        for item in correlations:
            t1, t2 = sorted([item['TickerA'].upper(), item['TickerB'].upper()])
            if t1 == t2: continue  # No self-correlation

            key = (t1, t2)
            if key in seen: continue

            seen.add(key)
            cleaned_data.append({
                "ticker_a": t1,
                "ticker_b": t2,
                "value": item['Value'],
                "calculated": datetime.datetime.utcnow()
            })

        sql = text("""
                   INSERT INTO "AssetCorrelations" ("TickerA", "TickerB", "Value", "CalculatedAt")
                   VALUES (:ticker_a, :ticker_b, :value, :calculated) ON CONFLICT ("TickerA", "TickerB")
                   DO
                   UPDATE SET
                       "Value" = EXCLUDED."Value",
                       "CalculatedAt" = EXCLUDED."CalculatedAt";
                   """)

        with self.engine.begin() as conn:
            conn.execute(sql, cleaned_data)

        print(f"   🔗 Saved {len(cleaned_data)} correlation pairs")