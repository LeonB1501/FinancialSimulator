/// <reference lib="webworker" />

import { validateStrategyWrapper } from '../../assets/fable_build/Worker.js';

addEventListener('message', ({ data }) => {
  const { id, code, tickers } = data;

  try {
    const request = {
      DslCode: code,
      ValidTickers: tickers || []
    };

    const jsonInput = JSON.stringify(request);

    const jsonOutput = validateStrategyWrapper(jsonInput);

    const result = JSON.parse(jsonOutput);

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