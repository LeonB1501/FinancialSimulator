import { SimulationPath } from './simulation.model';
import { SimulationMode, StochasticModel, Granularity } from './strategy.model';

export interface SimulationResults {
  id: string;
  strategyId: string;
  strategyName: string;
  createdAt: Date;
  
  metadata: ResultsMetadata;
  
  successProbability: number;
  ruinProbability: number;
  terminalWealthStats: DistributionStats;
  timeToTargetStats: DistributionStats | null;
  
  riskMetrics: RiskMetrics;
  
  drawdownAnalysis: DrawdownAnalysis;
  
  drawdownCone: DrawdownCone;
  recoveryAnalysis: RecoveryAnalysis;
  
  detailedStats: DetailedStatistics;
  
  samplePaths: SamplePaths;
  
  wealthDistribution: HistogramData;
  timeToTargetDistribution: HistogramData | null;

  averageCommission: number;
  averageSlippage: number;
  averageTax: number; 
}

export interface HistoricTransaction {
  day: number;
  date: Date;
  ticker: string;
  type: 'BUY' | 'SELL' | 'TAX'; 
  quantity: number;
  price: number;
  value: number;
  tag?: string;
  commission: number;
  slippage: number;
  tax: number; 
}

export interface HistoricBacktestResults {
  id: string;
  strategyId: string;
  strategyName: string;
  createdAt: Date;
  
  equityCurve: number[];
  benchmarkCurve: number[];
  drawdownCurve: number[];
  dates: Date[];
  
  totalReturn: number;
  benchmarkReturn: number;
  alpha: number;
  maxDrawdown: number;
  sharpeRatio: number;
  volatility: number;
  
  transactions: HistoricTransaction[];
  totalTrades: number;
  buyCount: number;
  sellCount: number;
  
  startDate: Date;
  endDate: Date;
  tradingDays: number;

  totalCommission: number;
  totalSlippage: number;
  totalTax: number; 
}

export interface ResultsMetadata {
  mode: SimulationMode;
  model: StochasticModel;
  indices: string[];
  iterations: number;
  granularity: Granularity;
  riskFreeRate: number;
  executionTimeMs: number;
  targetWealth?: number;
  timelineYears: number;
}

export interface DistributionStats {
  min: number;
  max: number;
  mean: number;
  geometricMean: number;
  median: number;
  stdDev: number;
  skewness: number;
  kurtosis: number;
  percentiles: Percentiles;
}

export interface Percentiles {
  p1: number;
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface RiskMetrics {
  sharpeRatio: DistributionStats;
  sortinoRatio: DistributionStats;
  calmarRatio: DistributionStats;
  annualizedVolatility: DistributionStats;
  maxDrawdown: DistributionStats;
  valueAtRisk95: number;
  conditionalVaR95: number;
}

export interface DrawdownAnalysis {
  frequencies: DrawdownFrequency[];
  averageDrawdown: number;
  averageRecoveryTime: number;
  longestDrawdown: number;
}

export interface DrawdownFrequency {
  threshold: number;
  label: string;
  frequency: number;
  count: number;
}

export interface DrawdownCone {
  p10: number[]; 
  p50: number[]; 
  p90: number[]; 
}

export interface RecoveryAnalysis {
  probabilityOneYearPlus: number; 
  bins: HistogramBin[];
}

export interface DetailedStatistics {
  metrics: StatisticsRow[];
}

export interface StatisticsRow {
  metric: string;
  unit: string;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  mean: number;
  stdDev: number;
}

export interface SamplePaths {
  p10: SimulationPath;
  p25: SimulationPath;
  p50: SimulationPath;
  p75: SimulationPath;
  p90: SimulationPath;
}

export interface HistogramData {
  bins: HistogramBin[];
  referenceLines: ReferenceLine[];
}

export interface HistogramBin {
  label: string;
  rangeStart: number;
  rangeEnd: number;
  count: number;
  frequency: number;
}

export interface ReferenceLine {
  value: number;
  label: string;
  color: string;
  style: 'solid' | 'dashed';
}

export interface ChartDataPoint {
  x: number | string;
  y: number;
}

export interface PathChartData {
  labels: string[];
  datasets: PathDataset[];
}

export interface PathDataset {
  label: string;
  data: number[];
  borderColor: string;
  backgroundColor: string;
  borderWidth: number;
  tension: number;
  pointRadius: number;
}

export enum ExportFormat {
  PDF = 'pdf',
  CSV = 'csv',
  JSON = 'json',
  Excel = 'xlsx',
}

export interface ExportOptions {
  format: ExportFormat;
  includeCharts: boolean;
  includePaths: boolean;
  includeRawData: boolean;
}