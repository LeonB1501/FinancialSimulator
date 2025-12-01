import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { 
  StrategyDraft, 
  CustomTicker, 
  StochasticModel,
  DEFAULT_HESTON_PARAMS,
} from '@core/models';

@Component({
  selector: 'qs-custom-tickers',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
  ],
  template: `
    <div class="max-w-4xl">
      <div class="mb-8">
        <h1 class="text-2xl lg:text-3xl font-bold text-surface-900 mb-2">
          Custom Tickers
        </h1>
        <p class="text-surface-600">
          Create custom synthetic assets with your own parameters. This step is optional.
        </p>
      </div>

      <!-- Info Box -->
      <div class="p-6 bg-blue-50 border border-blue-100 rounded-xl mb-8">
        <div class="flex items-start space-x-4">
          <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div>
            <h4 class="font-medium text-blue-900 mb-1">When to Use Custom Tickers</h4>
            <p class="text-sm text-blue-700">
              Custom tickers are useful when you want to simulate assets that aren't in our pre-configured list, 
              or when you want to test hypothetical scenarios with specific volatility and correlation characteristics.
            </p>
          </div>
        </div>
      </div>

      <!-- Custom Tickers List -->
      @if (customTickers().length > 0) {
        <div class="space-y-4 mb-8">
          @for (ticker of customTickers(); track ticker.id; let i = $index) {
            <div class="card p-6">
              <div class="flex items-start justify-between mb-4">
                <div>
                  <div class="flex items-center space-x-3">
                    <span class="font-mono text-xl font-bold text-accent-600">{{ ticker.symbol }}</span>
                    <span class="px-2 py-1 bg-surface-100 text-surface-600 text-xs rounded-full">
                      {{ getModelLabel(ticker.model) }}
                    </span>
                  </div>
                  <p class="text-surface-600 mt-1">{{ ticker.name }}</p>
                </div>
                <button
                  (click)="removeTicker(i)"
                  class="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>
              <div class="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span class="text-surface-500">κ:</span>
                  <!-- FIX: Use helper method instead of casting in template -->
                  <span class="ml-2 font-mono">{{ getParam(ticker, 'kappa') }}</span>
                </div>
                <div>
                  <span class="text-surface-500">θ:</span>
                  <span class="ml-2 font-mono">{{ getParam(ticker, 'theta') }}</span>
                </div>
                <div>
                  <span class="text-surface-500">σ:</span>
                  <span class="ml-2 font-mono">{{ getParam(ticker, 'sigma') }}</span>
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Add Ticker Form -->
      @if (showForm()) {
        <div class="card p-6 mb-8">
          <h3 class="text-lg font-semibold text-surface-900 mb-6">Add Custom Ticker</h3>
          
          <div class="grid md:grid-cols-2 gap-6 mb-6">
            <mat-form-field appearance="outline">
              <mat-label>Symbol</mat-label>
              <input matInput [(ngModel)]="newTicker.symbol" placeholder="e.g., CUSTOM1" maxlength="10" class="font-mono uppercase">
              <mat-hint>3-10 characters, letters and numbers only</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Name</mat-label>
              <input matInput [(ngModel)]="newTicker.name" placeholder="e.g., My Custom Asset">
            </mat-form-field>
          </div>

          <div class="mb-6">
            <label class="block text-sm font-medium text-surface-700 mb-2">Model</label>
            <mat-form-field appearance="outline" class="w-full md:w-1/2">
              <mat-select [(ngModel)]="newTicker.model">
                <mat-option [value]="StochasticModel.Heston">Heston</mat-option>
                <mat-option [value]="StochasticModel.GBM">GBM</mat-option>
                <mat-option [value]="StochasticModel.GARCH">GARCH</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <h4 class="font-medium text-surface-900 mb-4">Parameters</h4>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <mat-form-field appearance="outline">
              <mat-label>κ (Mean Reversion)</mat-label>
              <input matInput type="number" [(ngModel)]="newTicker.params.kappa" step="0.1">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>θ (Long-term Var)</mat-label>
              <input matInput type="number" [(ngModel)]="newTicker.params.theta" step="0.01">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>σ (Vol of Vol)</mat-label>
              <input matInput type="number" [(ngModel)]="newTicker.params.sigma" step="0.1">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>ρ (Correlation)</mat-label>
              <input matInput type="number" [(ngModel)]="newTicker.params.rho" step="0.1" min="-1" max="1">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>v₀ (Initial Var)</mat-label>
              <input matInput type="number" [(ngModel)]="newTicker.params.v0" step="0.01">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>S₀ (Initial Price)</mat-label>
              <input matInput type="number" [(ngModel)]="newTicker.params.s0" step="1">
            </mat-form-field>
          </div>

          <div class="flex justify-end space-x-3">
            <button (click)="cancelAdd()" class="btn-secondary btn-md">Cancel</button>
            <button (click)="addTicker()" [disabled]="!isValidTicker()" class="btn-primary btn-md">Add Ticker</button>
          </div>
        </div>
      } @else {
        <!-- Empty State / Add Button -->
        <div class="card p-12 text-center border-2 border-dashed border-surface-200">
          @if (customTickers().length === 0) {
            <div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
              </svg>
            </div>
            <h3 class="text-lg font-medium text-surface-900 mb-2">No custom tickers</h3>
            <p class="text-surface-600 mb-6">Create custom synthetic assets with configurable parameters.</p>
          }
          <button (click)="showForm.set(true)" class="btn-primary btn-md inline-flex">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
            Add Custom Ticker
          </button>
        </div>
      }

      <!-- Skip Notice -->
      <div class="mt-8 p-4 bg-surface-100 rounded-xl text-center">
        <p class="text-sm text-surface-600">
          This step is optional. You can skip it if you're only using pre-configured indices.
        </p>
      </div>
    </div>
  `,
})
export class CustomTickersComponent {
  @Input({ required: true }) draft!: StrategyDraft;
  @Output() tickersChanged = new EventEmitter<CustomTicker[]>();

  readonly StochasticModel = StochasticModel;
  readonly showForm = signal(false);

  newTicker = {
    symbol: '',
    name: '',
    model: StochasticModel.Heston,
    params: { ...DEFAULT_HESTON_PARAMS },
  };

  customTickers = () => this.draft.customTickers || [];

  getModelLabel(model: StochasticModel): string {
    const labels: Record<StochasticModel, string> = {
      [StochasticModel.Heston]: 'Heston',
      [StochasticModel.GBM]: 'GBM',
      [StochasticModel.GARCH]: 'GARCH',
      [StochasticModel.BlockedBootstrap]: 'Bootstrap',
      [StochasticModel.RegimeSwitching]: 'Regime',
    };
    return labels[model];
  }

  isValidTicker(): boolean {
    return (
      this.newTicker.symbol.length >= 3 &&
      this.newTicker.symbol.length <= 10 &&
      this.newTicker.name.length > 0
    );
  }

  addTicker(): void {
    if (!this.isValidTicker()) return;

    const ticker: CustomTicker = {
      id: crypto.randomUUID(),
      symbol: this.newTicker.symbol.toUpperCase(),
      name: this.newTicker.name,
      model: this.newTicker.model,
      parameters: { ...this.newTicker.params },
      createdAt: new Date(),
    };

    this.tickersChanged.emit([...this.customTickers(), ticker]);
    this.resetForm();
  }

  removeTicker(index: number): void {
    const updated = [...this.customTickers()];
    updated.splice(index, 1);
    this.tickersChanged.emit(updated);
  }

  cancelAdd(): void {
    this.resetForm();
  }

  private resetForm(): void {
    this.newTicker = {
      symbol: '',
      name: '',
      model: StochasticModel.Heston,
      params: { ...DEFAULT_HESTON_PARAMS },
    };
    this.showForm.set(false);
  }

  getParam(ticker: CustomTicker, param: string): number | string {
    return (ticker.parameters as any)[param] || '-';
  }
}
