import { runSimulationWrapper } from './fable_build/Worker.js';

// 1. Create a Mock Request (JSON)
// Thoth.Json expects Discriminated Unions to be arrays: ["CaseName", arg1, arg2...]
const request = {
  Config: {
    Assets: [
      {
        Ticker: "spy",
        InitialPrice: 100.0,
        // CORRECT FORMAT: ["CaseName", Mu, Sigma]
        Model: ["GeometricBrownianMotion", 0.05, 0.2]
      }
    ],
    Correlations: [], // Map in F# is often serialized as array of tuples or object depending on Thoth settings. Auto usually accepts array of tuples for Maps with non-string keys, but for string keys it might accept objects. Let's try empty array first.
    TradingDays: 10,
    Iterations: 1,
    RiskFreeRate: 0.0,
    Granularity: 1,
    HistoricalData: [] // Map as array of entries
  },
  DslCode: "buy 100 spy",
  InitialCash: 100000.0,
  BaseSeed: 42
};

console.log("--- Sending Request to Fable Engine ---");
const jsonString = JSON.stringify(request);

try {
  // 2. Call the F# function (compiled to JS)
  const responseJson = runSimulationWrapper(jsonString);

  // 3. Parse Result
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