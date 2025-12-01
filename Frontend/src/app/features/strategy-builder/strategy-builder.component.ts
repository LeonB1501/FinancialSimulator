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
    
    <div class="pt-[72px] min-h-screen bg-surface-50">
      <div class="flex">
        <!-- Left Sidebar - Progress Tracker -->
        <aside class="hidden lg:block w-[320px] flex-shrink-0 border-r border-surface-200 bg-white min-h-[calc(100vh-72px)] p-6 fixed left-0 top-[72px] bottom-0 overflow-y-auto">
          <div class="mb-8">
            <h2 class="text-lg font-semibold text-surface-900 mb-2">Build Strategy</h2>
            <p class="text-sm text-surface-500">Complete each step to configure your simulation.</p>
          </div>

          <!-- Progress Bar -->
          <div class="mb-8">
            <div class="flex justify-between text-sm mb-2">
              <span class="text-surface-600">Progress</span>
              <span class="font-medium text-accent-600">{{ progressPercent() }}%</span>
            </div>
            <div class="h-2 bg-surface-100 rounded-full overflow-hidden">
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
                    <p class="text-xs text-accent-500 mt-0.5">Current step</p>
                  }
                </div>
              </button>
            }
          </nav>

          <!-- Save Draft Button -->
          <div class="mt-8 pt-8 border-t border-surface-200">
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
        <main class="flex-1 lg:ml-[320px] pb-24">
          <!-- Mobile Progress -->
          <div class="lg:hidden sticky top-[72px] z-40 bg-white border-b border-surface-200 px-4 py-3">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-surface-900">
                Step {{ currentStep() + 1 }}: {{ steps[currentStep()].shortLabel }}
              </span>
              <span class="text-sm text-accent-600">{{ progressPercent() }}%</span>
            </div>
            <div class="h-1.5 bg-surface-100 rounded-full overflow-hidden">
              <div 
                class="h-full bg-accent-500 transition-all duration-300"
                [style.width.%]="progressPercent()"
              ></div>
            </div>
          </div>

          <!-- Step Content (CENTERED) -->
          <div class="max-w-4xl mx-auto p-6 lg:p-10">
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
      <div class="fixed bottom-0 left-0 right-0 lg:left-[320px] bg-white border-t border-surface-200 px-6 py-4 z-40">
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
      shortLabel: 'Parameters',
      isComplete: () => !!this.strategyService.draft().scenario && !!this.strategyService.draft().simulationConfig,
      isValid: () => !!this.strategyService.draft().scenario,
    },
    {
      id: 'dsl',
      label: 'Strategy DSL',
      shortLabel: 'DSL',
      isComplete: () => !!this.strategyService.draft().dsl?.code,
      isValid: () => true,
    },
    {
      id: 'review',
      label: 'Review & Run',
      shortLabel: 'Review',
      isComplete: () => !!this.strategyService.draft().name,
      isValid: () => !!this.strategyService.draft().name,
    },
  ];

  readonly progressPercent = computed(() => {
    const completedSteps = this.steps.filter((step, i) => step.isComplete() && i <= this.currentStep()).length;
    return Math.round((completedSteps / this.steps.length) * 100);
  });

  ngOnInit(): void {
    const editId = this.route.snapshot.queryParamMap.get('edit');
    if (editId) {
      this.editingStrategyId = editId;
      this.loadExistingStrategy(editId);
    } else {
      this.initializeNewStrategy();
    }
  }

  private initializeNewStrategy(): void {
    this.strategyService.clearDraft();
    this.strategyService.updateDraft({
      simulationConfig: DEFAULT_SIMULATION_CONFIG,
    });
  }

  private loadExistingStrategy(id: string): void {
    this.strategyService.loadStrategy(id).subscribe(strategy => {
      this.strategyService.loadDraftFromStrategy(strategy);
    });
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

  goToStep(index: number): void {
    if (this.canNavigateToStep(index)) {
      this.currentStep.set(index);
    }
  }

  canNavigateToStep(index: number): boolean {
    if (index <= this.currentStep()) return true;
    for (let i = 0; i < index; i++) {
      if (!this.steps[i].isValid()) return false;
    }
    return true;
  }

  getStepClass(index: number): string {
    if (index === this.currentStep()) {
      return 'bg-accent-50 border-2 border-accent-200';
    }
    if (this.steps[index].isComplete()) {
      return 'bg-green-50 hover:bg-green-100';
    }
    if (this.canNavigateToStep(index)) {
      return 'hover:bg-surface-50';
    }
    return 'opacity-50 cursor-not-allowed';
  }

  getStepNumberClass(index: number): string {
    const base = 'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0';
    if (index === this.currentStep()) {
      return `${base} bg-accent-500 text-white`;
    }
    if (this.steps[index].isComplete() && index !== this.currentStep()) {
      return `${base} bg-green-500 text-white`;
    }
    return `${base} bg-surface-200 text-surface-600`;
  }

  getStepLabelClass(index: number): string {
    if (index === this.currentStep()) {
      return 'font-medium text-accent-700';
    }
    if (this.steps[index].isComplete()) {
      return 'font-medium text-green-700';
    }
    return 'text-surface-600';
  }

  onModeSelected(mode: SimulationMode): void {
    this.strategyService.setDraftMode(mode);
  }

  onIndicesChanged(indices: any[]): void {
    this.strategyService.setDraftIndices(indices);
  }

  onParametersChanged(params: { index: number; parameters: any }): void {
    const draft = this.strategyService.draft();
    if (draft.indices) {
      const updated = [...draft.indices];
      updated[params.index] = { ...updated[params.index], parameters: params.parameters };
      this.strategyService.updateDraft({ indices: updated });
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
    this.strategyService.setDraftDsl(code);
  }

  onNameChanged(name: string): void {
    this.strategyService.updateDraft({ name });
  }

  canSubmit(): boolean {
    return !!this.strategyService.draft().name && 
           !!this.strategyService.draft().mode &&
           (this.strategyService.draft().indices?.length ?? 0) > 0;
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
      }
    });
  }
}