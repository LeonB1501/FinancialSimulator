import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, interval } from 'rxjs';
import { SimulationService } from '@core/services/simulation.service';
import { Strategy, SimulationState } from '@core/models';
import { DurationPipe } from '@shared/pipes/duration.pipe';

interface DialogData {
  strategy: Strategy;
  reconnect?: boolean; // If true, just show progress without starting new simulation
}

@Component({
  selector: 'qs-simulation-progress-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    DurationPipe,
  ],
  template: `
    <div class="p-8 text-center">
      <!-- Progress Circle -->
      <div class="relative w-48 h-48 mx-auto mb-8">
        <!-- Background circle -->
        <svg class="w-full h-full transform -rotate-90">
          <circle
            cx="96"
            cy="96"
            r="88"
            stroke="#E2E8F0"
            stroke-width="12"
            fill="none"
          />
          <circle
            cx="96"
            cy="96"
            r="88"
            stroke="url(#progressGradient)"
            stroke-width="12"
            fill="none"
            stroke-linecap="round"
            [attr.stroke-dasharray]="circumference"
            [attr.stroke-dashoffset]="dashOffset()"
            class="transition-all duration-300"
          />
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#00D4AA"/>
              <stop offset="100%" stop-color="#00A080"/>
            </linearGradient>
          </defs>
        </svg>
        
        <!-- Center content -->
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="text-4xl font-bold text-surface-900 dark:text-surface-100">{{ percentComplete() | number:'1.0-1' }}%</span>
          <span class="text-sm text-surface-500 dark:text-surface-400 mt-1">
            {{ completedIterations() | number }} / {{ totalIterations() | number }}
          </span>
        </div>
      </div>

      <!-- Status -->
      <div class="mb-6">
        <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-2">
          {{ statusTitle() }}
        </h2>
        <p class="text-surface-600 dark:text-surface-400">{{ currentPhase() }}</p>
      </div>

      <!-- Time Info -->
      <div class="flex justify-center space-x-8 mb-8">
        <div>
          <p class="text-sm text-surface-500 dark:text-surface-400">Elapsed</p>
          <p class="font-medium text-surface-900 dark:text-surface-100">{{ elapsedMs() | duration }}</p>
        </div>
        <div>
          <p class="text-sm text-surface-500 dark:text-surface-400">Remaining</p>
          <p class="font-medium text-surface-900 dark:text-surface-100">{{ estimatedRemainingMs() | duration }}</p>
        </div>
      </div>

      <!-- Action Buttons -->
      @if (canCancel()) {
        <div class="flex justify-center space-x-3">
          <button
            (click)="onMinimize()"
            class="btn-secondary btn-md"
          >
            <svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
            Minimize
          </button>
          <button
            (click)="onCancel()"
            class="btn-secondary btn-md text-red-600 hover:text-red-700 dark:text-red-400"
          >
            Cancel
          </button>
        </div>
      }

      <!-- Error State -->
      @if (hasError()) {
        <div class="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p class="text-red-700">{{ error() }}</p>
          <button 
            (click)="onClose()"
            class="mt-4 btn-primary btn-md"
          >
            Close
          </button>
        </div>
      }

      <!-- Success State -->
      @if (isComplete()) {
        <div class="mt-6">
          <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <p class="text-green-700 font-medium mb-4">Simulation completed successfully!</p>
          <button 
            (click)="onViewResults()"
            class="btn-primary btn-md"
          >
            View Results
          </button>
        </div>
      }
    </div>
  `,
})
export class SimulationProgressDialogComponent implements OnInit, OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<SimulationProgressDialogComponent>);
  private readonly data = inject<DialogData>(MAT_DIALOG_DATA);
  private readonly simulationService = inject(SimulationService);

  private progressSubscription?: Subscription;
  private simulationSubscription?: Subscription;
  private timerSubscription?: Subscription;
  private startTime: number = 0;
  private iterationsPerMs: number = 0;
  private isMinimized = false;

  readonly circumference = 2 * Math.PI * 88;

  readonly percentComplete = signal(0);
  readonly completedIterations = signal(0);
  readonly totalIterations = signal(0);
  readonly currentPhase = signal('Initializing...');
  readonly elapsedMs = signal(0);
  readonly estimatedRemainingMs = signal(0);
  readonly error = signal<string | null>(null);

  readonly state = this.simulationService.state;

  dashOffset = () => this.circumference - (this.percentComplete() / 100) * this.circumference;

  statusTitle = () => {
    switch (this.state()) {
      case SimulationState.Preparing: return 'Preparing Simulation';
      case SimulationState.Running: return 'Running Simulation';
      case SimulationState.Processing: return 'Processing Results';
      case SimulationState.Completed: return 'Simulation Complete';
      case SimulationState.Failed: return 'Simulation Failed';
      case SimulationState.Cancelled: return 'Simulation Cancelled';
      default: return 'Initializing';
    }
  };

  canCancel = () => this.simulationService.canCancel();
  hasError = () => this.state() === SimulationState.Failed;
  isComplete = () => this.state() === SimulationState.Completed;

  ngOnInit(): void {
    this.startTime = Date.now();

    // Local timer to update elapsed time smoothly every 100ms
    this.timerSubscription = interval(100).subscribe(() => {
      const state = this.state();
      if (state === SimulationState.Running || state === SimulationState.Preparing) {
        const currentElapsed = Date.now() - this.startTime;
        this.elapsedMs.set(currentElapsed);

        // Recalculate remaining time based on current speed
        if (this.iterationsPerMs > 0 && this.totalIterations() > 0) {
          const remaining = this.totalIterations() - this.completedIterations();
          this.estimatedRemainingMs.set(remaining / this.iterationsPerMs);
        }
      }
    });

    // Subscribe to progress updates from the service
    this.progressSubscription = this.simulationService.progress$.subscribe(progress => {
      this.percentComplete.set(progress.percentComplete);
      this.completedIterations.set(progress.completedIterations);
      this.totalIterations.set(progress.totalIterations);
      this.currentPhase.set(progress.currentPhase);

      // Calculate iteration speed for smoother remaining time estimates
      if (progress.completedIterations > 0 && progress.elapsedMs > 0) {
        this.iterationsPerMs = progress.completedIterations / progress.elapsedMs;
      }

      // Use the service's elapsed/remaining as ground truth when we receive updates
      this.elapsedMs.set(progress.elapsedMs);
      this.estimatedRemainingMs.set(progress.estimatedRemainingMs);
      
      // Handle completion/failure during reconnect
      if (this.data.reconnect) {
        if (progress.state === SimulationState.Completed) {
          this.dialogRef.close({ success: true });
        } else if (progress.state === SimulationState.Failed) {
          this.error.set('Simulation failed');
        }
      }
    });

    // Only start a new simulation if this is not a reconnect
    if (!this.data.reconnect) {
      this.simulationSubscription = this.simulationService.runSimulation(this.data.strategy).subscribe({
        next: () => {
          this.percentComplete.set(100);
          this.estimatedRemainingMs.set(0);
        },
        error: (err) => {
          this.error.set(err.message || 'Simulation failed');
        },
      });
    } else {
      // For reconnect, sync with current progress immediately
      const currentProgress = this.simulationService.progress();
      this.percentComplete.set(currentProgress.percentComplete);
      this.completedIterations.set(currentProgress.completedIterations);
      this.totalIterations.set(currentProgress.totalIterations);
      this.currentPhase.set(currentProgress.currentPhase);
      this.elapsedMs.set(currentProgress.elapsedMs);
      this.estimatedRemainingMs.set(currentProgress.estimatedRemainingMs);
    }
  }

  ngOnDestroy(): void {
    this.progressSubscription?.unsubscribe();
    this.timerSubscription?.unsubscribe();

    // Only unsubscribe (and terminate worker) if NOT minimized
    // When minimized, we want the simulation to keep running in the background
    if (!this.isMinimized) {
      this.simulationSubscription?.unsubscribe();
    }
  }

  onMinimize(): void {
    // Mark as minimized so ngOnDestroy doesn't kill the simulation
    this.isMinimized = true;
    // Close dialog but keep simulation running in background
    this.dialogRef.close({ success: false, minimized: true, strategyId: this.data.strategy.id });
  }

  onCancel(): void {
    this.simulationService.cancelSimulation();
    this.dialogRef.close({ success: false, cancelled: true });
  }

  onClose(): void {
    this.dialogRef.close({ success: false });
  }

  onViewResults(): void {
    this.dialogRef.close({ success: true });
  }
}
