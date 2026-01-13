declare module '*/assets/fable_build/Worker.js' {
  export function runSimulationWrapper(jsonInput: string): string;
  export function validateStrategyWrapper(jsonInput: string): string; // <--- ADD THIS
}