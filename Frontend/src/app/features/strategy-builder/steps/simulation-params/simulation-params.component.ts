import { Component, Output, EventEmitter, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  StrategyDraft, 
  SimulationMode, 
  SimulationConfig,
  AccumulationScenario,
  RetirementScenario,
  Granularity,
  DEFAULT_ACCUMULATION_SCENARIO,
  DEFAULT_RETIREMENT_SCENARIO,
  DEFAULT_SIMULATION_CONFIG,
} from '@core/models';

@Component({
  selector: 'qs-simulation-params',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-4xl mx-auto">
      <div class="mb-8">
        <h1 class="text-2xl lg:text-3xl font-bold text-surface-900 mb-2">
          Simulation Parameters
        </h1>
        <p class="text-surface-600">
          Configure your scenario and simulation settings.
        </p>
      </div>

      <div class="grid lg:grid-cols-5 gap-8">
        <!-- Left Column: Scenario -->
        <div class="lg:col-span-3">
          <div class="card p-6">
            <h2 class="text-lg font-semibold text-surface-900 mb-6">
              {{ draft().mode === SimulationMode.Accumulation ? 'Accumulation' : 'Retirement' }} Scenario
            </h2>

            @if (draft().mode === SimulationMode.Accumulation) {
              <div class="space-y-6">
                <div class="grid md:grid-cols-2 gap-6">
                  <div>
                    <label class="label">Initial Lump Sum</label>
                    <div class="relative">
                      <span class="absolute left-4 top-1/2 transform -translate-y-1/2 text-surface-500">$</span>
                      <input 
                        type="number" 
                        class="input pl-8"
                        [value]="accumulationScenario().initialLumpSum"
                        (input)="updateAccumulationParam('initialLumpSum', $event)"
                      >
                    </div>
                  </div>

                  <div>
                    <label class="label">Monthly Contribution</label>
                    <div class="relative">
                      <span class="absolute left-4 top-1/2 transform -translate-y-1/2 text-surface-500">$</span>
                      <input 
                        type="number" 
                        class="input pl-8"
                        [value]="accumulationScenario().monthlyContribution"
                        (input)="updateAccumulationParam('monthlyContribution', $event)"
                      >
                    </div>
                  </div>
                </div>

                <div class="grid md:grid-cols-2 gap-6">
                  <div>
                    <label class="label">Target Wealth</label>
                    <div class="relative">
                      <span class="absolute left-4 top-1/2 transform -translate-y-1/2 text-surface-500">$</span>
                      <input 
                        type="number" 
                        class="input pl-8"
                        [value]="accumulationScenario().targetWealth"
                        (input)="updateAccumulationParam('targetWealth', $event)"
                      >
                    </div>
                  </div>

                  <div>
                    <label class="label">Timeline</label>
                    <div class="relative">
                      <input 
                        type="number" 
                        class="input pr-16"
                        [value]="accumulationScenario().timelineYears"
                        (input)="updateAccumulationParam('timelineYears', $event)"
                      >
                      <span class="absolute right-4 top-1/2 transform -translate-y-1/2 text-surface-500">years</span>
                    </div>
                  </div>
                </div>

                <!-- Quick Summary -->
                <div class="p-4 bg-surface-50 rounded-xl">
                  <p class="text-sm text-surface-600">
                    You'll invest 
                    <span class="font-semibold text-surface-900">\${{ formatNumber(accumulationScenario().initialLumpSum) }}</span> 
                    initially, then 
                    <span class="font-semibold text-surface-900">\${{ formatNumber(accumulationScenario().monthlyContribution) }}/month</span> 
                    for 
                    <span class="font-semibold text-surface-900">{{ accumulationScenario().timelineYears }} years</span>, 
                    targeting 
                    <span class="font-semibold text-accent-600">\${{ formatNumber(accumulationScenario().targetWealth) }}</span>.
                  </p>
                  <p class="text-sm text-surface-500 mt-2">
                    Total contributions: 
                    <span class="font-medium">\${{ formatNumber(totalContributions()) }}</span>
                  </p>
                </div>
              </div>
            } @else {
              <div class="space-y-6">
                <div class="grid md:grid-cols-2 gap-6">
                  <div>
                    <label class="label">Initial Portfolio</label>
                    <div class="relative">
                      <span class="absolute left-4 top-1/2 transform -translate-y-1/2 text-surface-500">$</span>
                      <input 
                        type="number" 
                        class="input pl-8"
                        [value]="retirementScenario().initialPortfolio"
                        (input)="updateRetirementParam('initialPortfolio', $event)"
                      >
                    </div>
                  </div>

                  <div>
                    <label class="label">Monthly Withdrawal</label>
                    <div class="relative">
                      <span class="absolute left-4 top-1/2 transform -translate-y-1/2 text-surface-500">$</span>
                      <input 
                        type="number" 
                        class="input pl-8"
                        [value]="retirementScenario().monthlyWithdrawal"
                        (input)="updateRetirementParam('monthlyWithdrawal', $event)"
                      >
                    </div>
                  </div>
                </div>

                <div class="grid md:grid-cols-2 gap-6">
                  <div>
                    <label class="label">Inflation Rate</label>
                    <div class="relative">
                      <input 
                        type="number" 
                        step="0.1"
                        class="input pr-12"
                        [value]="(retirementScenario().inflationRate * 100)"
                        (input)="updateRetirementInflation($event)"
                      >
                      <span class="absolute right-4 top-1/2 transform -translate-y-1/2 text-surface-500">%</span>
                    </div>
                  </div>

                  <div>
                    <label class="label">Timeline</label>
                    <div class="relative">
                      <input 
                        type="number" 
                        class="input pr-16"
                        [value]="retirementScenario().timelineYears"
                        (input)="updateRetirementParam('timelineYears', $event)"
                      >
                      <span class="absolute right-4 top-1/2 transform -translate-y-1/2 text-surface-500">years</span>
                    </div>
                  </div>
                </div>

                <!-- Quick Summary -->
                <div class="p-4 bg-surface-50 rounded-xl">
                  <p class="text-sm text-surface-600">
                    Starting with 
                    <span class="font-semibold text-surface-900">\${{ formatNumber(retirementScenario().initialPortfolio) }}</span>, 
                    withdrawing 
                    <span class="font-semibold text-surface-900">\${{ formatNumber(retirementScenario().monthlyWithdrawal) }}/month</span> 
                    (adjusted for 
                    <span class="font-semibold text-surface-900">{{ (retirementScenario().inflationRate * 100).toFixed(1) }}%</span> 
                    inflation) over 
                    <span class="font-semibold text-surface-900">{{ retirementScenario().timelineYears }} years</span>.
                  </p>
                  <p class="text-sm text-surface-500 mt-2">
                    Annual withdrawal rate: 
                    <span class="font-medium">{{ withdrawalRate().toFixed(2) }}%</span>
                  </p>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Right Column: Simulation Settings -->
        <div class="lg:col-span-2">
          <div class="card p-6">
            <h2 class="text-lg font-semibold text-surface-900 mb-6">Simulation Settings</h2>

            <div class="space-y-6">
              <!-- Iterations -->
              <div>
                <label class="label">Iterations</label>
                <input 
                  type="number" 
                  class="input"
                  [value]="simulationConfig().iterations"
                  (input)="updateConfigParam('iterations', $event)"
                >
                <div class="flex flex-wrap gap-2 mt-2">
                  @for (preset of iterationPresets; track preset) {
                    <button
                      (click)="setIterations(preset)"
                      [class]="simulationConfig().iterations === preset ? 'bg-accent-100 text-accent-700 border-accent-300' : 'bg-surface-100 text-surface-600 border-surface-200'"
                      class="px-3 py-1 text-sm rounded-full border hover:border-surface-300 transition-colors"
                    >
                      {{ formatNumber(preset) }}
                    </button>
                  }
                </div>
              </div>

              <!-- Granularity -->
              <div>
                <label class="label">Granularity</label>
                <select 
                  class="input bg-white"
                  [value]="simulationConfig().granularity"
                  (change)="updateGranularity($event)"
                >
                  <option [value]="Granularity.Daily">Daily</option>
                  <option [value]="Granularity.Weekly">Weekly</option>
                  <option [value]="Granularity.Monthly">Monthly</option>
                </select>
                <p class="text-xs text-surface-500 mt-1">
                  {{ getGranularityHint() }}
                </p>
              </div>

              <!-- Risk-Free Rate -->
              <div>
                <label class="label">Risk-Free Rate</label>
                <div class="relative">
                  <input 
                    type="number" 
                    step="0.1"
                    class="input pr-20"
                    [value]="(simulationConfig().riskFreeRate * 100)"
                    (input)="updateRiskFreeRate($event)"
                  >
                  <span class="absolute right-4 top-1/2 transform -translate-y-1/2 text-surface-500">% annual</span>
                </div>
                <p class="text-xs text-surface-500 mt-1">
                  Used for Sharpe ratio and discounting
                </p>
              </div>

              <!-- Estimated Time -->
              <div class="p-4 bg-primary-50 rounded-xl">
                <div class="flex items-center space-x-3">
                  <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <div>
                    <p class="text-sm font-medium text-primary-900">Estimated Runtime</p>
                    <p class="text-sm text-primary-700">{{ estimatedTime() }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class SimulationParamsComponent {
  // FIX: Use Signal Input
  draft = input.required<StrategyDraft>();
  
  @Output() scenarioChanged = new EventEmitter<AccumulationScenario | RetirementScenario>();
  @Output() configChanged = new EventEmitter<SimulationConfig>();

  readonly SimulationMode = SimulationMode;
  readonly Granularity = Granularity;
  readonly iterationPresets = [1000, 5000, 10000, 50000, 100000];

  // FIX: Computed now tracks signal input
  accumulationScenario = computed((): AccumulationScenario => 
    (this.draft().scenario as AccumulationScenario) || DEFAULT_ACCUMULATION_SCENARIO
  );

  retirementScenario = computed((): RetirementScenario => 
    (this.draft().scenario as RetirementScenario) || DEFAULT_RETIREMENT_SCENARIO
  );

  simulationConfig = computed((): SimulationConfig => 
    { return { ...DEFAULT_SIMULATION_CONFIG, ...this.draft().simulationConfig }; }
  );

  totalContributions = computed(() => {
    const scenario = this.accumulationScenario();
    return scenario.initialLumpSum + (scenario.monthlyContribution * scenario.timelineYears * 12);
  });

  withdrawalRate = computed(() => {
    const scenario = this.retirementScenario();
    return (scenario.monthlyWithdrawal * 12 / scenario.initialPortfolio) * 100;
  });

  estimatedTime = computed(() => {
    const config = this.simulationConfig();
    const baseTime = config.iterations * 0.001;
    const granularityMultiplier = 
      config.granularity === Granularity.Daily ? 5 :
      config.granularity === Granularity.Weekly ? 1 : 0.25;
    
    const totalMs = baseTime * granularityMultiplier;
    
    if (totalMs < 1000) return '< 1 second';
    if (totalMs < 60000) return `~${Math.round(totalMs / 1000)} seconds`;
    return `~${Math.round(totalMs / 60000)} minutes`;
  });

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  updateAccumulationParam(param: keyof AccumulationScenario, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (!isNaN(value)) {
      this.scenarioChanged.emit({
        ...this.accumulationScenario(),
        [param]: value,
      });
    }
  }

  updateRetirementParam(param: keyof RetirementScenario, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (!isNaN(value)) {
      this.scenarioChanged.emit({
        ...this.retirementScenario(),
        [param]: value,
      });
    }
  }

  updateRetirementInflation(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (!isNaN(value)) {
      this.scenarioChanged.emit({
        ...this.retirementScenario(),
        inflationRate: value / 100,
      });
    }
  }

  updateConfigParam(param: keyof SimulationConfig, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (!isNaN(value)) {
      this.configChanged.emit({
        ...this.simulationConfig(),
        [param]: value,
      });
    }
  }

  setIterations(value: number): void {
    this.configChanged.emit({
      ...this.simulationConfig(),
      iterations: value,
    });
  }

  updateGranularity(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as Granularity;
    this.configChanged.emit({
      ...this.simulationConfig(),
      granularity: value,
    });
  }

  updateRiskFreeRate(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (!isNaN(value)) {
      this.configChanged.emit({
        ...this.simulationConfig(),
        riskFreeRate: value / 100,
      });
    }
  }

  getGranularityHint(): string {
    switch (this.simulationConfig().granularity) {
      case Granularity.Daily:
        return 'Most accurate but slower. ~252 steps per year.';
      case Granularity.Weekly:
        return 'Good balance of accuracy and speed. ~52 steps per year.';
      case Granularity.Monthly:
        return 'Fastest but less granular. 12 steps per year.';
    }
  }
}