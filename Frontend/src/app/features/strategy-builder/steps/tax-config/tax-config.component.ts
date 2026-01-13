import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { StrategyDraft, TaxConfig, DEFAULT_TAX_CONFIG } from '@core/models';

@Component({
  selector: 'qs-tax-config',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="max-w-4xl mx-auto">
      <div class="mb-8">
        <h1 class="text-2xl lg:text-3xl font-bold text-surface-900 dark:text-surface-100 mb-2">
          Tax Configuration
        </h1>
        <p class="text-surface-600 dark:text-surface-400">
          Model the impact of taxes on your strategy. Select a preset or customize rates.
        </p>
      </div>

      <!-- Presets -->
      <div class="grid md:grid-cols-3 gap-6 mb-8">
        
        <!-- Tax Free / Deferred -->
        <button 
          (click)="applyPreset('none')"
          [class]="getCardClass('none')"
          class="p-6 rounded-2xl border text-left relative group transition-all"
        >
          <div class="flex items-center justify-between mb-4">
            <div class="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <mat-icon class="text-green-600 dark:text-green-400">savings</mat-icon>
            </div>
            @if (isPreset('none')) {
              <div class="w-4 h-4 bg-accent-500 rounded-full"></div>
            }
          </div>
          <h3 class="font-semibold text-surface-900 dark:text-surface-100">Tax Advantaged</h3>
          <p class="text-sm text-surface-500 mt-2">IRA, 401k, ISA, or Roth. No capital gains taxes applied during simulation.</p>
        </button>

        <!-- US Standard -->
        <button 
          (click)="applyPreset('us')"
          [class]="getCardClass('us')"
          class="p-6 rounded-2xl border text-left relative group transition-all"
        >
          <div class="flex items-center justify-between mb-4">
            <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <mat-icon class="text-blue-600 dark:text-blue-400">public</mat-icon>
            </div>
            @if (isPreset('us')) {
              <div class="w-4 h-4 bg-accent-500 rounded-full"></div>
            }
          </div>
          <h3 class="font-semibold text-surface-900 dark:text-surface-100">US Trader</h3>
          <p class="text-sm text-surface-500 mt-2">Standard US rates. 35% Short-term, 15% Long-term (>1yr). Annual settlement.</p>
        </button>

        <!-- Wealth Tax -->
        <button 
          (click)="applyPreset('wealth')"
          [class]="getCardClass('wealth')"
          class="p-6 rounded-2xl border text-left relative group transition-all"
        >
          <div class="flex items-center justify-between mb-4">
            <div class="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <mat-icon class="text-purple-600 dark:text-purple-400">account_balance</mat-icon>
            </div>
            @if (isPreset('wealth')) {
              <div class="w-4 h-4 bg-accent-500 rounded-full"></div>
            }
          </div>
          <h3 class="font-semibold text-surface-900 dark:text-surface-100">Wealth Tax</h3>
          <p class="text-sm text-surface-500 mt-2">Swiss/European style. 0% Capital Gains, but 0.5% annual tax on total equity.</p>
        </button>
      </div>

      <!-- Advanced Configuration (Visible if not Tax Free) -->
      @if (!isPreset('none')) {
        <div class="card p-6 dark:bg-surface-800 animate-in fade-in">
          <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-6 flex items-center">
            <mat-icon class="text-surface-400 mr-2">tune</mat-icon>
            Advanced Settings
          </h3>

          <div class="grid md:grid-cols-2 gap-8">
            <!-- Capital Gains -->
            <div class="space-y-4">
              <h4 class="text-sm font-medium text-surface-500 uppercase tracking-wider">Capital Gains</h4>
              
              <div>
                <label class="label dark:text-surface-300">Short Term Rate</label>
                <div class="relative">
                  <input 
                    type="number" 
                    [(ngModel)]="config.shortTermRate" 
                    (change)="emitChange()"
                    class="input pr-8 dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100"
                    step="0.01" min="0" max="1"
                  >
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">%</span>
                </div>
              </div>

              <div>
                <label class="label dark:text-surface-300">Long Term Rate</label>
                <div class="relative">
                  <input 
                    type="number" 
                    [(ngModel)]="config.longTermRate" 
                    (change)="emitChange()"
                    class="input pr-8 dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100"
                    step="0.01" min="0" max="1"
                  >
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">%</span>
                </div>
              </div>

              <div>
                <label class="label dark:text-surface-300">Long Term Threshold</label>
                <div class="relative">
                  <input 
                    type="number" 
                    [(ngModel)]="config.longTermThreshold" 
                    (change)="emitChange()"
                    class="input pr-16 dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100"
                    step="1" min="1"
                  >
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">days</span>
                </div>
              </div>
            </div>

            <!-- Settlement & Wealth -->
            <div class="space-y-4">
              <h4 class="text-sm font-medium text-surface-500 uppercase tracking-wider">Settlement & Wealth</h4>

              <div>
                <label class="label dark:text-surface-300">Wealth Tax (Annual)</label>
                <div class="relative">
                  <input 
                    type="number" 
                    [(ngModel)]="config.wealthTaxRate" 
                    (change)="emitChange()"
                    class="input pr-8 dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100"
                    step="0.01" min="0" max="1"
                  >
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">%</span>
                </div>
                <p class="text-xs text-surface-500 mt-1">Applied to total portfolio value at end of year.</p>
              </div>

              <div>
                <label class="label dark:text-surface-300">Settlement Mode</label>
                <div class="flex space-x-4 mt-2">
                  <label class="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="paymentMode" 
                      value="Periodic" 
                      [ngModel]="config.paymentMode" 
                      (ngModelChange)="config.paymentMode = $event; emitChange()"
                      class="text-accent-500 focus:ring-accent-500"
                    >
                    <span class="text-surface-700 dark:text-surface-300">Annual (Periodic)</span>
                  </label>
                  <label class="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="paymentMode" 
                      value="Immediate" 
                      [ngModel]="config.paymentMode" 
                      (ngModelChange)="config.paymentMode = $event; emitChange()"
                      class="text-accent-500 focus:ring-accent-500"
                    >
                    <span class="text-surface-700 dark:text-surface-300">Immediate (Withholding)</span>
                  </label>
                </div>
                <p class="text-xs text-surface-500 mt-2">
                  <strong>Annual:</strong> Taxes accumulate and are paid at year-end.<br>
                  <strong>Immediate:</strong> Taxes are deducted from cash immediately upon closing a trade.
                </p>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class TaxConfigComponent implements OnInit {
  @Input({ required: true }) draft!: StrategyDraft;
  @Output() configChanged = new EventEmitter<TaxConfig>();

  config: TaxConfig = { ...DEFAULT_TAX_CONFIG };

  ngOnInit() {
    if (this.draft.taxConfig) {
      this.config = JSON.parse(JSON.stringify(this.draft.taxConfig));
    }
  }

  getCardClass(preset: 'none' | 'us' | 'wealth'): string {
    const isSelected = this.isPreset(preset);
    if (isSelected) {
      return 'bg-accent-50 dark:bg-accent-900/20 border-accent-500 ring-1 ring-accent-500';
    }
    return 'bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700 hover:border-accent-300 dark:hover:border-accent-600 hover:shadow-md';
  }

  isPreset(preset: 'none' | 'us' | 'wealth'): boolean {
    if (preset === 'none') {
      return this.config.shortTermRate === 0 && this.config.longTermRate === 0 && this.config.wealthTaxRate === 0;
    }
    if (preset === 'us') {
      return this.config.shortTermRate === 0.35 && this.config.longTermRate === 0.15 && this.config.wealthTaxRate === 0;
    }
    if (preset === 'wealth') {
      return this.config.shortTermRate === 0 && this.config.wealthTaxRate === 0.005;
    }
    return false;
  }

  applyPreset(preset: 'none' | 'us' | 'wealth') {
    switch (preset) {
      case 'none':
        this.config = { ...DEFAULT_TAX_CONFIG };
        break;
      case 'us':
        this.config = {
          paymentMode: 'Periodic',
          settlementFrequency: 252,
          shortTermRate: 0.35,
          longTermRate: 0.15,
          longTermThreshold: 365,
          wealthTaxRate: 0.0
        };
        break;
      case 'wealth':
        this.config = {
          paymentMode: 'Periodic',
          settlementFrequency: 252,
          shortTermRate: 0.0,
          longTermRate: 0.0,
          longTermThreshold: 365,
          wealthTaxRate: 0.005 // 0.5%
        };
        break;
    }
    this.emitChange();
  }

  emitChange() {
    this.configChanged.emit(this.config);
  }
}