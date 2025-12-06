import { Component, Input, Output, EventEmitter, OnInit, signal, computed, inject, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { StrategyDraft, HistoricScenario, DEFAULT_HISTORIC_SCENARIO, Index, StochasticModel, DEFAULT_HESTON_PARAMS } from '@core/models';
import { StrategyService } from '@core/services/strategy.service';
import { map, startWith } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

interface TickerAvailability {
  ticker: string;
  startYear: number;
  endYear: number;
  color: string;
}

@Component({
  selector: 'qs-historical-data-aligner',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule
  ],
  template: `
    <div class="max-w-5xl">
      <div class="mb-8">
        <h1 class="text-2xl lg:text-3xl font-bold text-surface-900 dark:text-surface-100 mb-2">
          Historical Data Aligner
        </h1>
        <p class="text-surface-600 dark:text-surface-400">
          Select assets and define the backtest period. Drag the orange handles on the timeline to adjust the period.
        </p>
      </div>

      <!-- Asset Selection -->
      <div class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 mb-6">
        <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">Selected Assets</h3>

        <!-- Search Bar -->
        <div class="mb-4">
          <div class="relative max-w-md">
            <input
              type="text"
              placeholder="Search assets (e.g. SPY, QQQ)..."
              [formControl]="tickerControl"
              class="w-full px-4 py-2.5 pl-10 bg-surface-50 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
            />
            <mat-icon class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-lg w-5 h-5">search</mat-icon>
          </div>

          <!-- Autocomplete Dropdown -->
          @if (tickerControl.value && (filteredOptions | async)?.length) {
            <div class="relative max-w-md">
              <div class="absolute z-20 w-full mt-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                @for (option of filteredOptions | async; track option) {
                  <button
                    (click)="addTicker(option)"
                    class="w-full px-4 py-2 text-left text-surface-900 dark:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-700 font-mono transition-colors"
                  >
                    {{ option }}
                  </button>
                }
              </div>
            </div>
          }
        </div>

        <!-- Selected Tags -->
        <div class="flex flex-wrap gap-2">
          @for (ticker of selectedTickers(); track ticker) {
            <div class="flex items-center gap-2 px-3 py-1.5 bg-surface-100 dark:bg-surface-700 rounded-lg border border-surface-200 dark:border-surface-600">
              <span class="font-mono font-bold text-surface-900 dark:text-surface-100">{{ ticker }}</span>
              <button (click)="removeTicker(ticker)" class="text-surface-400 hover:text-red-500 transition-colors">
                <mat-icon class="text-sm w-4 h-4 leading-4">close</mat-icon>
              </button>
            </div>
          }
          @if (selectedTickers().length === 0) {
            <p class="text-surface-500 dark:text-surface-400 text-sm italic">
              No assets selected. Search above to add assets to your backtest.
            </p>
          }
        </div>
      </div>

      <!-- Timeline Visualization -->
      <div class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 mb-6 select-none">
        <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">Data Availability Timeline</h3>
        
        <div class="relative w-full" #timelineContainer>
          @if (loadingData()) {
            <div class="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-surface-800/50 z-10">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500"></div>
            </div>
          }

          <!-- FIX: Added pointer-events-none class binding to prevent flickering during drag -->
          <svg 
            #timelineSvg 
            class="w-full h-auto" 
            [class.pointer-events-none]="isDragging"
            [attr.viewBox]="'0 0 800 ' + (120 + tickerAvailability().length * 40)" 
            preserveAspectRatio="xMidYMid meet"
          >
            <!-- Timeline axis -->
            <line x1="50" [attr.y1]="80" x2="750" [attr.y2]="80" 
                  stroke="currentColor" class="text-surface-300 dark:text-surface-600" stroke-width="2"/>
            
            <!-- Year markers -->
            @for (year of yearMarkers(); track year) {
              <g [attr.transform]="'translate(' + getYearX(year) + ', 80)'">
                <line y1="-5" y2="5" stroke="currentColor" class="text-surface-400 dark:text-surface-500" stroke-width="1"/>
                <text y="20" text-anchor="middle" class="text-xs fill-current text-surface-500 dark:text-surface-400">
                  {{ year }}
                </text>
              </g>
            }
            
            <!-- Ticker availability bars -->
            @for (ticker of tickerAvailability(); track ticker.ticker; let i = $index) {
              <g [attr.transform]="'translate(0, ' + (110 + i * 40) + ')'">
                <text x="45" y="15" text-anchor="end" class="text-sm fill-current text-surface-700 dark:text-surface-300 font-medium font-mono">
                  {{ ticker.ticker }}
                </text>
                <rect 
                  [attr.x]="getYearX(ticker.startYear)" 
                  y="5" 
                  [attr.width]="Math.max(0, getYearX(ticker.endYear) - getYearX(ticker.startYear))" 
                  height="20" 
                  [attr.fill]="ticker.color"
                  rx="4"
                  opacity="0.7"
                />
              </g>
            }
            
            <!-- INTERACTIVE SLIDER -->
            @if (validRange()) {
              <!-- Valid Range Background (Green) -->
              <rect 
                [attr.x]="getYearX(validRange()!.start)" 
                y="50" 
                [attr.width]="Math.max(0, getYearX(validRange()!.end) - getYearX(validRange()!.start))" 
                height="20" 
                fill="url(#validGradient)"
                rx="4"
              />
              
              <defs>
                <linearGradient id="validGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" style="stop-color:#10B981;stop-opacity:0.3" />
                  <stop offset="100%" style="stop-color:#34D399;stop-opacity:0.3" />
                </linearGradient>
              </defs>

              <!-- Draggable Selection Window -->
              <g class="cursor-pointer">
                <!-- Selection Bar -->
                <rect 
                  [attr.x]="getYearX(selectedStartYear())" 
                  y="45" 
                  [attr.width]="Math.max(0, getYearX(selectedEndYear()) - getYearX(selectedStartYear()))" 
                  height="30" 
                  fill="#F59E0B"
                  opacity="0.2"
                  rx="4"
                  (mousedown)="startDrag('range', $event)"
                />
                
                <!-- Start Handle -->
                <g [attr.transform]="'translate(' + getYearX(selectedStartYear()) + ', 40)'" 
                   class="cursor-ew-resize hover:scale-110 transition-transform"
                   (mousedown)="startDrag('start', $event)">
                  <path d="M0,0 L-8,10 L-8,30 L8,30 L8,10 Z" fill="#F59E0B" />
                  <line x1="0" y1="10" x2="0" y2="25" stroke="white" stroke-width="2" />
                </g>
                
                <!-- End Handle -->
                <g [attr.transform]="'translate(' + getYearX(selectedEndYear()) + ', 40)'" 
                   class="cursor-ew-resize hover:scale-110 transition-transform"
                   (mousedown)="startDrag('end', $event)">
                  <path d="M0,0 L-8,10 L-8,30 L8,30 L8,10 Z" fill="#F59E0B" />
                  <line x1="0" y1="10" x2="0" y2="25" stroke="white" stroke-width="2" />
                </g>
              </g>
            }
          </svg>
        </div>
      </div>

      <!-- Date Inputs -->
      <div class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 mb-6">
        <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">Backtest Period</h3>
        
        <div class="grid md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Start Date</label>
            <input 
              type="date" 
              [ngModel]="formatDateForInput(scenario()?.startDate)"
              (change)="onDateInput('start', $event)"
              [min]="formatDateForInput(minDate())"
              [max]="formatDateForInput(scenario()?.endDate)"
              class="input dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">End Date</label>
            <input 
              type="date" 
              [ngModel]="formatDateForInput(scenario()?.endDate)"
              (change)="onDateInput('end', $event)"
              [min]="formatDateForInput(scenario()?.startDate)"
              [max]="formatDateForInput(maxDate())"
              class="input dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100"
            />
          </div>
        </div>
        
        <div class="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center space-x-3">
          <mat-icon class="text-amber-500">info</mat-icon>
          <span class="text-sm text-amber-700 dark:text-amber-300">
            Selected period: <strong>{{ calculateTradingDays() }}</strong> trading days (~{{ calculateYears() }} years)
          </span>
        </div>
      </div>

    </div>
  `,
  styles: [`
    /* Remove default drag ghost image */
    .cursor-ew-resize { user-select: none; }
  `]
})
export class HistoricalDataAlignerComponent implements OnInit {
  @Input({ required: true }) draft!: StrategyDraft;
  @Output() scenarioChanged = new EventEmitter<HistoricScenario>();
  @ViewChild('timelineSvg') timelineSvg!: ElementRef<SVGSVGElement>;

  private strategyService = inject(StrategyService);

  // Timeline Config
  readonly timelineStartYear = 1993;
  readonly timelineEndYear = new Date().getFullYear();
  readonly Math = Math; // Expose Math to template

  // State
  readonly selectedTickers = signal<string[]>([]);
  readonly tickerAvailability = signal<TickerAvailability[]>([]);
  readonly loadingData = signal(false);

  // Selection State (Years as floats for precision)
  readonly selectedStartYear = signal<number>(2010);
  readonly selectedEndYear = signal<number>(2020);

  // Local scenario state to avoid depending on async parent updates
  private localScenario = signal<HistoricScenario | null>(null);

  // Form Control for Search
  tickerControl = new FormControl('');
  readonly availableTickers = signal<string[]>([]);
  readonly loadingTickers = signal(false);
  filteredOptions = this.tickerControl.valueChanges.pipe(
    startWith(''),
    map(value => this._filter(value || '')),
  );

  // Computed - prefer local state, fallback to draft
  readonly scenario = computed(() => this.localScenario() || (this.draft.scenario as HistoricScenario | undefined));
  
  readonly validRange = computed(() => {
    const tickers = this.tickerAvailability();
    if (tickers.length === 0) return null;
    
    // Intersection of all tickers
    const maxStart = Math.max(...tickers.map(t => t.startYear));
    const minEnd = Math.min(...tickers.map(t => t.endYear));
    
    if (maxStart >= minEnd) return null;
    return { start: maxStart, end: minEnd };
  });

  readonly yearMarkers = computed(() => {
    const markers: number[] = [];
    for (let year = this.timelineStartYear; year <= this.timelineEndYear; year += 5) {
      markers.push(year);
    }
    return markers;
  });

  readonly minDate = computed(() => {
    const range = this.validRange();
    return range ? this.yearToDate(range.start) : new Date('1993-01-01');
  });

  readonly maxDate = computed(() => {
    const range = this.validRange();
    return range ? this.yearToDate(range.end) : new Date();
  });

  ngOnInit() {
    // Load available tickers from backend
    this.loadingTickers.set(true);
    this.strategyService.getAvailableTickers().subscribe(tickers => {
      this.availableTickers.set(tickers);
      this.loadingTickers.set(false);
    });

    // Load existing selection from draft
    if (this.draft.indices) {
      const tickers = this.draft.indices.map(i => i.symbol);
      this.selectedTickers.set(tickers);
      this.loadTickerData(tickers);
    }

    // Initialize scenario - always set local state first
    const existingScenario = this.draft.scenario as HistoricScenario | undefined;
    if (existingScenario?.startDate && existingScenario?.endDate) {
      this.localScenario.set(existingScenario);
      this.selectedStartYear.set(this.dateToYear(new Date(existingScenario.startDate)));
      this.selectedEndYear.set(this.dateToYear(new Date(existingScenario.endDate)));
    } else {
      // No existing scenario - use defaults and emit
      this.localScenario.set(DEFAULT_HISTORIC_SCENARIO);
      this.selectedStartYear.set(this.dateToYear(new Date(DEFAULT_HISTORIC_SCENARIO.startDate)));
      this.selectedEndYear.set(this.dateToYear(new Date(DEFAULT_HISTORIC_SCENARIO.endDate)));
      this.scenarioChanged.emit(DEFAULT_HISTORIC_SCENARIO);
    }
  }

  // --- Data Loading ---

  private async loadTickerData(tickers: string[]) {
    this.loadingData.set(true);
    const availability: TickerAvailability[] = [];
    const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i];
      try {
        // Fetch history to determine start/end dates
        const history = await firstValueFrom(this.strategyService.getHistoricalData(ticker));
        
        if (history && history.length > 0) {
          // Assuming history is sorted, or backend returns dates. 
          // Since getHistoricalData returns {price, vol}, we assume it starts from 1993 or later.
          // For MVP, we'll approximate based on array length assuming daily data ending today.
          // Ideally, backend should return { startDate, endDate } metadata.
          
          // Hack for MVP: Assume data ends today and calculate start based on length
          const endDate = new Date();
          const tradingDays = history.length;
          const yearsOfData = tradingDays / 252;
          const startDate = new Date();
          startDate.setFullYear(endDate.getFullYear() - Math.floor(yearsOfData));

          availability.push({
            ticker: ticker.toUpperCase(),
            startYear: this.dateToYear(startDate),
            endYear: this.dateToYear(endDate),
            color: colors[i % colors.length]
          });
        } else {
            // Fallback if no data found (e.g. mock mode off but DB empty)
            availability.push({
                ticker: ticker.toUpperCase(),
                startYear: 2000,
                endYear: 2024,
                color: '#94A3B8' // Grey for missing data
            });
        }
      } catch (e) {
        console.error(`Failed to load data for ${ticker}`, e);
      }
    }

    this.tickerAvailability.set(availability);
    this.loadingData.set(false);
    this.snapToValidRange();
  }

  // --- Asset Management ---

  addTicker(ticker: string) {
    const current = this.selectedTickers();
    if (!current.includes(ticker)) {
      const updated = [...current, ticker];
      this.selectedTickers.set(updated);
      this.loadTickerData(updated);
      this.updateDraftIndices(updated);
      this.tickerControl.setValue('');
    }
  }

  removeTicker(ticker: string) {
    const updated = this.selectedTickers().filter(t => t !== ticker);
    this.selectedTickers.set(updated);
    this.loadTickerData(updated);
    this.updateDraftIndices(updated);
  }

  private updateDraftIndices(tickers: string[]) {
    // Update the main draft object so other steps know about these assets
    const indices: Index[] = tickers.map(t => ({
      symbol: t,
      name: t,
      model: StochasticModel.BlockedBootstrap, // Default for historic
      parameters: DEFAULT_HESTON_PARAMS // Placeholder
    }));
    this.strategyService.updateDraft({ indices });
  }

  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();
    // Exclude already selected tickers from suggestions
    const selected = this.selectedTickers();
    return this.availableTickers()
      .filter(option => !selected.includes(option))
      .filter(option => option.toLowerCase().includes(filterValue));
  }

  // --- Timeline Logic ---

  getYearX(year: number): number {
    const range = this.timelineEndYear - this.timelineStartYear;
    const position = (year - this.timelineStartYear) / range;
    return 50 + position * 700; // 50px padding, 700px width
  }

  getXYear(x: number): number {
    const range = this.timelineEndYear - this.timelineStartYear;
    const position = (x - 50) / 700;
    return this.timelineStartYear + position * range;
  }

  // --- Drag & Drop ---

  public isDragging = false; // FIX: Made public for template access
  private dragTarget: 'start' | 'end' | 'range' | null = null;
  private dragStartSvgX = 0;
  private initialStartYear = 0;
  private initialEndYear = 0;

  startDrag(target: 'start' | 'end' | 'range', event: MouseEvent) {
    this.isDragging = true;
    this.dragTarget = target;
    this.dragStartSvgX = this.screenToSvgX(event.clientX);
    this.initialStartYear = this.selectedStartYear();
    this.initialEndYear = this.selectedEndYear();
    event.preventDefault();
  }

  @HostListener('window:mousemove', ['$event'])
  onDrag(event: MouseEvent) {
    if (!this.isDragging || !this.dragTarget) return;
    event.preventDefault(); // Stop text selection

    // Convert to SVG coordinates for accurate calculation
    const currentSvgX = this.screenToSvgX(event.clientX);
    const deltaSvgPixels = currentSvgX - this.dragStartSvgX;
    const svgPixelPerYear = 700 / (this.timelineEndYear - this.timelineStartYear);
    const deltaYears = deltaSvgPixels / svgPixelPerYear;

    // FIX: Simplified drag logic to prevent flickering
    // We calculate raw new values first
    let newStart = this.initialStartYear;
    let newEnd = this.initialEndYear;

    if (this.dragTarget === 'start') {
      newStart = this.initialStartYear + deltaYears;
      // Simple clamp, don't snap yet
      newStart = Math.min(newStart, this.selectedEndYear() - 0.5); 
    } else if (this.dragTarget === 'end') {
      newEnd = this.initialEndYear + deltaYears;
      newEnd = Math.max(newEnd, this.selectedStartYear() + 0.5);
    } else if (this.dragTarget === 'range') {
      const duration = this.initialEndYear - this.initialStartYear;
      newStart = this.initialStartYear + deltaYears;
      newEnd = newStart + duration;
    }

    // Update signals directly for smooth UI
    this.selectedStartYear.set(newStart);
    this.selectedEndYear.set(newEnd);
  }

  @HostListener('window:mouseup')
  onDragEnd() {
    if (this.isDragging) {
      // Only snap and update scenario when drag actually ends
      this.snapToValidRange();
      this.updateScenarioDates();
    }
    this.isDragging = false;
    this.dragTarget = null;
  }

  private snapToValidRange() {
    const valid = this.validRange();
    if (!valid) return;

    let start = this.selectedStartYear();
    let end = this.selectedEndYear();

    // Clamp to valid range boundaries
    if (start < valid.start) start = valid.start;
    if (end > valid.end) end = valid.end;
    
    // Ensure start < end
    if (start >= end) {
        start = valid.start;
        end = Math.min(valid.end, valid.start + 5);
    }

    this.selectedStartYear.set(start);
    this.selectedEndYear.set(end);
    this.updateScenarioDates();
  }

  // --- Date Handling ---

  dateToYear(date: Date): number {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = (date.getTime() - startOfYear.getTime()) / 86400000;
    return date.getFullYear() + dayOfYear / 365;
  }

  yearToDate(yearFloat: number): Date {
    const year = Math.floor(yearFloat);
    const remainder = yearFloat - year;
    const days = Math.floor(remainder * 365);
    const date = new Date(year, 0, 1);
    date.setDate(days + 1); // +1 because Jan 1 is day 1
    return date;
  }

  formatDateForInput(dateStr: string | Date | undefined): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
  }

  onDateInput(type: 'start' | 'end', event: Event) {
    const input = event.target as HTMLInputElement;
    const date = new Date(input.value);
    const year = this.dateToYear(date);

    if (type === 'start') this.selectedStartYear.set(year);
    else this.selectedEndYear.set(year);
    
    this.updateScenarioDates();
  }

  updateScenarioDates() {
    const s = this.yearToDate(this.selectedStartYear());
    const e = this.yearToDate(this.selectedEndYear());
    
    const current = this.scenario() || DEFAULT_HISTORIC_SCENARIO;
    this.emitScenario({
      ...current,
      startDate: s.toISOString(),
      endDate: e.toISOString()
    });
  }

  // --- Calculations & Outputs ---

  calculateTradingDays(): number {
    const s = this.scenario();
    let start: Date;
    let end: Date;

    if (s?.startDate && s?.endDate) {
      start = new Date(s.startDate);
      end = new Date(s.endDate);
    } else {
      // Fallback to year signals
      start = this.yearToDate(this.selectedStartYear());
      end = this.yearToDate(this.selectedEndYear());
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays * 252 / 365);
  }

  calculateYears(): string {
    return (this.calculateTradingDays() / 252).toFixed(1);
  }

  private emitScenario(s: HistoricScenario) {
    this.localScenario.set(s); // Update local state immediately
    this.scenarioChanged.emit(s);
  }

  // Convert screen X coordinate to SVG viewBox X coordinate
  private screenToSvgX(screenX: number): number {
    if (!this.timelineSvg?.nativeElement) return screenX;
    const svg = this.timelineSvg.nativeElement;
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    // Scale from screen coordinates to viewBox coordinates
    return ((screenX - rect.left) / rect.width) * viewBox.width;
  }
}