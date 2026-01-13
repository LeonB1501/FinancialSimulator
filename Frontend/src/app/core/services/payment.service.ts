import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private readonly api = inject(ApiService);

  startCheckout(interval: 'month' | 'year'): void {
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