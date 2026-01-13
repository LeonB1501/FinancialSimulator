import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { SimulationQueueService } from '@core/services/simulation-queue.service';
import { StrategyService } from '@core/services/strategy.service';
import { QueuedSimulation } from '@core/models/simulation.model';
import { DurationPipe } from '@shared/pipes/duration.pipe';
import { SimulationProgressDialogComponent } from '../../../features/strategy-builder/simulation-progress-dialog/simulation-progress-dialog.component';

@Component({
  selector: 'qs-simulation-indicator',
  standalone: true,
  imports: [CommonModule, DurationPipe],
  template: `
    <!-- Indicator Button -->
    <div class="relative">
      <button
        (click)="togglePanel()"
        [class]="buttonClass()"
        class="relative p-2 rounded-lg transition-colors"
        [attr.aria-label]="'Simulations: ' + queueService.activeCount() + ' active'"
      >
        <!-- Spinner icon when running -->
        @if (queueService.runningSimulation()) {
          <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
        } @else {
          <!-- Stack/queue icon when idle -->
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
          </svg>
        }

        <!-- Badge -->
        @if (queueService.activeCount() > 0) {
          <span class="absolute -top-1 -right-1 w-5 h-5 bg-accent-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {{ queueService.activeCount() }}
          </span>
        }
      </button>

      <!-- Dropdown Panel -->
      @if (isPanelOpen()) {
        <div
          class="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-surface-800 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 overflow-hidden z-50"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="px-4 py-3 bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
            <h3 class="font-semibold text-surface-900 dark:text-surface-100">Simulations</h3>
            @if (queueService.recentSimulations().length > 0) {
              <button
                (click)="queueService.clearFinished()"
                class="text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
              >
                Clear finished
              </button>
            }
          </div>

          <!-- Active Simulations -->
          @if (queueService.activeSimulations().length > 0) {
            <div class="divide-y divide-surface-100 dark:divide-surface-700">
              @for (sim of queueService.activeSimulations(); track sim.id) {
                <div
                  class="p-4 hover:bg-surface-50 dark:hover:bg-surface-700 cursor-pointer transition-colors"
                  (click)="viewSimulation(sim)"
                >
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center space-x-2">
                      @if (sim.status === 'running') {
                        <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      } @else {
                        <span class="w-2 h-2 bg-amber-500 rounded-full"></span>
                      }
                      <span class="font-medium text-surface-900 dark:text-surface-100 truncate max-w-[180px]">
                        {{ sim.strategyName }}
                      </span>
                    </div>
                    <button
                      (click)="cancelSimulation(sim, $event)"
                      class="p-1 text-surface-400 hover:text-red-500 transition-colors"
                      title="Cancel"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>

                  @if (sim.status === 'running') {
                    <!-- Progress bar -->
                    <div class="w-full bg-surface-200 dark:bg-surface-600 rounded-full h-1.5 mb-2">
                      <div
                        class="bg-accent-500 h-1.5 rounded-full transition-all duration-300"
                        [style.width.%]="sim.progress.percentComplete"
                      ></div>
                    </div>
                    <div class="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400">
                      <span>{{ sim.progress.percentComplete | number:'1.0-0' }}%</span>
                      <span>{{ sim.progress.estimatedRemainingMs | duration }} remaining</span>
                    </div>
                  } @else {
                    <p class="text-xs text-amber-600 dark:text-amber-400">Queued</p>
                  }
                </div>
              }
            </div>
          }

          <!-- Recent/Completed Simulations -->
          @if (queueService.recentSimulations().length > 0) {
            <div class="border-t border-surface-200 dark:border-surface-700">
              <div class="px-4 py-2 bg-surface-50 dark:bg-surface-900">
                <span class="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">Recent</span>
              </div>
              <div class="divide-y divide-surface-100 dark:divide-surface-700">
                @for (sim of queueService.recentSimulations(); track sim.id) {
                  <div
                    class="p-3 hover:bg-surface-50 dark:hover:bg-surface-700 cursor-pointer transition-colors flex items-center justify-between"
                    (click)="viewResults(sim)"
                  >
                    <div class="flex items-center space-x-2">
                      @if (sim.status === 'completed') {
                        <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                        </svg>
                      } @else if (sim.status === 'failed') {
                        <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                      } @else {
                        <svg class="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      }
                      <div class="flex flex-col">
                        <span class="text-sm text-surface-700 dark:text-surface-300 truncate max-w-[160px]">
                          {{ sim.strategyName }}
                        </span>
                        @if (sim.status === 'completed') {
                          <span class="text-xs text-accent-600 dark:text-accent-400">View Results →</span>
                        } @else if (sim.status === 'failed') {
                          <span class="text-xs text-red-500">{{ sim.error || 'Failed' }}</span>
                        } @else {
                          <span class="text-xs text-surface-400">Cancelled</span>
                        }
                      </div>
                    </div>
                    <button
                      (click)="removeSimulation(sim, $event)"
                      class="p-1 text-surface-300 hover:text-surface-500 dark:text-surface-500 dark:hover:text-surface-300"
                    >
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Empty State -->
          @if (queueService.activeSimulations().length === 0 && queueService.recentSimulations().length === 0) {
            <div class="p-8 text-center">
              <svg class="w-12 h-12 mx-auto text-surface-300 dark:text-surface-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
              <p class="text-sm text-surface-500 dark:text-surface-400">No simulations</p>
              <p class="text-xs text-surface-400 dark:text-surface-500 mt-1">Run a simulation to see it here</p>
            </div>
          }
        </div>
      }
    </div>

    <!-- Backdrop for closing -->
    @if (isPanelOpen()) {
      <div
        class="fixed inset-0 z-40"
        (click)="closePanel()"
      ></div>
    }
  `,
})
export class SimulationIndicatorComponent {
  readonly queueService = inject(SimulationQueueService);
  private readonly strategyService = inject(StrategyService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  readonly isPanelOpen = signal(false);

  buttonClass = () => {
    if (this.queueService.runningSimulation()) {
      return 'text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-900/30';
    }
    if (this.queueService.activeCount() > 0) {
      return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30';
    }
    return 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700';
  };

  togglePanel(): void {
    this.isPanelOpen.update(v => !v);
  }

  closePanel(): void {
    this.isPanelOpen.set(false);
  }

  viewSimulation(sim: QueuedSimulation): void {
    this.closePanel();
    
    // Load full strategy and open progress dialog
    this.strategyService.loadStrategy(sim.strategyId).subscribe({
      next: (strategy) => {
        const dialogRef = this.dialog.open(SimulationProgressDialogComponent, {
          disableClose: true,
          width: '500px',
          data: { strategy, reconnect: true }, // reconnect flag to just show progress
        });

        dialogRef.afterClosed().subscribe(result => {
          if (result?.success) {
            this.router.navigate(['/results', sim.strategyId]);
          }
          // If minimized again, it's already registered in queue
        });
      },
      error: () => {
        // Strategy not found, just close
      }
    });
  }

  viewResults(sim: QueuedSimulation): void {
    // Navigate using strategyId - backend stores results by strategy
    this.router.navigate(['/results', sim.strategyId]);
    this.closePanel();
  }

  cancelSimulation(sim: QueuedSimulation, event: Event): void {
    event.stopPropagation();
    this.queueService.cancel(sim.id);
  }

  removeSimulation(sim: QueuedSimulation, event: Event): void {
    event.stopPropagation();
    this.queueService.remove(sim.id);
  }
}
