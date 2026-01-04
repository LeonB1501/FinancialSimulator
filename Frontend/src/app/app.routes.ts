import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/landing.component').then(m => m.LandingComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
    canActivate: [guestGuard],
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'strategies',
    loadChildren: () => import('./features/strategies/strategies.routes').then(m => m.STRATEGIES_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'build',
    loadChildren: () => import('./features/strategy-builder/strategy-builder.routes').then(m => m.STRATEGY_BUILDER_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'results/:id',
    loadComponent: () => import('./features/results/monte-carlo-results.component').then(m => m.ResultsComponent),
    canActivate: [authGuard],
  },
  {
    path: 'results/historic/:id',
    loadComponent: () => import('./features/results/historic-results.component').then(m => m.HistoricResultsComponent),
    canActivate: [authGuard],
  },
  // --- NEW ROUTES ---
  {
    path: 'upgrade',
    loadComponent: () => import('./features/subscription/upgrade/upgrade.component').then(m => m.UpgradeComponent),
    canActivate: [authGuard],
  },
  {
    path: 'payment/success',
    loadComponent: () => import('./features/subscription/success/success.component').then(m => m.SuccessComponent),
    canActivate: [authGuard],
  },
  // ------------------
  {
    path: '**',
    redirectTo: '',
  },
];