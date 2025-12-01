/// <reference lib="webworker" />

// Import the Fable-compiled wrapper
// Note: We point to the assets folder where we compiled the F# code
import { runSimulationWrapper } from '../../assets/fable_build/Worker.js';

addEventListener('message', ({ data }) => {
  const { id, input } = data;

  try {
    console.log(`[Worker] Starting simulation job ${id}...`);
    
    // 1. Serialize the input to JSON (The F# wrapper expects a JSON string)
    const jsonInput = JSON.stringify(input);

    // 2. Call the F# Engine
    // runSimulationWrapper is the function we exposed in Worker.fs
    const jsonOutput = runSimulationWrapper(jsonInput);

    // 3. Parse the result
    const result = JSON.parse(jsonOutput);

    if (result.Success) {
      // Send success back to main thread
      postMessage({
        type: 'success',
        id,
        payload: result.Report // We only send the Report, not RawResults to save memory
      });
    } else {
      // Handle F# Engine errors (e.g. invalid parameters)
      postMessage({
        type: 'error',
        id,
        error: result.Error || 'Unknown F# Engine Error'
      });
    }

  } catch (err: any) {
    // Handle unexpected JS runtime errors
    console.error('[Worker] Critical Error:', err);
    postMessage({
      type: 'error',
      id,
      error: err.message || 'Critical Worker Error'
    });
  }
});