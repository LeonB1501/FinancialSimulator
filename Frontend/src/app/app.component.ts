import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SimulationService } from './core/services/simulation.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'qs-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <router-outlet />
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
    }
  `],
})
export class AppComponent implements OnInit {
  private readonly simulationService = inject(SimulationService);
  private readonly themeService = inject(ThemeService);

  ngOnInit(): void {
    // Pre-initialize WASM engine
    this.simulationService.initializeWasm().catch(console.error);
  }
}

// TEMPORARY TEST
const worker = new Worker(new URL('./workers/simulation.worker', import.meta.url));
worker.onmessage = ({ data }) => {
  console.log('🎉 WORKER RESPONSE:', data);
};
worker.postMessage({
  id: 'test-1',
  input: {
    // Minimal valid config to satisfy F# decoder
    Config: { 
      Assets: [{ Ticker: "spy", InitialPrice: 100.0, Model: ["GeometricBrownianMotion", 0.05, 0.2] }],
      Correlations: [],
      TradingDays: 10,
      Iterations: 10,
      RiskFreeRate: 0.04,
      Granularity: 1,
      HistoricalData: [],
      StartDate: "2024-01-01T00:00:00",
      Scenario: ["NoScenario"]
    },
    DslCode: "buy 1 spy",
    InitialCash: 10000.0,
    BaseSeed: 1,
    Analysis: { TargetWealth: null, TargetDays: null, RiskFreeRate: 0.04 }
  }
});
