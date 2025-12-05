import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, Subject, throwError, forkJoin, of } from 'rxjs';
import { tap, map, catchError, finalize, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { StrategyService } from './strategy.service';
import { 
  Strategy, 
  StochasticModel, 
  Index, 
  SimulationMode, 
  Granularity, 
  AccumulationScenario, 
  RetirementScenario 
} from '../models/strategy.model';
import { 
  SimulationState,
  SimulationProgress,
  SimulationJob,
} from '../models/simulation.model';
import { SimulationResults, DrawdownFrequency } from '../models/results.model';

@Injectable({
  providedIn: 'root'
})
export class SimulationService {
  private readonly USE_SERVER_DEBUG_MODE = false; 
  private readonly api = inject(ApiService);
  private readonly strategyService = inject(StrategyService);
  
  private currentJob: SimulationJob | null = null;

  // State signals
  private readonly _state = signal<SimulationState>(SimulationState.Idle);
  private readonly _progress = signal<SimulationProgress>({
    state: SimulationState.Idle,
    completedIterations: 0,
    totalIterations: 0,
    percentComplete: 0,
    elapsedMs: 0,
    estimatedRemainingMs: 0,
    currentPhase: '',
  });
  private readonly _error = signal<string | null>(null);

  // Progress stream for real-time updates
  private readonly progressSubject = new Subject<SimulationProgress>();
  readonly progress$ = this.progressSubject.asObservable();

  readonly state = this._state.asReadonly();
  readonly progress = this._progress.asReadonly();
  readonly error = this._error.asReadonly();

  readonly isRunning = computed(() => 
    this._state() === SimulationState.Running || 
    this._state() === SimulationState.Preparing ||
    this._state() === SimulationState.Processing
  );
  
  readonly canCancel = computed(() => 
    this._state() === SimulationState.Running
  );

  async initializeWasm(): Promise<void> {
    return Promise.resolve();
  }

  runSimulation(strategy: Strategy): Observable<SimulationResults> {
    if (this.isRunning()) {
      return throwError(() => new Error('A simulation is already running'));
    }

    this._state.set(SimulationState.Preparing);
    this._error.set(null);

    const startTime = Date.now();
    
    this.currentJob = {
      id: crypto.randomUUID(),
      strategyId: strategy.id,
      strategy,
      progress: {
        state: SimulationState.Preparing,
        completedIterations: 0,
        totalIterations: strategy.simulationConfig.iterations,
        percentComplete: 0,
        elapsedMs: 0,
        estimatedRemainingMs: 0,
        currentPhase: 'Preparing simulation...',
      },
      startedAt: new Date(),
    };

    // Emit initial progress
    this.progressSubject.next(this.currentJob.progress);

    // 1. Fetch Historical Data if needed (for Blocked Bootstrap)
    const historyRequests: Observable<any>[] = [];
    const tickersNeedingHistory: string[] = [];

    strategy.indices.forEach(idx => {
      if (idx.model === StochasticModel.BlockedBootstrap) {
        historyRequests.push(this.strategyService.getHistoricalData(idx.symbol));
        tickersNeedingHistory.push(idx.symbol);
      }
    });

    // If no history needed, proceed immediately
    const historyObservable = historyRequests.length > 0 
      ? forkJoin(historyRequests) 
      : of([]);

    return historyObservable.pipe(
      switchMap(histories => {
        // Map history back to tickers
        const historyMap: Record<string, any[]> = {};
        tickersNeedingHistory.forEach((ticker, i) => {
          historyMap[ticker.toLowerCase()] = histories[i];
        });

        // 2. Run Worker
        return this.runWorkerSimulation(strategy, historyMap, startTime);
      }),
      catchError(err => {
        this.handleError('Failed to prepare simulation: ' + err.message, null);
        return throwError(() => err);
      })
    );
  }

  private runWorkerSimulation(
    strategy: Strategy, 
    historyMap: Record<string, any[]>, 
    startTime: number
  ): Observable<SimulationResults> {

    // --- DEBUG MODE INTERCEPTION ---
    if (this.USE_SERVER_DEBUG_MODE) {
      console.warn('⚠️ RUNNING IN SERVER DEBUG MODE - WORKER BYPASSED');
      const input = this.mapStrategyToFableInput(strategy, historyMap);
      
      return this.api.post<any>('/Debug/run', input).pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.error);
          }
          console.log("F# Engine Result:", response);
          throw new Error("Debug Run Successful. Check Backend Console for breakpoints.");
        })
      );
    }
    // -------------------------------

    return new Observable<SimulationResults>(observer => {
      
      const worker = new Worker(new URL('../../workers/simulation.worker', import.meta.url));
      
      // Map to Thoth-compatible JSON
      const input = this.mapStrategyToFableInput(strategy, historyMap);

      // DEBUG: Log the exact payload being sent to the worker
      console.log('🚀 Sending to Worker:', JSON.stringify(input, null, 2));

      worker.onmessage = ({ data }) => {
        if (data.type === 'success') {
          this._state.set(SimulationState.Processing);
          
          // Update progress to 100%
          this.updateProgress(100, strategy.simulationConfig.iterations, 'Processing results...');

          try {
            // 1. Process Raw Data from WASM
            const results = this.processResults(strategy, data.payload, startTime);
            
            // 2. Save to Backend
            this.saveResultsToBackend(results).subscribe({
              next: (savedRecord) => {
                console.log('Results saved successfully with ID:', savedRecord.id);
                this._state.set(SimulationState.Completed);
                if (this.currentJob) this.currentJob.completedAt = new Date();
                
                // Return the results
                observer.next({ ...results, id: savedRecord.id });
                observer.complete();
              },
              error: (err) => {
                console.error('Failed to save results to backend:', err);
                this.notificationServiceError('Simulation finished, but results could not be saved.');
                this._state.set(SimulationState.Completed);
                observer.next(results);
                observer.complete();
              }
            });

          } catch (err: any) {
            this.handleError(err.message, observer);
          }
          worker.terminate();

        } else if (data.type === 'error') {
          this.handleError(data.error, observer);
          worker.terminate();
        }
      };

      worker.onerror = (err) => {
        this.handleError('Worker Error: ' + err.message, observer);
        worker.terminate();
      };

      this._state.set(SimulationState.Running);
      this.updateProgress(0, strategy.simulationConfig.iterations, 'Running simulation...');
      worker.postMessage({ id: this.currentJob?.id, input });

      return () => worker.terminate();
    });
  }

  // --- Backend Persistence ---

  private saveResultsToBackend(results: SimulationResults): Observable<{ id: string }> {
    return this.api.post<{ id: string }>('/results', results);
  }

  loadResults(resultsId: string): Observable<SimulationResults> {
    return this.api.get<SimulationResults>(`/results/${resultsId}`);
  }

  loadResultsForStrategy(strategyId: string): Observable<SimulationResults> {
    return this.api.get<SimulationResults>(`/results/strategy/${strategyId}`);
  }

  exportResults(resultsId: string, format: 'pdf' | 'csv' | 'json' | 'xlsx'): Observable<Blob> {
    return this.api.get<Blob>(`/results/${resultsId}/export`, { format });
  }

  // --- Helper Methods ---

  private updateProgress(percent: number, total: number, phase: string) {
    if (this.currentJob) {
      this.currentJob.progress = {
        ...this.currentJob.progress,
        percentComplete: percent,
        completedIterations: Math.floor((percent / 100) * total),
        currentPhase: phase
      };
      this._progress.set(this.currentJob.progress);
      this.progressSubject.next(this.currentJob.progress);
    }
  }

  private handleError(msg: string, observer: any) {
    this._state.set(SimulationState.Failed);
    this._error.set(msg);
    if (observer) observer.error(new Error(msg));
    this.currentJob = null;
  }

  private notificationServiceError(msg: string) {
    console.error(msg); 
  }

  cancelSimulation(): void {
    if (!this.canCancel()) return;
    this._state.set(SimulationState.Cancelled);
    this.currentJob = null;
  }

  reset(): void {
    this._state.set(SimulationState.Idle);
    this._error.set(null);
    this.currentJob = null;
  }

  // ============================================
  // Data Mapping (TS -> F# Thoth JSON)
  // ============================================

  private mapStrategyToFableInput(strategy: Strategy, historyMap: Record<string, any[]>): any {
    const assets = strategy.indices.map(idx => {
      return {
        Ticker: idx.symbol.toLowerCase(),
        InitialPrice: (idx.parameters as any).s0 ?? 100.0,
        Model: this.mapModelToFable(idx)
      };
    });

    if (strategy.customTickers) {
      strategy.customTickers.forEach(t => {
        assets.push({
          Ticker: t.symbol.toLowerCase(),
          InitialPrice: (t.parameters as any).s0 ?? 100.0,
          Model: this.mapModelToFable(t as unknown as Index)
        });
      });
    }

    let scenario: any = ["NoScenario"];
    if (strategy.mode === SimulationMode.Accumulation) {
      const s = strategy.scenario as AccumulationScenario;
      scenario = ["Accumulation", {
        MonthlyContribution: s.monthlyContribution ?? 0,
        ContributionGrowthRate: s.contributionGrowthRate ?? 0, 
        TargetWealth: s.targetWealth ?? 0
      }];
    } else {
      const s = strategy.scenario as RetirementScenario;
      scenario = ["Retirement", {
        MonthlyWithdrawal: s.monthlyWithdrawal ?? 0,
        InflationRate: s.inflationRate ?? 0,
        InitialPortfolio: s.initialPortfolio ?? 0,
        PensionStartMonth: (s.pensionStartYear || 0) * 12,
        MonthlyPension: s.monthlyPension || 0
      }];
    }

    const correlations: any[] = [];
    if (strategy.correlationMatrix && strategy.correlationMatrix.matrix) {
      const indices = strategy.correlationMatrix.indices;
      const matrix = strategy.correlationMatrix.matrix;
      
      for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
          correlations.push([[indices[i].toLowerCase(), indices[j].toLowerCase()], matrix[i][j]]);
        }
      }
    }

    const historicalData: any[] = [];
    Object.entries(historyMap).forEach(([ticker, data]) => {
      const mappedData = data.map(d => ({ Price: d.price, Vol: d.vol }));
      historicalData.push([ticker, mappedData]);
    });

    return {
      Config: {
        Assets: assets,
        Correlations: correlations, 
        TradingDays: (strategy.scenario as any).timelineYears * 252,
        Iterations: strategy.simulationConfig.iterations,
        RiskFreeRate: strategy.simulationConfig.riskFreeRate,
        Granularity: strategy.simulationConfig.granularity === 'daily' ? 1 : 
                     strategy.simulationConfig.granularity === 'weekly' ? 5 : 20,
        HistoricalData: historicalData,
        StartDate: new Date().toISOString(),
        Scenario: scenario
      },
      DslCode: strategy.dsl.code || "buy 100% spy",
      InitialCash: (strategy.scenario as any).initialLumpSum ?? (strategy.scenario as any).initialPortfolio ?? 100000,
      BaseSeed: strategy.simulationConfig.seed ?? Math.floor(Math.random() * 10000),
      Analysis: {
        TargetWealth: (strategy.scenario as any).targetWealth ?? null,
        TargetDays: null,
        RiskFreeRate: strategy.simulationConfig.riskFreeRate
      }
    };
  }

  private mapModelToFable(index: Index): any {
    const p = index.parameters as any;
    
    // FIX: Using PascalCase keys to match F# Record fields exactly for Thoth.Json
    // FIX: Added null-coalescing (??) defaults for ALL fields to prevent "undefined" JSON errors.
    switch (index.model) {
      case StochasticModel.Heston:
        return ["Heston", {
          Kappa: p.kappa ?? 2.0,
          Theta: p.theta ?? 0.04,
          Sigma: p.sigma ?? 0.3,
          Rho: p.rho ?? -0.7,
          V0: p.v0 ?? 0.04,
          Mu: p.mu ?? 0.0,
          Epsilon: p.epsilon ?? 0.0001
        }];
      
      case StochasticModel.GBM:
        // Arrays are positional, so no key mapping needed here
        return ["GeometricBrownianMotion", p.mu ?? 0.08, p.sigma ?? 0.2];
        
      case StochasticModel.GARCH:
        return ["Garch", {
          Omega: p.omega ?? 0.000002,
          Alpha: p.alpha ?? 0.09,
          Beta: p.beta ?? 0.90,
          Mu: p.mu ?? 0.08,
          InitialVol: p.initialVol ?? 0.2
        }];
        
      case StochasticModel.BlockedBootstrap:
        return ["BlockedBootstrap", {
          BlockSize: p.blockSize || 20,
          HistoricalDataId: index.symbol.toLowerCase()
        }];

      case StochasticModel.RegimeSwitching:
        return ["RegimeSwitching", 0, (p.regimes || []).map((r: any) => ({
            Name: r.name,
            Mu: r.mu,
            Sigma: r.sigma,
            TransitionProbs: p.transitionMatrix ? p.transitionMatrix[0] : [0.9, 0.1]
        }))];
        
      default:
        return ["GeometricBrownianMotion", 0.08, 0.2];
    }
  }

  private processResults(strategy: Strategy, report: any, startTime: number): SimulationResults {
    const frequencies: DrawdownFrequency[] = [];
    const thresholds = [0.1, 0.2, 0.3, 0.4, 0.5];
    
    thresholds.forEach(t => {
      const key = t.toString(); 
      let freq = 0;
      if (Array.isArray(report.DrawdownFrequencies)) {
        const found = report.DrawdownFrequencies.find((pair: any) => pair[0] === t);
        freq = found ? found[1] : 0;
      } else {
        freq = report.DrawdownFrequencies[key] || 0;
      }
      
      frequencies.push({
        threshold: t,
        label: `${t * 100}% DD`,
        frequency: freq,
        count: Math.round(freq * strategy.simulationConfig.iterations)
      });
    });

    // --- FIX: Map TimeStats correctly instead of null ---
    const timeStats = report.TimeStats;
    let mappedTimeStats = null;
    if (timeStats && timeStats.Mean > 0) {
      mappedTimeStats = {
        min: 0,
        max: 0,
        mean: timeStats.Mean,
        geometricMean: timeStats.GeometricMean,
        median: timeStats.Median,
        stdDev: 0,
        skewness: 0,
        kurtosis: 0,
        percentiles: {
          p1: 0,
          p5: 0,
          p10: this.getDecile(timeStats.Deciles, 10),
          p25: this.getDecile(timeStats.Deciles, 25) || this.getDecile(timeStats.Deciles, 20),
          p50: timeStats.Median,
          p75: this.getDecile(timeStats.Deciles, 75) || this.getDecile(timeStats.Deciles, 80),
          p90: this.getDecile(timeStats.Deciles, 90),
          p95: 0,
          p99: 0
        }
      };
    }

    return {
      id: crypto.randomUUID(), 
      strategyId: strategy.id.toString(),
      strategyName: strategy.name,
      createdAt: new Date(),
      metadata: {
        mode: strategy.mode,
        model: strategy.indices[0]?.model,
        indices: strategy.indices.map(i => i.symbol),
        iterations: strategy.simulationConfig.iterations,
        granularity: strategy.simulationConfig.granularity,
        riskFreeRate: strategy.simulationConfig.riskFreeRate,
        executionTimeMs: Date.now() - startTime,
        timelineYears: (strategy.scenario as any).timelineYears,
        targetWealth: (strategy.scenario as any).targetWealth,
      },
      successProbability: report.ProbabilityOfSuccess,
      ruinProbability: report.ProbabilityOfRuin, // <--- MAPPED HERE
      terminalWealthStats: {
        min: 0, 
        max: 0, 
        mean: report.WealthStats.Mean,
        geometricMean: report.WealthStats.GeometricMean,
        median: report.WealthStats.Median,
        stdDev: 0, 
        skewness: 0,
        kurtosis: 0,
        percentiles: {
          p1: 0,
          p5: 0,
          p10: this.getDecile(report.WealthStats.Deciles, 10),
          p25: this.getDecile(report.WealthStats.Deciles, 20),
          p50: report.WealthStats.Median,
          p75: this.getDecile(report.WealthStats.Deciles, 80),
          p90: this.getDecile(report.WealthStats.Deciles, 90),
          p95: 0,
          p99: 0
        }
      },
      timeToTargetStats: mappedTimeStats,
      riskMetrics: {
        sharpeRatio: { median: report.AverageSharpe } as any,
        sortinoRatio: { median: report.AverageSortino } as any,
        calmarRatio: { median: 0 } as any,
        annualizedVolatility: { median: report.AverageVolatility } as any,
        maxDrawdown: { median: report.AverageMaxDrawdown, percentiles: { p99: 0 } } as any,
        valueAtRisk95: 0,
        conditionalVaR95: 0
      },
      drawdownAnalysis: {
        frequencies: frequencies,
        averageDrawdown: report.AverageMaxDrawdown,
        averageRecoveryTime: 0,
        longestDrawdown: 0
      },
      detailedStats: { metrics: [] },
      samplePaths: {
        p10: this.mapPath(report.SamplePaths[0], report.Dates),
        p25: this.mapPath(report.SamplePaths[1], report.Dates),
        p50: this.mapPath(report.SamplePaths[2], report.Dates),
        p75: this.mapPath(report.SamplePaths[3], report.Dates),
        p90: this.mapPath(report.SamplePaths[4], report.Dates),
      },
      wealthDistribution: { bins: [], referenceLines: [] },
      timeToTargetDistribution: null
    };
  }

  private getDecile(deciles: any, key: number): number {
    if (Array.isArray(deciles)) {
      const found = deciles.find((pair: any) => pair[0] === key);
      return found ? found[1] : 0;
    }
    return deciles[key.toString()] || 0;
  }

  private mapPath(values: number[], dates: string[]): any {
    return {
      timestamps: dates ? dates.map(d => new Date(d).getTime()) : values.map((_, i) => i),
      values: values,
      events: []
    };
  }
}