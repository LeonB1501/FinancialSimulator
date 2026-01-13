/// <reference lib="webworker" />

import { runSimulationWrapper, runSimulationWithProgressWrapper } from '../../assets/fable_build/Worker.js';

addEventListener('message', ({ data }) => {
  const { id, input } = data;

  try {
    console.log(`[Worker] Starting simulation job ${id}...`);

    const jsonInput = JSON.stringify(input);

    const onProgress = (completed: number, total: number): void => {
      postMessage({
        type: 'progress',
        id,
        completed,
        total
      });
    };

    const jsonOutput = runSimulationWithProgressWrapper(jsonInput, onProgress);

    const result = JSON.parse(jsonOutput);

    if (result.Success) {
      postMessage({
        type: 'success',
        id,
        payload: result.Report 
      });
    } else {
      postMessage({
        type: 'error',
        id,
        error: result.Error || 'Unknown F# Engine Error'
      });
    }

  } catch (err: any) {
    console.error('[Worker] Critical Error:', err);
    postMessage({
      type: 'error',
      id,
      error: err.message || 'Critical Worker Error'
    });
  }
});