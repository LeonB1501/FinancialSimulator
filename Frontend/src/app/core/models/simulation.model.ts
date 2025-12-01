import { Strategy } from './strategy.model';

// ============================================
// SIMULATION STATE
// ============================================

export enum SimulationState {
  Idle = 'idle',
  Preparing = 'preparing',
  Running = 'running',
  Processing = 'processing',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Failed = 'failed',
}

export interface SimulationProgress {
  state: SimulationState;
  completedIterations: number;
  totalIterations: number;
  percentComplete: number;
  elapsedMs: number;
  estimatedRemainingMs: number;
  currentPhase: string;
}

export interface SimulationJob {
  id: string;
  strategyId: string;
  strategy: Strategy;
  progress: SimulationProgress;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

// ============================================
// WASM INTERFACE
// ============================================

export interface WasmSimulationInput {
  mode: string;
  scenario: Record<string, number | string>;
  indices: WasmIndex[];
  correlationMatrix: number[][];
  simulationConfig: {
    iterations: number;
    granularity: string;
    riskFreeRate: number;
    seed?: number;
  };
  dslCode: string;
}

export interface WasmIndex {
  symbol: string;
  model: string;
  parameters: Record<string, number | string>;
}

export interface WasmProgressCallback {
  (completed: number, total: number, phase: string): void;
}

export interface WasmSimulationEngine {
  initialize(): Promise<void>;
  run(input: WasmSimulationInput, onProgress: WasmProgressCallback): Promise<WasmSimulationOutput>;
  cancel(): void;
  isRunning(): boolean;
}

export interface WasmSimulationOutput {
  success: boolean;
  error?: string;
  results?: SimulationRawResults;
}

export interface SimulationRawResults {
  terminalWealth: number[];
  timeToTarget: number[];
  paths: SimulationPath[];
  annualizedReturns: number[];
  maxDrawdowns: number[];
  sharpeRatios: number[];
  sortinoRatios: number[];
}

export interface SimulationPath {
  timestamps: number[];
  values: number[];
  events: PathEvent[];
}

export interface PathEvent {
  timestamp: number;
  type: 'trade' | 'dividend' | 'rebalance' | 'contribution' | 'withdrawal';
  description: string;
  impact: number;
}
