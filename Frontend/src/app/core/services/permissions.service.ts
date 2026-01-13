import { Injectable, inject, computed } from '@angular/core';
import { AuthService } from './auth.service';
import { StochasticModel } from '../models/strategy.model';

@Injectable({
  providedIn: 'root'
})
export class PermissionsService {
  private readonly auth = inject(AuthService);
  
  readonly isPremium = computed(() => {
    const user = this.auth.user();
    return user?.subscriptionTier === 'Pro' && user?.subscriptionStatus === 'Active';
  });


  readonly maxStrategies = computed(() => this.isPremium() ? Infinity : 5);
  
  readonly maxIterations = computed(() => this.isPremium() ? 100000 : 1000);

  readonly canUseHistoricData = computed(() => this.isPremium());

  readonly canUseAiAssistant = computed(() => this.isPremium());


  canCreateStrategy(currentCount: number): boolean {
    return this.isPremium() || currentCount < this.maxStrategies();
  }

  canUseModel(model: StochasticModel): boolean {
    if (this.isPremium()) return true;

    return model === StochasticModel.GBM || 
           model === StochasticModel.Heston;
  }

  canRunIterations(count: number): boolean {
    if (this.isPremium()) return true;
    return count <= this.maxIterations();
  }

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