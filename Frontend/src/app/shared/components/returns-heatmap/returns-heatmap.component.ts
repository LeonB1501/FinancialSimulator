import { Component, Input, OnChanges, computed, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';

interface MonthlyReturn {
  year: number;
  months: (number | null)[]; // 0-11, null if no data
  total: number;
}

@Component({
  selector: 'qs-returns-heatmap',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  template: `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr>
            <th class="p-2 text-left font-medium text-surface-500 dark:text-surface-400">Year</th>
            @for (month of months; track month) {
              <th class="p-2 font-medium text-surface-500 dark:text-surface-400">{{ month }}</th>
            }
            <th class="p-2 font-bold text-surface-900 dark:text-surface-100">YTD</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-surface-100 dark:divide-surface-700">
          @for (row of heatmapData(); track row.year) {
            <tr>
              <td class="p-2 font-mono font-medium text-surface-700 dark:text-surface-300">{{ row.year }}</td>
              @for (val of row.months; track $index) {
                <td class="p-1">
                  @if (val !== null) {
                    <div 
                      class="w-full h-8 rounded flex items-center justify-center text-xs font-medium transition-colors hover:opacity-80"
                      [style.background-color]="getColor(val)"
                      [class.text-white]="Math.abs(val) > 0.05"
                      [class.text-surface-900]="Math.abs(val) <= 0.05"
                    >
                      {{ val * 100 | number:'1.1-1' }}%
                    </div>
                  } @else {
                    <div class="w-full h-8 bg-surface-50 dark:bg-surface-800 rounded"></div>
                  }
                </td>
              }
              <td class="p-2 font-bold text-right" [class]="row.total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                {{ row.total * 100 | number:'1.1-1' }}%
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class ReturnsHeatmapComponent implements OnChanges {
  @Input({ required: true }) dates!: string[] | Date[];
  @Input({ required: true }) values!: number[]; // Equity curve values

  readonly months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  readonly Math = Math;
  
  readonly heatmapData = signal<MonthlyReturn[]>([]);

  ngOnChanges(): void {
    this.calculateHeatmap();
  }

  private calculateHeatmap(): void {
    if (!this.dates || !this.values || this.dates.length !== this.values.length || this.dates.length === 0) {
      this.heatmapData.set([]);
      return;
    }

    // Map by Year -> Month -> { startPrice, endPrice }
    const years = new Map<number, { months: (number | null)[]; startVal: number; endVal: number }>();
    
    // Initialize structure
    const startYear = new Date(this.dates[0]).getFullYear();
    const endYear = new Date(this.dates[this.dates.length - 1]).getFullYear();

    for (let y = startYear; y <= endYear; y++) {
      years.set(y, { 
        months: Array(12).fill(null),
        startVal: 0, 
        endVal: 0 
      });
    }

    // Helper to get month-end values
    // We iterate through days to find the last value of each month
    let currentYear = new Date(this.dates[0]).getFullYear();
    let currentMonth = new Date(this.dates[0]).getMonth();
    
    // Set initial previous price for the very first month calculation
    // Ideally, monthly return = (End / Start) - 1.
    // Start of Month N is End of Month N-1.
    
    // We simplify: Calculate percentage change of equity curve between last day of month M and last day of month M-1.
    
    // 1. Build a map of "Last Value per Month"
    const monthEndValues = new Map<string, number>(); // Key: "YYYY-MM", Value: equity
    
    // Set "Start" value (virtual month 0 for the first real month)
    const firstDate = new Date(this.dates[0]);
    const prevMonthKey = this.getPrevMonthKey(firstDate.getFullYear(), firstDate.getMonth());
    monthEndValues.set(prevMonthKey, this.values[0]); 

    for (let i = 0; i < this.dates.length; i++) {
      const d = new Date(this.dates[i]);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthEndValues.set(key, this.values[i]); // Keep overwriting until the last day of month stays
    }

    // 2. Calculate Returns
    const result: MonthlyReturn[] = [];

    // Sort years descending (newest top)
    const sortedYears = Array.from(years.keys()).sort((a, b) => b - a);

    for (const year of sortedYears) {
      const row: MonthlyReturn = { year, months: Array(12).fill(null), total: 0 };
      
      let yearStartVal = 0;
      let yearEndVal = 0;
      let hasData = false;

      for (let m = 0; m < 12; m++) {
        const currentKey = `${year}-${m}`;
        const prevKey = this.getPrevMonthKey(year, m);

        if (monthEndValues.has(currentKey) && monthEndValues.has(prevKey)) {
          const start = monthEndValues.get(prevKey)!;
          const end = monthEndValues.get(currentKey)!;
          
          if (start !== 0) {
            row.months[m] = (end - start) / start;
            
            // Track Year Total
            if (!hasData) {
              yearStartVal = start;
              hasData = true;
            }
            yearEndVal = end;
          }
        }
      }

      if (hasData && yearStartVal !== 0) {
        row.total = (yearEndVal - yearStartVal) / yearStartVal;
      }
      
      result.push(row);
    }

    this.heatmapData.set(result);
  }

  private getPrevMonthKey(year: number, month: number): string {
    if (month === 0) return `${year - 1}-11`;
    return `${year}-${month - 1}`;
  }

  getColor(value: number): string {
    // Green for positive, Red for negative
    // Opacity scales with magnitude. Max out opacity at +/- 10%
    const intensity = Math.min(Math.abs(value) / 0.10, 1.0);
    
    // Light mode colors (can be adapted for dark mode via CSS variables if needed, 
    // but RGBA works well on both usually)
    if (value >= 0) {
      // Green-500: 16, 185, 129
      return `rgba(16, 185, 129, ${0.1 + intensity * 0.9})`; 
    } else {
      // Red-500: 239, 68, 68
      return `rgba(239, 68, 68, ${0.1 + intensity * 0.9})`;
    }
  }
}