import { Routes } from '@angular/router';

export const STRATEGIES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./strategies-list/strategies-list.component').then(m => m.StrategiesListComponent),
  },
];
