import { Component, Input, Output, EventEmitter, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { 
  StrategyDraft, 
  SimulationMode,
  StochasticModel,
  Granularity,
  AccumulationScenario,
  RetirementScenario,
} from '@core/models';

@Component({
  selector: 'qs-review',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatInputModule,
    MatFormFieldModule,
  ],
  template: `
    <div class="max-w-4xl">
      <div class="mb-8">
        <h1 class="text-2xl lg:text-3xl font-bold text-surface-900 dark:text-surface-100 mb-2">
          Review & Run
        </h1>
        <p class="text-surface-600 dark:text-surface-400">
          Review your configuration and run the simulation.
        </p>
      </div>

      <!-- Strategy Name -->
      <div class="card p-6 mb-8 dark:bg-surface-800">
        <label class="block text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">Strategy Name</label>
        <mat-form-field appearance="outline" class="w-full">
          <input 
            matInput 
            [value]="draft.name || ''"
            (input)="onNameChange($event)"
            placeholder="e.g., Conservative Growth Portfolio"
            class="text-lg dark:text-surface-100"
          >
          <mat-hint class="dark:text-surface-400">Give your strategy a memorable name</mat-hint>
        </mat-form-field>
      </div>

      <!-- Summary Sections -->
      <div class="space-y-6">
        <!-- Mode & Scenario -->
        <div class="card overflow-hidden dark:bg-surface-800 dark:border-surface-700">
          <button 
            (click)="toggleSection('mode')"
            class="w-full flex items-center justify-between p-6 text-left hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
          >
            <div class="flex items-center space-x-4">
              <div class="w-10 h-10 bg-accent-100 dark:bg-accent-900/30 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-accent-600 dark:text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
              </div>
              <div>
                <h3 class="font-semibold text-surface-900 dark:text-surface-100">Mode & Scenario</h3>
                <p class="text-sm text-surface-500 dark:text-surface-400">{{ modeLabel() }} mode configured</p>
              </div>
            </div>
            <svg 
              class="w-5 h-5 text-surface-400 dark:text-surface-500 transition-transform"
              [class.rotate-180]="expandedSections().has('mode')"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          @if (expandedSections().has('mode')) {
            <div class="px-6 pb-6 border-t border-surface-100 dark:border-surface-700 pt-4">
              <dl class="grid grid-cols-2 gap-4">
                @if (draft.mode === SimulationMode.Accumulation) {
                  <div>
                    <dt class="text-sm text-surface-500 dark:text-surface-400">Initial Investment</dt>
                    <dd class="font-medium text-surface-900 dark:text-surface-200">\${{ formatNumber(accumulationScenario().initialLumpSum) }}</dd>
                  </div>
                  <div>
                    <dt class="text-sm text-surface-500 dark:text-surface-400">Monthly Contribution</dt>
                    <dd class="font-medium text-surface-900 dark:text-surface-200">\${{ formatNumber(accumulationScenario().monthlyContribution) }}</dd>
                  </div>
                  <div>
                    <dt class="text-sm text-surface-500 dark:text-surface-400">Target Wealth</dt>
                    <dd class="font-medium text-surface-900 dark:text-surface-200">\${{ formatNumber(accumulationScenario().targetWealth) }}</dd>
                  </div>
                  <div>
                    <dt class="text-sm text-surface-500 dark:text-surface-400">Timeline</dt>
                    <dd class="font-medium text-surface-900 dark:text-surface-200">{{ accumulationScenario().timelineYears }} years</dd>
                  </div>
                } @else {
                  <div>
                    <dt class="text-sm text-surface-500 dark:text-surface-400">Initial Portfolio</dt>
                    <dd class="font-medium text-surface-900 dark:text-surface-200">\${{ formatNumber(retirementScenario().initialPortfolio) }}</dd>
                  </div>
                  <div>
                    <dt class="text-sm text-surface-500 dark:text-surface-400">Monthly Withdrawal</dt>
                    <dd class="font-medium text-surface-900 dark:text-surface-200">\${{ formatNumber(retirementScenario().monthlyWithdrawal) }}</dd>
                  </div>
                  <div>
                    <dt class="text-sm text-surface-500 dark:text-surface-400">Inflation Rate</dt>
                    <dd class="font-medium text-surface-900 dark:text-surface-200">{{ (retirementScenario().inflationRate * 100).toFixed(1) }}%</dd>
                  </div>
                  <div>
                    <dt class="text-sm text-surface-500 dark:text-surface-400">Timeline</dt>
                    <dd class="font-medium text-surface-900 dark:text-surface-200">{{ retirementScenario().timelineYears }} years</dd>
                  </div>
                }
              </dl>
            </div>
          }
        </div>

        <!-- Model & Indices -->
        <div class="card overflow-hidden dark:bg-surface-800 dark:border-surface-700">
          <button 
            (click)="toggleSection('model')"
            class="w-full flex items-center justify-between p-6 text-left hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
          >
            <div class="flex items-center space-x-4">
              <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
                </svg>
              </div>
              <div>
                <h3 class="font-semibold text-surface-900 dark:text-surface-100">Model & Indices</h3>
                <p class="text-sm text-surface-500 dark:text-surface-400">{{ indicesCount() }} indices with {{ modelLabel() }} model</p>
              </div>
            </div>
            <svg 
              class="w-5 h-5 text-surface-400 dark:text-surface-500 transition-transform"
              [class.rotate-180]="expandedSections().has('model')"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          @if (expandedSections().has('model')) {
            <div class="px-6 pb-6 border-t border-surface-100 dark:border-surface-700 pt-4">
              <div class="flex flex-wrap gap-2 mb-4">
                @for (index of draft.indices || []; track index.symbol) {
                  <span class="px-3 py-1.5 bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 rounded-full text-sm font-medium font-mono">
                    {{ index.symbol }}
                  </span>
                }
              </div>
              @if (draft.customTickers && draft.customTickers.length > 0) {
                <p class="text-sm text-surface-500 dark:text-surface-400">
                  + {{ draft.customTickers.length }} custom ticker(s)
                </p>
              }
            </div>
          }
        </div>

        <!-- Simulation Settings -->
        <div class="card overflow-hidden dark:bg-surface-800 dark:border-surface-700">
          <button 
            (click)="toggleSection('simulation')"
            class="w-full flex items-center justify-between p-6 text-left hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
          >
            <div class="flex items-center space-x-4">
              <div class="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </div>
              <div>
                <h3 class="font-semibold text-surface-900 dark:text-surface-100">Simulation Settings</h3>
                <p class="text-sm text-surface-500 dark:text-surface-400">{{ formatNumber(draft.simulationConfig?.iterations || 10000) }} iterations, {{ granularityLabel() }}</p>
              </div>
            </div>
            <svg 
              class="w-5 h-5 text-surface-400 dark:text-surface-500 transition-transform"
              [class.rotate-180]="expandedSections().has('simulation')"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          @if (expandedSections().has('simulation')) {
            <div class="px-6 pb-6 border-t border-surface-100 dark:border-surface-700 pt-4">
              <dl class="grid grid-cols-3 gap-4">
                <div>
                  <dt class="text-sm text-surface-500 dark:text-surface-400">Iterations</dt>
                  <dd class="font-medium text-surface-900 dark:text-surface-200">{{ formatNumber(draft.simulationConfig?.iterations || 10000) }}</dd>
                </div>
                <div>
                  <dt class="text-sm text-surface-500 dark:text-surface-400">Granularity</dt>
                  <dd class="font-medium text-surface-900 dark:text-surface-200">{{ granularityLabel() }}</dd>
                </div>
                <div>
                  <dt class="text-sm text-surface-500 dark:text-surface-400">Risk-Free Rate</dt>
                  <dd class="font-medium text-surface-900 dark:text-surface-200">{{ ((draft.simulationConfig?.riskFreeRate || 0.04) * 100).toFixed(1) }}%</dd>
                </div>
              </dl>
            </div>
          }
        </div>

        <!-- DSL Code -->
        @if (draft.dsl?.code) {
          <div class="card overflow-hidden dark:bg-surface-800 dark:border-surface-700">
            <button 
              (click)="toggleSection('dsl')"
              class="w-full flex items-center justify-between p-6 text-left hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
            >
              <div class="flex items-center space-x-4">
                <div class="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                  <svg class="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                  </svg>
                </div>
                <div>
                  <h3 class="font-semibold text-surface-900 dark:text-surface-100">Strategy DSL</h3>
                  <p class="text-sm text-surface-500 dark:text-surface-400">{{ dslLineCount() }} lines of code</p>
                </div>
              </div>
              <svg 
                class="w-5 h-5 text-surface-400 dark:text-surface-500 transition-transform"
                [class.rotate-180]="expandedSections().has('dsl')"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            @if (expandedSections().has('dsl')) {
              <div class="px-6 pb-6 border-t border-surface-100 dark:border-surface-700 pt-4">
                <pre class="bg-surface-900 dark:bg-surface-950 text-surface-100 p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-48 border border-surface-700"><code>{{ draft.dsl?.code }}</code></pre>
              </div>
            }
          </div>
        }
      </div>

      <!-- Estimated Time -->
      <div class="mt-8 p-6 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <div class="w-12 h-12 bg-primary-100 dark:bg-primary-900/50 rounded-xl flex items-center justify-center">
              <svg class="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div>
              <p class="font-medium text-primary-900 dark:text-primary-100">Estimated Simulation Time</p>
              <p class="text-2xl font-bold text-primary-600 dark:text-primary-400">{{ estimatedTime() }}</p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-sm text-primary-700 dark:text-primary-300">{{ formatNumber(draft.simulationConfig?.iterations || 10000) }} iterations</p>
            <p class="text-sm text-primary-700 dark:text-primary-300">{{ granularityLabel() }} granularity</p>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ReviewComponent {
  @Input({ required: true }) draft!: StrategyDraft;
  @Output() nameChanged = new EventEmitter<string>();

  readonly SimulationMode = SimulationMode;

  private _expandedSections = new Set<string>(['mode', 'model', 'simulation']);
  readonly expandedSections = () => this._expandedSections;

  toggleSection(section: string): void {
    if (this._expandedSections.has(section)) {
      this._expandedSections.delete(section);
    } else {
      this._expandedSections.add(section);
    }
  }

  onNameChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.nameChanged.emit(value);
  }

  modeLabel = () => this.draft.mode === SimulationMode.Accumulation ? 'Accumulation' : 'Retirement';

  modelLabel = () => {
    const model = this.draft.indices?.[0]?.model;
    const labels: Record<StochasticModel, string> = {
      [StochasticModel.Heston]: 'Heston',
      [StochasticModel.GBM]: 'GBM',
      [StochasticModel.GARCH]: 'GARCH',
      [StochasticModel.BlockedBootstrap]: 'Bootstrap',
      [StochasticModel.RegimeSwitching]: 'Regime',
    };
    return model ? labels[model] : 'None';
  };

  granularityLabel = () => {
    const granularity = this.draft.simulationConfig?.granularity;
    const labels: Record<Granularity, string> = {
      [Granularity.Daily]: 'Daily',
      [Granularity.Weekly]: 'Weekly',
      [Granularity.Monthly]: 'Monthly',
    };
    return granularity ? labels[granularity] : 'Weekly';
  };

  indicesCount = () => (this.draft.indices?.length || 0);
  dslLineCount = () => (this.draft.dsl?.code?.split('\n').length || 0);

  accumulationScenario = () => (this.draft.scenario as AccumulationScenario) || { initialLumpSum: 0, monthlyContribution: 0, targetWealth: 0, timelineYears: 0 };
  retirementScenario = () => (this.draft.scenario as RetirementScenario) || { initialPortfolio: 0, monthlyWithdrawal: 0, inflationRate: 0, timelineYears: 0 };

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  estimatedTime = () => {
    const iterations = this.draft.simulationConfig?.iterations || 10000;
    const granularity = this.draft.simulationConfig?.granularity || Granularity.Weekly;
    
    const baseTime = iterations * 0.001;
    const multiplier = granularity === Granularity.Daily ? 5 : granularity === Granularity.Weekly ? 1 : 0.25;
    const totalMs = baseTime * multiplier;
    
    if (totalMs < 1000) return '< 1 second';
    if (totalMs < 60000) return `~${Math.round(totalMs / 1000)} seconds`;
    return `~${Math.round(totalMs / 60000)} minutes`;
  };
}
