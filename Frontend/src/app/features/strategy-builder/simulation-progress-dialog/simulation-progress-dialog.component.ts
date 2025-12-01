import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';
import { SimulationService } from '@core/services/simulation.service';
import { Strategy, SimulationState } from '@core/models';
import { DurationPipe } from '@shared/pipes/duration.pipe';

interface DialogData {
  strategy: Strategy;
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
          <span class="text-4xl font-bold text-surface-900">{{ percentComplete() }}%</span>
          <span class="text-sm text-surface-500 mt-1">
            {{ completedIterations() | number }} / {{ totalIterations() | number }}
          </span>
        </div>
      </div>

      <!-- Status -->
      <div class="mb-6">
        <h2 class="text-xl font-semibold text-surface-900 mb-2">
          {{ statusTitle() }}
        </h2>
        <p class="text-surface-600">{{ currentPhase() }}</p>
      </div>

      <!-- Time Info -->
      <div class="flex justify-center space-x-8 mb-8">
        <div>
          <p class="text-sm text-surface-500">Elapsed</p>
          <p class="font-medium text-surface-900">{{ elapsedMs() | duration }}</p>
        </div>
        <div>
          <p class="text-sm text-surface-500">Remaining</p>
          <p class="font-medium text-surface-900">{{ estimatedRemainingMs() | duration }}</p>
        </div>
      </div>

      <!-- Cancel Button -->
      @if (canCancel()) {
        <button 
          (click)="onCancel()"
          class="btn-secondary btn-md"
        >
          Cancel Simulation
        </button>
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

  private subscription?: Subscription;

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
    // Subscribe to progress updates
    this.subscription = this.simulationService.progress$.subscribe(progress => {
      this.percentComplete.set(progress.percentComplete);
      this.completedIterations.set(progress.completedIterations);
      this.totalIterations.set(progress.totalIterations);
      this.currentPhase.set(progress.currentPhase);
      this.elapsedMs.set(progress.elapsedMs);
      this.estimatedRemainingMs.set(progress.estimatedRemainingMs);
    });

    // Start simulation
    this.simulationService.runSimulation(this.data.strategy).subscribe({
      next: () => {
        this.percentComplete.set(100);
      },
      error: (err) => {
        this.error.set(err.message || 'Simulation failed');
      },
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
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
