import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { HeaderComponent } from '@shared/components/header/header.component';
import { StrategyCardComponent } from '@shared/components/strategy-card/strategy-card.component';
import { StrategyService } from '@core/services/strategy.service';
import { SimulationService } from '@core/services/simulation.service';
import { SimulationQueueService } from '@core/services/simulation-queue.service';
import { NotificationService } from '@core/services/notification.service';
import { StrategySummary, Strategy, SimulationMode, StrategyStatus } from '@core/models';
import { SimulationProgressDialogComponent } from '../../strategy-builder/simulation-progress-dialog/simulation-progress-dialog.component';
import { ConfirmationDialogComponent, ConfirmationDialogData } from '@shared/components/confirmation-dialog/confirmation-dialog.component';

@Component({
  selector: 'qs-strategies-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, HeaderComponent, StrategyCardComponent],
  template: `
    <qs-header />
    
    <div class="pt-[72px] min-h-screen bg-surface-50 dark:bg-surface-900 transition-colors duration-300">
      <div class="container-fluid py-8">
        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 class="text-2xl lg:text-3xl font-bold text-surface-900 dark:text-surface-100">My Strategies</h1>
            <p class="text-surface-600 dark:text-surface-400 mt-1">Manage and organize your investment strategies.</p>
          </div>
          <a routerLink="/build" class="px-4 py-2 bg-accent-500 text-white font-medium rounded-lg hover:bg-accent-600 transition-colors flex items-center shadow-soft">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
            New Strategy
          </a>
        </div>

        <!-- Filters -->
        <div class="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-4 mb-8 shadow-soft dark:shadow-none">
          <div class="grid md:grid-cols-4 gap-4">
            <!-- Search -->
            <div class="md:col-span-2">
              <div class="relative">
                <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-surface-400 dark:text-surface-500">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </span>
                <input 
                  type="text" 
                  [(ngModel)]="searchQuery"
                  placeholder="Search strategies..." 
                  class="w-full pl-10 pr-4 py-2.5 border border-surface-200 dark:border-surface-600 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none transition-all bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500"
                >
              </div>
            </div>

            <!-- Mode Filter -->
            <div>
              <select 
                [(ngModel)]="modeFilter" 
                class="w-full px-4 py-2.5 border border-surface-200 dark:border-surface-600 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100"
              >
                <option value="">All Modes</option>
                <option [value]="SimulationMode.Accumulation">Accumulation</option>
                <option [value]="SimulationMode.Retirement">Retirement</option>
              </select>
            </div>

            <!-- Status Filter -->
            <div>
              <select 
                [(ngModel)]="statusFilter" 
                class="w-full px-4 py-2.5 border border-surface-200 dark:border-surface-600 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100"
              >
                <option value="">All Statuses</option>
                <option [value]="StrategyStatus.Draft">Draft</option>
                <option [value]="StrategyStatus.Ready">Ready</option>
                <option [value]="StrategyStatus.Completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Results Summary -->
        <div class="flex items-center justify-between mb-6">
          <p class="text-surface-600 dark:text-surface-400">
            {{ filteredStrategies().length }} {{ filteredStrategies().length === 1 ? 'strategy' : 'strategies' }}
          </p>
          <div class="flex items-center space-x-2">
            <span class="text-sm text-surface-500 dark:text-surface-400">Sort by:</span>
            <select 
              [(ngModel)]="sortBy" 
              class="px-3 py-1.5 border border-surface-200 dark:border-surface-600 rounded-lg text-sm focus:ring-2 focus:ring-accent-500 outline-none bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100"
            >
              <option value="updatedAt">Last Updated</option>
              <option value="name">Name</option>
              <option value="mode">Mode</option>
            </select>
          </div>
        </div>

        <!-- Strategy Grid -->
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            @for (strategy of filteredStrategies(); track strategy.id) {
              <qs-strategy-card 
                [strategy]="strategy"
                (run)="onRunStrategy($event)"
                (edit)="onEditStrategy($event)"
                (delete)="onDeleteStrategy($event)"
              />
            }
        </div>

        <!-- Empty State -->
        @if (filteredStrategies().length === 0) {
          <div class="text-center py-16">
            <div class="w-20 h-20 mx-auto mb-6 bg-surface-100 dark:bg-surface-800 rounded-full flex items-center justify-center">
              <svg class="w-10 h-10 text-surface-400 dark:text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">No strategies found</h3>
            <p class="text-surface-600 dark:text-surface-400 mb-6">Get started by creating your first strategy.</p>
            <a routerLink="/build" class="inline-flex items-center px-4 py-2 bg-accent-500 text-white font-medium rounded-lg hover:bg-accent-600 transition-colors">
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
              </svg>
              Create Strategy
            </a>
          </div>
        }
      </div>
    </div>
  `
})
export class StrategiesListComponent implements OnInit, OnDestroy {
  readonly strategyService = inject(StrategyService);
  private readonly simulationService = inject(SimulationService);
  private readonly queueService = inject(SimulationQueueService);
  private readonly dialog = inject(MatDialog);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  
  private queueCompleteSub?: Subscription;
  
  readonly SimulationMode = SimulationMode;
  readonly StrategyStatus = StrategyStatus;

  readonly searchQuery = signal('');
  readonly modeFilter = signal<SimulationMode | ''>('');
  readonly statusFilter = signal<StrategyStatus | ''>('');
  readonly sortBy = signal('updatedAt');
  
  readonly allStrategies = this.strategyService.strategies;

  readonly filteredStrategies = computed(() => {
    const strategies = this.allStrategies();
    const query = this.searchQuery().toLowerCase();
    const mode = this.modeFilter();
    const status = this.statusFilter();
    const sort = this.sortBy();

    let filtered = strategies.filter(s => {
      const matchesSearch = !query || s.name.toLowerCase().includes(query);
      const matchesMode = !mode || s.mode === mode;
      const matchesStatus = !status || s.status === status;
      return matchesSearch && matchesMode && matchesStatus;
    });

    return filtered.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'mode') return a.mode.localeCompare(b.mode);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  });

  ngOnInit() {
    this.loadStrategies();
    
    // Listen for background simulation completions to refresh list
    this.queueCompleteSub = this.queueService.onComplete$.subscribe(() => {
      this.loadStrategies();
    });
  }

  ngOnDestroy(): void {
    this.queueCompleteSub?.unsubscribe();
  }

  loadStrategies() {
    this.strategyService.loadStrategies().subscribe();
  }
  
  onRunStrategy(strategy: StrategySummary) {
    // 1. Fetch full strategy details first
    this.strategyService.loadStrategy(strategy.id).subscribe({
      next: (fullStrategy) => {
        // 2. Open Progress Dialog
        const dialogRef = this.dialog.open(SimulationProgressDialogComponent, {
          disableClose: true,
          width: '500px',
          data: { strategy: fullStrategy },
        });

        // 3. Handle Completion
        dialogRef.afterClosed().subscribe(result => {
          if (result?.success) {
            this.notificationService.success('Simulation completed successfully!');
            this.router.navigate(['/results', strategy.id]);
          } else if (result?.minimized) {
            // Register with queue for background tracking
            this.queueService.registerRunning(fullStrategy as Strategy);
            this.notificationService.info('Simulation running in background. Check the indicator in the header.');
          } else if (result?.cancelled) {
            this.notificationService.info('Simulation cancelled.');
          }
          // Refresh list to update "Run Simulation" to "View Results"
          this.loadStrategies();
        });
      },
      error: (err) => {
        this.notificationService.error('Failed to load strategy for simulation: ' + err.message);
      }
    });
  }

  onEditStrategy(s: StrategySummary) { window.location.href = `/build?edit=${s.id}`; }
  
  onDeleteStrategy(strategy: StrategySummary) {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Delete Strategy',
        message: `Are you sure you want to delete "${strategy.name}"? This action cannot be undone.`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      } as ConfirmationDialogData,
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.strategyService.deleteStrategy(strategy.id).subscribe({
          next: () => {
            this.notificationService.success('Strategy deleted');
            this.loadStrategies();
          },
          error: () => {
            this.notificationService.error('Failed to delete strategy');
          },
        });
      }
    });
  }
}