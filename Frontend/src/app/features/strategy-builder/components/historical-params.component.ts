import { Component, Input, Output, EventEmitter, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { StrategyDraft, HistoricScenario, DEFAULT_HISTORIC_SCENARIO } from '@core/models';
import { StrategyService } from '@core/services/strategy.service';

@Component({
  selector: 'qs-historical-params',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="max-w-4xl">
      <div class="mb-8">
        <h1 class="text-2xl lg:text-3xl font-bold text-surface-900 dark:text-surface-100 mb-2">
          Simulation Parameters
        </h1>
        <p class="text-surface-600 dark:text-surface-400">
          Configure your backtest parameters including initial capital, contributions, and benchmark.
        </p>
      </div>

      <!-- Initial Capital -->
      <div class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 mb-6">
        <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">Initial Capital</h3>
        <p class="text-sm text-surface-500 dark:text-surface-400 mb-4">
          The starting amount of money in your portfolio at the beginning of the backtest.
        </p>

        <div class="relative max-w-xs">
          <span class="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 font-medium">$</span>
          <input
            type="number"
            [ngModel]="scenario()?.initialCapital || 100000"
            (ngModelChange)="onInitialCapitalChange($event)"
            min="0"
            step="1000"
            class="w-full pl-8 pr-4 py-3 bg-surface-50 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg text-surface-900 dark:text-surface-100 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
          />
        </div>
      </div>

      <!-- Monthly Contribution -->
      <div class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 mb-6">
        <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">Monthly Contribution</h3>
        <p class="text-sm text-surface-500 dark:text-surface-400 mb-4">
          Amount to add to your portfolio each month during the backtest period. Set to 0 for no contributions.
        </p>

        <div class="relative max-w-xs">
          <span class="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 font-medium">$</span>
          <input
            type="number"
            [ngModel]="scenario()?.monthlyContribution || 0"
            (ngModelChange)="onMonthlyContributionChange($event)"
            min="0"
            step="100"
            class="w-full pl-8 pr-4 py-3 bg-surface-50 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg text-surface-900 dark:text-surface-100 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
          />
        </div>

        @if ((scenario()?.monthlyContribution || 0) > 0) {
          <div class="mt-4 p-4 bg-accent-50 dark:bg-accent-900/20 rounded-xl">
            <p class="text-sm text-accent-700 dark:text-accent-300">
              Total contributions over backtest period:
              <strong class="font-semibold">\${{ calculateTotalContributions() | number:'1.0-0' }}</strong>
            </p>
          </div>
        }
      </div>

      <!-- Benchmark Selection -->
      <div class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 mb-6">
        <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">Benchmark</h3>
        <p class="text-sm text-surface-500 dark:text-surface-400 mb-4">
          Select a benchmark index to compare your strategy's performance against.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          @for (benchmark of benchmarks; track benchmark.ticker) {
            <button
              (click)="onBenchmarkChange(benchmark.ticker)"
              [class]="getBenchmarkClass(benchmark.ticker)"
              class="p-4 rounded-xl border-2 transition-all duration-200 text-left"
            >
              <div class="font-mono font-bold text-lg">{{ benchmark.ticker | uppercase }}</div>
              <div class="text-sm text-surface-500 dark:text-surface-400">{{ benchmark.name }}</div>
            </button>
          }
        </div>
      </div>

      <!-- Summary -->
      <div class="bg-gradient-to-r from-accent-50 to-accent-100 dark:from-accent-900/30 dark:to-accent-800/30 rounded-2xl border border-accent-200 dark:border-accent-700 p-6">
        <h3 class="text-lg font-semibold text-accent-900 dark:text-accent-100 mb-4 flex items-center gap-2">
          <mat-icon class="text-accent-500">summarize</mat-icon>
          Configuration Summary
        </h3>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p class="text-xs text-accent-600 dark:text-accent-400 uppercase tracking-wide mb-1">Initial Capital</p>
            <p class="text-lg font-semibold text-accent-900 dark:text-accent-100">\${{ scenario()?.initialCapital | number:'1.0-0' }}</p>
          </div>
          <div>
            <p class="text-xs text-accent-600 dark:text-accent-400 uppercase tracking-wide mb-1">Monthly</p>
            <p class="text-lg font-semibold text-accent-900 dark:text-accent-100">\${{ scenario()?.monthlyContribution | number:'1.0-0' }}</p>
          </div>
          <div>
            <p class="text-xs text-accent-600 dark:text-accent-400 uppercase tracking-wide mb-1">Benchmark</p>
            <p class="text-lg font-semibold text-accent-900 dark:text-accent-100 font-mono">{{ (scenario()?.benchmarkTicker || 'SPY') | uppercase }}</p>
          </div>
          <div>
            <p class="text-xs text-accent-600 dark:text-accent-400 uppercase tracking-wide mb-1">Period</p>
            <p class="text-lg font-semibold text-accent-900 dark:text-accent-100">{{ calculateYears() }} years</p>
          </div>
        </div>
      </div>
    </div>
  `
})
export class HistoricalParamsComponent implements OnInit {
  @Input({ required: true }) draft!: StrategyDraft;
  @Output() scenarioChanged = new EventEmitter<HistoricScenario>();

  private strategyService = inject(StrategyService);

  readonly benchmarks = [
    { ticker: 'spy', name: 'S&P 500' },
    { ticker: 'qqq', name: 'Nasdaq 100' },
    { ticker: 'iwm', name: 'Russell 2000' },
    { ticker: 'dia', name: 'Dow Jones' },
    { ticker: 'gld', name: 'Gold' },
    { ticker: 'agg', name: 'US Aggregate Bond' },
  ];

  private localScenario = signal<HistoricScenario | null>(null);

  readonly scenario = computed(() =>
    this.localScenario() || (this.draft.scenario as HistoricScenario | undefined)
  );

  ngOnInit() {
    const existingScenario = this.draft.scenario as HistoricScenario | undefined;
    if (existingScenario) {
      this.localScenario.set(existingScenario);
    } else {
      this.localScenario.set(DEFAULT_HISTORIC_SCENARIO);
      this.scenarioChanged.emit(DEFAULT_HISTORIC_SCENARIO);
    }
  }

  onInitialCapitalChange(value: number) {
    const current = this.scenario() || DEFAULT_HISTORIC_SCENARIO;
    this.emitScenario({ ...current, initialCapital: value || 0 });
  }

  onMonthlyContributionChange(value: number) {
    const current = this.scenario() || DEFAULT_HISTORIC_SCENARIO;
    this.emitScenario({ ...current, monthlyContribution: value || 0 });
  }

  onBenchmarkChange(ticker: string) {
    const current = this.scenario() || DEFAULT_HISTORIC_SCENARIO;
    this.emitScenario({ ...current, benchmarkTicker: ticker });
  }

  getBenchmarkClass(ticker: string): string {
    const isSelected = (this.scenario()?.benchmarkTicker || 'spy') === ticker;
    if (isSelected) {
      return 'border-accent-500 bg-accent-50 dark:bg-accent-900/30';
    }
    return 'border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 hover:border-accent-300 dark:hover:border-accent-600';
  }

  calculateTotalContributions(): number {
    const s = this.scenario();
    if (!s?.startDate || !s?.endDate) return 0;

    const start = new Date(s.startDate);
    const end = new Date(s.endDate);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return months * (s.monthlyContribution || 0);
  }

  calculateYears(): string {
    const s = this.scenario();
    if (!s?.startDate || !s?.endDate) return '0';

    const start = new Date(s.startDate);
    const end = new Date(s.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return (diffDays / 365).toFixed(1);
  }

  private emitScenario(s: HistoricScenario) {
    this.localScenario.set(s);
    this.scenarioChanged.emit(s);
  }
}
