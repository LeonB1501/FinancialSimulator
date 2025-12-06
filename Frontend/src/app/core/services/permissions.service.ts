import { Injectable, inject, computed } from '@angular/core';
import { AuthService } from './auth.service';
import { StochasticModel } from '../models/strategy.model';

@Injectable({
  providedIn: 'root'
})
export class PermissionsService {
  private readonly auth = inject(AuthService);

  // --- Core Status ---
  
  readonly isPremium = computed(() => {
    const user = this.auth.user();
    // Check for 'Pro' tier. We also check status to ensure it's active.
    // Note: In Phase 1 we set default to "Inactive", so for dev we might need to manually set this in DB
    return user?.subscriptionTier === 'Pro' && user?.subscriptionStatus === 'Active';
  });

  // --- Feature Gates ---

  readonly maxStrategies = computed(() => this.isPremium() ? Infinity : 5);
  
  readonly maxIterations = computed(() => this.isPremium() ? 100000 : 1000);

  readonly canUseHistoricData = computed(() => this.isPremium());

  readonly canUseAiAssistant = computed(() => this.isPremium());

  // --- Helper Methods ---

  canCreateStrategy(currentCount: number): boolean {
    return this.isPremium() || currentCount < this.maxStrategies();
  }

  canUseModel(model: StochasticModel): boolean {
    if (this.isPremium()) return true;

    // Free Tier allowed models
    return model === StochasticModel.GBM || 
           model === StochasticModel.Heston;
  }

  canRunIterations(count: number): boolean {
    if (this.isPremium()) return true;
    return count <= this.maxIterations();
  }

  // Returns the reason why a feature is locked (for tooltips/dialogs)
  getLockReason(feature: 'historic' | 'ai' | 'model' | 'iterations' | 'strategy_limit'): string {
    if (this.isPremium()) return '';

    switch (feature) {
      case 'historic':
        return 'Historic backtesting is available on the Pro plan.';
      case 'ai':
        return 'AI Assistant (Nanci) is available on the Pro plan.';
      case 'model':
        return 'Advanced stochastic models are available on the Pro plan.';
      case 'iterations':
        return `Free tier is limited to ${this.maxIterations()} iterations.`;
      case 'strategy_limit':
        return `Free tier is limited to ${this.maxStrategies()} strategies.`;
      default:
        return 'Upgrade to Pro to unlock this feature.';
    }
  }
}