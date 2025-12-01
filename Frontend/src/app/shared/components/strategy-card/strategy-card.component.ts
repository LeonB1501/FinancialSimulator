import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { StrategySummary, StrategyStatus, SimulationMode, StochasticModel } from '@core/models';

@Component({
  selector: 'qs-strategy-card',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  template: `
    <div class="card-hover p-6 group">
      <!-- Header -->
      <div class="flex items-start justify-between mb-4">
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-semibold text-surface-900 truncate">{{ strategy.name }}</h3>
          <p class="text-sm text-surface-500 mt-1">{{ modelLabel }} • {{ modeLabel }}</p>
        </div>
        <span [class]="statusClasses">
          {{ statusLabel }}
        </span>
      </div>

      <!-- Indices -->
      <div class="flex flex-wrap gap-2 mb-4">
        @for (index of strategy.indices; track index) {
          <span class="px-2.5 py-1 bg-surface-100 text-surface-600 text-xs font-medium rounded-full">
            {{ index }}
          </span>
        }
      </div>

      <!-- Meta -->
      <p class="text-sm text-surface-400 mb-4">
        Updated {{ strategy.updatedAt | date:'MMM d, y, h:mm a' }}
      </p>

      <!-- Actions -->
      <div class="flex items-center space-x-3 pt-4 border-t border-surface-100">
        @if (strategy.hasResults) {
          <a 
            [routerLink]="['/results', strategy.id]"
            class="flex-1 btn-primary btn-sm text-center"
          >
            View Results
          </a>
        } @else {
          <button 
            (click)="run.emit(strategy)"
            class="flex-1 btn-primary btn-sm"
          >
            Run Simulation
          </button>
        }
        <button 
          (click)="edit.emit(strategy)"
          class="btn-secondary btn-sm px-3"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>
        <button 
          (click)="delete.emit(strategy)"
          class="btn-ghost btn-sm px-3 text-red-500 hover:bg-red-50"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>
    </div>
  `,
})
export class StrategyCardComponent {
  @Input({ required: true }) strategy!: StrategySummary;
  
  @Output() run = new EventEmitter<StrategySummary>();
  @Output() edit = new EventEmitter<StrategySummary>();
  @Output() delete = new EventEmitter<StrategySummary>();

  get modelLabel(): string {
    const labels: Record<StochasticModel, string> = {
      [StochasticModel.Heston]: 'Heston',
      [StochasticModel.GBM]: 'GBM',
      [StochasticModel.GARCH]: 'GARCH',
      [StochasticModel.BlockedBootstrap]: 'Bootstrap',
      [StochasticModel.RegimeSwitching]: 'Regime',
    };
    return labels[this.strategy.model] || this.strategy.model;
  }

  get modeLabel(): string {
    return this.strategy.mode === SimulationMode.Accumulation ? 'Accumulation' : 'Retirement';
  }

  get statusLabel(): string {
    const labels: Record<StrategyStatus, string> = {
      [StrategyStatus.Draft]: 'Draft',
      [StrategyStatus.Ready]: 'Ready',
      [StrategyStatus.Running]: 'Running',
      [StrategyStatus.Completed]: 'Completed',
      [StrategyStatus.Failed]: 'Failed',
    };
    return labels[this.strategy.status] || this.strategy.status;
  }

  get statusClasses(): string {
    const base = 'px-2.5 py-1 text-xs font-medium rounded-full';
    const colors: Record<StrategyStatus, string> = {
      [StrategyStatus.Draft]: 'bg-surface-100 text-surface-600',
      [StrategyStatus.Ready]: 'bg-blue-100 text-blue-700',
      [StrategyStatus.Running]: 'bg-amber-100 text-amber-700',
      [StrategyStatus.Completed]: 'bg-green-100 text-green-700',
      [StrategyStatus.Failed]: 'bg-red-100 text-red-700',
    };
    return `${base} ${colors[this.strategy.status]}`;
  }
}
