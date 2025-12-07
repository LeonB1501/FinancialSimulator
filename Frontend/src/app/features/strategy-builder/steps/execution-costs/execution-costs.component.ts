import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { StrategyDraft, ExecutionCosts, VolatilityTier, DEFAULT_EXECUTION_COSTS } from '@core/models';

@Component({
  selector: 'qs-execution-costs',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
  template: `
    <div class="max-w-4xl mx-auto">
      <div class="mb-8">
        <h1 class="text-2xl lg:text-3xl font-bold text-surface-900 dark:text-surface-100 mb-2">
          Execution & Costs
        </h1>
        <p class="text-surface-600 dark:text-surface-400">
          Model realistic market friction. Define commissions and volatility-based spreads.
        </p>
      </div>

      <!-- 1. Commissions -->
      <div class="card p-6 mb-8 dark:bg-surface-800">
        <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4 flex items-center">
          <mat-icon class="text-accent-500 mr-2">payments</mat-icon>
          Commissions
        </h3>
        <div class="grid md:grid-cols-2 gap-6">
          <div>
            <label class="label dark:text-surface-300">Per Order Fee (Flat)</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">$</span>
              <input 
                type="number" 
                [(ngModel)]="costs.commission.perOrder" 
                (change)="emitChange()" 
                class="input pl-8 dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100" 
                placeholder="0.00"
                min="0"
                step="0.5"
              >
            </div>
            <p class="text-xs text-surface-500 mt-1">Applied once per trade execution.</p>
          </div>
          <div>
            <label class="label dark:text-surface-300">Per Unit Fee</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">$</span>
              <input 
                type="number" 
                [(ngModel)]="costs.commission.perUnit" 
                (change)="emitChange()" 
                class="input pl-8 dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100" 
                placeholder="0.00"
                min="0"
                step="0.01"
              >
            </div>
            <p class="text-xs text-surface-500 mt-1">Applied per share or contract.</p>
          </div>
        </div>
      </div>

      <!-- 2. Volatility-Based Spreads -->
      <div class="card p-6 dark:bg-surface-800">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 flex items-center">
            <mat-icon class="text-accent-500 mr-2">show_chart</mat-icon>
            Dynamic Spreads
          </h3>
          <button (click)="addTier()" class="btn-secondary btn-sm">
            + Add Volatility Tier
          </button>
        </div>

        <p class="text-sm text-surface-600 dark:text-surface-400 mb-6 bg-surface-50 dark:bg-surface-700/50 p-3 rounded-lg border border-surface-100 dark:border-surface-700">
          Define how the Bid/Ask spread widens as market volatility increases. 
          The engine will check the current volatility of the underlying asset and apply the matching spread penalty.
        </p>

        <!-- Base Spread -->
        <div class="mb-6 max-w-xs">
          <label class="label dark:text-surface-300">Base Spread (Default)</label>
          <div class="relative">
            <input 
              type="number" 
              [(ngModel)]="costs.slippage.defaultSpread" 
              (change)="emitChange()" 
              class="input pr-8 dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100" 
              step="0.01"
              min="0"
            >
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">%</span>
          </div>
        </div>

        <!-- Tiers Table -->
        @if (costs.slippage.volatilityTiers.length > 0) {
          <div class="overflow-hidden rounded-xl border border-surface-200 dark:border-surface-700">
            <table class="w-full text-sm text-left">
              <thead class="bg-surface-50 dark:bg-surface-900 text-surface-500 dark:text-surface-400">
                <tr>
                  <th class="px-4 py-3 font-medium">Min Volatility</th>
                  <th class="px-4 py-3 font-medium">Max Volatility</th>
                  <th class="px-4 py-3 font-medium">Spread Penalty</th>
                  <th class="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-surface-100 dark:divide-surface-700">
                @for (tier of costs.slippage.volatilityTiers; track $index) {
                  <tr class="bg-white dark:bg-surface-800">
                    <td class="px-4 py-2">
                      <div class="relative w-24">
                        <input 
                          type="number" 
                          [(ngModel)]="tier.minVol" 
                          (change)="emitChange()" 
                          class="w-full bg-transparent border-b border-surface-300 dark:border-surface-600 focus:border-accent-500 outline-none text-surface-900 dark:text-surface-100 text-right pr-4" 
                          step="1"
                        >
                        <span class="absolute right-0 top-0 text-surface-400">%</span>
                      </div>
                    </td>
                    <td class="px-4 py-2">
                      <div class="relative w-24">
                        <input 
                          type="number" 
                          [(ngModel)]="tier.maxVol" 
                          (change)="emitChange()" 
                          class="w-full bg-transparent border-b border-surface-300 dark:border-surface-600 focus:border-accent-500 outline-none text-surface-900 dark:text-surface-100 text-right pr-4" 
                          step="1"
                        >
                        <span class="absolute right-0 top-0 text-surface-400">%</span>
                      </div>
                    </td>
                    <td class="px-4 py-2">
                      <div class="relative w-24">
                        <input 
                          type="number" 
                          [(ngModel)]="tier.spread" 
                          (change)="emitChange()" 
                          class="w-full bg-transparent border-b border-surface-300 dark:border-surface-600 focus:border-accent-500 outline-none font-bold text-accent-600 dark:text-accent-400 text-right pr-4" 
                          step="0.01"
                        >
                        <span class="absolute right-0 top-0 text-surface-400">%</span>
                      </div>
                    </td>
                    <td class="px-4 py-2 text-right">
                      <button (click)="removeTier($index)" class="text-red-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-700">
                        <mat-icon class="text-sm w-4 h-4 leading-4">delete</mat-icon>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="text-xs text-surface-500 mt-2 italic">
            * Volatility ranges are inclusive of Min and exclusive of Max.
          </p>
        } @else {
          <div class="text-center p-8 border-2 border-dashed border-surface-200 dark:border-surface-700 rounded-xl">
            <p class="text-surface-500 dark:text-surface-400 mb-2">No volatility tiers defined.</p>
            <p class="text-xs text-surface-400 dark:text-surface-500">The default spread will be applied in all market conditions.</p>
          </div>
        }
      </div>
    </div>
  `
})
export class ExecutionCostsComponent implements OnInit {
  @Input({ required: true }) draft!: StrategyDraft;
  @Output() costsChanged = new EventEmitter<ExecutionCosts>();

  // Initialize with defaults to avoid null checks in template
  costs: ExecutionCosts = { ...DEFAULT_EXECUTION_COSTS };

  ngOnInit() {
    if (this.draft.executionCosts) {
      // Deep copy to avoid mutating draft directly
      this.costs = JSON.parse(JSON.stringify(this.draft.executionCosts));
    }
  }

  addTier() {
    this.costs.slippage.volatilityTiers.push({ minVol: 0, maxVol: 0, spread: 0 });
    this.emitChange();
  }

  removeTier(index: number) {
    this.costs.slippage.volatilityTiers.splice(index, 1);
    this.emitChange();
  }

  emitChange() {
    this.costsChanged.emit(this.costs);
  }
}