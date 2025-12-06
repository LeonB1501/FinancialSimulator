import { Injectable, inject, signal, computed } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { SimulationService } from './simulation.service';
import { Strategy } from '../models/strategy.model';
import {
  SimulationState,
  SimulationProgress,
  QueuedSimulation,
  QueuedSimulationStatus,
} from '../models/simulation.model';
import { SimulationResults } from '../models/results.model';

@Injectable({
  providedIn: 'root'
})
export class SimulationQueueService {
  private readonly simulationService = inject(SimulationService);

  // Queue state
  private readonly _queue = signal<QueuedSimulation[]>([]);
  private readonly _isProcessing = signal(false);

  // Current running simulation subscription
  private currentSubscription?: Subscription;
  private progressSubscription?: Subscription;

  // Public signals
  readonly queue = this._queue.asReadonly();
  readonly isProcessing = this._isProcessing.asReadonly();

  // Computed signals for different queue states
  readonly runningSimulation = computed(() =>
    this._queue().find(s => s.status === 'running') ?? null
  );

  readonly queuedSimulations = computed(() =>
    this._queue().filter(s => s.status === 'queued')
  );

  readonly activeSimulations = computed(() =>
    this._queue().filter(s => s.status === 'running' || s.status === 'queued')
  );

  readonly recentSimulations = computed(() =>
    this._queue()
      .filter(s => s.status === 'completed' || s.status === 'failed' || s.status === 'cancelled')
      .slice(0, 5)
  );

  readonly activeCount = computed(() => this.activeSimulations().length);

  // Event subjects
  private readonly _onComplete = new Subject<{ id: string; resultsId: string }>();
  private readonly _onError = new Subject<{ id: string; error: string }>();

  readonly onComplete$ = this._onComplete.asObservable();
  readonly onError$ = this._onError.asObservable();

  /**
   * Add a simulation to the queue
   */
  enqueue(strategy: Strategy): string {
    const id = crypto.randomUUID();

    const queuedSimulation: QueuedSimulation = {
      id,
      strategyId: strategy.id,
      strategyName: strategy.name,
      status: 'queued',
      progress: {
        state: SimulationState.Idle,
        completedIterations: 0,
        totalIterations: strategy.simulationConfig.iterations,
        percentComplete: 0,
        elapsedMs: 0,
        estimatedRemainingMs: 0,
        currentPhase: 'Queued...',
      },
      queuedAt: new Date(),
    };

    // Add to queue
    this._queue.update(queue => [...queue, queuedSimulation]);

    // Store the strategy in a map for later retrieval
    this.strategyCache.set(id, strategy);

    // Start processing if not already
    this.processQueue();

    return id;
  }

  /**
   * Register an already-running simulation (e.g., when dialog is minimized)
   * This allows the queue to track progress without starting a new simulation
   */
  registerRunning(strategy: Strategy): string {
    const id = crypto.randomUUID();

    // Get current progress from the simulation service
    const currentProgress = this.simulationService.progress();

    const queuedSimulation: QueuedSimulation = {
      id,
      strategyId: strategy.id,
      strategyName: strategy.name,
      status: 'running',
      progress: currentProgress,
      queuedAt: new Date(),
      startedAt: new Date(),
    };

    // Add to queue
    this._queue.update(queue => [...queue, queuedSimulation]);
    this.strategyCache.set(id, strategy);

    // Mark as processing so we don't start another
    this._isProcessing.set(true);

    // Subscribe to progress updates for this simulation
    this.progressSubscription = this.simulationService.progress$.subscribe(progress => {
      this.updateSimulation(id, { progress });

      // Check if completed
      if (progress.state === SimulationState.Completed) {
        this.updateSimulation(id, {
          status: 'completed',
          completedAt: new Date(),
        });
        this._onComplete.next({ id, resultsId: strategy.id });
        this.cleanup();
        this.processQueue();
      } else if (progress.state === SimulationState.Failed) {
        this.updateSimulation(id, {
          status: 'failed',
          completedAt: new Date(),
          error: 'Simulation failed',
        });
        this._onError.next({ id, error: 'Simulation failed' });
        this.cleanup();
        this.processQueue();
      } else if (progress.state === SimulationState.Cancelled) {
        this.updateSimulation(id, {
          status: 'cancelled',
          completedAt: new Date(),
        });
        this.cleanup();
        this.processQueue();
      }
    });

    return id;
  }

  // Cache strategies by queue ID since we need them when processing
  private strategyCache = new Map<string, Strategy>();

  /**
   * Cancel a queued or running simulation
   */
  cancel(id: string): void {
    const simulation = this._queue().find(s => s.id === id);
    if (!simulation) return;

    if (simulation.status === 'running') {
      // Cancel the running simulation
      this.simulationService.cancelSimulation();
      this.currentSubscription?.unsubscribe();
      this.progressSubscription?.unsubscribe();
    }

    // Update status
    this.updateSimulation(id, {
      status: 'cancelled',
      completedAt: new Date(),
      progress: {
        ...simulation.progress,
        state: SimulationState.Cancelled,
        currentPhase: 'Cancelled',
      }
    });

    // Clean up cache
    this.strategyCache.delete(id);

    // Process next in queue
    if (simulation.status === 'running') {
      this._isProcessing.set(false);
      this.processQueue();
    }
  }

  /**
   * Remove a simulation from the queue (only completed/failed/cancelled)
   */
  remove(id: string): void {
    const simulation = this._queue().find(s => s.id === id);
    if (!simulation) return;

    // Can only remove finished simulations
    if (simulation.status === 'running' || simulation.status === 'queued') {
      return;
    }

    this._queue.update(queue => queue.filter(s => s.id !== id));
    this.strategyCache.delete(id);
  }

  /**
   * Clear all finished simulations from the queue
   */
  clearFinished(): void {
    const finished = this._queue().filter(
      s => s.status === 'completed' || s.status === 'failed' || s.status === 'cancelled'
    );

    finished.forEach(s => this.strategyCache.delete(s.id));

    this._queue.update(queue =>
      queue.filter(s => s.status === 'running' || s.status === 'queued')
    );
  }

  /**
   * Get a specific simulation by ID
   */
  getSimulation(id: string): QueuedSimulation | undefined {
    return this._queue().find(s => s.id === id);
  }

  /**
   * Process the next simulation in the queue
   */
  private processQueue(): void {
    // Already processing
    if (this._isProcessing()) return;

    // Find next queued simulation
    const next = this._queue().find(s => s.status === 'queued');
    if (!next) return;

    const strategy = this.strategyCache.get(next.id);
    if (!strategy) {
      // Strategy not found, mark as failed
      this.updateSimulation(next.id, {
        status: 'failed',
        error: 'Strategy not found in cache',
        completedAt: new Date(),
      });
      this.processQueue();
      return;
    }

    this._isProcessing.set(true);

    // Update status to running
    this.updateSimulation(next.id, {
      status: 'running',
      startedAt: new Date(),
      progress: {
        ...next.progress,
        state: SimulationState.Running,
        currentPhase: 'Starting simulation...',
      }
    });

    // Subscribe to progress updates
    this.progressSubscription = this.simulationService.progress$.subscribe(progress => {
      this.updateSimulation(next.id, { progress });
    });

    // Run the simulation
    this.currentSubscription = this.simulationService.runSimulation(strategy).subscribe({
      next: (results: SimulationResults) => {
        this.updateSimulation(next.id, {
          status: 'completed',
          completedAt: new Date(),
          resultsId: results.id,
          progress: {
            ...this.getSimulation(next.id)?.progress!,
            state: SimulationState.Completed,
            percentComplete: 100,
            currentPhase: 'Completed',
          }
        });

        this._onComplete.next({ id: next.id, resultsId: results.id });
        this.cleanup();
        this.processQueue();
      },
      error: (err: Error) => {
        this.updateSimulation(next.id, {
          status: 'failed',
          completedAt: new Date(),
          error: err.message,
          progress: {
            ...this.getSimulation(next.id)?.progress!,
            state: SimulationState.Failed,
            currentPhase: 'Failed',
          }
        });

        this._onError.next({ id: next.id, error: err.message });
        this.cleanup();
        this.processQueue();
      }
    });
  }

  private cleanup(): void {
    this.currentSubscription?.unsubscribe();
    this.progressSubscription?.unsubscribe();
    this._isProcessing.set(false);
  }

  private updateSimulation(id: string, updates: Partial<QueuedSimulation>): void {
    this._queue.update(queue =>
      queue.map(s => s.id === id ? { ...s, ...updates } : s)
    );
  }
}
