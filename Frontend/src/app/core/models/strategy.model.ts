// ============================================
// ENUMS
// ============================================

export enum SimulationMode {
  Accumulation = 'accumulation',
  Retirement = 'retirement',
}

export enum StochasticModel {
  Heston = 'heston',
  GBM = 'gbm',
  GARCH = 'garch',
  BlockedBootstrap = 'blocked_bootstrap',
  RegimeSwitching = 'regime_switching',
}

export enum Granularity {
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
}

export enum StrategyStatus {
  Draft = 'draft',
  Ready = 'ready',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
}

// ============================================
// MODEL PARAMETERS
// ============================================

export interface HestonParameters {
  kappa: number;    // Mean reversion speed
  theta: number;    // Long-term variance
  sigma: number;    // Vol of vol
  rho: number;      // Correlation
  v0: number;       // Initial variance
  s0: number;       // Initial price
  mu: number;       // Drift (Expected Return)
  epsilon: number;  // Minimum variance floor
}

export interface GBMParameters {
  mu: number;       // Drift
  sigma: number;    // Volatility
  s0: number;       // Initial price
}

export interface GARCHParameters {
  omega: number;    // Constant
  alpha: number;    // ARCH coefficient
  beta: number;     // GARCH coefficient
  mu: number;       // Drift
  initialVol: number; // Starting volatility
  s0: number;       // Initial price
}

export interface BlockedBootstrapParameters {
  blockSize: number;
  historicalDataStart: string;
  historicalDataEnd: string;
}

export interface RegimeSwitchingParameters {
  regimes: RegimeParameters[];
  transitionMatrix: number[][];
}

export interface RegimeParameters {
  name: string;
  mu: number;
  sigma: number;
  probability: number;
}

export type ModelParameters = 
  | HestonParameters 
  | GBMParameters 
  | GARCHParameters 
  | BlockedBootstrapParameters 
  | RegimeSwitchingParameters;

// ============================================
// INDEX & CORRELATION
// ============================================

export interface Index {
  symbol: string;
  name: string;
  model: StochasticModel;
  parameters: ModelParameters;
}

export interface CorrelationMatrix {
  indices: string[];
  matrix: number[][];
}

// ============================================
// CUSTOM TICKER
// ============================================

export interface CustomTicker {
  id: string;
  symbol: string;
  name: string;
  model: StochasticModel;
  parameters: ModelParameters;
  createdAt: Date;
}

// ============================================
// SIMULATION PARAMETERS
// ============================================

export interface AccumulationScenario {
  initialLumpSum: number;
  monthlyContribution: number;
  targetWealth: number;
  timelineYears: number;
}

export interface RetirementScenario {
  initialPortfolio: number;
  monthlyWithdrawal: number;
  inflationRate: number;
  timelineYears: number;
}

export type Scenario = AccumulationScenario | RetirementScenario;

export interface SimulationConfig {
  iterations: number;
  granularity: Granularity;
  riskFreeRate: number;
  seed?: number;
}

// ============================================
// DSL
// ============================================

export interface DslCode {
  code: string;
  isValid: boolean;
  errors: DslError[];
  warnings: DslWarning[];
}

export interface DslError {
  line: number;
  column: number;
  message: string;
}

export interface DslWarning {
  line: number;
  column: number;
  message: string;
}

// ============================================
// STRATEGY
// ============================================

export interface Strategy {
  id: string;
  userId: string;
  name: string;
  description?: string;
  mode: SimulationMode;
  scenario: Scenario;
  indices: Index[];
  correlationMatrix: CorrelationMatrix;
  customTickers: CustomTicker[];
  simulationConfig: SimulationConfig;
  dsl: DslCode;
  status: StrategyStatus;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt?: Date;
  resultsId?: string;
}

export interface StrategyDraft {
  name?: string;
  description?: string;
  mode?: SimulationMode;
  scenario?: Partial<Scenario>;
  indices?: Index[];
  correlationMatrix?: CorrelationMatrix;
  customTickers?: CustomTicker[];
  simulationConfig?: Partial<SimulationConfig>;
  dsl?: Partial<DslCode>;
}

export interface StrategySummary {
  id: string;
  name: string;
  mode: SimulationMode;
  model: StochasticModel;
  indices: string[];
  status: StrategyStatus;
  updatedAt: Date;
  hasResults: boolean;
}

// ============================================
// DEFAULT VALUES
// ============================================

export const DEFAULT_HESTON_PARAMS: HestonParameters = {
  kappa: 2.0,
  theta: 0.04,
  sigma: 0.3,
  rho: -0.7,
  v0: 0.04,
  s0: 100,
  mu: 0.08,
  epsilon: 0.0001
};

export const DEFAULT_GBM_PARAMS: GBMParameters = {
  mu: 0.08,
  sigma: 0.2,
  s0: 100,
};

export const DEFAULT_GARCH_PARAMS: GARCHParameters = {
  omega: 0.000002,
  alpha: 0.09,
  beta: 0.90,
  mu: 0.08,
  initialVol: 0.2,
  s0: 100
};

export const DEFAULT_ACCUMULATION_SCENARIO: AccumulationScenario = {
  initialLumpSum: 50000,
  monthlyContribution: 2000,
  targetWealth: 1000000,
  timelineYears: 20,
};

export const DEFAULT_RETIREMENT_SCENARIO: RetirementScenario = {
  initialPortfolio: 1000000,
  monthlyWithdrawal: 4000,
  inflationRate: 0.025,
  timelineYears: 30,
};

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  iterations: 10000,
  granularity: Granularity.Weekly,
  riskFreeRate: 0.04,
};

export const AVAILABLE_INDICES: Index[] = [
  {
    symbol: 'SPY',
    name: 'S&P 500 ETF',
    model: StochasticModel.Heston,
    parameters: DEFAULT_HESTON_PARAMS,
  },
  {
    symbol: 'QQQ',
    name: 'Nasdaq 100 ETF',
    model: StochasticModel.Heston,
    parameters: { ...DEFAULT_HESTON_PARAMS, sigma: 0.35 },
  },
  {
    symbol: 'IWM',
    name: 'Russell 2000 ETF',
    model: StochasticModel.Heston,
    parameters: { ...DEFAULT_HESTON_PARAMS, sigma: 0.4 },
  },
  {
    symbol: 'EFA',
    name: 'International Developed ETF',
    model: StochasticModel.GBM,
    parameters: { ...DEFAULT_GBM_PARAMS, sigma: 0.18 },
  },
  {
    symbol: 'EEM',
    name: 'Emerging Markets ETF',
    model: StochasticModel.GBM,
    parameters: { ...DEFAULT_GBM_PARAMS, sigma: 0.25 },
  },
];