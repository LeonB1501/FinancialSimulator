/// <reference lib="webworker" />

// Import the Fable-compiled wrapper
// We reuse the same JS file, as it now contains both functions
import { validateStrategyWrapper } from '../../assets/fable_build/Worker.js';

addEventListener('message', ({ data }) => {
  const { id, code, tickers } = data;

  try {
    // 1. Construct the request object expected by F#
    const request = {
      DslCode: code,
      ValidTickers: tickers || []
    };

    // 2. Serialize to JSON
    const jsonInput = JSON.stringify(request);

    // 3. Call the F# function
    const jsonOutput = validateStrategyWrapper(jsonInput);

    // 4. Parse result
    const result = JSON.parse(jsonOutput);

    // 5. Send back
    postMessage({
      id,
      isValid: result.IsValid,
      errors: result.Errors
    });

  } catch (err: any) {
    postMessage({
      id,
      isValid: false,
      errors: [{ line: 1, column: 1, message: `Internal Error: ${err.message}` }]
    });
  }
});