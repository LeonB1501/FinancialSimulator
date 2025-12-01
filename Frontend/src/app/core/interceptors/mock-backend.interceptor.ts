import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '@env/environment';
import { SimulationMode, StochasticModel, StrategyStatus, Granularity } from '../models/strategy.model';

export const mockBackendInterceptor: HttpInterceptorFn = (req, next) => {
  // Only intercept if mock data is enabled and request goes to API
  if (!environment.features.enableMockData || !req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  console.log(`[Mock Backend] Intercepting ${req.method} ${req.url}`);

  // ============================================================
  // MOCK DATA STORE
  // ============================================================
  
  const MOCK_USER = {
    id: 'user-123',
    email: 'demo@quantsim.app',
    name: 'Demo User',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const MOCK_STRATEGIES = [
    {
      id: 'strat-1',
      name: 'Calendar Spread Strategy',
      mode: SimulationMode.Accumulation,
      indices: [{ symbol: 'SPY', model: StochasticModel.Heston }],
      status: StrategyStatus.Completed,
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      hasResults: true,
      resultsId: 'res-1'
    },
    {
      id: 'strat-2',
      name: 'Iron Condor Weekly',
      mode: SimulationMode.Retirement,
      indices: [{ symbol: 'SPY', model: StochasticModel.RegimeSwitching }],
      status: StrategyStatus.Draft,
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
      hasResults: false
    },
    {
      id: 'strat-3',
      name: '60/40 Momentum',
      mode: SimulationMode.Accumulation,
      indices: [{ symbol: 'SPY', model: StochasticModel.GARCH }, { symbol: 'AGG', model: StochasticModel.GBM }],
      status: StrategyStatus.Completed,
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 1 week ago
      hasResults: true,
      resultsId: 'res-3'
    }
  ];

  const MOCK_RESULTS = {
    id: 'res-1',
    strategyId: 'strat-1',
    strategyName: 'Calendar Spread Strategy',
    createdAt: new Date(),
    metadata: {
      mode: SimulationMode.Accumulation,
      model: StochasticModel.Heston,
      indices: ['SPY', 'QQQ'],
      iterations: 10000,
      granularity: Granularity.Weekly,
      riskFreeRate: 0.04,
      executionTimeMs: 1500,
      timelineYears: 20,
      targetWealth: 1000000
    },
    successProbability: 0.734,
    terminalWealthStats: {
      min: 50000, max: 5000000, mean: 1350000, median: 1234567, stdDev: 568000,
      percentiles: { p1: 100000, p5: 250000, p10: 456000, p25: 723000, p50: 1230000, p75: 1890000, p90: 2670000, p95: 3100000, p99: 4500000 }
    },
    riskMetrics: {
      sharpeRatio: { median: 1.23, percentiles: { p10: 0.8, p90: 1.5 } },
      sortinoRatio: { median: 1.67, percentiles: { p10: 1.1, p90: 2.1 } },
      maxDrawdown: { median: 0.345, percentiles: { p10: 0.18, p90: 0.55, p99: 0.62 } },
      annualizedVolatility: { median: 0.184 },
      calmarRatio: { median: 0.45 }
    }
  };

  // ============================================================
  // ROUTING LOGIC
  // ============================================================

  // 1. Auth Endpoints
  if (req.url.includes('/auth/login') || req.url.includes('/auth/register')) {
    return of(new HttpResponse({ status: 200, body: { 
      user: MOCK_USER, 
      token: 'mock-jwt-token', 
      expiresIn: 3600 
    }})).pipe(delay(800)); // Simulate network delay
  }

  // 2. Strategies List
  if (req.url.includes('/strategies') && req.method === 'GET' && !req.url.match(/\/strategies\/.+/)) {
    return of(new HttpResponse({ status: 200, body: {
      data: MOCK_STRATEGIES,
      total: MOCK_STRATEGIES.length,
      page: 1,
      pageSize: 10,
      totalPages: 1
    }})).pipe(delay(500));
  }

  // 3. Single Strategy Detail
  if (req.url.match(/\/strategies\/.+/) && req.method === 'GET' && !req.url.includes('/results')) {
    // Return a generic full strategy object
    return of(new HttpResponse({ status: 200, body: {
      ...MOCK_STRATEGIES[0],
      scenario: { initialLumpSum: 50000, monthlyContribution: 2000, targetWealth: 1000000, timelineYears: 20 },
      simulationConfig: { iterations: 10000, granularity: 'weekly', riskFreeRate: 0.04 },
      dsl: { code: '// Mock DSL Code', isValid: true }
    }})).pipe(delay(300));
  }

  // 4. Simulation Results
  if (req.url.includes('/results')) {
    return of(new HttpResponse({ status: 200, body: MOCK_RESULTS })).pipe(delay(600));
  }

  // 5. Run Simulation (POST)
  if (req.url.includes('/run')) {
    return of(new HttpResponse({ status: 200, body: MOCK_RESULTS })).pipe(delay(2000)); // Longer delay for "calculation"
  }

  // Default: Pass through (shouldn't happen in test mode usually)
  return next(req);
};