import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';

@Component({
  selector: 'qs-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatMenuModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <header class="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-surface-800 shadow-soft dark:shadow-soft-dark border-b border-transparent dark:border-surface-700 transition-colors duration-300">
      <div class="max-w-full mx-auto px-6 lg:px-8">
        <div class="flex items-center justify-between h-[72px]">
          <!-- Logo -->
          <a routerLink="/" class="flex items-center space-x-3">
            <div class="w-9 h-9 bg-gradient-to-br from-accent-500 to-accent-600 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            <span class="text-xl font-bold text-primary-600 dark:text-accent-400">QuantSim</span>
          </a>

          <!-- Center Navigation (authenticated) -->
          @if (authService.isAuthenticated()) {
            <nav class="hidden md:flex items-center space-x-1">
              <a 
                routerLink="/dashboard" 
                routerLinkActive="bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-accent-400"
                class="flex items-center space-x-2 px-4 py-2 rounded-lg text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                </svg>
                <span>Dashboard</span>
              </a>
              
              <a 
                routerLink="/build" 
                routerLinkActive="bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-accent-400"
                class="flex items-center space-x-2 px-4 py-2 rounded-lg text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                </svg>
                <span>Build Strategy</span>
              </a>
              
              <a 
                routerLink="/strategies" 
                routerLinkActive="bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-accent-400"
                class="flex items-center space-x-2 px-4 py-2 rounded-lg text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                </svg>
                <span>My Strategies</span>
              </a>
            </nav>
          }

          <!-- Right Section -->
          <div class="flex items-center space-x-4">
            <!-- Dark Mode Toggle -->
            <button 
              (click)="themeService.toggleTheme()"
              class="p-2 rounded-lg text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              [attr.aria-label]="themeService.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
            >
              @if (themeService.isDark()) {
                <!-- Sun icon for dark mode (click to go light) -->
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
                </svg>
              } @else {
                <!-- Moon icon for light mode (click to go dark) -->
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
                </svg>
              }
            </button>

            @if (authService.isAuthenticated()) {
              <!-- User Menu -->
              <button 
                [matMenuTriggerFor]="userMenu"
                class="flex items-center space-x-2 p-1 rounded-full hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              >
                <div class="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-semibold">
                  {{ authService.userInitials() }}
                </div>
                <svg class="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
              
              <mat-menu #userMenu="matMenu" class="mt-2">
                <div class="px-4 py-3 border-b border-surface-100 dark:border-surface-700">
                  <p class="text-sm font-medium text-surface-900 dark:text-surface-100">{{ authService.user()?.name }}</p>
                  <p class="text-sm text-surface-500 dark:text-surface-400">{{ authService.user()?.email }}</p>
                </div>
                <button mat-menu-item disabled>
                  <svg class="w-5 h-5 mr-3 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  Account Settings
                </button>
                <button mat-menu-item disabled>
                  <svg class="w-5 h-5 mr-3 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
                  </svg>
                  Preferences
                </button>
                <div class="border-t border-surface-100 dark:border-surface-700 mt-1 pt-1">
                  <button mat-menu-item (click)="authService.logout()">
                    <svg class="w-5 h-5 mr-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                    </svg>
                    Sign Out
                  </button>
                </div>
              </mat-menu>
            } @else {
              <!-- Public Navigation -->
              @if (showPublicNav) {
                <nav class="hidden md:flex items-center space-x-6">
                  <a href="#features" class="text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-200 transition-colors">Features</a>
                  <a href="#how-it-works" class="text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-200 transition-colors">How it Works</a>
                </nav>
              }
              <a 
                routerLink="/" 
                fragment="auth"
                class="btn-secondary btn-md"
              >
                Sign In
              </a>
              <a 
                routerLink="/" 
                fragment="auth"
                class="btn-primary btn-md"
              >
                Get Started
              </a>
            }
          </div>
        </div>
      </div>
    </header>
  `,
})
export class HeaderComponent {
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  
  @Input() showPublicNav = true;
}
