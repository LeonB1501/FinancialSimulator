// This file is deprecated - use monte-carlo-results.component.ts instead
// Re-export for backward compatibility
export { ResultsComponent } from './monte-carlo-results.component';
/*
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Generating...</span>
                  } @else {
                    <svg class="w-4 h-4 text-surface-500 group-hover:text-accent-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                    <span>Export Report</span>
                    <svg class="w-4 h-4 text-surface-400 group-hover:text-surface-600 dark:group-hover:text-surface-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                  }
                </button>
                
                <mat-menu #exportMenu="matMenu" xPosition="before" class="mt-2">
                  <button mat-menu-item (click)="onExport('pdf')" class="group">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center group-hover:bg-red-100 dark:group-hover:bg-red-900/40 transition-colors">
                        <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                        </svg>
                      </div>
                      <div class="flex flex-col leading-tight">
                        <span class="font-medium text-surface-900 dark:text-surface-100">PDF Report</span>
                        <span class="text-xs text-surface-500">Charts & Analysis</span>
                      </div>
                    </div>
                  </button>
                  <button mat-menu-item (click)="onExport('xlsx')" class="group">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center group-hover:bg-green-100 dark:group-hover:bg-green-900/40 transition-colors">
                        <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                      </div>
                      <div class="flex flex-col leading-tight">
                        <span class="font-medium text-surface-900 dark:text-surface-100">Excel Workbook</span>
                        <span class="text-xs text-surface-500">Calculations & Data</span>
                      </div>
                    </div>
                  </button>
                  <button mat-menu-item (click)="onExport('csv')" class="group">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors">
                        <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
                        </svg>
                      </div>
                      <div class="flex flex-col leading-tight">
                        <span class="font-medium text-surface-900 dark:text-surface-100">Raw CSV</span>
                        <span class="text-xs text-surface-500">Plain text data</span>
                      </div>
                    </div>
                  </button>
                </mat-menu>
              </div>
            </div>

            <!-- Charts Section with Tabs -->
            <div class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 shadow-soft dark:shadow-none mb-6">
              <mat-tab-group #tabGroup animationDuration="0ms" class="qs-tabs">
                <mat-tab label="Equity Curve">
                  <div class="pt-4" #equityChartContainer>
                    <!-- Toggle for Gross Equity -->
                    <div class="flex justify-end mb-2">
                        <label class="inline-flex items-center cursor-pointer">
                            <input type="checkbox" [checked]="showGrossEquity()" (change)="showGrossEquity.set(!showGrossEquity())" class="sr-only peer">
                            <div class="relative w-11 h-6 bg-surface-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent-300 dark:peer-focus:ring-accent-800 rounded-full peer dark:bg-surface-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-accent-600"></div>
                            <span class="ms-3 text-sm font-medium text-surface-900 dark:text-surface-300">Show Gross Equity (Pre-Cost)</span>
                        </label>
                    </div>
                    
                    <div class="chart-container" style="height: 450px;">
                      <canvas baseChart [data]="equityCurveData()" [options]="lineChartOptions()" type="line"></canvas>
                    </div>
                    <div class="mt-4 flex items-center justify-center space-x-6 text-sm text-surface-500 dark:text-surface-400">
                      <div class="flex items-center">
                        <span class="w-3 h-3 rounded-full bg-green-500 mr-2"></span> Buy Trade
                      </div>
                      <div class="flex items-center">
                        <span class="w-3 h-3 rounded-full bg-red-500 mr-2"></span> Sell Trade
                      </div>
                    </div>
                  </div>
                </mat-tab>
                
                <mat-tab label="Drawdown">
                  <div class="pt-4" #drawdownChartContainer>
                    <div class="chart-container" style="height: 450px;">
                      <canvas baseChart [data]="drawdownData()" [options]="areaChartOptions()" type="line"></canvas>
                    </div>
                  </div>
                </mat-tab>

                <mat-tab label="Rolling Volatility">
                  <div class="pt-4" #rollingVolChartContainer>
                    <div class="chart-container" style="height: 450px;">
                      <canvas baseChart [data]="rollingVolData()" [options]="lineChartOptions()" type="line"></canvas>
                    </div>
                    <p class="text-center text-xs text-surface-500 mt-2">6-Month Rolling Annualized Volatility</p>
                  </div>
                </mat-tab>

                <mat-tab label="Rolling Sharpe">
                  <div class="pt-4" #rollingSharpeChartContainer>
                    <div class="chart-container" style="height: 450px;">
                      <canvas baseChart [data]="rollingSharpeData()" [options]="lineChartOptions()" type="line"></canvas>
                    </div>
                    <p class="text-center text-xs text-surface-500 mt-2">12-Month Rolling Sharpe Ratio</p>
                  </div>
                </mat-tab>
              </mat-tab-group>
            </div>

            <!-- Execution Analysis (NEW) -->
            <div class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 shadow-soft dark:shadow-none mb-6">
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4 flex items-center">
                    <mat-icon class="text-accent-500 mr-2">payments</mat-icon>
                    Execution Analysis
                </h3>
                <div class="grid md:grid-cols-4 gap-6">
                    <div class="p-4 bg-surface-50 dark:bg-surface-700/50 rounded-xl">
                        <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">Total Commissions</p>
                        <p class="text-xl font-bold text-surface-900 dark:text-surface-100">
                            {{ results()!.totalCommission | currency }}
                        </p>
                    </div>
                    <div class="p-4 bg-surface-50 dark:bg-surface-700/50 rounded-xl">
                        <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">Total Slippage</p>
                        <p class="text-xl font-bold text-surface-900 dark:text-surface-100">
                            {{ results()!.totalSlippage | currency }}
                        </p>
                    </div>
                    <div class="p-4 bg-surface-50 dark:bg-surface-700/50 rounded-xl">
                        <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">Total Tax</p>
                        <p class="text-xl font-bold text-surface-900 dark:text-surface-100">
                            {{ results()!.totalTax | currency }}
                        </p>
                    </div>
                    <div class="p-4 bg-surface-50 dark:bg-surface-700/50 rounded-xl">
                        <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">Total Drag</p>
                        <p class="text-xl font-bold text-red-600 dark:text-red-400">
                            {{ (results()!.totalCommission + results()!.totalSlippage + results()!.totalTax) | currency }}
                        </p>
                        <p class="text-xs text-surface-500 mt-1">
                            {{ ((results()!.totalCommission + results()!.totalSlippage + results()!.totalTax) / results()!.equityCurve[0] * 100) | number:'1.2-2' }}% of initial capital
                        </p>
                    </div>
                </div>
            </div>

            <!-- Two Column Section -->
            <div class="grid lg:grid-cols-2 gap-6 mb-6">
              <!-- Monthly Returns Heatmap -->
              <div #heatmapContainer class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 shadow-soft dark:shadow-none">
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">Monthly Returns</h3>
                <qs-returns-heatmap 
                  [dates]="results()!.dates"
                  [values]="results()!.equityCurve"
                />
              </div>

              <!-- Trade Statistics -->
              <div #statsContainer class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 shadow-soft dark:shadow-none">
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">Trade Statistics</h3>
                <div class="space-y-4">
                  <div class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-700/50 rounded-lg">
                    <span class="text-surface-600 dark:text-surface-400">Total Trades</span>
                    <span class="font-bold text-surface-900 dark:text-surface-100">{{ results()!.transactions.length }}</span>
                  </div>
                  <div class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-700/50 rounded-lg">
                    <span class="text-surface-600 dark:text-surface-400">Avg Trades / Year</span>
                    <span class="font-bold text-surface-900 dark:text-surface-100">
                      {{ (results()!.transactions.length / (results()!.equityCurve.length / 252)) | number:'1.1-1' }}
                    </span>
                  </div>
                  <div class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-700/50 rounded-lg">
                    <span class="text-surface-600 dark:text-surface-400">Buy / Sell Ratio</span>
                    <span class="font-bold text-surface-900 dark:text-surface-100">
                      {{ buyCount() }}:{{ sellCount() }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Trade Log -->
            <div #tradeLogContainer class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 shadow-soft dark:shadow-none">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100">Trade Log</h3>
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
                        <th class="text-left py-3 px-4 text-sm font-semibold text-surface-700 dark:text-surface-300">Context</th>
                        <th class="text-left py-3 px-4 text-sm font-semibold text-surface-700 dark:text-surface-300">Ticker</th>
                        <th class="text-left py-3 px-4 text-sm font-semibold text-surface-700 dark:text-surface-300">Action</th>
                        <th class="text-right py-3 px-4 text-sm font-semibold text-surface-700 dark:text-surface-300">Quantity</th>
                        <th class="text-right py-3 px-4 text-sm font-semibold text-surface-700 dark:text-surface-300">Price</th>
                        <th class="text-right py-3 px-4 text-sm font-semibold text-surface-700 dark:text-surface-300">Value</th>
                        <th class="text-right py-3 px-4 text-sm font-semibold text-surface-700 dark:text-surface-300">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (txn of filteredTransactions(); track txn.day) {
                        <tr class="border-b border-surface-100 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-700/50">
                          <td class="py-3 px-4 text-sm text-surface-900 dark:text-surface-100">{{ txn.date | date:'mediumDate' }}</td>
                          <td class="py-3 px-4 text-sm text-surface-500 dark:text-surface-400">
                             @if (txn.tag) {
                               <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-100 dark:bg-surface-700 text-surface-800 dark:text-surface-300">
                                 {{ txn.tag }}
                               </span>
                             } @else {
                               <span class="text-surface-400 text-xs italic">-</span>
                             }
                          </td>
                          <td class="py-3 px-4 text-sm text-surface-900 dark:text-surface-100 font-medium">{{ txn.ticker.toUpperCase() }}</td>
                          <td class="py-3 px-4">
                            <span 
                              class="px-2 py-1 rounded-md text-xs font-medium"
                              [class]="txn.type === 'BUY' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : (txn.type === 'SELL' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300')"
                            >{{ txn.type }}</span>
                          </td>
                          <td class="py-3 px-4 text-sm text-surface-600 dark:text-surface-400 text-right">{{ txn.quantity | number:'1.2-2' }}</td>
                          <td class="py-3 px-4 text-sm text-surface-600 dark:text-surface-400 text-right">{{ txn.price | currency }}</td>
                          <td class="py-3 px-4 text-sm font-medium text-right" [class]="txn.type === 'BUY' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
                            {{ txn.type === 'BUY' ? '-' : '+' }}{{ txn.value | currency }}
                          </td>
                          <td class="py-3 px-4 text-sm text-surface-500 dark:text-surface-400 text-right">
                             {{ (txn.commission + txn.slippage + txn.tax) | currency }}
                          </td>
                        </tr>
                      }
                      @if (filteredTransactions().length === 0) {
                        <tr>
                          <td colspan="8" class="py-8 text-center text-surface-500 dark:text-surface-400">
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
  private readonly exportService = inject(ExportService);
  private readonly permissions = inject(PermissionsService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotificationService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly results = signal<HistoricBacktestResults | null>(null);
  readonly isExporting = signal(false);

  @ViewChild('tabGroup') tabGroup!: MatTabGroup;
  @ViewChild('equityChartContainer') equityChartContainer!: ElementRef;
  @ViewChild('drawdownChartContainer') drawdownChartContainer!: ElementRef;
  @ViewChild('rollingVolChartContainer') rollingVolChartContainer!: ElementRef;
  @ViewChild('rollingSharpeChartContainer') rollingSharpeChartContainer!: ElementRef;
  @ViewChild('heatmapContainer') heatmapContainer!: ElementRef;
  @ViewChild('statsContainer') statsContainer!: ElementRef;
  @ViewChild('tradeLogContainer') tradeLogContainer!: ElementRef;

  readonly filterType = signal<'all' | 'BUY' | 'SELL'>('all');
  readonly showAllTransactions = signal(false);
  readonly showGrossEquity = signal(false);

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

  readonly dailyReturns = computed(() => {
    const equity = this.results()?.equityCurve;
    if (!equity || equity.length < 2) return [];
    
    const returns: number[] = [];
    for (let i = 1; i < equity.length; i++) {
      const prev = equity[i-1];
      const curr = equity[i];
      returns.push(prev > 0 ? (curr - prev) / prev : 0);
    }
    return returns;
  });

  readonly rollingVolData = computed((): ChartData<'line'> => {
    const returns = this.dailyReturns();
    if (returns.length === 0) return { labels: [], datasets: [] };

    const windowSize = 126;
    const rollingVol: number[] = [];
    for (let i = 0; i < windowSize; i++) rollingVol.push(NaN);

    for (let i = windowSize; i < returns.length; i++) {
      const slice = returns.slice(i - windowSize, i);
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
      const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (slice.length - 1);
      const stdDev = Math.sqrt(variance);
      rollingVol.push(stdDev * Math.sqrt(252));
    }
    
    const dates = this.results()?.dates.slice(1) || [];

    return {
      labels: this.generateDateLabels(dates.map(d => d.toISOString())),
      datasets: [{
        label: '6-Month Rolling Volatility',
        data: rollingVol,
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
        pointRadius: 0,
        borderWidth: 1.5
      }]
    };
  });

  readonly rollingSharpeData = computed((): ChartData<'line'> => {
    const returns = this.dailyReturns();
    if (returns.length === 0) return { labels: [], datasets: [] };

    const windowSize = 252;
    const rollingSharpe: number[] = [];
    for (let i = 0; i < windowSize; i++) rollingSharpe.push(NaN);

    for (let i = windowSize; i < returns.length; i++) {
      const slice = returns.slice(i - windowSize, i);
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
      const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (slice.length - 1);
      const stdDev = Math.sqrt(variance);
      
      if (stdDev > 0) {
        const annualizedReturn = mean * 252;
        const annualizedVol = stdDev * Math.sqrt(252);
        rollingSharpe.push((annualizedReturn - 0.04) / annualizedVol);
      } else {
        rollingSharpe.push(0);
      }
    }

    const dates = this.results()?.dates.slice(1) || [];

    return {
      labels: this.generateDateLabels(dates.map(d => d.toISOString())),
      datasets: [{
        label: '12-Month Rolling Sharpe',
        data: rollingSharpe,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        pointRadius: 0,
        borderWidth: 1.5
      }]
    };
  });

  readonly equityCurveData = computed((): ChartData<'line'> => {
    const r = this.results();
    if (!r) return { labels: [], datasets: [] };

    const pointRadius: number[] = new Array(r.equityCurve.length).fill(0);
    const pointStyle: any[] = new Array(r.equityCurve.length).fill('circle');
    const pointBackgroundColor: string[] = new Array(r.equityCurve.length).fill('transparent');
    const pointRotation: number[] = new Array(r.equityCurve.length).fill(0);
    const pointBorderColor: string[] = new Array(r.equityCurve.length).fill('transparent');

    const txnMap = new Map<number, HistoricTransaction[]>();
    r.transactions.forEach(t => {
      if (!txnMap.has(t.day)) txnMap.set(t.day, []);
      txnMap.get(t.day)!.push(t);
    });

    txnMap.forEach((txns, index) => {
      if (index >= 0 && index < r.equityCurve.length) {
        const netQty = txns.reduce((sum, t) => sum + (t.type === 'BUY' ? t.quantity : -t.quantity), 0);
        
        pointRadius[index] = 6;
        pointStyle[index] = 'triangle';
        
        if (netQty > 0) {
           pointBackgroundColor[index] = '#10B981';
           pointBorderColor[index] = '#065F46';
           pointRotation[index] = 0;
        } else {
           pointBackgroundColor[index] = '#EF4444';
           pointBorderColor[index] = '#7F1D1D';
           pointRotation[index] = 180;
        }
      }
    });

    // Calculate Gross Equity (Hypothetical)
    let grossEquity: number[] = [];
    if (this.showGrossEquity()) {
        let cumulativeCost = 0;
        const costMap = new Map<number, number>(); // Day -> Cost
        r.transactions.forEach(t => {
            const cost = t.commission + t.slippage + t.tax; // Include Tax
            costMap.set(t.day, (costMap.get(t.day) || 0) + cost);
        });

        grossEquity = r.equityCurve.map((val, i) => {
            if (costMap.has(i)) {
                cumulativeCost += costMap.get(i)!;
            }
            return val + cumulativeCost;
        });
    }

    const datasets: any[] = [
        { 
          label: 'Strategy', 
          data: r.equityCurve, 
          borderColor: '#00D4AA', 
          backgroundColor: 'rgba(0, 212, 170, 0.1)',
          fill: true,
          borderWidth: 2,
          pointRadius: pointRadius,
          pointStyle: pointStyle,
          pointBackgroundColor: pointBackgroundColor,
          pointBorderColor: pointBorderColor,
          pointRotation: pointRotation,
          pointHoverRadius: 8
        },
        { 
          label: 'Benchmark', 
          data: r.benchmarkCurve, 
          borderColor: '#64748B', 
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 0
        }
    ];

    if (this.showGrossEquity()) {
        datasets.push({
            label: 'Gross Equity (Pre-Cost)',
            data: grossEquity,
            borderColor: '#A855F7', // Purple
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [2, 2],
            pointRadius: 0
        });
    }

    return {
      labels: this.generateDateLabels(r.dates.map(d => d.toISOString())),
      datasets: datasets
    };
  });
  
  readonly drawdownData = computed((): ChartData<'line'> => {
    const r = this.results();
    if (!r) return { labels: [], datasets: [] };

    return {
      labels: this.generateDateLabels(r.dates.map(d => d.toISOString())),
      datasets: [{
        label: 'Drawdown',
        data: r.drawdownCurve,
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        fill: true,
        borderWidth: 1.5,
        pointRadius: 0
      }]
    };
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
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const rawVal = context.parsed.y;
            if (rawVal === null || rawVal === undefined) return label;
            
            if (label.includes('Equity') || label === 'Benchmark') {
              return `${label}: $${new Intl.NumberFormat('en-US').format(rawVal)}`;
            }
            return `${label}: ${rawVal.toFixed(2)}`;
          },
          afterBody: (context: TooltipItem<'line'>[]) => {
             const index = context[0].dataIndex;
             const r = this.results();
             if (!r || context[0].dataset.label !== 'Strategy') return [];

             const txns = r.transactions.filter(t => t.day === index);
             if (txns.length === 0) return [];

             const lines = ['--- TRADES ---'];
             txns.forEach(t => {
                const tag = t.tag ? ` (${t.tag})` : '';
                const type = t.type === 'BUY' ? '🟢 Buy' : (t.type === 'SELL' ? '🔴 Sell' : '⚪ Tax');
                lines.push(`${type} ${t.quantity.toFixed(2)} ${t.ticker.toUpperCase()} ${tag}`);
             });
             return lines;
          }
        }
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
          callback: (value) => {
             const v = Number(value);
             if (v > 1000) return '$' + (v / 1000).toFixed(0) + 'K';
             return v.toFixed(2);
          }
        }
      }
    },
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

  ngOnInit(): void {
    const strategyId = this.route.snapshot.paramMap.get('id');
    
    if (strategyId) {
      this.api.get<any>(`/results/strategy/${strategyId}`).subscribe({
        next: (data) => {
          const transactions = data.transactions || [];
          const buyCount = transactions.filter((t: any) => t.type === 'BUY').length;
          const sellCount = transactions.filter((t: any) => t.type === 'SELL').length;
          const dates = data.dates || [];
          const startDate = dates.length > 0 ? new Date(dates[0]) : new Date();
          const endDate = dates.length > 0 ? new Date(dates[dates.length - 1]) : new Date();

          // Calculate totals if backend didn't aggregate
          const totalComm = data.totalCommission ?? transactions.reduce((sum: number, t: any) => sum + (t.commission || 0), 0);
          const totalSlip = data.totalSlippage ?? transactions.reduce((sum: number, t: any) => sum + (t.slippage || 0), 0);
          const totalTax = data.totalTax ?? transactions.reduce((sum: number, t: any) => sum + (t.tax || 0), 0);

          const enrichedData: HistoricBacktestResults = {
            id: data.id || strategyId,
            strategyId: strategyId,
            strategyName: data.strategyName || 'Historic Strategy',
            createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
            
            equityCurve: data.equityCurve || [],
            benchmarkCurve: data.benchmarkCurve || [],
            drawdownCurve: data.drawdownCurve || [],
            dates: dates.map((d: string) => new Date(d)),
            
            totalReturn: data.totalReturn || 0,
            benchmarkReturn: data.benchmarkReturn || 0,
            alpha: (data.totalReturn || 0) - (data.benchmarkReturn || 0),
            maxDrawdown: data.maxDrawdown || 0,
            sharpeRatio: data.sharpeRatio || 0,
            volatility: data.volatility || 0,
            
            transactions: transactions,
            totalTrades: transactions.length,
            buyCount: buyCount,
            sellCount: sellCount,
            
            startDate: startDate,
            endDate: endDate,
            tradingDays: dates.length,

            // NEW: Costs
            totalCommission: totalComm,
            totalSlippage: totalSlip,
            totalTax: totalTax // <--- Added
          };
          
          this.results.set(enrichedData);
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

  async onExport(format: 'pdf' | 'csv' | 'xlsx') {
    if (!this.results()) return;

    if (!this.permissions.isPremium()) {
      this.dialog.open(PremiumDialogComponent, {
        width: '450px',
        data: { featureName: 'Export Reports', description: 'Download comprehensive reports.' }
      });
      return;
    }

    if (format === 'csv') {
      this.exportService.exportToCsv(this.results()!);
      return;
    }
    if (format === 'xlsx') {
      this.exportService.exportToExcel(this.results()!);
      return;
    }

    if (format === 'pdf') {
      this.isExporting.set(true);
      this.notify.info('Generating PDF report... This may take a moment.');

      // Temporarily show all transactions for the PDF export
      const wasShowingAll = this.showAllTransactions();
      this.showAllTransactions.set(true);

      try {
        const sections: PdfSection[] = [];
        const originalIndex = this.tabGroup.selectedIndex;

        // 1. Capture Equity Curve (Tab 0)
        this.tabGroup.selectedIndex = 0;
        await this.wait(350);
        if (this.equityChartContainer) {
          sections.push({
            title: 'Equity Curve',
            element: this.equityChartContainer.nativeElement,
            description: 'Strategy performance vs Benchmark over time.'
          });
        }

        // 2. Capture Drawdown (Tab 1)
        this.tabGroup.selectedIndex = 1;
        await this.wait(350);
        if (this.drawdownChartContainer) {
          sections.push({
            title: 'Drawdown Profile',
            element: this.drawdownChartContainer.nativeElement,
            description: 'Historical drawdown depth percentage.'
          });
        }
*/
