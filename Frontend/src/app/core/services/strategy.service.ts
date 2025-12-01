import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, of, tap, map, catchError, shareReplay } from 'rxjs';
import { ApiService, PaginatedResponse } from './api.service';
import { 
  Strategy, 
  StrategyDraft, 
  StrategySummary,
  SimulationMode,
  StochasticModel,
  Index,
  CorrelationMatrix,
  CustomTicker,
  SimulationConfig,
  DslCode,
  Scenario,
  DEFAULT_ACCUMULATION_SCENARIO,
  DEFAULT_RETIREMENT_SCENARIO,
  DEFAULT_SIMULATION_CONFIG,
  AVAILABLE_INDICES,
  StrategyStatus,
  HestonParameters,
  GBMParameters,
  GARCHParameters,
  DEFAULT_HESTON_PARAMS,
  DEFAULT_GBM_PARAMS,
  DEFAULT_GARCH_PARAMS
} from '../models/strategy.model';

export interface StrategyFilters {
  search?: string;
  mode?: SimulationMode;
  status?: StrategyStatus;
  sortBy?: 'name' | 'updatedAt' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

@Injectable({
  providedIn: 'root'
})
export class StrategyService {
  private readonly api = inject(ApiService);

  // State signals
  private readonly _strategies = signal<StrategySummary[]>([]);
  private readonly _currentStrategy = signal<Strategy | null>(null);
  private readonly _draft = signal<StrategyDraft>({});
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);

  // Caching for heavy data
  private readonly _historyCache = new Map<string, Observable<any>>();

  // Public signals
  readonly strategies = this._strategies.asReadonly();
  readonly currentStrategy = this._currentStrategy.asReadonly();
  readonly draft = this._draft.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();

  // Computed
  readonly strategyCount = computed(() => this._strategies().length);
  readonly hasUnsavedChanges = computed(() => {
    const draft = this._draft();
    return Object.keys(draft).length > 0;
  });

  // ============================================
  // Parameter Fetching & Mapping
  // ============================================

  // ... existing code ...

  // NEW: Fetch real correlations from Backend
  getCorrelations(symbols: string[]): Observable<{ row: number, col: number, value: number }[]> {
    // Need at least 2 assets to have a correlation
    if (symbols.length < 2) return of([]);

    // The C# controller expects ?tickers=SPY&tickers=QQQ...
    let params: any = {};
    // Angular HttpClient handles array params automatically if passed correctly, 
    // but sometimes it's safer to construct the HttpParams object explicitly if using an interceptor chain.
    // However, standard usage:
    params = { tickers: symbols };

    return this.api.get<any[]>('/MarketData/correlations', params).pipe(
      map(response => {
        const updates: { row: number, col: number, value: number }[] = [];
        
        // Map the response (TickerA, TickerB, Value) to matrix coordinates
        response.forEach(item => {
          const idxA = symbols.findIndex(s => s.toLowerCase() === item.tickerA.toLowerCase());
          const idxB = symbols.findIndex(s => s.toLowerCase() === item.tickerB.toLowerCase());
          
          if (idxA !== -1 && idxB !== -1) {
            // Set (A, B)
            updates.push({ row: idxA, col: idxB, value: item.value });
            // Set (B, A) - Symmetric
            updates.push({ row: idxB, col: idxA, value: item.value }); 
          }
        });
        return updates;
      }),
      catchError(err => {
        console.error('Failed to fetch correlations', err);
        return of([]);
      })
    );
  }


  getModelParameters(symbol: string, model: StochasticModel): Observable<any> {
    // 1. Call the real API
    return this.api.get<any>(`/MarketData/${symbol}/params/${model}`).pipe(
      map(apiParams => {
        // 2. If API returns empty object (no calibration data), return defaults
        if (!apiParams || Object.keys(apiParams).length === 0) {
          console.warn(`No calibration data for ${symbol} (${model}). Using defaults.`);
          return this.getDefaultParams(model);
        }

        // 3. Map API response to Frontend Model
        // Python returns { "param": { "value": 1.23, "std_err": 0.01 } }
        // We need to extract .value
        const val = (key: string) => apiParams[key]?.value ?? apiParams[key];

        switch (model) {
          case StochasticModel.Heston:
            return {
              kappa: val('kappa') ?? DEFAULT_HESTON_PARAMS.kappa,
              theta: val('theta') ?? DEFAULT_HESTON_PARAMS.theta,
              // FIX: Map 'sigma_v' (Python/DB) to 'sigma' (Frontend/F#)
              sigma: val('sigma_v') ?? val('sigma') ?? DEFAULT_HESTON_PARAMS.sigma,
              rho: val('rho') ?? DEFAULT_HESTON_PARAMS.rho,
              v0: val('v0') ?? DEFAULT_HESTON_PARAMS.v0,
              mu: val('mu') ?? DEFAULT_HESTON_PARAMS.mu,
              s0: DEFAULT_HESTON_PARAMS.s0, 
              // FIX: Add epsilon if missing
              epsilon: 0.0001 
            } as HestonParameters;

          case StochasticModel.GBM:
            return {
              mu: val('mu') ?? DEFAULT_GBM_PARAMS.mu,
              sigma: val('sigma') ?? DEFAULT_GBM_PARAMS.sigma,
              s0: DEFAULT_GBM_PARAMS.s0
            } as GBMParameters;

          case StochasticModel.GARCH:
            return {
              omega: val('omega') ?? DEFAULT_GARCH_PARAMS.omega,
              alpha: val('alpha') ?? DEFAULT_GARCH_PARAMS.alpha,
              beta: val('beta') ?? DEFAULT_GARCH_PARAMS.beta,
              mu: val('mu') ?? DEFAULT_GARCH_PARAMS.mu,
              initialVol: val('initial_vol') ?? DEFAULT_GARCH_PARAMS.initialVol,
              s0: DEFAULT_GARCH_PARAMS.s0
            } as GARCHParameters;

          default:
            return this.getDefaultParams(model);
        }
      }),
      catchError(err => {
        console.error(`Failed to fetch params for ${symbol}`, err);
        return of(this.getDefaultParams(model));
      })
    );
  }

  getHistoricalData(symbol: string): Observable<any> {
    // Cache the observable to prevent multiple in-flight requests for the same ticker
    if (this._historyCache.has(symbol)) {
      return this._historyCache.get(symbol)!;
    }

    const request = this.api.get<any>(`/MarketData/${symbol}`).pipe(
      map(response => {
        // The API returns { ticker: "...", dailyData: [{ price: 100, vol: 0.2 }, ...] }
        // We just need the dailyData array for the F# engine
        return response.dailyData || [];
      }),
      shareReplay(1), // Cache the result
      catchError(err => {
        console.error(`Failed to fetch history for ${symbol}`, err);
        return of([]);
      })
    );

    this._historyCache.set(symbol, request);
    return request;
  }

  private getDefaultParams(model: StochasticModel): any {
    switch (model) {
      case StochasticModel.Heston: return { ...DEFAULT_HESTON_PARAMS };
      case StochasticModel.GBM: return { ...DEFAULT_GBM_PARAMS };
      case StochasticModel.GARCH: return { ...DEFAULT_GARCH_PARAMS };
      default: return { ...DEFAULT_GBM_PARAMS };
    }
  }

  // ============================================
  // CRUD Operations
  // ============================================

  loadStrategies(filters?: StrategyFilters): Observable<PaginatedResponse<StrategySummary>> {
    this._loading.set(true);
    
    return this.api.get<PaginatedResponse<StrategySummary>>('/strategies', filters as Record<string, string | number | boolean>).pipe(
      tap(response => {
        this._strategies.set(response.data);
        this._loading.set(false);
      })
    );
  }

  loadStrategy(id: string): Observable<Strategy> {
    this._loading.set(true);
    
    return this.api.get<Strategy>(`/strategies/${id}`).pipe(
      tap(strategy => {
        this._currentStrategy.set(strategy);
        this._loading.set(false);
      })
    );
  }

  createStrategy(strategy: Omit<Strategy, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Observable<Strategy> {
    this._saving.set(true);
    
    return this.api.post<Strategy>('/strategies', strategy).pipe(
      tap(created => {
        this._strategies.update(list => [this.toSummary(created), ...list]);
        this._currentStrategy.set(created);
        this._saving.set(false);
        this.clearDraft();
      })
    );
  }

  updateStrategy(id: string, updates: Partial<Strategy>): Observable<Strategy> {
    this._saving.set(true);
    
    return this.api.patch<Strategy>(`/strategies/${id}`, updates).pipe(
      tap(updated => {
        this._strategies.update(list => 
          list.map(s => s.id === id ? this.toSummary(updated) : s)
        );
        this._currentStrategy.set(updated);
        this._saving.set(false);
      })
    );
  }

  deleteStrategy(id: string): Observable<void> {
    return this.api.delete<void>(`/strategies/${id}`).pipe(
      tap(() => {
        this._strategies.update(list => list.filter(s => s.id !== id));
        if (this._currentStrategy()?.id === id) {
          this._currentStrategy.set(null);
        }
      })
    );
  }

  duplicateStrategy(id: string): Observable<Strategy> {
    return this.api.post<Strategy>(`/strategies/${id}/duplicate`, {}).pipe(
      tap(duplicated => {
        this._strategies.update(list => [this.toSummary(duplicated), ...list]);
      })
    );
  }

  // ============================================
  // Draft Management
  // ============================================

  updateDraft(updates: Partial<StrategyDraft>): void {
    this._draft.update(current => ({ ...current, ...updates }));
  }

  setDraftMode(mode: SimulationMode): void {
    const scenario = mode === SimulationMode.Accumulation 
      ? DEFAULT_ACCUMULATION_SCENARIO 
      : DEFAULT_RETIREMENT_SCENARIO;
    
    this._draft.update(current => ({
      ...current,
      mode,
      scenario,
    }));
  }

  setDraftIndices(indices: Index[]): void {
    // Auto-generate correlation matrix
    const symbols = indices.map(i => i.symbol);
    const matrix = this.generateDefaultCorrelationMatrix(symbols.length);
    
    this._draft.update(current => ({
      ...current,
      indices,
      correlationMatrix: { indices: symbols, matrix },
    }));
  }

  setDraftCorrelation(row: number, col: number, value: number): void {
    this._draft.update(current => {
      const matrix = current.correlationMatrix?.matrix.map(r => [...r]) || [];
      if (matrix[row] && matrix[col]) {
        matrix[row][col] = value;
        matrix[col][row] = value; // Symmetric
      }
      return {
        ...current,
        correlationMatrix: {
          indices: current.correlationMatrix?.indices || [],
          matrix,
        },
      };
    });
  }

  setDraftDsl(code: string): void {
    this._draft.update(current => ({
      ...current,
      dsl: {
        code,
        isValid: true, // Will be validated by backend
        errors: [],
        warnings: [],
      },
    }));
  }

  clearDraft(): void {
    this._draft.set({});
  }

  loadDraftFromStrategy(strategy: Strategy): void {
    this._draft.set({
      name: strategy.name,
      description: strategy.description,
      mode: strategy.mode,
      scenario: strategy.scenario,
      indices: strategy.indices,
      correlationMatrix: strategy.correlationMatrix,
      customTickers: strategy.customTickers,
      simulationConfig: strategy.simulationConfig,
      dsl: strategy.dsl,
    });
  }

  // ============================================
  // DSL Validation
  // ============================================

  validateDsl(code: string): Observable<DslCode> {
    return this.api.post<DslCode>('/dsl/validate', { code });
  }

  // ============================================
  // Helper Methods
  // ============================================

  private toSummary(strategy: Strategy): StrategySummary {
    return {
      id: strategy.id,
      name: strategy.name,
      mode: strategy.mode,
      model: strategy.indices[0]?.model || StochasticModel.Heston,
      indices: strategy.indices.map(i => i.symbol),
      status: strategy.status,
      updatedAt: strategy.updatedAt,
      hasResults: !!strategy.resultsId,
    };
  }

  private generateDefaultCorrelationMatrix(size: number): number[][] {
    const matrix: number[][] = [];
    for (let i = 0; i < size; i++) {
      matrix[i] = [];
      for (let j = 0; j < size; j++) {
        matrix[i][j] = i === j ? 1 : 0.5; // Default correlation
      }
    }
    return matrix;
  }

  getAvailableIndices(): Index[] {
    return AVAILABLE_INDICES;
  }
}