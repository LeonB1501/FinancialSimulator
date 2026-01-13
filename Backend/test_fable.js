import { runSimulationWrapper } from './fable_build/Worker.js';

const request = {
  Config: {
    Assets: [
      {
        Ticker: "spy",
        InitialPrice: 100.0,
        Model: ["GeometricBrownianMotion", 0.05, 0.2]
      }
    ],
    Correlations: [], 
    Iterations: 1,
    RiskFreeRate: 0.0,
    Granularity: 1,
    HistoricalData: []
  },
  DslCode: "buy 100 spy",
  InitialCash: 100000.0,
  BaseSeed: 42
};

console.log("--- Sending Request to Fable Engine ---");
const jsonString = JSON.stringify(request);

try {
  const responseJson = runSimulationWrapper(jsonString);

  const response = JSON.parse(responseJson);

  if (response.Success) {
    console.log("✅ SUCCESS!");
    const firstRun = response.Results[0];
    const finalEquity = firstRun.EquityCurve[firstRun.EquityCurve.length - 1];
    console.log(`Initial Cash: $100,000`);
    console.log(`Final Equity: $${finalEquity.toFixed(2)}`);
  } else {
    console.error("❌ FAILURE:", response.Error);
  }
} catch (e) {
  console.error("CRITICAL RUNTIME ERROR:", e);
}