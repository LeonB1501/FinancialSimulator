import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ChartConfiguration, ChartData } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { HeaderComponent } from '@shared/components/header/header.component';
import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { CompactCurrencyPipe } from '@shared/pipes/compact-currency.pipe';
import { ApiService } from '@core/services/api.service';
import { ThemeService } from '@core/services/theme.service';

interface HistoricTransaction {
  day: number;
  date: Date;
  ticker: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  value: number;
}

interface HistoricBacktestResult {
  success: boolean;
  error?: string;
  equityCurve: number[];
  benchmarkCurve: number[];
  drawdownCurve: number[];
  dates: string[];
  transactions: HistoricTransaction[];
  totalReturn: number;
  benchmarkReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  volatility: number;
}

@Component({
  selector: 'qs-historic-results',
  standalone: true,
  imports: [
    CommonModule, RouterLink, DatePipe, DecimalPipe, CurrencyPipe,
    NgChartsModule, HeaderComponent, LoadingSpinnerComponent, CompactCurrencyPipe
  ],
  template: `
    <qs-header />
    
    <div class="pt-[72px] min-h-screen bg-surface-50 dark:bg-surface-900 transition-colors duration-300">
      @if (loading()) {
        <div class="flex items-center justify-center min-h-[calc(100vh-72px)]">
          <qs-loading-spinner size="lg" message="Loading historic backtest results..." />
        </div>
      } @else if (error()) {
        <div class="flex items-center justify-center min-h-[calc(100vh-72px)]">
          <div class="text-center">
            <div class="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-2">Error Loading Results</h2>
            <p class="text-surface-600 dark:text-surface-400">{{ error() }}</p>
          </div>
        </div>
      } @else if (results()) {
        <div class="flex">
          <!-- Left Sidebar -->
          <aside class="hidden lg:block w-[320px] flex-shrink-0 border-r border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 min-h-[calc(100vh-72px)] p-6 overflow-y-auto fixed left-0 top-[72px] bottom-0 transition-colors duration-300">
            <h2 class="text-xl font-bold text-surface-900 dark:text-surface-100 mb-1">Historic Backtest</h2>
            <p class="text-sm text-surface-500 dark:text-surface-400 mb-6">Strategy performance against real market data</p>
            
            <!-- Key Metrics -->
            <div class="space-y-4">
              <!-- Total Return -->
              <div class="p-4 rounded-xl" [class]="results()!.totalReturn >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'">
                <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">Strategy Return</p>
                <p class="text-3xl font-bold" [class]="results()!.totalReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                  {{ (results()!.totalReturn * 100) | number:'1.2-2' }}%
                </p>
              </div>
              
              <!-- Benchmark Return -->
              <div class="p-4 bg-surface-50 dark:bg-surface-700/50 rounded-xl">
                <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">Benchmark Return</p>
                <p class="text-2xl font-bold text-surface-900 dark:text-surface-100">
                  {{ (results()!.benchmarkReturn * 100) | number:'1.2-2' }}%
                </p>
              </div>
              
              <!-- Alpha -->
              <div class="p-4 rounded-xl" [class]="alpha() >= 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-surface-50 dark:bg-surface-700/50'">
                <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">Alpha (vs Benchmark)</p>
                <p class="text-2xl font-bold" [class]="alpha() >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-surface-600 dark:text-surface-400'">
                  {{ (alpha() * 100) | number:'1.2-2' }}%
                </p>
              </div>
              
              <!-- Max Drawdown -->
              <div class="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">Max Drawdown</p>
                <p class="text-2xl font-bold text-red-600 dark:text-red-400">
                  -{{ (results()!.maxDrawdown * 100) | number:'1.2-2' }}%
                </p>
              </div>
              
              <!-- Sharpe Ratio -->
              <div class="p-4 bg-surface-50 dark:bg-surface-700/50 rounded-xl">
                <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">Sharpe Ratio</p>
                <p class="text-2xl font-bold text-surface-900 dark:text-surface-100">
                  {{ results()!.sharpeRatio | number:'1.2-2' }}
                </p>
              </div>
              
              <!-- Volatility -->
              <div class="p-4 bg-surface-50 dark:bg-surface-700/50 rounded-xl">
                <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">Annual Volatility</p>
                <p class="text-2xl font-bold text-surface-900 dark:text-surface-100">
                  {{ (results()!.volatility * 100) | number:'1.1-1' }}%
                </p>
              </div>
            </div>
            
            <!-- Trade Summary -->
            <div class="mt-6 pt-6 border-t border-surface-200 dark:border-surface-700">
              <p class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Trade Summary</p>
              <div class="flex justify-between text-sm">
                <span class="text-surface-500 dark:text-surface-400">Total Trades</span>
                <span class="font-medium text-surface-900 dark:text-surface-100">{{ results()!.transactions.length }}</span>
              </div>
              <div class="flex justify-between text-sm mt-1">
                <span class="text-surface-500 dark:text-surface-400">Buy Orders</span>
                <span class="font-medium text-green-600 dark:text-green-400">{{ buyCount() }}</span>
              </div>
              <div class="flex justify-between text-sm mt-1">
                <span class="text-surface-500 dark:text-surface-400">Sell Orders</span>
                <span class="font-medium text-red-600 dark:text-red-400">{{ sellCount() }}</span>
              </div>
            </div>
          </aside>

          <!-- Main Content -->
          <main class="flex-1 lg:ml-[320px] p-6 lg:p-10 transition-all duration-300">
            <div class="mb-8">
              <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-100">Historic Backtest Results</h1>
              <p class="text-surface-600 dark:text-surface-400 mt-1">
                Deterministic simulation against real market data
              </p>
            </div>

            <div class="grid gap-6">
              <!-- Equity Curve Chart -->
              <div class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 shadow-soft dark:shadow-none transition-colors duration-300">
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">Equity Curve</h3>
                <p class="text-sm text-surface-500 dark:text-surface-400 mb-4">Strategy vs Benchmark with trade markers</p>
                <div class="chart-container" style="height: 400px;">
                  <canvas baseChart [data]="equityCurveData()" [options]="lineChartOptions()" type="line"></canvas>
                </div>
              </div>

              <!-- Drawdown Chart -->
              <div class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 transition-colors duration-300">
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">Drawdown</h3>
                <p class="text-sm text-surface-500 dark:text-surface-400 mb-4">Percentage decline from peak equity</p>
                <div class="chart-container" style="height: 250px;">
                  <canvas baseChart [data]="drawdownData()" [options]="areaChartOptions()" type="line"></canvas>
                </div>
              </div>

              <!-- Trade Log Table -->
              <div class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 transition-colors duration-300">
                <div class="flex items-center justify-between mb-4">
                  <div>
                    <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100">Trade Log</h3>
                    <p class="text-sm text-surface-500 dark:text-surface-400">Complete transaction history</p>
                  </div>
                  <div class="flex items-center space-x-2">
                    <button 
                      (click)="filterType.set('all')"
                      [class]="filterType() === 'all' ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300' : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'"
                      class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >All</button>
                    <button 
                      (click)="filterType.set('BUY')"
                      [class]="filterType() === 'BUY' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'"
                      class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >Buy</button>
                    <button 
                      (click)="filterType.set('SELL')"
                      [class]="filterType() === 'SELL' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'"
                      class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >Sell</button>
                  </div>
                </div>
                
                <div class="overflow-x-auto">
                  <table class="w-full">
                    <thead>
                      <tr class="border-b border-surface-200 dark:border-surface-700">
                        <th class="text-left py-3 px-4 text-sm font-semibold text-surface-700 dark:text-surface-300">Date</th>
                        <th class="text-left py-3 px-4 text-sm font-semibold text-surface-700 dark:text-surface-300">Ticker</th>
                        <th class="text-left py-3 px-4 text-sm font-semibold text-surface-700 dark:text-surface-300">Action</th>
                        <th class="text-right py-3 px-4 text-sm font-semibold text-surface-700 dark:text-surface-300">Quantity</th>
                        <th class="text-right py-3 px-4 text-sm font-semibold text-surface-700 dark:text-surface-300">Price</th>
                        <th class="text-right py-3 px-4 text-sm font-semibold text-surface-700 dark:text-surface-300">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (txn of filteredTransactions(); track txn.day) {
                        <tr class="border-b border-surface-100 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-700/50">
                          <td class="py-3 px-4 text-sm text-surface-900 dark:text-surface-100">{{ txn.date | date:'mediumDate' }}</td>
                          <td class="py-3 px-4 text-sm text-surface-900 dark:text-surface-100 font-medium">{{ txn.ticker.toUpperCase() }}</td>
                          <td class="py-3 px-4">
                            <span 
                              class="px-2 py-1 rounded-md text-xs font-medium"
                              [class]="txn.type === 'BUY' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'"
                            >{{ txn.type }}</span>
                          </td>
                          <td class="py-3 px-4 text-sm text-surface-600 dark:text-surface-400 text-right">{{ txn.quantity | number:'1.2-2' }}</td>
                          <td class="py-3 px-4 text-sm text-surface-600 dark:text-surface-400 text-right">{{ txn.price | currency }}</td>
                          <td class="py-3 px-4 text-sm font-medium text-right" [class]="txn.type === 'BUY' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
                            {{ txn.type === 'BUY' ? '-' : '+' }}{{ txn.value | currency }}
                          </td>
                        </tr>
                      }
                      @if (filteredTransactions().length === 0) {
                        <tr>
                          <td colspan="6" class="py-8 text-center text-surface-500 dark:text-surface-400">
                            No transactions found
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                
                @if (results()!.transactions.length > 10) {
                  <div class="mt-4 flex justify-center">
                    <button 
                      (click)="showAllTransactions.set(!showAllTransactions())"
                      class="text-accent-600 dark:text-accent-400 text-sm font-medium hover:underline"
                    >
                      {{ showAllTransactions() ? 'Show Less' : 'Show All ' + results()!.transactions.length + ' Transactions' }}
                    </button>
                  </div>
                }
              </div>
            </div>
          </main>
        </div>
      }
    </div>
  `
})
export class HistoricResultsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly themeService = inject(ThemeService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly results = signal<HistoricBacktestResult | null>(null);
  readonly filterType = signal<'all' | 'BUY' | 'SELL'>('all');
  readonly showAllTransactions = signal(false);

  readonly alpha = computed(() => {
    const r = this.results();
    return r ? r.totalReturn - r.benchmarkReturn : 0;
  });

  readonly buyCount = computed(() => 
    this.results()?.transactions.filter(t => t.type === 'BUY').length ?? 0
  );

  readonly sellCount = computed(() => 
    this.results()?.transactions.filter(t => t.type === 'SELL').length ?? 0
  );

  readonly filteredTransactions = computed(() => {
    const r = this.results();
    if (!r) return [];
    
    let txns = r.transactions;
    if (this.filterType() !== 'all') {
      txns = txns.filter(t => t.type === this.filterType());
    }
    
    if (!this.showAllTransactions() && txns.length > 10) {
      return txns.slice(0, 10);
    }
    return txns;
  });

  private readonly gridColor = computed(() => 
    this.themeService.isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
  );
  
  private readonly textColor = computed(() => 
    this.themeService.isDark() ? '#94A3B8' : '#64748B'
  );

  readonly lineChartOptions = computed<ChartConfiguration['options']>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: { 
      legend: { 
        position: 'bottom',
        labels: { color: this.textColor() }
      } 
    },
    scales: {
      x: { 
        grid: { display: false },
        ticks: { color: this.textColor(), maxTicksLimit: 10 }
      },
      y: { 
        grid: { color: this.gridColor() },
        ticks: { 
          color: this.textColor(),
          callback: (value) => '$' + (Number(value) / 1000).toFixed(0) + 'K'
        }
      }
    },
    elements: { point: { radius: 0 }, line: { tension: 0.1 } }
  }));

  readonly areaChartOptions = computed<ChartConfiguration['options']>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { 
        grid: { display: false },
        ticks: { color: this.textColor(), maxTicksLimit: 10 }
      },
      y: { 
        grid: { color: this.gridColor() },
        reverse: true,
        ticks: { 
          color: this.textColor(),
          callback: (value) => (Number(value) * 100).toFixed(0) + '%'
        }
      }
    },
    elements: { point: { radius: 0 } }
  }));

  readonly equityCurveData = computed((): ChartData<'line'> => {
    const r = this.results();
    if (!r) return { labels: [], datasets: [] };

    const labels = r.dates.map((d, i) => {
      const date = new Date(d);
      if (i % Math.floor(r.dates.length / 10) === 0) {
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      }
      return '';
    });

    return {
      labels,
      datasets: [
        { 
          label: 'Strategy', 
          data: r.equityCurve, 
          borderColor: '#00D4AA', 
          backgroundColor: 'rgba(0, 212, 170, 0.1)',
          fill: true,
          borderWidth: 2 
        },
        { 
          label: 'Benchmark', 
          data: r.benchmarkCurve, 
          borderColor: '#64748B', 
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [5, 5]
        }
      ]
    };
  });

  readonly drawdownData = computed((): ChartData<'line'> => {
    const r = this.results();
    if (!r) return { labels: [], datasets: [] };

    const labels = r.dates.map((d, i) => {
      const date = new Date(d);
      if (i % Math.floor(r.dates.length / 10) === 0) {
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      }
      return '';
    });

    return {
      labels,
      datasets: [{
        label: 'Drawdown',
        data: r.drawdownCurve,
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        fill: true,
        borderWidth: 1.5
      }]
    };
  });

  ngOnInit(): void {
    const strategyId = this.route.snapshot.paramMap.get('id');
    
    if (strategyId) {
      // Fetch results from backend
      this.api.get<any>(`/results/strategy/${strategyId}`).subscribe({
        next: (data) => {
          // The backend returns the raw JSON stored in ReportJson
          // For historic, this matches the HistoricBacktestResponse structure
          this.results.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load historic results:', err);
          this.error.set('Failed to load results. ' + err.message);
          this.loading.set(false);
        }
      });
    } else {
      this.loading.set(false);
      this.error.set('No strategy ID provided');
    }
  }
}