import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StrategyDraft, SimulationMode } from '@core/models';

@Component({
  selector: 'qs-mode-selection',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-5xl">
      <div class="mb-8">
        <h1 class="text-2xl lg:text-3xl font-bold text-surface-900 dark:text-surface-100 mb-2">
          Select Simulation Mode
        </h1>
        <p class="text-surface-600 dark:text-surface-400">
          Choose how you want to test your strategy.
        </p>
      </div>

      <div class="grid md:grid-cols-3 gap-6">
        <!-- Accumulation Mode -->
        <button
          (click)="selectMode(SimulationMode.Accumulation)"
          [class]="getModeCardClass(SimulationMode.Accumulation)"
          class="bg-white dark:bg-surface-800 rounded-2xl border p-8 text-left transition-all duration-200"
        >
          <div class="flex items-start justify-between mb-6">
            <div class="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            <div [class]="getRadioClass(SimulationMode.Accumulation)">
              @if (draft.mode === SimulationMode.Accumulation) {
                <div class="w-3 h-3 bg-accent-500 rounded-full"></div>
              }
            </div>
          </div>

          <h3 class="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-3">Accumulation</h3>
          <p class="text-surface-600 dark:text-surface-400 mb-6">
            Build wealth over time with regular contributions. Track your progress toward a target portfolio value.
          </p>

          <ul class="space-y-3">
            <li class="flex items-center text-sm text-surface-600 dark:text-surface-400">
              <svg class="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Initial lump sum investment
            </li>
            <li class="flex items-center text-sm text-surface-600 dark:text-surface-400">
              <svg class="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Regular monthly contributions
            </li>
            <li class="flex items-center text-sm text-surface-600 dark:text-surface-400">
              <svg class="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Monte Carlo distribution
            </li>
          </ul>
        </button>

        <!-- Retirement Mode -->
        <button
          (click)="selectMode(SimulationMode.Retirement)"
          [class]="getModeCardClass(SimulationMode.Retirement)"
          class="bg-white dark:bg-surface-800 rounded-2xl border p-8 text-left transition-all duration-200"
        >
          <div class="flex items-start justify-between mb-6">
            <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div [class]="getRadioClass(SimulationMode.Retirement)">
              @if (draft.mode === SimulationMode.Retirement) {
                <div class="w-3 h-3 bg-accent-500 rounded-full"></div>
              }
            </div>
          </div>

          <h3 class="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-3">Retirement</h3>
          <p class="text-surface-600 dark:text-surface-400 mb-6">
            Draw down from your portfolio in retirement. Analyze sustainability and longevity risk.
          </p>

          <ul class="space-y-3">
            <li class="flex items-center text-sm text-surface-600 dark:text-surface-400">
              <svg class="w-5 h-5 text-blue-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Starting portfolio value
            </li>
            <li class="flex items-center text-sm text-surface-600 dark:text-surface-400">
              <svg class="w-5 h-5 text-blue-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Monthly withdrawal amount
            </li>
            <li class="flex items-center text-sm text-surface-600 dark:text-surface-400">
              <svg class="w-5 h-5 text-blue-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Monte Carlo distribution
            </li>
          </ul>
        </button>

        <!-- Historic Backtest Mode -->
        <button
          (click)="selectMode(SimulationMode.Historic)"
          [class]="getModeCardClass(SimulationMode.Historic)"
          class="bg-white dark:bg-surface-800 rounded-2xl border p-8 text-left transition-all duration-200"
        >
          <div class="flex items-start justify-between mb-6">
            <div class="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div [class]="getRadioClass(SimulationMode.Historic)">
              @if (draft.mode === SimulationMode.Historic) {
                <div class="w-3 h-3 bg-accent-500 rounded-full"></div>
              }
            </div>
          </div>

          <h3 class="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-3">Historic Backtest</h3>
          <p class="text-surface-600 dark:text-surface-400 mb-6">
            Test against real market history. Analyze trade logs and benchmark performance.
          </p>

          <ul class="space-y-3">
            <li class="flex items-center text-sm text-surface-600 dark:text-surface-400">
              <svg class="w-5 h-5 text-amber-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Real historical data
            </li>
            <li class="flex items-center text-sm text-surface-600 dark:text-surface-400">
              <svg class="w-5 h-5 text-amber-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Detailed trade log
            </li>
            <li class="flex items-center text-sm text-surface-600 dark:text-surface-400">
              <svg class="w-5 h-5 text-amber-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Benchmark comparison
            </li>
          </ul>
        </button>
      </div>
    </div>
  `,
})
export class ModeSelectionComponent {
  @Input({ required: true }) draft!: StrategyDraft;
  @Output() modeSelected = new EventEmitter<SimulationMode>();

  readonly SimulationMode = SimulationMode;

  selectMode(mode: SimulationMode): void {
    this.modeSelected.emit(mode);
  }

  getModeCardClass(mode: SimulationMode): string {
    const isSelected = this.draft.mode === mode;
    if (isSelected) {
      return 'ring-2 ring-accent-500 border-accent-200 dark:border-accent-700 bg-accent-50/30 dark:bg-accent-900/20';
    }
    return 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600 hover:shadow-medium dark:hover:shadow-none';
  }

  getRadioClass(mode: SimulationMode): string {
    const base = 'w-6 h-6 rounded-full border-2 flex items-center justify-center';
    if (this.draft.mode === mode) {
      return `${base} border-accent-500 bg-white dark:bg-surface-700`;
    }
    return `${base} border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-700`;
  }
}
