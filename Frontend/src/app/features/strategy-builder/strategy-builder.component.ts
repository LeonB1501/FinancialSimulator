import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { HeaderComponent } from '@shared/components/header/header.component';
import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { ModeSelectionComponent } from './steps/mode-selection/mode-selection.component';
import { ModelConfigComponent } from './steps/model-config/model-config.component';
import { SimulationParamsComponent } from './steps/simulation-params/simulation-params.component';
import { DslEditorComponent } from './steps/dsl-editor/dsl-editor.component';
import { ReviewComponent } from './steps/review/review.component';
import { SimulationProgressDialogComponent } from './simulation-progress-dialog/simulation-progress-dialog.component';
import { StrategyService } from '@core/services/strategy.service';
import { SimulationQueueService } from '@core/services/simulation-queue.service';
import { NotificationService } from '@core/services/notification.service';
import {
  StrategyDraft,
  SimulationMode,
  DEFAULT_SIMULATION_CONFIG,
  Strategy,
  StrategyStatus,
} from '@core/models';

interface WizardStep {
  id: string;
  label: string;
  shortLabel: string;
  isComplete: () => boolean;
  isValid: () => boolean;
}

@Component({
  selector: 'qs-strategy-builder',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    HeaderComponent,
    LoadingSpinnerComponent,
    ModeSelectionComponent,
    ModelConfigComponent,
    SimulationParamsComponent,
    DslEditorComponent,
    ReviewComponent,
  ],
  template: `
    <qs-header />
    
    <div class="pt-[72px] min-h-screen bg-surface-50 dark:bg-surface-900 transition-colors duration-300">
      <div class="flex">
        <!-- Left Sidebar - Progress Tracker -->
        <aside class="hidden lg:block w-[320px] flex-shrink-0 border-r border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 min-h-[calc(100vh-72px)] p-6 fixed left-0 top-[72px] bottom-0 overflow-y-auto transition-colors duration-300">
          <div class="mb-8">
            <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">Build Strategy</h2>
            <p class="text-sm text-surface-500 dark:text-surface-400">Complete each step to configure your simulation.</p>
          </div>

          <!-- Progress Bar -->
          <div class="mb-8">
            <div class="flex justify-between text-sm mb-2">
              <span class="text-surface-600 dark:text-surface-400">Progress</span>
              <span class="font-medium text-accent-600 dark:text-accent-400">{{ progressPercent() }}%</span>
            </div>
            <div class="h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
              <div 
                class="h-full bg-gradient-to-r from-accent-500 to-accent-400 transition-all duration-300"
                [style.width.%]="progressPercent()"
              ></div>
            </div>
          </div>

          <!-- Step List -->
          <nav class="space-y-2">
            @for (step of steps; track step.id; let i = $index) {
              <button
                (click)="goToStep(i)"
                [disabled]="!canNavigateToStep(i)"
                [class]="getStepClass(i)"
                class="w-full flex items-center space-x-4 p-4 rounded-xl transition-all duration-200 text-left"
              >
                <div [class]="getStepNumberClass(i)">
                  @if (step.isComplete() && i !== currentStep()) {
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                  } @else {
                    {{ i + 1 }}
                  }
                </div>
                <div class="flex-1 min-w-0">
                  <p [class]="getStepLabelClass(i)">{{ step.label }}</p>
                  @if (i === currentStep()) {
                    <p class="text-xs text-accent-500 dark:text-accent-400 mt-0.5">Current step</p>
                  }
                </div>
              </button>
            }
          </nav>

          <!-- Save Draft Button -->
          <div class="mt-8 pt-8 border-t border-surface-200 dark:border-surface-700">
            <button
              (click)="saveDraft()"
              [disabled]="strategyService.saving()"
              class="w-full btn-secondary btn-md"
            >
              Save Draft
            </button>
          </div>
        </aside>

        <!-- Main Content Area -->
        <main class="flex-1 lg:ml-[320px] pb-24 transition-all duration-300">
          <!-- Mobile Progress -->
          <div class="lg:hidden sticky top-[72px] z-40 bg-white dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 px-4 py-3 transition-colors duration-300">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-surface-900 dark:text-surface-100">
                Step {{ currentStep() + 1 }}: {{ steps[currentStep()].shortLabel }}
              </span>
              <span class="text-sm text-accent-600 dark:text-accent-400">{{ progressPercent() }}%</span>
            </div>
            <div class="h-1.5 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
              <div 
                class="h-full bg-accent-500 transition-all duration-300"
                [style.width.%]="progressPercent()"
              ></div>
            </div>
          </div>

          <!-- Step Content -->
          <div class="mx-auto p-6 lg:p-10 transition-all duration-300"
               [class.max-w-4xl]="currentStep() !== 3"
               [class.max-w-[1600px]]="currentStep() === 3">
            
            @switch (currentStep()) {
              @case (0) {
                <qs-mode-selection 
                  [draft]="strategyService.draft()"
                  (modeSelected)="onModeSelected($event)"
                />
              }
              @case (1) {
                <qs-model-config 
                  [draft]="strategyService.draft()"
                  (indicesChanged)="onIndicesChanged($event)"
                  (parametersChanged)="onParametersChanged($event)"
                  (correlationChanged)="onCorrelationChanged($event)"
                  (tickersChanged)="onCustomTickersChanged($event)"
                />
              }
              @case (2) {
                <qs-simulation-params 
                  [draft]="strategyService.draft()"
                  (scenarioChanged)="onScenarioChanged($event)"
                  (configChanged)="onSimulationConfigChanged($event)"
                />
              }
              @case (3) {
                <qs-dsl-editor 
                  [draft]="strategyService.draft()"
                  (codeChanged)="onDslCodeChanged($event)"
                />
              }
              @case (4) {
                <qs-review 
                  [draft]="strategyService.draft()"
                  (nameChanged)="onNameChanged($event)"
                />
              }
            }
          </div>
        </main>
      </div>

      <!-- Bottom Action Bar -->
      <div class="fixed bottom-0 left-0 right-0 lg:left-[320px] bg-white dark:bg-surface-800 border-t border-surface-200 dark:border-surface-700 px-6 py-4 z-40 transition-colors duration-300">
        <div class="max-w-4xl mx-auto flex items-center justify-between">
          <button
            (click)="previousStep()"
            [disabled]="currentStep() === 0"
            [class.opacity-50]="currentStep() === 0"
            [class.cursor-not-allowed]="currentStep() === 0"
            class="btn-secondary btn-md"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
            Back
          </button>

          <div class="flex items-center space-x-3">
            @if (currentStep() === steps.length - 1) {
              <button
                (click)="saveAndRun()"
                [disabled]="!canSubmit()"
                class="btn-primary btn-md"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Run Simulation
              </button>
              <button
                (click)="saveOnly()"
                [disabled]="!canSubmit()"
                class="btn-secondary btn-md"
              >
                Save Strategy
              </button>
            } @else {
              <button
                (click)="nextStep()"
                [disabled]="!steps[currentStep()].isValid()"
                class="btn-primary btn-md"
              >
                Continue
                <svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class StrategyBuilderComponent implements OnInit {
  readonly strategyService = inject(StrategyService);
  private readonly queueService = inject(SimulationQueueService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);

  readonly currentStep = signal(0);
  private editingStrategyId: string | null = null;

  steps: WizardStep[] = [
    {
      id: 'mode',
      label: 'Mode Selection',
      shortLabel: 'Mode',
      isComplete: () => !!this.strategyService.draft().mode,
      isValid: () => !!this.strategyService.draft().mode,
    },
    {
      id: 'model',
      label: 'Model Configuration',
      shortLabel: 'Model',
      isComplete: () => (this.strategyService.draft().indices?.length ?? 0) > 0,
      isValid: () => (this.strategyService.draft().indices?.length ?? 0) > 0,
    },
    {
      id: 'params',
      label: 'Simulation Parameters',
      shortLabel: 'Params',
      isComplete: () => !!this.strategyService.draft().scenario,
      isValid: () => !!this.strategyService.draft().scenario,
    },
    {
      id: 'dsl',
      label: 'Strategy DSL',
      shortLabel: 'DSL',
      // DSL must have code and no validation errors
      isComplete: () => {
        const dsl = this.strategyService.draft().dsl;
        return (dsl?.code?.length || 0) > 0 && (dsl?.isValid !== false);
      },
      isValid: () => {
        const dsl = this.strategyService.draft().dsl;
        const hasCode = (dsl?.code?.trim().length || 0) > 0;
        const isValid = dsl?.isValid !== false && (dsl?.errors?.length || 0) === 0;
        return hasCode && isValid;
      },
    },
    {
      id: 'review',
      label: 'Review & Run',
      shortLabel: 'Review',
      isComplete: () => false,
      isValid: () => true,
    },
  ];

  readonly progressPercent = computed(() => {
    const completed = this.steps.filter((s, i) => i < this.currentStep() || s.isComplete()).length;
    return Math.round((completed / this.steps.length) * 100);
  });

  ngOnInit(): void {
    // FIX: Clear draft if not editing to ensure clean slate
    const editId = this.route.snapshot.queryParams['edit'];
    if (editId) {
      this.loadStrategy(editId);
    } else {
      this.strategyService.clearDraft();
    }
  }

  private loadStrategy(id: string): void {
    this.strategyService.loadStrategy(id).subscribe(strategy => {
      this.editingStrategyId = id;
      this.strategyService.updateDraft({
        name: strategy.name,
        description: strategy.description,
        mode: strategy.mode,
        scenario: strategy.scenario,
        indices: strategy.indices,
        correlationMatrix: strategy.correlationMatrix,
        customTickers: strategy.customTickers,
        simulationConfig: strategy.simulationConfig,
        dsl: strategy.dsl,
      });
    });
  }

  getStepClass(index: number): string {
    if (index === this.currentStep()) {
      return 'bg-accent-50 dark:bg-accent-900/30 border border-accent-200 dark:border-accent-700';
    }
    if (this.steps[index].isComplete()) {
      return 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30';
    }
    if (!this.canNavigateToStep(index)) {
      return 'bg-surface-50 dark:bg-surface-800 border border-transparent opacity-50 cursor-not-allowed';
    }
    return 'bg-surface-50 dark:bg-surface-800 border border-transparent hover:bg-surface-100 dark:hover:bg-surface-700';
  }

  getStepNumberClass(index: number): string {
    const base = 'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold flex-shrink-0';
    if (index === this.currentStep()) {
      return `${base} bg-accent-500 text-white`;
    }
    if (this.steps[index].isComplete()) {
      return `${base} bg-green-500 text-white`;
    }
    return `${base} bg-surface-200 dark:bg-surface-600 text-surface-600 dark:text-surface-300`;
  }

  getStepLabelClass(index: number): string {
    if (index === this.currentStep()) {
      return 'font-semibold text-accent-700 dark:text-accent-400';
    }
    if (this.steps[index].isComplete()) {
      return 'font-medium text-green-700 dark:text-green-400';
    }
    return 'font-medium text-surface-600 dark:text-surface-400';
  }

  canNavigateToStep(index: number): boolean {
    if (index <= this.currentStep()) return true;
    for (let i = 0; i < index; i++) {
      if (!this.steps[i].isComplete()) return false;
    }
    return true;
  }

  goToStep(index: number): void {
    if (this.canNavigateToStep(index)) {
      this.currentStep.set(index);
    }
  }

  nextStep(): void {
    if (this.currentStep() < this.steps.length - 1 && this.steps[this.currentStep()].isValid()) {
      this.currentStep.update(s => s + 1);
    }
  }

  previousStep(): void {
    if (this.currentStep() > 0) {
      this.currentStep.update(s => s - 1);
    }
  }

  canSubmit(): boolean {
    // All steps must be complete AND DSL must be valid
    const allStepsComplete = this.steps.slice(0, -1).every(s => s.isComplete());
    const dsl = this.strategyService.draft().dsl;
    const dslIsValid = (dsl?.code?.trim().length || 0) > 0 &&
                       dsl?.isValid !== false &&
                       (dsl?.errors?.length || 0) === 0;
    return allStepsComplete && dslIsValid;
  }

  onModeSelected(mode: SimulationMode): void {
    this.strategyService.setDraftMode(mode);
  }

  onIndicesChanged(indices: any[]): void {
    this.strategyService.updateDraft({ indices });
  }

  onParametersChanged(event: { index: number; parameters: any }): void {
    const currentIndices = [...(this.strategyService.draft().indices || [])];
    if (currentIndices[event.index]) {
      currentIndices[event.index] = {
        ...currentIndices[event.index],
        parameters: event.parameters
      };
      this.strategyService.updateDraft({ indices: currentIndices });
    }
  }

  onCorrelationChanged(event: { row: number; col: number; value: number }): void {
    this.strategyService.setDraftCorrelation(event.row, event.col, event.value);
  }

  onCustomTickersChanged(tickers: any[]): void {
    this.strategyService.updateDraft({ customTickers: tickers });
  }

  onScenarioChanged(scenario: any): void {
    this.strategyService.updateDraft({ scenario });
  }

  onSimulationConfigChanged(config: any): void {
    this.strategyService.updateDraft({ simulationConfig: config });
  }

  onDslCodeChanged(code: string): void {
    this.strategyService.updateDraft({ 
      dsl: { code, isValid: true, errors: [], warnings: [] }
    });
  }

  onNameChanged(name: string): void {
    this.strategyService.updateDraft({ name });
  }

  saveDraft(): void {
    const draft = this.strategyService.draft();
    if (!draft.name) {
      this.strategyService.updateDraft({ name: 'Untitled Strategy' });
    }
    this.saveStrategy(true);
  }

  saveOnly(): void {
    this.saveStrategy(false);
  }

  saveAndRun(): void {
    // FIX: Wait for save to complete before running, passing the *saved* strategy object
    this.saveStrategy(false).then(strategy => {
      if (strategy) {
        this.runSimulation(strategy);
      }
    });
  }

  private async saveStrategy(isDraft: boolean): Promise<Strategy | null> {
    const draft = this.strategyService.draft();
    
    const strategyData: any = {
      name: draft.name || 'Untitled Strategy',
      description: draft.description,
      mode: draft.mode!,
      scenario: draft.scenario!,
      indices: draft.indices || [],
      correlationMatrix: draft.correlationMatrix || { indices: [], matrix: [] },
      customTickers: draft.customTickers || [],
      simulationConfig: { ...DEFAULT_SIMULATION_CONFIG, ...draft.simulationConfig },
      dsl: draft.dsl || { code: '', isValid: true, errors: [], warnings: [] },
      status: isDraft ? StrategyStatus.Draft : StrategyStatus.Ready,
    };

    return new Promise((resolve) => {
      if (this.editingStrategyId) {
        this.strategyService.updateStrategy(this.editingStrategyId, strategyData).subscribe({
          next: (strategy) => {
            this.notificationService.success('Strategy saved!');
            resolve(strategy);
          },
          error: () => {
            this.notificationService.error('Failed to save strategy');
            resolve(null);
          },
        });
      } else {
        this.strategyService.createStrategy(strategyData).subscribe({
          next: (strategy) => {
            this.editingStrategyId = strategy.id;
            this.notificationService.success('Strategy created!');
            resolve(strategy);
          },
          error: () => {
            this.notificationService.error('Failed to create strategy');
            resolve(null);
          },
        });
      }
    });
  }

  private runSimulation(strategy: Strategy): void {
    const dialogRef = this.dialog.open(SimulationProgressDialogComponent, {
      disableClose: true,
      width: '500px',
      data: { strategy },
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        this.router.navigate(['/results', strategy.id]);
      } else if (result?.minimized) {
        // Simulation is already running in background, register with queue for tracking
        this.queueService.registerRunning(strategy);
        this.notificationService.info('Simulation running in background. Check the indicator in the header.');
      }
    });
  }
}