import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ChartConfiguration, ChartData } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { HeaderComponent } from '@shared/components/header/header.component';
import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { CompactCurrencyPipe } from '@shared/pipes/compact-currency.pipe';
import { SimulationService } from '@core/services/simulation.service';
import { ThemeService } from '@core/services/theme.service';
import { SimulationResults } from '@core/models';
import { SimulationMode } from '@core/models/strategy.model';

@Component({
  selector: 'qs-results',
  standalone: true,
  imports: [
    CommonModule, RouterLink, DatePipe, DecimalPipe, 
    NgChartsModule, HeaderComponent, LoadingSpinnerComponent, CompactCurrencyPipe
  ],
  template: `
    <qs-header />
    
    <div class="pt-[72px] min-h-screen bg-surface-50 dark:bg-surface-900 transition-colors duration-300">
      @if (loading()) {
        <div class="flex items-center justify-center min-h-[calc(100vh-72px)]">
          <qs-loading-spinner size="lg" message="Loading results..." />
        </div>
      } @else if (results()) {
        <div class="flex">
          <!-- Left Sidebar (Strategy Info) -->
          <aside class="hidden lg:block w-[320px] flex-shrink-0 border-r border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 min-h-[calc(100vh-72px)] p-6 overflow-y-auto fixed left-0 top-[72px] bottom-0 transition-colors duration-300">
            <h2 class="text-xl font-bold text-surface-900 dark:text-surface-100 mb-1">{{ results()!.strategyName }}</h2>
            
            <div class="space-y-3 mt-4 mb-6">
                <div class="flex items-center space-x-3 text-sm">
                    <svg class="w-4 h-4 text-surface-400 dark:text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                    </svg>
                    <span class="text-surface-600 dark:text-surface-400">{{ results()!.metadata.model }} Model</span>
                </div>
                <div class="flex items-center space-x-3 text-sm">
                    <svg class="w-4 h-4 text-surface-400 dark:text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                    </svg>
                    <span class="text-surface-600 dark:text-surface-400">{{ results()!.metadata.indices.join(', ') }}</span>
                </div>
                <div class="flex items-center space-x-3 text-sm">
                    <svg class="w-4 h-4 text-surface-400 dark:text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    <span class="text-surface-600 dark:text-surface-400">{{ results()!.metadata.mode }} Mode</span>
                </div>
            </div>

            <!-- Quick Stats -->
            <div class="space-y-4 mb-6">
                <!-- Success / Survival Rate -->
                <div class="bg-gradient-to-r from-green-50 to-accent-50 dark:from-green-900/20 dark:to-accent-900/20 rounded-xl p-5 border border-green-200 dark:border-green-800">
                    @if (isRetirement()) {
                        <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">Probability of Survival</p>
                        <p class="text-4xl font-bold text-green-600 dark:text-green-400">{{ (1 - probabilityOfRuin()) * 100 | number:'1.1-1' }}%</p>
                        <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">never ran out of money</p>
                    } @else {
                        <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">Probability of Success</p>
                        <p class="text-4xl font-bold text-green-600 dark:text-green-400">{{ (results()!.successProbability * 100) | number:'1.1-1' }}%</p>
                        <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">of reaching target</p>
                    }
                </div>

                <!-- Median Wealth / Legacy -->
                <div class="bg-surface-50 dark:bg-surface-700/50 rounded-xl p-5 border border-surface-200 dark:border-surface-600">
                    <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">
                        {{ isRetirement() ? 'Median Legacy' : 'Median Terminal Wealth' }}
                    </p>
                    <p class="text-2xl font-bold text-surface-900 dark:text-surface-100">{{ results()!.terminalWealthStats.median | compactCurrency:0 }}</p>
                    <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">50th percentile</p>
                </div>

                <!-- Drawdown / Ruin -->
                <div class="bg-surface-50 dark:bg-surface-700/50 rounded-xl p-5 border border-surface-200 dark:border-surface-600">
                    @if (isRetirement()) {
                        <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">Probability of Ruin</p>
                        <p class="text-2xl font-bold text-red-600 dark:text-red-400">{{ (probabilityOfRuin() * 100) | number:'1.1-1' }}%</p>
                        <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">ran out of money</p>
                    } @else {
                        <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">Maximum Drawdown</p>
                        <p class="text-2xl font-bold text-red-600 dark:text-red-400">{{ (results()!.riskMetrics.maxDrawdown.median * 100) | number:'1.1-1' }}%</p>
                        <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">median worst case</p>
                    }
                </div>
            </div>

            <div class="space-y-3">
                <a [routerLink]="['/build']" [queryParams]="{edit: results()!.strategyId}" class="flex items-center justify-center space-x-2 w-full px-4 py-3 border border-surface-200 dark:border-surface-600 text-surface-700 dark:text-surface-300 font-medium rounded-xl hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                    <span>Edit & Re-run</span>
                </a>
            </div>
          </aside>

          <!-- Main Content Area -->
          <main class="flex-1 lg:ml-[320px] p-6 lg:p-10 transition-all duration-300">
            <div class="mb-8">
                <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-100">
                    {{ isRetirement() ? 'Retirement Analysis' : 'Simulation Results' }}
                </h1>
            </div>

            <div class="grid gap-6">
                <!-- Wealth Distribution -->
                <div class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 shadow-soft dark:shadow-none transition-colors duration-300">
                    <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-6">
                        {{ isRetirement() ? 'Legacy Outcomes (Terminal Wealth)' : 'Terminal Wealth Outcomes' }}
                    </h3>
                    <div class="chart-container">
                        <canvas baseChart [data]="wealthDistributionData()" [options]="histogramOptions()" type="bar"></canvas>
                    </div>
                    <!-- Deciles -->
                    <div class="mt-6 pt-6 border-t border-surface-100 dark:border-surface-700">
                        <div class="flex justify-between items-end">
                            <div class="text-center">
                                <p class="text-xs text-surface-400 dark:text-surface-500">P10 (Bear)</p>
                                <p class="text-sm font-semibold text-red-600 dark:text-red-400">{{ results()!.terminalWealthStats.percentiles.p10 | compactCurrency:0 }}</p>
                            </div>
                            <div class="text-center">
                                <p class="text-xs text-surface-400 dark:text-surface-500">P25</p>
                                <p class="text-sm font-semibold text-amber-600 dark:text-amber-400">{{ results()!.terminalWealthStats.percentiles.p25 | compactCurrency:0 }}</p>
                            </div>
                            <div class="text-center">
                                <p class="text-xs text-surface-400 dark:text-surface-500">P50 (Median)</p>
                                <p class="text-sm font-semibold text-surface-900 dark:text-surface-100 text-base">{{ results()!.terminalWealthStats.percentiles.p50 | compactCurrency:0 }}</p>
                            </div>
                            <div class="text-center">
                                <p class="text-xs text-surface-400 dark:text-surface-500">P75</p>
                                <p class="text-sm font-semibold text-green-600 dark:text-green-400">{{ results()!.terminalWealthStats.percentiles.p75 | compactCurrency:0 }}</p>
                            </div>
                            <div class="text-center">
                                <p class="text-xs text-surface-400 dark:text-surface-500">P90 (Bull)</p>
                                <p class="text-sm font-semibold text-green-700 dark:text-green-500">{{ results()!.terminalWealthStats.percentiles.p90 | compactCurrency:0 }}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Two Column Grid -->
                <div class="grid md:grid-cols-2 gap-6">
                    <!-- Time to Target (Only for Accumulation) -->
                    @if (!isRetirement()) {
                        <div class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 transition-colors duration-300">
                            <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-6">Time to Reach Goal</h3>
                            
                            @if (results()!.timeToTargetStats && results()!.timeToTargetStats!.median > 0) {
                                <div class="chart-container">
                                    <canvas baseChart [data]="timeToTargetData()" [options]="histogramOptions()" type="bar"></canvas>
                                </div>
                                <div class="mt-4 grid grid-cols-2 gap-4 text-center">
                                    <div class="bg-surface-50 dark:bg-surface-700/50 rounded-lg p-3">
                                        <p class="text-sm text-surface-500 dark:text-surface-400">Median Time</p>
                                        <p class="text-xl font-bold text-surface-900 dark:text-surface-100">{{ results()!.timeToTargetStats!.median | number:'1.1-1' }} years</p>
                                    </div>
                                    <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                                        <p class="text-sm text-surface-500 dark:text-surface-400">Success Rate</p>
                                        <p class="text-xl font-bold text-green-600 dark:text-green-400">{{ (results()!.successProbability * 100) | number:'1.1-1' }}%</p>
                                    </div>
                                </div>
                            } @else {
                                <div class="flex flex-col justify-center items-center text-center h-48">
                                    <div class="w-12 h-12 bg-surface-100 dark:bg-surface-700 rounded-full flex items-center justify-center mb-4">
                                        <svg class="w-6 h-6 text-surface-400 dark:text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                    </div>
                                    <p class="text-surface-500 dark:text-surface-400 text-sm">Target wealth not reached in sufficient simulations.</p>
                                </div>
                            }
                        </div>
                    }

                    <!-- Risk Metrics -->
                    <div class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 transition-colors duration-300" [class.col-span-2]="isRetirement()">
                        <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-6">Risk Analysis</h3>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div class="p-4 bg-surface-50 dark:bg-surface-700/50 rounded-xl">
                                <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">Sharpe Ratio</p>
                                <p class="text-2xl font-bold text-surface-900 dark:text-surface-100">{{ results()!.riskMetrics.sharpeRatio.median | number:'1.2-2' }}</p>
                            </div>
                            <div class="p-4 bg-surface-50 dark:bg-surface-700/50 rounded-xl">
                                <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">Sortino Ratio</p>
                                <p class="text-2xl font-bold text-surface-900 dark:text-surface-100">{{ results()!.riskMetrics.sortinoRatio.median | number:'1.2-2' }}</p>
                            </div>
                            <div class="p-4 bg-surface-50 dark:bg-surface-700/50 rounded-xl">
                                <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">Ann. Volatility</p>
                                <p class="text-2xl font-bold text-surface-900 dark:text-surface-100">{{ (results()!.riskMetrics.annualizedVolatility.median * 100) | number:'1.1-1' }}%</p>
                            </div>
                            <div class="p-4 bg-surface-50 dark:bg-surface-700/50 rounded-xl">
                                <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">Avg Max DD</p>
                                <p class="text-2xl font-bold text-red-600 dark:text-red-400">{{ (results()!.riskMetrics.maxDrawdown.median * 100) | number:'1.1-1' }}%</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Drawdown Frequency -->
                <div class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 transition-colors duration-300">
                    <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-6">Drawdown Frequency</h3>
                    <p class="text-sm text-surface-500 dark:text-surface-400 mb-4">Percentage of simulations that experienced a drawdown of at least X%.</p>
                    <div class="h-64">
                        <canvas baseChart [data]="drawdownFrequencyData()" [options]="horizontalBarOptions()" type="bar"></canvas>
                    </div>
                </div>

                <!-- Sample Paths -->
                <div class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 transition-colors duration-300">
                    <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-6">Sample Portfolio Paths</h3>
                    <p class="text-sm text-surface-500 dark:text-surface-400 mb-4">Representative equity curves from the simulation (Bear case to Bull case).</p>
                    <div class="chart-container" style="height: 350px;">
                        <canvas baseChart [data]="samplePathsData()" [options]="lineChartOptions()" type="line"></canvas>
                    </div>
                </div>

                <!-- Detailed Stats Table -->
                <div class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 transition-colors duration-300">
                    <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-6">Detailed Statistics</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead>
                                <tr class="border-b border-surface-200 dark:border-surface-700">
                                    <th class="text-left py-3 px-4 text-sm font-semibold text-surface-700 dark:text-surface-300">Metric</th>
                                    <th class="text-right py-3 px-4 text-sm font-semibold text-surface-700 dark:text-surface-300">P10 (Bear)</th>
                                    <th class="text-right py-3 px-4 text-sm font-semibold text-surface-700 dark:text-surface-300">P50 (Median)</th>
                                    <th class="text-right py-3 px-4 text-sm font-semibold text-surface-700 dark:text-surface-300">P90 (Bull)</th>
                                    <th class="text-right py-3 px-4 text-sm font-semibold text-surface-700 dark:text-surface-300">Mean</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr class="border-b border-surface-100 dark:border-surface-700">
                                    <td class="py-3 px-4 text-sm text-surface-900 dark:text-surface-100 font-medium">Terminal Wealth</td>
                                    <td class="py-3 px-4 text-sm text-surface-600 dark:text-surface-400 text-right">{{ results()!.terminalWealthStats.percentiles.p10 | compactCurrency:0 }}</td>
                                    <td class="py-3 px-4 text-sm text-surface-900 dark:text-surface-100 text-right font-semibold bg-accent-50 dark:bg-accent-900/20">{{ results()!.terminalWealthStats.percentiles.p50 | compactCurrency:0 }}</td>
                                    <td class="py-3 px-4 text-sm text-surface-600 dark:text-surface-400 text-right">{{ results()!.terminalWealthStats.percentiles.p90 | compactCurrency:0 }}</td>
                                    <td class="py-3 px-4 text-sm text-surface-600 dark:text-surface-400 text-right">{{ results()!.terminalWealthStats.mean | compactCurrency:0 }}</td>
                                </tr>
                                <tr class="border-b border-surface-100 dark:border-surface-700">
                                    <td class="py-3 px-4 text-sm text-surface-900 dark:text-surface-100 font-medium">Max Drawdown</td>
                                    <td class="py-3 px-4 text-sm text-surface-600 dark:text-surface-400 text-right">-</td>
                                    <td class="py-3 px-4 text-sm text-surface-900 dark:text-surface-100 text-right font-semibold bg-accent-50 dark:bg-accent-900/20">{{ (results()!.riskMetrics.maxDrawdown.median * 100) | number:'1.1-1' }}%</td>
                                    <td class="py-3 px-4 text-sm text-surface-600 dark:text-surface-400 text-right">-</td>
                                    <td class="py-3 px-4 text-sm text-surface-600 dark:text-surface-400 text-right">{{ (results()!.drawdownAnalysis.averageDrawdown * 100) | number:'1.1-1' }}%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
          </main>
        </div>
      }
    </div>
  `
})
export class ResultsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly simulationService = inject(SimulationService);
  private readonly themeService = inject(ThemeService);
  
  readonly loading = signal(true);
  readonly results = signal<SimulationResults | null>(null);
  
  readonly isRetirement = computed(() => this.results()?.metadata.mode === SimulationMode.Retirement);
  
  // FIX: Map directly to ruinProbability from backend response (mapped in service)
  readonly probabilityOfRuin = computed(() => this.results()?.ruinProbability || 0);

  private readonly gridColor = computed(() => this.themeService.isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)');
  private readonly textColor = computed(() => this.themeService.isDark() ? '#94A3B8' : '#64748B');

  readonly histogramOptions = computed<ChartConfiguration['options']>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { 
        grid: { display: false },
        ticks: { color: this.textColor() }
      },
      y: { 
        grid: { color: this.gridColor() }, 
        beginAtZero: true,
        ticks: { color: this.textColor() }
      }
    }
  }));

  readonly lineChartOptions = computed<ChartConfiguration['options']>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
        legend: { 
            position: 'bottom',
            labels: { color: this.textColor() }
        } 
    },
    scales: {
      x: { 
        grid: { display: false },
        ticks: { color: this.textColor() }
      },
      y: { 
        grid: { color: this.gridColor() },
        ticks: { color: this.textColor() }
      }
    },
    elements: {
      point: { radius: 0 } 
    }
  }));

  readonly horizontalBarOptions = computed<ChartConfiguration['options']>(() => ({
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { 
        grid: { color: this.gridColor() }, 
        max: 100,
        ticks: { color: this.textColor() }
      },
      y: { 
        grid: { display: false },
        ticks: { color: this.textColor() }
      }
    }
  }));

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    
    if (id) {
      const isStrategyId = !isNaN(Number(id));

      if (isStrategyId) {
        this.simulationService.loadResultsForStrategy(id).subscribe({
          next: (res) => {
            this.results.set(res);
            this.loading.set(false);
          },
          error: (err) => {
            console.error('Failed to load strategy results:', err);
            this.loading.set(false);
          }
        });
      } else {
        this.simulationService.loadResults(id).subscribe({
          next: (res) => {
            this.results.set(res);
            this.loading.set(false);
          },
          error: (err) => {
            console.error('Failed to load result by ID:', err);
            this.loading.set(false);
          }
        });
      }
    } else {
      this.loading.set(false);
    }
  }

  wealthDistributionData = computed((): ChartData<'bar'> => {
    const res = this.results();
    if (!res) return { labels: [], datasets: [] };

    const p = res.terminalWealthStats.percentiles;

    return {
      labels: ['P10 (Bear)', 'P25', 'P50 (Median)', 'P75', 'P90 (Bull)'],
      datasets: [{ 
        data: [p.p10, p.p25, p.p50, p.p75, p.p90], 
        backgroundColor: [
          '#EF4444', // Red (P10)
          '#F59E0B', // Amber (P25)
          '#64748B', // Slate (P50) - consider adjusting for dark mode if needed
          '#10B981', // Emerald (P75)
          '#3B82F6'  // Blue (P90)
        ], 
        borderRadius: 4,
        label: this.isRetirement() ? 'Legacy' : 'Terminal Wealth'
      }]
    };
  });

  timeToTargetData = computed((): ChartData<'bar'> => {
    const res = this.results();
    if (!res || !res.timeToTargetStats) return { labels: [], datasets: [] };

    const p = res.timeToTargetStats.percentiles;

    return {
      labels: ['Fastest (P10)', 'Fast (P25)', 'Median (P50)', 'Slow (P75)', 'Slowest (P90)'],
      datasets: [{ 
          data: [p.p10, p.p25, p.p50, p.p75, p.p90], 
          backgroundColor: '#3B82F6',
          borderRadius: 4,
          label: 'Years to Goal'
      }]
    };
  });

  drawdownFrequencyData = computed((): ChartData<'bar'> => {
    const res = this.results();
    if (!res) return { labels: [], datasets: [] };

    return {
      labels: res.drawdownAnalysis.frequencies.map(f => f.label),
      datasets: [{ 
          data: res.drawdownAnalysis.frequencies.map(f => f.frequency * 100), 
          backgroundColor: ['#FBBF24', '#F59E0B', '#F97316', '#EF4444', '#DC2626'],
          borderRadius: 4 
      }]
    };
  });

  samplePathsData = computed((): ChartData<'line'> => {
    const res = this.results();
    if (!res) return { labels: [], datasets: [] };

    const timestamps = res.samplePaths.p50.timestamps;
    const labels = timestamps.map((t, i) => {
        if (i % 252 === 0) return new Date(t).getFullYear().toString(); 
        return '';
    });

    return {
      labels: labels,
      datasets: [
          { label: 'P10 (Bear)', data: res.samplePaths.p10.values, borderColor: '#EF4444', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 1.5 },
          { label: 'P25', data: res.samplePaths.p25.values, borderColor: '#F59E0B', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 1 },
          { label: 'P50 (Median)', data: res.samplePaths.p50.values, borderColor: '#00D4AA', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 2.5 },
          { label: 'P75', data: res.samplePaths.p75.values, borderColor: '#10B981', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 1 },
          { label: 'P90 (Bull)', data: res.samplePaths.p90.values, borderColor: '#3B82F6', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 1.5 }
      ]
    };
  });
}