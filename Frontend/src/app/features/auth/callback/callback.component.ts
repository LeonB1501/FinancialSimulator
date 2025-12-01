import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'qs-callback',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-surface-50">
      <div class="text-center">
        @if (!error) {
          <qs-loading-spinner size="lg" message="Completing sign in..." />
        } @else {
          <div class="card p-8 max-w-md">
            <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </div>
            <h2 class="text-xl font-semibold text-surface-900 mb-2">Authentication Failed</h2>
            <p class="text-surface-600 mb-6">{{ error }}</p>
            <a routerLink="/" class="btn-primary btn-md">Return to Home</a>
          </div>
        }
      </div>
    </div>
  `,
})
export class CallbackComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  error: string | null = null;

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    const errorParam = this.route.snapshot.queryParamMap.get('error');

    if (errorParam) {
      this.error = errorParam;
      return;
    }

    if (!token) {
      this.error = 'No authentication token received';
      return;
    }

    this.authService.handleOAuthCallback(token).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
        this.router.navigate([returnUrl]);
      },
      error: (err) => {
        this.error = err.message || 'Authentication failed';
      },
    });
  }
}
