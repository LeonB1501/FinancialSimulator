import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, of, map, tap, catchError, shareReplay } from 'rxjs';
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
  DEFAULT_HISTORIC_SCENARIO,
  DEFAULT_SIMULATION_CONFIG,
  AVAILABLE_INDICES,
  StrategyStatus,
  HestonParameters,
  GBMParameters,
  GARCHParameters,
  DEFAULT_HESTON_PARAMS,
  DEFAULT_GBM_PARAMS,
  DEFAULT_GARCH_PARAMS,
  DslError,
  DEFAULT_EXECUTION_COSTS // <--- ADDED IMPORT
} from '../models/strategy.model';

// --- DTO Interfaces matching Backend C# DTOs ---
interface CreateStrategyRequest {
  name: string;
  dslScript: string;
  configJson: string;
  isPublic: boolean;
}

interface UpdateStrategyRequest {
  name?: string;
  dslScript?: string;
  configJson?: string;
  isPublic?: boolean;
}

interface StrategyResponseDto {
  id: number;
  name: string;
  dslScript: string;
  configJson: string;
  isPublic: boolean;
  createdAt: string;
  lastModified: string;
  latestResultId?: string;
}

interface DslValidationResponse {
  isValid: boolean;
  errors: DslError[];
}

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

  getCorrelations(symbols: string[]): Observable<{ row: number, col: number, value: number }[]> {
    if (symbols.length < 2) return of([]);

    const params = { tickers: symbols };

    return this.api.get<any[]>('/MarketData/correlations', params).pipe(
      map(response => {
        const updates: { row: number, col: number, value: number }[] = [];
        
        response.forEach(item => {
          const idxA = symbols.findIndex(s => s.toLowerCase() === item.tickerA.toLowerCase());
          const idxB = symbols.findIndex(s => s.toLowerCase() === item.tickerB.toLowerCase());
          
          if (idxA !== -1 && idxB !== -1) {
            updates.push({ row: idxA, col: idxB, value: item.value });
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
    return this.api.get<any>(`/MarketData/${symbol}/params/${model}`).pipe(
      map(apiParams => {
        if (!apiParams || Object.keys(apiParams).length === 0) {
          return this.getDefaultParams(model);
        }

        // Helper to handle inconsistent capitalization from Python backend
        const val = (key: string) => {
          if (apiParams[key]?.value !== undefined) return apiParams[key].value;
          const lowerKey = key.toLowerCase();
          if (apiParams[lowerKey]?.value !== undefined) return apiParams[lowerKey].value;
          return apiParams[key];
        };

        switch (model) {
          case StochasticModel.Heston:
            return {
              kappa: val('kappa') ?? DEFAULT_HESTON_PARAMS.kappa,
              theta: val('theta') ?? DEFAULT_HESTON_PARAMS.theta,
              sigma: val('sigma_v') ?? val('sigma') ?? DEFAULT_HESTON_PARAMS.sigma,
              rho: val('rho') ?? DEFAULT_HESTON_PARAMS.rho,
              v0: val('v0') ?? DEFAULT_HESTON_PARAMS.v0,
              mu: val('mu') ?? DEFAULT_HESTON_PARAMS.mu,
              s0: DEFAULT_HESTON_PARAMS.s0, 
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
    if (this._historyCache.has(symbol)) {
      return this._historyCache.get(symbol)!;
    }

    const request = this.api.get<any>(`/MarketData/${symbol}`).pipe(
      map(response => response.dailyData || []),
      shareReplay(1),
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
    
    return this.api.get<any[]>('/strategies').pipe(
      map(dtos => {
        const summaries: StrategySummary[] = dtos.map(dto => this.mapDtoToSummary(dto));
        return {
          data: summaries,
          total: summaries.length,
          page: 1,
          pageSize: 100,
          totalPages: 1
        } as PaginatedResponse<StrategySummary>;
      }),
      tap(response => {
        this._strategies.set(response.data);
        this._loading.set(false);
      }),
      catchError(err => {
        console.error('Error loading strategies:', err);
        this._loading.set(false);
        throw err;
      })
    );
  }

  loadStrategy(id: string): Observable<Strategy> {
    this._loading.set(true);
    
    return this.api.get<StrategyResponseDto>(`/strategies/${id}`).pipe(
      map(dto => this.mapDtoToStrategy(dto)),
      tap(strategy => {
        this._currentStrategy.set(strategy);
        this._loading.set(false);
      }),
      catchError(err => {
        console.error(`Error loading strategy ${id}:`, err);
        this._loading.set(false);
        throw err;
      })
    );
  }

  createStrategy(strategyData: any): Observable<Strategy> {
    this._saving.set(true);
    
    // 1. Serialize Config
    const config = {
      mode: strategyData.mode,
      scenario: strategyData.scenario,
      indices: strategyData.indices,
      correlationMatrix: strategyData.correlationMatrix,
      customTickers: strategyData.customTickers,
      simulationConfig: strategyData.simulationConfig,
      executionCosts: strategyData.executionCosts, // Include Costs
      status: strategyData.status
    };

    // 2. Prepare DTO
    const payload: CreateStrategyRequest = {
      name: strategyData.name,
      dslScript: strategyData.dsl.code,
      configJson: JSON.stringify(config),
      isPublic: false
    };
    
    return this.api.post<StrategyResponseDto>('/strategies', payload).pipe(
      map(dto => this.mapDtoToStrategy(dto)),
      tap(created => {
        this._strategies.update(list => [this.toSummary(created), ...list]);
        this._currentStrategy.set(created);
        this._saving.set(false);
        this.clearDraft();
      }),
      catchError(err => {
        console.error('Error creating strategy:', err);
        this._saving.set(false);
        throw err;
      })
    );
  }

  updateStrategy(id: string, strategyData: any): Observable<Strategy> {
    this._saving.set(true);
    
    // 1. Serialize Config
    const config = {
      mode: strategyData.mode,
      scenario: strategyData.scenario,
      indices: strategyData.indices,
      correlationMatrix: strategyData.correlationMatrix,
      customTickers: strategyData.customTickers,
      simulationConfig: strategyData.simulationConfig,
      executionCosts: strategyData.executionCosts, // Include Costs
      status: strategyData.status
    };

    // 2. Prepare DTO
    const payload: UpdateStrategyRequest = {
      name: strategyData.name,
      dslScript: strategyData.dsl.code,
      configJson: JSON.stringify(config),
      isPublic: false
    };
    
    return this.api.patch<StrategyResponseDto>(`/strategies/${id}`, payload).pipe(
      map(dto => this.mapDtoToStrategy(dto)),
      tap(updated => {
        this._strategies.update(list => 
          list.map(s => s.id === id ? this.toSummary(updated) : s)
        );
        this._currentStrategy.set(updated);
        this._saving.set(false);
      }),
      catchError(err => {
        console.error('Error updating strategy:', err);
        this._saving.set(false);
        throw err;
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
    return this.api.post<StrategyResponseDto>(`/strategies/${id}/duplicate`, {}).pipe(
      map(dto => this.mapDtoToStrategy(dto)),
      tap(duplicated => {
        this._strategies.update(list => [this.toSummary(duplicated), ...list]);
      })
    );
  }

  // ============================================
  // DSL Validation
  // ============================================

  validateDsl(code: string): Observable<DslCode> {
    return this.api.post<DslValidationResponse>('/dsl/validate', { code }).pipe(
      tap(response => {
        if (!response.isValid && response.errors?.length > 0) {
          console.group('%c[F# Compiler Error]', 'color: red; font-weight: bold; font-size: 12px;');
          response.errors.forEach(err => {
            console.error(`Line ${err.line}, Col ${err.column}: ${err.message}`);
          });
          console.groupEnd();
        } else {
          console.log('%c[F# Compiler] Code is valid', 'color: green; font-weight: bold;');
        }
      }),
      map(response => ({
        code,
        isValid: response.isValid,
        errors: response.errors || [],
        warnings: []
      } as unknown as DslCode))
    );
  }

  // ============================================
  // MAPPERS (DTO <-> Model)
  // ============================================

  private mapDtoToStrategy(dto: StrategyResponseDto): Strategy {
    let config: any = {};
    try {
      config = JSON.parse(dto.configJson);
    } catch (e) {
      console.error('Failed to parse strategy config JSON', e);
    }

    return {
      id: dto.id.toString(),
      userId: '', 
      name: dto.name,
      description: '',
      mode: config.mode || SimulationMode.Accumulation,
      scenario: config.scenario || DEFAULT_ACCUMULATION_SCENARIO,
      indices: config.indices || [],
      correlationMatrix: config.correlationMatrix || { indices: [], matrix: [] },
      customTickers: config.customTickers || [],
      // FIX: Map execution costs with default fallback
      executionCosts: config.executionCosts || DEFAULT_EXECUTION_COSTS,
      simulationConfig: config.simulationConfig || DEFAULT_SIMULATION_CONFIG,
      dsl: {
        code: dto.dslScript,
        isValid: true,
        errors: [],
        warnings: []
      },
      status: config.status || StrategyStatus.Draft,
      createdAt: new Date(dto.createdAt),
      updatedAt: new Date(dto.lastModified),
      lastRunAt: undefined,
      latestResultId: dto.latestResultId
    };
  }

  private mapDtoToSummary(dto: any): StrategySummary {
    let config: any = {};
    try {
      config = JSON.parse(dto.configJson);
    } catch { }

    return {
      id: dto.id.toString(),
      name: dto.name,
      mode: config.mode || SimulationMode.Accumulation,
      model: config.indices?.[0]?.model || StochasticModel.Heston,
      indices: (config.indices || []).map((i: any) => i.symbol),
      status: config.status || StrategyStatus.Draft,
      updatedAt: new Date(dto.lastModified),
      latestResultId: dto.latestResultId
    };
  }

  // ============================================
  // Draft Management
  // ============================================

  updateDraft(updates: Partial<StrategyDraft>): void {
    this._draft.update(current => ({ ...current, ...updates }));
  }

  setDraftMode(mode: SimulationMode): void {
    let scenario: Scenario;
    
    switch (mode) {
      case SimulationMode.Accumulation:
        scenario = DEFAULT_ACCUMULATION_SCENARIO;
        break;
      case SimulationMode.Retirement:
        scenario = DEFAULT_RETIREMENT_SCENARIO;
        break;
      case SimulationMode.Historic:
        scenario = DEFAULT_HISTORIC_SCENARIO;
        break;
      default:
        scenario = DEFAULT_ACCUMULATION_SCENARIO;
    }
    
    this._draft.update(current => ({
      ...current,
      mode,
      scenario,
    }));
  }

  setDraftIndices(indices: Index[]): void {
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
        matrix[col][row] = value;
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
        isValid: true,
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
      executionCosts: strategy.executionCosts, // Load costs
      dsl: strategy.dsl,
    });
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
      latestResultId: strategy.latestResultId,
    };
  }

  private generateDefaultCorrelationMatrix(size: number): number[][] {
    const matrix: number[][] = [];
    for (let i = 0; i < size; i++) {
      matrix[i] = [];
      for (let j = 0; j < size; j++) {
        matrix[i][j] = i === j ? 1 : 0.5;
      }
    }
    return matrix;
  }

  getAvailableIndices(): Index[] {
    return AVAILABLE_INDICES;
  }

  // Cached observable for available tickers
  private _availableTickers$: Observable<string[]> | null = null;

  getAvailableTickers(): Observable<string[]> {
    if (!this._availableTickers$) {
      this._availableTickers$ = this.api.get<string[]>('/MarketData/tickers').pipe(
        map(tickers => tickers.map(t => t.toUpperCase())),
        shareReplay(1),
        catchError(err => {
          console.error('Failed to fetch available tickers', err);
          // Fallback to empty array if API fails
          return of([]);
        })
      );
    }
    return this._availableTickers$;
  }
}