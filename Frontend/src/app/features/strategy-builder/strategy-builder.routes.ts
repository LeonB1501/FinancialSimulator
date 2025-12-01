import { Routes } from '@angular/router';

export const STRATEGY_BUILDER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./strategy-builder.component').then(m => m.StrategyBuilderComponent),
  },
];
