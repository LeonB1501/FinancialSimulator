import { ApplicationConfig, provideZoneChangeDetection, importProvidersFrom } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { NgChartsModule } from 'ng2-charts'; // Use Module import for safety

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { mockBackendInterceptor } from '@core/interceptors/mock-backend.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions()
    ),
    provideHttpClient(
      withInterceptors([mockBackendInterceptor ,authInterceptor])
    ),
    provideAnimationsAsync(),
    importProvidersFrom(NgChartsModule), // Fixed
  ]
};