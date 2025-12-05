import { SimulationPath } from './simulation.model';
import { SimulationMode, StochasticModel, Granularity } from './strategy.model';

// ============================================
// RESULTS
// ============================================

export interface SimulationResults {
  id: string;
  strategyId: string;
  strategyName: string;
  createdAt: Date;
  
  // Metadata
  metadata: ResultsMetadata;
  
  // Core metrics
  successProbability: number;
  ruinProbability: number; // <--- ADDED
  terminalWealthStats: DistributionStats;
  timeToTargetStats: DistributionStats | null;
  
  // Risk metrics
  riskMetrics: RiskMetrics;
  
  // Drawdown analysis
  drawdownAnalysis: DrawdownAnalysis;
  
  // Detailed statistics table
  detailedStats: DetailedStatistics;
  
  // Sample paths (percentile representatives)
  samplePaths: SamplePaths;
  
  // Histogram data
  wealthDistribution: HistogramData;
  timeToTargetDistribution: HistogramData | null;
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

// ============================================
// STATISTICS
// ============================================

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

// ============================================
// DRAWDOWN ANALYSIS
// ============================================

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

// ============================================
// DETAILED STATISTICS
// ============================================

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

// ============================================
// SAMPLE PATHS
// ============================================

export interface SamplePaths {
  p10: SimulationPath;
  p25: SimulationPath;
  p50: SimulationPath;
  p75: SimulationPath;
  p90: SimulationPath;
}

// ============================================
// HISTOGRAM DATA
// ============================================

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

// ============================================
// CHART DATA HELPERS
// ============================================

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

// ============================================
// EXPORT FORMATS
// ============================================

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