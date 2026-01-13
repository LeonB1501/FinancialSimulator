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
    // Check if this strategy is already registered
    const existing = this._queue().find(s => s.strategyId === strategy.id &&
      (s.status === 'running' || s.status === 'queued'));
    if (existing) {
      return existing.id; // Already tracking this strategy
    }

    const id = crypto.randomUUID();

    // Get current progress from the simulation service
    const currentProgress = this.simulationService.progress();

    // Check if there's already a running simulation
    const alreadyRunning = this._queue().find(s => s.status === 'running');
    const isActuallyRunning = this.simulationService.isRunning();

    const queuedSimulation: QueuedSimulation = {
      id,
      strategyId: strategy.id,
      strategyName: strategy.name,
      // Only mark as running if nothing else is running AND simulation service is active
      status: (!alreadyRunning && isActuallyRunning) ? 'running' : 'queued',
      progress: isActuallyRunning ? currentProgress : {
        state: SimulationState.Idle,
        completedIterations: 0,
        totalIterations: strategy.simulationConfig.iterations,
        percentComplete: 0,
        elapsedMs: 0,
        estimatedRemainingMs: 0,
        currentPhase: 'Queued...',
      },
      queuedAt: new Date(),
      startedAt: isActuallyRunning && !alreadyRunning ? new Date() : undefined,
    };

    // Add to queue
    this._queue.update(queue => [...queue, queuedSimulation]);
    this.strategyCache.set(id, strategy);

    // Only subscribe to progress if this is the running simulation
    if (queuedSimulation.status === 'running') {
      this._isProcessing.set(true);

      // Clean up any existing subscription first
      this.progressSubscription?.unsubscribe();

      // Check if simulation is already complete (edge case)
      const currentState = this.simulationService.state();
      if (currentState === SimulationState.Completed) {
        this.updateSimulation(id, {
          status: 'completed',
          completedAt: new Date(),
          progress: { ...currentProgress, percentComplete: 100, currentPhase: 'Completed', estimatedRemainingMs: 0 }
        });
        this._onComplete.next({ id, resultsId: strategy.id });
        this.cleanup();
        setTimeout(() => this.processQueue(), 100);
        return id;
      } else if (currentState === SimulationState.Failed) {
        this.updateSimulation(id, {
          status: 'failed',
          completedAt: new Date(),
          error: 'Simulation failed',
          progress: { ...currentProgress, currentPhase: 'Failed', estimatedRemainingMs: 0 }
        });
        this._onError.next({ id, error: 'Simulation failed' });
        this.cleanup();
        setTimeout(() => this.processQueue(), 100);
        return id;
      } else if (currentState === SimulationState.Idle || currentState === SimulationState.Cancelled) {
        // Simulation is not actually running, mark as queued
        this.updateSimulation(id, { status: 'queued' });
        this._isProcessing.set(false);
        return id;
      }

      // Subscribe to progress updates for this simulation
      const simulationId = id;
      this.progressSubscription = this.simulationService.progress$.subscribe(progress => {
        // Only update the currently running simulation
        const running = this._queue().find(s => s.status === 'running');
        if (running && running.id === simulationId) {
          this.updateSimulation(simulationId, { progress });
        }

        // Check the service's state signal (more reliable than progress.state)
        const serviceState = this.simulationService.state();

        if (serviceState === SimulationState.Completed || progress.state === SimulationState.Completed) {
          this.updateSimulation(simulationId, {
            status: 'completed',
            completedAt: new Date(),
            progress: { ...progress, state: SimulationState.Completed, percentComplete: 100, currentPhase: 'Completed', estimatedRemainingMs: 0 }
          });
          this._onComplete.next({ id: simulationId, resultsId: strategy.id });
          this.cleanup();
          setTimeout(() => this.processQueue(), 100);
        } else if (serviceState === SimulationState.Failed || progress.state === SimulationState.Failed) {
          this.updateSimulation(simulationId, {
            status: 'failed',
            completedAt: new Date(),
            error: 'Simulation failed',
            progress: { ...progress, state: SimulationState.Failed, currentPhase: 'Failed', estimatedRemainingMs: 0 }
          });
          this._onError.next({ id: simulationId, error: 'Simulation failed' });
          this.cleanup();
          setTimeout(() => this.processQueue(), 100);
        } else if (serviceState === SimulationState.Cancelled || progress.state === SimulationState.Cancelled) {
          this.updateSimulation(simulationId, {
            status: 'cancelled',
            completedAt: new Date(),
            progress: { ...progress, state: SimulationState.Cancelled, currentPhase: 'Cancelled', estimatedRemainingMs: 0 }
          });
          this.cleanup();
          setTimeout(() => this.processQueue(), 100);
        }
      });
    }

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

    const wasRunning = simulation.status === 'running';

    if (wasRunning) {
      // Cancel the running simulation
      this.simulationService.cancelSimulation();
      this.cleanup();
    }

    // Update status
    this.updateSimulation(id, {
      status: 'cancelled',
      completedAt: new Date(),
      progress: {
        ...simulation.progress,
        state: SimulationState.Cancelled,
        currentPhase: 'Cancelled',
        estimatedRemainingMs: 0,
      }
    });

    // Clean up cache
    this.strategyCache.delete(id);

    // Process next in queue after a short delay
    if (wasRunning) {
      setTimeout(() => this.processQueue(), 100);
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

    // Check if simulation service is already running (e.g., from dialog)
    if (this.simulationService.isRunning()) return;

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
        progress: {
          ...next.progress,
          state: SimulationState.Failed,
          currentPhase: 'Failed - Strategy not found',
        }
      });
      // Try next item
      setTimeout(() => this.processQueue(), 0);
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

    // Clean up any existing subscriptions first
    this.progressSubscription?.unsubscribe();
    this.currentSubscription?.unsubscribe();

    // Subscribe to progress updates - only update this specific simulation
    const simulationId = next.id;
    this.progressSubscription = this.simulationService.progress$.subscribe(progress => {
      // Verify this is still the running simulation before updating
      const running = this._queue().find(s => s.status === 'running');
      if (running && running.id === simulationId) {
        this.updateSimulation(simulationId, { progress });
      }
    });

    // Run the simulation
    this.currentSubscription = this.simulationService.runSimulation(strategy).subscribe({
      next: (results: SimulationResults) => {
        this.updateSimulation(simulationId, {
          status: 'completed',
          completedAt: new Date(),
          resultsId: results.id,
          progress: {
            state: SimulationState.Completed,
            completedIterations: strategy.simulationConfig.iterations,
            totalIterations: strategy.simulationConfig.iterations,
            percentComplete: 100,
            elapsedMs: this.getSimulation(simulationId)?.progress?.elapsedMs || 0,
            estimatedRemainingMs: 0,
            currentPhase: 'Completed',
          }
        });

        this._onComplete.next({ id: simulationId, resultsId: results.id });
        this.cleanup();
        // Process next after a small delay to ensure UI updates
        setTimeout(() => this.processQueue(), 100);
      },
      error: (err: Error) => {
        this.updateSimulation(simulationId, {
          status: 'failed',
          completedAt: new Date(),
          error: err.message,
          progress: {
            state: SimulationState.Failed,
            completedIterations: this.getSimulation(simulationId)?.progress?.completedIterations || 0,
            totalIterations: strategy.simulationConfig.iterations,
            percentComplete: this.getSimulation(simulationId)?.progress?.percentComplete || 0,
            elapsedMs: this.getSimulation(simulationId)?.progress?.elapsedMs || 0,
            estimatedRemainingMs: 0,
            currentPhase: 'Failed',
          }
        });

        this._onError.next({ id: simulationId, error: err.message });
        this.cleanup();
        // Process next after a small delay
        setTimeout(() => this.processQueue(), 100);
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
