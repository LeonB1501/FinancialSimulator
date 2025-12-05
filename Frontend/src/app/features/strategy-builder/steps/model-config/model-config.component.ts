import { Component, Output, EventEmitter, signal, computed, input, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialogModule } from '@angular/material/dialog';
import { StrategyService } from '@core/services/strategy.service';
import { 
  StrategyDraft, 
  Index, 
  StochasticModel, 
  AVAILABLE_INDICES,
  HestonParameters,
  GBMParameters,
  GARCHParameters,
  BlockedBootstrapParameters,
  RegimeSwitchingParameters,
  DEFAULT_HESTON_PARAMS,
  DEFAULT_GBM_PARAMS,
  DEFAULT_GARCH_PARAMS,
  CustomTicker,
} from '@core/models';

@Component({
  selector: 'qs-model-config',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTabsModule,
    MatDialogModule,
  ],
  template: `
    <div class="max-w-5xl mx-auto">
      <div class="mb-8">
        <h1 class="text-2xl lg:text-3xl font-bold text-surface-900 dark:text-surface-100 mb-2">
          Configure Models & Indices
        </h1>
        <p class="text-surface-600 dark:text-surface-400">
          Select indices to include and configure stochastic model parameters.
        </p>
      </div>

      <!-- Model Selection -->
      <section class="mb-10">
        <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">Stochastic Model</h2>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
          @for (model of models; track model.id) {
            <button
              (click)="selectModel(model.id)"
              [disabled]="isModelDisabled(model.id)"
              [class]="getModelCardClass(model.id)"
              class="bg-white dark:bg-surface-800 rounded-2xl border p-4 text-center transition-all duration-200 relative group"
            >
              <div class="text-2xl mb-2" [class.opacity-50]="isModelDisabled(model.id)">{{ model.icon }}</div>
              <p class="font-medium text-sm" [class]="isModelDisabled(model.id) ? 'text-surface-400 dark:text-surface-500' : 'text-surface-900 dark:text-surface-100'">
                {{ model.name }}
              </p>
              
              @if (isModelDisabled(model.id)) {
                <div class="absolute inset-0 bg-white/50 dark:bg-surface-900/50 cursor-not-allowed rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span class="text-xs bg-surface-900 dark:bg-surface-100 text-white dark:text-surface-900 px-2 py-1 rounded shadow-lg">
                    Requires History
                  </span>
                </div>
              }
            </button>
          }
        </div>
        @if (hasCustomIndexSelected() && selectedModelType() === StochasticModel.BlockedBootstrap) {
          <p class="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Bootstrap model is unavailable for custom tickers (no historical data).
          </p>
        }
      </section>

      <!-- Index Selection -->
      <section class="mb-10">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-100">Select Indices</h2>
          <button (click)="openCustomTickerDialog()" class="text-sm text-accent-600 dark:text-accent-400 font-medium hover:text-accent-700 dark:hover:text-accent-300 flex items-center">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
            Add Custom Ticker
          </button>
        </div>
        
        <div class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 shadow-soft dark:shadow-none">
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            @for (index of allAvailableIndices(); track index.symbol) {
              <label
                [class]="getIndexCheckboxClass(index.symbol)"
                class="flex items-center p-4 rounded-xl border cursor-pointer transition-all select-none"
              >
                <input
                  type="checkbox"
                  [checked]="isIndexSelected(index.symbol)"
                  (change)="toggleIndex(index)"
                  class="sr-only"
                >
                <div class="flex items-center space-x-3 w-full">
                  <span class="font-mono text-lg font-semibold" [class]="isIndexSelected(index.symbol) ? 'text-accent-600 dark:text-accent-400' : 'text-surface-600 dark:text-surface-300'">
                    {{ index.symbol }}
                  </span>
                  @if (isCustomTicker(index.symbol)) {
                    <span class="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Custom</span>
                  }
                  @if (isIndexSelected(index.symbol)) {
                    <svg class="w-5 h-5 text-accent-500 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                  }
                </div>
              </label>
            }
          </div>
        </div>
      </section>

      <!-- Parameter Configuration -->
      @if (selectedIndices().length > 0) {
        <section class="mb-10">
          <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">Model Parameters</h2>
          <div class="bg-white dark:bg-surface-800 overflow-hidden border border-surface-200 dark:border-surface-700 rounded-xl">
            <mat-tab-group animationDuration="0ms">
              @for (index of selectedIndices(); track index.symbol; let i = $index) {
                <mat-tab [label]="index.symbol">
                  <div class="p-6">
                    <div class="flex items-center justify-between mb-6">
                      <div>
                        <h3 class="font-medium text-surface-900 dark:text-surface-100 text-lg">{{ index.name }}</h3>
                        <p class="text-sm text-surface-500 dark:text-surface-400">{{ getModelName(selectedModelType()) }} parameters</p>
                      </div>
                    </div>
                    
                    @if (selectedModelType() === StochasticModel.Heston) {
                      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                          <label class="label dark:text-surface-300">Mean Reversion (κ)</label>
                          <input type="number" step="0.1" class="input dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100" [value]="getHestonParam(index, 'kappa')" (input)="updateHestonParam(i, 'kappa', $event)">
                        </div>
                        <div>
                          <label class="label dark:text-surface-300">Long-term Var (θ)</label>
                          <input type="number" step="0.01" class="input dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100" [value]="getHestonParam(index, 'theta')" (input)="updateHestonParam(i, 'theta', $event)">
                        </div>
                        <div>
                          <label class="label dark:text-surface-300">Vol of Vol (σ)</label>
                          <input type="number" step="0.1" class="input dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100" [value]="getHestonParam(index, 'sigma')" (input)="updateHestonParam(i, 'sigma', $event)">
                        </div>
                        <div>
                          <label class="label dark:text-surface-300">Correlation (ρ)</label>
                          <input type="number" step="0.1" min="-1" max="1" class="input dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100" [value]="getHestonParam(index, 'rho')" (input)="updateHestonParam(i, 'rho', $event)">
                        </div>
                        <div>
                          <label class="label dark:text-surface-300">Initial Var (v₀)</label>
                          <input type="number" step="0.01" class="input dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100" [value]="getHestonParam(index, 'v0')" (input)="updateHestonParam(i, 'v0', $event)">
                        </div>
                        <div>
                          <label class="label dark:text-surface-300">Initial Price (S₀)</label>
                          <input type="number" step="1" class="input dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100" [value]="getHestonParam(index, 's0')" (input)="updateHestonParam(i, 's0', $event)">
                        </div>
                        <div>
                          <label class="label dark:text-surface-300">Drift (μ)</label>
                          <input type="number" step="0.01" class="input dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100" [value]="getHestonParam(index, 'mu')" (input)="updateHestonParam(i, 'mu', $event)">
                        </div>
                      </div>
                    } @else if (selectedModelType() === StochasticModel.GBM) {
                      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                          <label class="label dark:text-surface-300">Drift (μ)</label>
                          <input type="number" step="0.01" class="input dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100" [value]="getGBMParam(index, 'mu')" (input)="updateGBMParam(i, 'mu', $event)">
                        </div>
                        <div>
                          <label class="label dark:text-surface-300">Volatility (σ)</label>
                          <input type="number" step="0.01" class="input dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100" [value]="getGBMParam(index, 'sigma')" (input)="updateGBMParam(i, 'sigma', $event)">
                        </div>
                        <div>
                          <label class="label dark:text-surface-300">Initial Price (S₀)</label>
                          <input type="number" step="1" class="input dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100" [value]="getGBMParam(index, 's0')" (input)="updateGBMParam(i, 's0', $event)">
                        </div>
                      </div>
                    } @else if (selectedModelType() === StochasticModel.GARCH) {
                      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                          <label class="label dark:text-surface-300">Constant (ω)</label>
                          <input type="number" step="0.000001" class="input dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100" [value]="getGARCHParam(index, 'omega')" (input)="updateGARCHParam(i, 'omega', $event)">
                        </div>
                        <div>
                          <label class="label dark:text-surface-300">ARCH (α)</label>
                          <input type="number" step="0.01" class="input dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100" [value]="getGARCHParam(index, 'alpha')" (input)="updateGARCHParam(i, 'alpha', $event)">
                        </div>
                        <div>
                          <label class="label dark:text-surface-300">GARCH (β)</label>
                          <input type="number" step="0.01" class="input dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100" [value]="getGARCHParam(index, 'beta')" (input)="updateGARCHParam(i, 'beta', $event)">
                        </div>
                        <div>
                          <label class="label dark:text-surface-300">Drift (μ)</label>
                          <input type="number" step="0.01" class="input dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100" [value]="getGARCHParam(index, 'mu')" (input)="updateGARCHParam(i, 'mu', $event)">
                        </div>
                        <div>
                          <label class="label dark:text-surface-300">Initial Vol</label>
                          <input type="number" step="0.01" class="input dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100" [value]="getGARCHParam(index, 'initialVol')" (input)="updateGARCHParam(i, 'initialVol', $event)">
                        </div>
                        <div>
                          <label class="label dark:text-surface-300">Initial Price (S₀)</label>
                          <input type="number" step="1" class="input dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100" [value]="getGARCHParam(index, 's0')" (input)="updateGARCHParam(i, 's0', $event)">
                        </div>
                      </div>
                    } @else if (selectedModelType() === StochasticModel.RegimeSwitching) {
                        <div class="space-y-6">
                            <!-- Regimes -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                @for (regime of getRegimes(index); track $index) {
                                    <div class="p-4 bg-surface-50 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-xl">
                                        <h4 class="font-semibold text-surface-900 dark:text-surface-100 mb-3">{{ regime.name || 'Regime ' + $index }}</h4>
                                        <div class="space-y-3">
                                            <div>
                                                <label class="text-xs font-medium text-surface-600 dark:text-surface-400 block mb-1">Drift (μ)</label>
                                                <input type="number" step="0.01" class="w-full text-sm p-2 rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100" [value]="regime.mu" (input)="updateRegimeParam(i, $index, 'mu', $event)">
                                            </div>
                                            <div>
                                                <label class="text-xs font-medium text-surface-600 dark:text-surface-400 block mb-1">Volatility (σ)</label>
                                                <input type="number" step="0.01" class="w-full text-sm p-2 rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100" [value]="regime.sigma" (input)="updateRegimeParam(i, $index, 'sigma', $event)">
                                            </div>
                                        </div>
                                    </div>
                                }
                            </div>
                            
                            <!-- Transition Matrix -->
                            <div>
                                <h4 class="font-medium text-surface-900 dark:text-surface-100 mb-2">Transition Matrix</h4>
                                <div class="overflow-x-auto">
                                    <table class="w-full text-sm">
                                        <thead>
                                            <tr>
                                                <th class="p-2 text-surface-600 dark:text-surface-400"></th>
                                                @for (regime of getRegimes(index); track $index) {
                                                    <th class="p-2 text-surface-600 dark:text-surface-400 font-medium">To {{ regime.name || 'R' + $index }}</th>
                                                }
                                            </tr>
                                        </thead>
                                        <tbody>
                                            @for (row of getRegimeIndices(index); track row) {
                                                <tr>
                                                    <td class="p-2 font-medium text-surface-600 dark:text-surface-400">From {{ getRegimes(index)[row].name || 'R' + row }}</td>
                                                    @for (col of getRegimeIndices(index); track col) {
                                                        <td class="p-1">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                max="1"
                                                                [value]="getTransitionMatrix(index)[row][col]"
                                                                (input)="updateTransitionParam(i, row, col, $event)"
                                                                class="w-20 h-10 text-center rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-sm font-mono text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
                                                            >
                                                        </td>
                                                    }
                                                </tr>
                                            }
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    } @else if (selectedModelType() === StochasticModel.BlockedBootstrap) {
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label class="label dark:text-surface-300">Block Size</label>
                                <input type="number" step="1" min="5" max="100" class="input dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100" [value]="getBootstrapParam(index, 'blockSize')" (input)="updateBootstrapParam(i, 'blockSize', $event)">
                                <p class="text-xs text-surface-500 dark:text-surface-400 mt-1">Number of consecutive days in each bootstrap block</p>
                            </div>
                        </div>
                    }
                  </div>
                </mat-tab>
              }
            </mat-tab-group>
          </div>
        </section>
      }

      <!-- Correlation Matrix -->
      @if (selectedIndices().length > 1) {
        <section>
          <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">Correlation Matrix</h2>
          <div class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 overflow-x-auto shadow-soft dark:shadow-none">
            <table class="w-full">
              <thead>
                <tr>
                  <th class="p-2"></th>
                  @for (idx of selectedIndices(); track idx.symbol) {
                    <th class="p-2 font-mono text-sm font-medium text-surface-600 dark:text-surface-400">{{ idx.symbol }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (rowIdx of selectedIndices(); track rowIdx.symbol; let i = $index) {
                  <tr>
                    <td class="p-2 font-mono text-sm font-medium text-surface-600 dark:text-surface-400">{{ rowIdx.symbol }}</td>
                    @for (colIdx of selectedIndices(); track colIdx.symbol; let j = $index) {
                      <td class="p-1">
                        <input
                          type="number"
                          step="0.05"
                          min="-1"
                          max="1"
                          [value]="getCorrelation(i, j)"
                          [disabled]="i === j"
                          (input)="updateCorrelation(i, j, $event)"
                          [class]="getCorrelationInputClass(i, j)"
                          class="w-20 h-10 text-center rounded-lg border text-sm font-mono focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
                        >
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
      
      <!-- Custom Ticker Dialog -->
      <dialog #customTickerDialog class="p-0 rounded-2xl shadow-xl backdrop:bg-black/50">
        <div class="w-[500px] bg-white dark:bg-surface-800 p-6">
            <h3 class="text-lg font-bold text-surface-900 dark:text-surface-100 mb-4">Add Custom Ticker</h3>
            <div class="space-y-4">
                <div>
                    <label class="label dark:text-surface-300">Symbol</label>
                    <input #tickerSymbol type="text" class="input dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100 uppercase font-mono" placeholder="e.g. MYASSET" maxlength="10">
                </div>
                <div>
                    <label class="label dark:text-surface-300">Name</label>
                    <input #tickerName type="text" class="input dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100" placeholder="e.g. Synthetic Asset">
                </div>
                <div class="flex justify-end space-x-3 mt-6">
                    <button (click)="customTickerDialog.close()" class="btn-secondary btn-md">Cancel</button>
                    <button (click)="addCustomTicker(tickerSymbol.value, tickerName.value); customTickerDialog.close()" class="btn-primary btn-md">Add</button>
                </div>
            </div>
        </div>
      </dialog>
    </div>
  `
})
export class ModelConfigComponent implements OnInit {
  private strategyService = inject(StrategyService);

  draft = input.required<StrategyDraft>();
  
  @Output() indicesChanged = new EventEmitter<Index[]>();
  @Output() parametersChanged = new EventEmitter<{ index: number; parameters: any }>();
  @Output() correlationChanged = new EventEmitter<{ row: number; col: number; value: number }>();
  @Output() tickersChanged = new EventEmitter<CustomTicker[]>();

  readonly StochasticModel = StochasticModel;
  readonly selectedModelType = signal<StochasticModel>(StochasticModel.Heston);

  models = [
    { id: StochasticModel.Heston, name: 'Heston', icon: '📈' },
    { id: StochasticModel.GBM, name: 'GBM', icon: '📊' },
    { id: StochasticModel.GARCH, name: 'GARCH', icon: '📉' },
    { id: StochasticModel.BlockedBootstrap, name: 'Bootstrap', icon: '🔄' },
    { id: StochasticModel.RegimeSwitching, name: 'Regime', icon: '🔀' },
  ];

  selectedIndices = computed(() => this.draft().indices || []);
  
  allAvailableIndices = computed(() => {
      const customIndices: Index[] = (this.draft().customTickers || []).map(t => ({
          symbol: t.symbol,
          name: t.name,
          model: this.selectedModelType(),
          parameters: this.getDefaultParams(this.selectedModelType())
      }));
      return [...AVAILABLE_INDICES, ...customIndices];
  });

  readonly hasCustomIndexSelected = computed(() => {
    const selected = this.selectedIndices();
    const customTickers = this.draft().customTickers || [];
    return selected.some(idx => customTickers.some(ct => ct.symbol === idx.symbol));
  });

  ngOnInit() {
    // FIX: Initialize the selected model from the draft to prevent resetting to default
    const existingIndices = this.draft().indices;
    if (existingIndices && existingIndices.length > 0) {
      this.selectedModelType.set(existingIndices[0].model);
    }
  }

  isCustomTicker(symbol: string): boolean {
    return (this.draft().customTickers || []).some(t => t.symbol === symbol);
  }

  isModelDisabled(modelId: StochasticModel): boolean {
    if (modelId === StochasticModel.BlockedBootstrap && this.hasCustomIndexSelected()) {
      return true;
    }
    return false;
  }

  getModelCardClass(modelId: StochasticModel): string {
    const isSelected = this.selectedModelType() === modelId;
    if (isSelected) {
      return 'ring-2 ring-accent-500 border-accent-200 dark:border-accent-700';
    }
    return 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600 hover:shadow-medium dark:hover:shadow-none';
  }

  getIndexCheckboxClass(symbol: string): string {
    const isSelected = this.isIndexSelected(symbol);
    if (isSelected) {
      return 'bg-accent-50 dark:bg-accent-900/30 border-accent-200 dark:border-accent-700';
    }
    return 'bg-white dark:bg-surface-700 border-surface-200 dark:border-surface-600 hover:border-surface-300 dark:hover:border-surface-500';
  }

  getCorrelationInputClass(row: number, col: number): string {
    if (row === col) {
      return 'bg-surface-100 dark:bg-surface-700 border-surface-200 dark:border-surface-600 text-surface-400 dark:text-surface-500 cursor-not-allowed';
    }
    return 'bg-white dark:bg-surface-700 border-surface-200 dark:border-surface-600 text-surface-900 dark:text-surface-100';
  }

  getModelName(model: StochasticModel): string {
    return this.models.find(m => m.id === model)?.name || 'Unknown';
  }

  selectModel(model: StochasticModel): void {
    if (this.isModelDisabled(model)) return;

    this.selectedModelType.set(model);
    
    const currentIndices = this.selectedIndices();
    const updatedWithDefaults = currentIndices.map(idx => ({
      ...idx,
      model,
      parameters: this.getDefaultParams(model),
    }));
    this.indicesChanged.emit(updatedWithDefaults);

    updatedWithDefaults.forEach((idx, i) => {
      this.fetchParameters(idx.symbol, model, i);
    });
  }

  isIndexSelected(symbol: string): boolean {
    return this.selectedIndices().some(i => i.symbol === symbol);
  }

  toggleIndex(index: Index): void {
    const current = this.selectedIndices();
    const existingIdx = current.findIndex(i => i.symbol === index.symbol);
    
    let newIndices: Index[] = [];

    if (existingIdx >= 0) {
      // Remove
      newIndices = current.filter(i => i.symbol !== index.symbol);
      this.indicesChanged.emit(newIndices);
    } else {
      // Add
      if (this.isCustomTicker(index.symbol) && this.selectedModelType() === StochasticModel.BlockedBootstrap) {
        this.selectModel(StochasticModel.Heston);
      }

      const newIndex: Index = {
        ...index,
        model: this.selectedModelType(),
        parameters: this.getDefaultParams(this.selectedModelType()),
      };
      
      newIndices = [...current, newIndex];
      this.indicesChanged.emit(newIndices);
      this.fetchParameters(newIndex.symbol, this.selectedModelType(), newIndices.length - 1);
    }

    // Update Correlations if we have enough assets
    if (newIndices.length > 1) {
      const symbols = newIndices.map(i => i.symbol);
      
      this.strategyService.getCorrelations(symbols).subscribe(updates => {
        if (updates.length > 0) {
          updates.forEach(u => this.correlationChanged.emit(u));
        }
      });
    }
  }

  private fetchParameters(symbol: string, model: StochasticModel, listIndex: number) {
    if (this.isCustomTicker(symbol)) return;

    this.strategyService.getModelParameters(symbol, model).subscribe(params => {
      this.parametersChanged.emit({
        index: listIndex,
        parameters: params
      });
    });
  }

  getDefaultParams(model: StochasticModel): any {
    switch (model) {
      case StochasticModel.Heston: return { ...DEFAULT_HESTON_PARAMS };
      case StochasticModel.GBM: return { ...DEFAULT_GBM_PARAMS };
      case StochasticModel.GARCH: return { ...DEFAULT_GARCH_PARAMS };
      case StochasticModel.BlockedBootstrap: return { blockSize: 20 };
      case StochasticModel.RegimeSwitching: return { 
          regimes: [
              { name: 'Low Vol', mu: 0.10, sigma: 0.12 },
              { name: 'High Vol', mu: -0.05, sigma: 0.25 }
          ],
          transitionMatrix: [[0.95, 0.05], [0.10, 0.90]]
      };
      default: return { ...DEFAULT_GBM_PARAMS };
    }
  }

  // --- HESTON HELPERS ---
  getHestonParam(index: Index, param: keyof HestonParameters): number {
    const params = index.parameters as HestonParameters;
    return params?.[param] ?? DEFAULT_HESTON_PARAMS[param];
  }

  updateHestonParam(indexPos: number, param: keyof HestonParameters, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (!isNaN(value)) {
      const current = this.selectedIndices()[indexPos].parameters as HestonParameters;
      this.parametersChanged.emit({
        index: indexPos,
        parameters: { ...current, [param]: value },
      });
    }
  }

  // --- GBM HELPERS ---
  getGBMParam(index: Index, param: keyof GBMParameters): number {
    const params = index.parameters as GBMParameters;
    return params?.[param] ?? DEFAULT_GBM_PARAMS[param];
  }

  updateGBMParam(indexPos: number, param: keyof GBMParameters, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (!isNaN(value)) {
      const current = this.selectedIndices()[indexPos].parameters as GBMParameters;
      this.parametersChanged.emit({
        index: indexPos,
        parameters: { ...current, [param]: value },
      });
    }
  }

  // --- GARCH HELPERS ---
  getGARCHParam(index: Index, param: keyof GARCHParameters): number {
    const params = index.parameters as GARCHParameters;
    return params?.[param] ?? DEFAULT_GARCH_PARAMS[param];
  }

  updateGARCHParam(indexPos: number, param: keyof GARCHParameters, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (!isNaN(value)) {
      const current = this.selectedIndices()[indexPos].parameters as GARCHParameters;
      this.parametersChanged.emit({
        index: indexPos,
        parameters: { ...current, [param]: value },
      });
    }
  }

  // --- BOOTSTRAP HELPERS ---
  getBootstrapParam(index: Index, param: keyof BlockedBootstrapParameters): number {
    const params = index.parameters as BlockedBootstrapParameters;
    return (params as any)?.[param] ?? 20;
  }

  updateBootstrapParam(indexPos: number, param: string, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (!isNaN(value)) {
      const current = this.selectedIndices()[indexPos].parameters;
      this.parametersChanged.emit({
        index: indexPos,
        parameters: { ...current, [param]: value },
      });
    }
  }

  // --- REGIME SWITCHING HELPERS ---
  getRegimes(index: Index): any[] {
    const params = index.parameters as RegimeSwitchingParameters;
    return params?.regimes || this.getDefaultParams(StochasticModel.RegimeSwitching).regimes;
  }

  getTransitionMatrix(index: Index): number[][] {
    const params = index.parameters as RegimeSwitchingParameters;
    return params?.transitionMatrix || this.getDefaultParams(StochasticModel.RegimeSwitching).transitionMatrix;
  }

  getRegimeIndices(index: Index): number[] {
    const n = this.getRegimes(index).length;
    return Array.from({ length: n }, (_, i) => i);
  }

  updateRegimeParam(indexPos: number, regimeIdx: number, param: string, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (isNaN(value)) return;

    const current = this.selectedIndices()[indexPos].parameters as RegimeSwitchingParameters;
    const newRegimes = [...current.regimes];
    newRegimes[regimeIdx] = { ...newRegimes[regimeIdx], [param]: value };

    this.parametersChanged.emit({
      index: indexPos,
      parameters: { ...current, regimes: newRegimes }
    });
  }

  updateTransitionParam(indexPos: number, row: number, col: number, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (isNaN(value)) return;

    const current = this.selectedIndices()[indexPos].parameters as RegimeSwitchingParameters;
    const newMatrix = current.transitionMatrix.map(r => [...r]);
    newMatrix[row][col] = value;

    this.parametersChanged.emit({
      index: indexPos,
      parameters: { ...current, transitionMatrix: newMatrix }
    });
  }

  // --- CORRELATION & GENERAL ---
  getCorrelation(row: number, col: number): number {
    if (row === col) return 1;
    return this.draft().correlationMatrix?.matrix?.[row]?.[col] ?? 0.5;
  }

  updateCorrelation(row: number, col: number, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (!isNaN(value) && value >= -1 && value <= 1) {
      this.correlationChanged.emit({ row, col, value });
    }
  }
  
  openCustomTickerDialog() {
      const dialog = document.querySelector('dialog');
      if (dialog) dialog.showModal();
  }
  
  addCustomTicker(symbol: string, name: string) {
      if (!symbol || !name) return;
      
      if (this.selectedModelType() === StochasticModel.BlockedBootstrap) {
        this.selectModel(StochasticModel.Heston);
      }

      const ticker: CustomTicker = {
          id: crypto.randomUUID(),
          symbol: symbol.toUpperCase(),
          name,
          model: this.selectedModelType(),
          parameters: this.getDefaultParams(this.selectedModelType()),
          createdAt: new Date()
      };
      
      const current = this.draft().customTickers || [];
      this.tickersChanged.emit([...current, ticker]);
  }
}