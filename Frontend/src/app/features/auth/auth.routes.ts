import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: 'callback',
    loadComponent: () => import('./callback/callback.component').then(m => m.CallbackComponent),
  },
];
