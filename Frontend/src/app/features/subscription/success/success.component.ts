import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'qs-payment-success',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent],
  template: `
    <div class="min-h-screen bg-surface-50 dark:bg-surface-900 flex items-center justify-center p-4">
      <div class="card p-8 max-w-md w-full text-center dark:bg-surface-800 dark:border-surface-700">
        
        @if (loading) {
          <qs-loading-spinner size="lg" message="Finalizing your upgrade..." />
        } @else {
          <div class="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <svg class="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          
          <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-2">
            Upgrade Successful!
          </h1>
          
          <p class="text-surface-600 dark:text-surface-400 mb-8">
            Welcome to QuantSim Pro. Your account has been upgraded and all features are now unlocked.
          </p>
          
          <button 
            (click)="navigateToDashboard()"
            class="w-full btn-primary btn-lg"
          >
            Go to Dashboard
          </button>
        }
      </div>
    </div>
  `
})
export class SuccessComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  
  loading = true;

  ngOnInit(): void {
    // Refresh the token to get the new 'Pro' claim from the backend
    // The backend webhook should have already processed the event by the time 
    // the user is redirected here, but we might need a small retry loop in a real app.
    // For now, we assume immediate consistency or that the backend provides a fresh token endpoint.
    
    setTimeout(() => {
      this.authService.refreshToken().subscribe({
        next: () => {
          this.loading = false;
        },
        error: (err) => {
          console.error('Failed to refresh token', err);
          // Even if refresh fails, let them go to dashboard, they might just need to re-login
          this.loading = false; 
        }
      });
    }, 1500); // Small artificial delay for UX "processing" feel
  }

  navigateToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}