import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PaymentService } from '@core/services/payment.service';
import { HeaderComponent } from '@shared/components/header/header.component';

@Component({
  selector: 'qs-upgrade',
  standalone: true,
  imports: [CommonModule, RouterLink, HeaderComponent],
  template: `
    <qs-header />
    
    <div class="pt-[72px] min-h-screen bg-surface-50 dark:bg-surface-900 transition-colors duration-300">
      <div class="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        
        <!-- Header -->
        <div class="text-center max-w-3xl mx-auto mb-16">
          <h1 class="text-4xl font-bold text-surface-900 dark:text-surface-100 mb-4">
            Supercharge Your Backtesting
          </h1>
          <p class="text-xl text-surface-600 dark:text-surface-400">
            Unlock professional-grade models, AI assistance, and unlimited strategies.
          </p>

          <!-- Billing Toggle -->
          <div class="mt-8 flex items-center justify-center space-x-4">
            <span class="text-sm font-medium" [class.text-surface-900]="billingInterval() === 'month'" [class.dark:text-surface-100]="billingInterval() === 'month'" [class.text-surface-500]="billingInterval() !== 'month'">Monthly</span>
            <button 
              (click)="toggleInterval()"
              class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
              [class.bg-accent-500]="billingInterval() === 'year'"
              [class.bg-surface-300]="billingInterval() === 'month'"
            >
              <span 
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                [class.translate-x-5]="billingInterval() === 'year'"
                [class.translate-x-0]="billingInterval() === 'month'"
              ></span>
            </button>
            <span class="text-sm font-medium" [class.text-surface-900]="billingInterval() === 'year'" [class.dark:text-surface-100]="billingInterval() === 'year'" [class.text-surface-500]="billingInterval() !== 'year'">
              Yearly <span class="text-accent-600 dark:text-accent-400 text-xs ml-1">(Save 20%)</span>
            </span>
          </div>
        </div>

        <!-- Pricing Cards -->
        <div class="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          
          <!-- Free Plan -->
          <div class="card p-8 flex flex-col dark:bg-surface-800 border-surface-200 dark:border-surface-700">
            <div class="mb-4">
              <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100">Basic</h3>
              <p class="text-surface-500 dark:text-surface-400 text-sm">Essential tools for hobbyists.</p>
            </div>
            <div class="mb-6">
              <span class="text-4xl font-bold text-surface-900 dark:text-surface-100">$0</span>
              <span class="text-surface-500 dark:text-surface-400">/forever</span>
            </div>
            <a routerLink="/dashboard" class="btn-secondary btn-lg w-full mb-8 text-center">
              Current Plan
            </a>
            <ul class="space-y-4 flex-1">
              <li class="flex items-start">
                <svg class="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                <span class="text-surface-600 dark:text-surface-300">5 Saved Strategies</span>
              </li>
              <li class="flex items-start">
                <svg class="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                <span class="text-surface-600 dark:text-surface-300">Standard Models (GBM, Heston)</span>
              </li>
              <li class="flex items-start">
                <svg class="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                <span class="text-surface-600 dark:text-surface-300">1,000 Iterations per Sim</span>
              </li>
              <li class="flex items-start opacity-50">
                <svg class="w-5 h-5 text-surface-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                <span class="text-surface-500">Historic Backtesting</span>
              </li>
              <li class="flex items-start opacity-50">
                <svg class="w-5 h-5 text-surface-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                <span class="text-surface-500">AI Assistant (Nanci)</span>
              </li>
            </ul>
          </div>

          <!-- Pro Plan -->
          <div class="card p-8 flex flex-col relative border-accent-500 ring-4 ring-accent-500/10 dark:bg-surface-800 transform md:-translate-y-4">
            <div class="absolute top-0 right-0 bg-accent-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">
              MOST POPULAR
            </div>
            <div class="mb-4">
              <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100">Pro</h3>
              <p class="text-surface-500 dark:text-surface-400 text-sm">For serious quantitative analysis.</p>
            </div>
            <div class="mb-6">
              <span class="text-4xl font-bold text-surface-900 dark:text-surface-100">\${{ billingInterval() === 'month' ? '29' : '24' }}</span>
              <span class="text-surface-500 dark:text-surface-400">/month</span>
              @if (billingInterval() === 'year') {
                <p class="text-xs text-accent-600 dark:text-accent-400 mt-1">Billed $288 yearly</p>
              }
            </div>
            <button 
              (click)="onUpgrade()"
              class="btn-primary btn-lg w-full mb-8 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              Start 7-Day Free Trial
            </button>
            <ul class="space-y-4 flex-1">
              <li class="flex items-start">
                <svg class="w-5 h-5 text-accent-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                <span class="text-surface-900 dark:text-surface-100 font-medium">Unlimited Strategies</span>
              </li>
              <li class="flex items-start">
                <svg class="w-5 h-5 text-accent-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                <span class="text-surface-900 dark:text-surface-100 font-medium">Historic Backtesting</span>
              </li>
              <li class="flex items-start">
                <svg class="w-5 h-5 text-accent-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                <span class="text-surface-900 dark:text-surface-100 font-medium">AI Strategy Assistant</span>
              </li>
              <li class="flex items-start">
                <svg class="w-5 h-5 text-accent-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                <span class="text-surface-900 dark:text-surface-100 font-medium">Advanced Models (GARCH, Regime)</span>
              </li>
              <li class="flex items-start">
                <svg class="w-5 h-5 text-accent-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                <span class="text-surface-900 dark:text-surface-100 font-medium">Unlimited Iterations</span>
              </li>
              <li class="flex items-start">
                <svg class="w-5 h-5 text-accent-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                <span class="text-surface-900 dark:text-surface-100 font-medium">Custom Tickers & Correlations</span>
              </li>
            </ul>
          </div>

        </div>
        
        <div class="text-center mt-12">
          <p class="text-surface-500 dark:text-surface-400 text-sm">
            Secure payment via Stripe. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  `
})
export class UpgradeComponent {
  private readonly paymentService = inject(PaymentService);
  
  readonly billingInterval = signal<'month' | 'year'>('year');

  toggleInterval(): void {
    this.billingInterval.update(v => v === 'month' ? 'year' : 'month');
  }

  onUpgrade(): void {
    this.paymentService.startCheckout(this.billingInterval());
  }
}