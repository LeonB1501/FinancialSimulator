import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ChartConfiguration, ChartData } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { HeaderComponent } from '@shared/components/header/header.component';
import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { CompactCurrencyPipe } from '@shared/pipes/compact-currency.pipe';
import { SimulationService } from '@core/services/simulation.service';
import { SimulationResults } from '@core/models';

@Component({
  selector: 'qs-results',
  standalone: true,
  imports: [
    CommonModule, RouterLink, DatePipe, DecimalPipe, 
    NgChartsModule, HeaderComponent, LoadingSpinnerComponent, CompactCurrencyPipe
  ],
  template: `
    <qs-header />
    
    <div class="pt-[72px] min-h-screen bg-surface-50">
      @if (loading()) {
        <div class="flex items-center justify-center min-h-[calc(100vh-72px)]">
          <qs-loading-spinner size="lg" message="Loading results..." />
        </div>
      } @else if (results()) {
        <div class="flex">
          <!-- Left Sidebar (Strategy Info) -->
          <aside class="hidden lg:block w-[320px] flex-shrink-0 border-r border-surface-200 bg-white min-h-[calc(100vh-72px)] p-6 overflow-y-auto fixed left-0 top-[72px] bottom-0">
            <h2 class="text-xl font-bold text-surface-900 mb-1">{{ results()!.strategyName }}</h2>
            
            <div class="space-y-3 mt-4 mb-6">
                <div class="flex items-center space-x-3 text-sm">
                    <svg class="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                    </svg>
                    <span class="text-surface-600">{{ results()!.metadata.model }} Model</span>
                </div>
                <div class="flex items-center space-x-3 text-sm">
                    <svg class="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                    </svg>
                    <span class="text-surface-600">{{ results()!.metadata.indices.join(', ') }}</span>
                </div>
                <div class="flex items-center space-x-3 text-sm">
                    <svg class="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    <span class="text-surface-600">{{ results()!.metadata.mode }} Mode</span>
                </div>
                <div class="flex items-center space-x-3 text-sm">
                    <svg class="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
                    </svg>
                    <span class="text-surface-600">{{ results()!.metadata.iterations | number }} iterations</span>
                </div>
                <div class="flex items-center space-x-3 text-sm">
                    <svg class="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <span class="text-surface-600">{{ results()!.metadata.granularity }} granularity</span>
                </div>
                <div class="flex items-center space-x-3 text-sm">
                    <svg class="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span class="text-surface-600">{{ results()!.createdAt | date:'MMM d, y h:mm a' }}</span>
                </div>
            </div>

            <!-- Quick Stats -->
            <div class="space-y-4 mb-6">
                <div class="bg-gradient-to-r from-green-50 to-accent-50 rounded-xl p-5 border border-green-200">
                    <p class="text-sm text-surface-500 mb-1">Probability of Success</p>
                    <p class="text-4xl font-bold text-green-600">{{ (results()!.successProbability * 100) | number:'1.1-1' }}%</p>
                    <p class="text-sm text-surface-500 mt-1">of reaching target</p>
                </div>
                <div class="bg-surface-50 rounded-xl p-5 border border-surface-200">
                    <p class="text-sm text-surface-500 mb-1">Median Terminal Wealth</p>
                    <p class="text-2xl font-bold text-surface-900">{{ results()!.terminalWealthStats.median | compactCurrency:0 }}</p>
                    <p class="text-sm text-surface-500 mt-1">50th percentile</p>
                </div>
                <div class="bg-surface-50 rounded-xl p-5 border border-surface-200">
                    <p class="text-sm text-surface-500 mb-1">Maximum Drawdown</p>
                    <p class="text-2xl font-bold text-red-600">{{ (results()!.riskMetrics.maxDrawdown.median * 100) | number:'1.1-1' }}%</p>
                    <p class="text-sm text-surface-500 mt-1">median worst case</p>
                </div>
            </div>

            <div class="space-y-3">
                <a [routerLink]="['/build']" [queryParams]="{edit: results()!.strategyId}" class="flex items-center justify-center space-x-2 w-full px-4 py-3 border border-surface-200 text-surface-700 font-medium rounded-xl hover:bg-surface-50 transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                    <span>Edit & Re-run</span>
                </a>
            </div>
          </aside>

          <!-- Main Content Area -->
          <main class="flex-1 lg:ml-[320px] p-6 lg:p-10">
            <div class="mb-8">
                <h1 class="text-2xl font-bold text-surface-900">Simulation Results</h1>
            </div>

            <div class="grid gap-6">
                <!-- Wealth Distribution -->
                <div class="bg-white rounded-2xl border border-surface-200 p-6">
                    <h3 class="text-lg font-semibold text-surface-900 mb-6">Terminal Wealth Distribution</h3>
                    <div class="chart-container">
                        <canvas baseChart [data]="wealthDistributionData()" [options]="histogramOptions" type="bar"></canvas>
                    </div>
                    <!-- Deciles -->
                    <div class="mt-6 pt-6 border-t border-surface-100">
                        <div class="flex justify-between items-end">
                            <div class="text-center">
                                <p class="text-xs text-surface-400">P10</p>
                                <p class="text-sm font-semibold text-red-600">{{ results()!.terminalWealthStats.percentiles.p10 | compactCurrency:0 }}</p>
                            </div>
                            <div class="text-center">
                                <p class="text-xs text-surface-400">P25</p>
                                <p class="text-sm font-semibold text-amber-600">{{ results()!.terminalWealthStats.percentiles.p25 | compactCurrency:0 }}</p>
                            </div>
                            <div class="text-center">
                                <p class="text-xs text-surface-400">P50</p>
                                <p class="text-sm font-semibold text-surface-900 text-base">{{ results()!.terminalWealthStats.percentiles.p50 | compactCurrency:0 }}</p>
                            </div>
                            <div class="text-center">
                                <p class="text-xs text-surface-400">P75</p>
                                <p class="text-sm font-semibold text-green-600">{{ results()!.terminalWealthStats.percentiles.p75 | compactCurrency:0 }}</p>
                            </div>
                            <div class="text-center">
                                <p class="text-xs text-surface-400">P90</p>
                                <p class="text-sm font-semibold text-green-700">{{ results()!.terminalWealthStats.percentiles.p90 | compactCurrency:0 }}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Two Column Grid -->
                <div class="grid md:grid-cols-2 gap-6">
                    <!-- Time to Target -->
                    <div class="bg-white rounded-2xl border border-surface-200 p-6">
                        <h3 class="text-lg font-semibold text-surface-900 mb-6">Time to Reach Goal</h3>
                        <div class="chart-container">
                             <canvas baseChart [data]="timeToTargetData()" [options]="histogramOptions" type="bar"></canvas>
                        </div>
                        <div class="mt-4 grid grid-cols-2 gap-4 text-center">
                            <div class="bg-surface-50 rounded-lg p-3">
                                <p class="text-sm text-surface-500">Median Time</p>
                                <p class="text-xl font-bold text-surface-900">12.3 years</p>
                            </div>
                            <div class="bg-green-50 rounded-lg p-3">
                                <p class="text-sm text-surface-500">Within Target</p>
                                <p class="text-xl font-bold text-green-600">{{ (results()!.successProbability * 100) | number:'1.1-1' }}%</p>
                            </div>
                        </div>
                    </div>

                    <!-- Risk Metrics -->
                    <div class="bg-white rounded-2xl border border-surface-200 p-6">
                        <h3 class="text-lg font-semibold text-surface-900 mb-6">Risk Analysis</h3>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="p-4 bg-surface-50 rounded-xl">
                                <p class="text-sm text-surface-500 mb-1">Sharpe Ratio</p>
                                <p class="text-2xl font-bold text-surface-900">{{ results()!.riskMetrics.sharpeRatio.median | number:'1.2-2' }}</p>
                            </div>
                            <div class="p-4 bg-surface-50 rounded-xl">
                                <p class="text-sm text-surface-500 mb-1">Sortino Ratio</p>
                                <p class="text-2xl font-bold text-surface-900">{{ results()!.riskMetrics.sortinoRatio.median | number:'1.2-2' }}</p>
                            </div>
                            <div class="p-4 bg-surface-50 rounded-xl">
                                <p class="text-sm text-surface-500 mb-1">Ann. Volatility</p>
                                <p class="text-2xl font-bold text-surface-900">{{ (results()!.riskMetrics.annualizedVolatility.median * 100) | number:'1.1-1' }}%</p>
                            </div>
                            <div class="p-4 bg-surface-50 rounded-xl">
                                <p class="text-sm text-surface-500 mb-1">Calmar Ratio</p>
                                <p class="text-2xl font-bold text-surface-900">{{ results()!.riskMetrics.calmarRatio.median | number:'1.2-2' }}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Drawdown Frequency -->
                <div class="bg-white rounded-2xl border border-surface-200 p-6">
                    <h3 class="text-lg font-semibold text-surface-900 mb-6">Drawdown Frequency</h3>
                    <div class="h-64">
                        <canvas baseChart [data]="drawdownFrequencyData()" [options]="horizontalBarOptions" type="bar"></canvas>
                    </div>
                </div>

                <!-- Sample Paths -->
                <div class="bg-white rounded-2xl border border-surface-200 p-6">
                    <h3 class="text-lg font-semibold text-surface-900 mb-6">Sample Portfolio Paths</h3>
                    <div class="chart-container" style="height: 350px;">
                        <canvas baseChart [data]="samplePathsData()" [options]="lineChartOptions" type="line"></canvas>
                    </div>
                </div>

                <!-- Detailed Stats Table -->
                <div class="bg-white rounded-2xl border border-surface-200 p-6">
                    <h3 class="text-lg font-semibold text-surface-900 mb-6">Detailed Statistics</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead>
                                <tr class="border-b border-surface-200">
                                    <th class="text-left py-3 px-4 text-sm font-semibold text-surface-700">Metric</th>
                                    <th class="text-right py-3 px-4 text-sm font-semibold text-surface-700">P10</th>
                                    <th class="text-right py-3 px-4 text-sm font-semibold text-surface-700">P50</th>
                                    <th class="text-right py-3 px-4 text-sm font-semibold text-surface-700">P90</th>
                                    <th class="text-right py-3 px-4 text-sm font-semibold text-surface-700">Mean</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr class="border-b border-surface-100">
                                    <td class="py-3 px-4 text-sm text-surface-900 font-medium">Terminal Wealth</td>
                                    <td class="py-3 px-4 text-sm text-surface-600 text-right">{{ results()!.terminalWealthStats.percentiles.p10 | compactCurrency:0 }}</td>
                                    <td class="py-3 px-4 text-sm text-surface-900 text-right font-semibold bg-accent-50">{{ results()!.terminalWealthStats.percentiles.p50 | compactCurrency:0 }}</td>
                                    <td class="py-3 px-4 text-sm text-surface-600 text-right">{{ results()!.terminalWealthStats.percentiles.p90 | compactCurrency:0 }}</td>
                                    <td class="py-3 px-4 text-sm text-surface-600 text-right">{{ results()!.terminalWealthStats.mean | compactCurrency:0 }}</td>
                                </tr>
                                <tr class="border-b border-surface-100">
                                    <td class="py-3 px-4 text-sm text-surface-900 font-medium">Max Drawdown</td>
                                    <td class="py-3 px-4 text-sm text-surface-600 text-right">{{ (results()!.riskMetrics.maxDrawdown.percentiles.p10 * 100) | number:'1.1-1' }}%</td>
                                    <td class="py-3 px-4 text-sm text-surface-900 text-right font-semibold bg-accent-50">{{ (results()!.riskMetrics.maxDrawdown.percentiles.p50 * 100) | number:'1.1-1' }}%</td>
                                    <td class="py-3 px-4 text-sm text-surface-600 text-right">{{ (results()!.riskMetrics.maxDrawdown.percentiles.p90 * 100) | number:'1.1-1' }}%</td>
                                    <td class="py-3 px-4 text-sm text-surface-600 text-right">{{ (results()!.riskMetrics.maxDrawdown.mean * 100) | number:'1.1-1' }}%</td>
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
  
  readonly loading = signal(true);
  readonly results = signal<SimulationResults | null>(null);

  // Chart Options
  readonly histogramOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: 'rgba(0,0,0,0.05)' }, beginAtZero: true }
    }
  };

  readonly lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: 'rgba(0,0,0,0.05)' } }
    }
  };

  readonly horizontalBarOptions: ChartConfiguration['options'] = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: 'rgba(0,0,0,0.05)' }, max: 100 },
      y: { grid: { display: false } }
    }
  };

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.simulationService.loadResultsForStrategy(id).subscribe(res => {
        this.results.set(res);
        this.loading.set(false);
      });
    }
  }

  // Data Computations
  wealthDistributionData = computed((): ChartData<'bar'> => ({
    labels: ['$0-200K', '$200-400K', '$400-600K', '$600-800K', '$800K-1M', '$1M+'],
    datasets: [{ data: [5, 15, 25, 30, 15, 10], backgroundColor: '#00D4AA', borderRadius: 4 }]
  }));

  timeToTargetData = computed((): ChartData<'bar'> => ({
    labels: ['5-7yr', '7-9yr', '9-11yr', '11-13yr', '13-15yr', 'Not Hit'],
    datasets: [{ 
        data: [10, 20, 30, 25, 10, 5], 
        backgroundColor: (ctx) => ctx.dataIndex === 5 ? '#EF4444' : '#3B82F6',
        borderRadius: 4 
    }]
  }));

  drawdownFrequencyData = computed((): ChartData<'bar'> => ({
    labels: ['10% DD', '20% DD', '30% DD', '40% DD', '50%+ DD'],
    datasets: [{ 
        data: [92, 68, 41, 23, 8], 
        backgroundColor: ['#FBBF24', '#F59E0B', '#F97316', '#EF4444', '#DC2626'],
        borderRadius: 4 
    }]
  }));

  samplePathsData = computed((): ChartData<'line'> => ({
    labels: Array.from({length: 21}, (_, i) => `Year ${i}`),
    datasets: [
        { label: 'P10', data: this.generatePath(0.5), borderColor: '#F87171', backgroundColor: 'transparent', pointRadius: 0 },
        { label: 'P50', data: this.generatePath(1.0), borderColor: '#00D4AA', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 3 },
        { label: 'P90', data: this.generatePath(2.0), borderColor: '#16A34A', backgroundColor: 'transparent', pointRadius: 0 }
    ]
  }));

  private generatePath(mult: number) {
    const path = [50000];
    for(let i=1; i<=20; i++) path.push(path[i-1] * (1 + 0.08 * mult));
    return path;
  }
}