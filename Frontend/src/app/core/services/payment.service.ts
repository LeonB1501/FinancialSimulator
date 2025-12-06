import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private readonly api = inject(ApiService);

  /**
   * Calls the backend to create a Stripe Checkout Session
   * and redirects the browser to the Stripe hosted page.
   */
  startCheckout(interval: 'month' | 'year'): void {
    // We will implement the backend endpoint '/payment/checkout' in Phase 6.
    // For now, this sets up the frontend contract.
    this.api.post<{ sessionUrl: string }>('/payment/checkout', { interval }).subscribe({
      next: (response) => {
        window.location.href = response.sessionUrl;
      },
      error: (err) => {
        console.error('Failed to start checkout:', err);
        alert('Could not initialize payment. Please try again later.');
      }
    });
  }

  /**
   * Optional: Manage portal for existing subscribers
   */
  manageSubscription(): void {
    this.api.post<{ url: string }>('/payment/portal', {}).subscribe({
      next: (response) => {
        window.location.href = response.url;
      },
      error: (err) => {
        console.error('Failed to open portal:', err);
      }
    });
  }
}