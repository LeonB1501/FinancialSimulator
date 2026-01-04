import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { HeaderComponent } from '@shared/components/header/header.component';
import { StrategyCardComponent } from '@shared/components/strategy-card/strategy-card.component';
import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { ConfirmationDialogComponent, ConfirmationDialogData } from '@shared/components/confirmation-dialog/confirmation-dialog.component';
import { SimulationProgressDialogComponent } from '../strategy-builder/simulation-progress-dialog/simulation-progress-dialog.component';
import { PremiumDialogComponent } from '@shared/components/premium-dialog/premium-dialog.component';
import { AuthService } from '@core/services/auth.service';
import { StrategyService } from '@core/services/strategy.service';
import { SimulationService } from '@core/services/simulation.service';
import { SimulationQueueService } from '@core/services/simulation-queue.service';
import { NotificationService } from '@core/services/notification.service';
import { PermissionsService } from '@core/services/permissions.service';
import { PaymentService } from '@core/services/payment.service';
import { StrategySummary, Strategy } from '@core/models';

interface ActivityItem {
  id: string;
  type: 'created' | 'updated' | 'completed' | 'failed';
  strategyName: string;
  timestamp: Date;
  details?: string;
}

interface QuickStats {
  savedStrategies: number;
  simulationsRun: number;
  lastActivity: string;
}

@Component({
  selector: 'qs-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    MatDialogModule,
    HeaderComponent,
    StrategyCardComponent,
    LoadingSpinnerComponent,
  ],
  template: `
    <qs-header />
    
    <div class="pt-[72px] min-h-screen bg-surface-50 dark:bg-surface-900 transition-colors duration-300">
      <div class="flex">
        <!-- Left Sidebar -->
        <aside class="hidden lg:block w-[280px] flex-shrink-0 border-r border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 min-h-[calc(100vh-72px)] p-6 transition-colors duration-300">
          <!-- Quick Stats -->
          <div class="space-y-4 mb-8">
            <div class="card p-4">
              <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">Saved Strategies</p>
              <div class="flex items-baseline justify-between">
                <p class="text-2xl font-bold text-surface-900 dark:text-surface-100">{{ quickStats().savedStrategies }}</p>
                @if (!permissionsService.isPremium()) {
                  <span class="text-xs text-surface-500">of {{ permissionsService.maxStrategies() }}</span>
                }
              </div>
              @if (!permissionsService.isPremium()) {
                <div class="w-full bg-surface-200 dark:bg-surface-700 rounded-full h-1.5 mt-2">
                  <div class="bg-accent-500 h-1.5 rounded-full" [style.width.%]="(quickStats().savedStrategies / permissionsService.maxStrategies()) * 100"></div>
                </div>
              }
            </div>
            <div class="card p-4">
              <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">Simulations Run</p>
              <p class="text-2xl font-bold text-surface-900 dark:text-surface-100">{{ quickStats().simulationsRun }}</p>
            </div>
            <div class="card p-4">
              <p class="text-sm text-surface-500 dark:text-surface-400 mb-1">Last Activity</p>
              <p class="text-lg font-medium text-surface-700 dark:text-surface-300">{{ quickStats().lastActivity }}</p>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="space-y-3">
            <button 
              (click)="onNewStrategy()"
              class="flex items-center justify-center space-x-2 w-full btn-primary btn-md relative overflow-hidden"
              [class.opacity-90]="!canCreateStrategy()"
            >
              @if (!canCreateStrategy()) {
                <div class="absolute inset-0 bg-black/10 flex items-center justify-center">
                  <svg class="w-5 h-5 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                </div>
              }
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
              </svg>
              <span>New Strategy</span>
            </button>
            <a 
              routerLink="/strategies" 
              class="flex items-center justify-center space-x-2 w-full btn-secondary btn-md"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
              </svg>
              <span>View All</span>
            </a>
          </div>
        </aside>

        <!-- Main Content -->
        <main class="flex-1 p-6 lg:p-8">
          <!-- Welcome Section -->
          <div class="mb-8 flex justify-between items-end">
            <div>
              <h1 class="text-2xl lg:text-3xl font-bold text-surface-900 dark:text-surface-100 mb-2">
                Welcome back, {{ (authService.user()?.name?.split(' ')?.[0]) || 'there' }}!
              </h1>
              <p class="text-surface-600 dark:text-surface-400">
                Here's an overview of your strategies and recent activity.
              </p>
            </div>
            @if (!permissionsService.isPremium()) {
              <button (click)="openPremiumDialog('Pro Features')" class="hidden md:flex items-center px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                <span class="font-bold">Upgrade to Pro</span>
              </button>
            }
          </div>

          <!-- Mobile Quick Actions -->
          <div class="lg:hidden flex space-x-3 mb-8">
            <button (click)="onNewStrategy()" class="flex-1 btn-primary btn-md text-center relative overflow-hidden">
              @if (!canCreateStrategy()) {
                <div class="absolute inset-0 bg-black/10 flex items-center justify-center">
                  <svg class="w-5 h-5 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                </div>
              }
              <svg class="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
              </svg>
              New Strategy
            </button>
            <a routerLink="/strategies" class="flex-1 btn-secondary btn-md text-center">
              View All
            </a>
          </div>

          <!-- Recent Strategies -->
          <section class="mb-10">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-100">Recent Strategies</h2>
              <a routerLink="/strategies" class="text-accent-600 dark:text-accent-400 hover:text-accent-700 dark:hover:text-accent-300 text-sm font-medium">
                View all →
              </a>
            </div>

            @if (strategyService.loading()) {
              <div class="grid md:grid-cols-2 gap-6">
                @for (i of [1, 2, 3, 4]; track i) {
                  <div class="card p-6 animate-pulse">
                    <div class="h-6 bg-surface-200 dark:bg-surface-700 rounded w-3/4 mb-4"></div>
                    <div class="h-4 bg-surface-100 dark:bg-surface-600 rounded w-1/2 mb-4"></div>
                    <div class="flex space-x-2 mb-4">
                      <div class="h-6 bg-surface-100 dark:bg-surface-600 rounded-full w-16"></div>
                      <div class="h-6 bg-surface-100 dark:bg-surface-600 rounded-full w-16"></div>
                    </div>
                    <div class="h-4 bg-surface-100 dark:bg-surface-600 rounded w-1/3"></div>
                  </div>
                }
              </div>
            } @else if (recentStrategies().length === 0) {
              <div class="card p-12 text-center">
                <div class="w-16 h-16 bg-surface-100 dark:bg-surface-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg class="w-8 h-8 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                  </svg>
                </div>
                <h3 class="text-lg font-medium text-surface-900 dark:text-surface-100 mb-2">No strategies yet</h3>
                <p class="text-surface-600 dark:text-surface-400 mb-6">Create your first strategy to start backtesting.</p>
                <button (click)="onNewStrategy()" class="btn-primary btn-md inline-flex">
                  <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                  </svg>
                  Create Strategy
                </button>
              </div>
            } @else {
              <div class="grid md:grid-cols-2 gap-6">
                @for (strategy of recentStrategies(); track strategy.id) {
                  <qs-strategy-card 
                    [strategy]="strategy"
                    (run)="onRunStrategy($event)"
                    (edit)="onEditStrategy($event)"
                    (delete)="onDeleteStrategy($event)"
                  />
                }
              </div>
            }
          </section>

          <!-- Two Column Layout: Activity Feed & Account Summary -->
          <div class="grid lg:grid-cols-3 gap-8">
            <!-- Activity Feed -->
            <section class="lg:col-span-2">
              <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-6">Recent Activity</h2>
              
              @if (activityItems().length === 0) {
                <div class="card p-8 text-center">
                  <p class="text-surface-500 dark:text-surface-400">No recent activity to show.</p>
                </div>
              } @else {
                <div class="space-y-4">
                  @for (item of activityItems(); track item.id) {
                    <div class="card p-4 gradient-border-left">
                      <div class="flex items-start justify-between">
                        <div class="flex items-start space-x-3">
                          <div [class]="getActivityIconClass(item.type)">
                            <ng-container [ngSwitch]="item.type">
                              <svg *ngSwitchCase="'created'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                              </svg>
                              <svg *ngSwitchCase="'updated'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                              </svg>
                              <svg *ngSwitchCase="'completed'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                              </svg>
                              <svg *ngSwitchCase="'failed'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                              </svg>
                            </ng-container>
                          </div>
                          <div>
                            <p class="font-medium text-surface-900 dark:text-surface-100">{{ item.strategyName }}</p>
                            <p class="text-sm text-surface-500 dark:text-surface-400">{{ getActivityLabel(item.type) }}</p>
                          </div>
                        </div>
                        <span class="text-sm text-surface-400">
                          {{ item.timestamp | date:'MMM d, h:mm a' }}
                        </span>
                      </div>
                    </div>
                  }
                </div>
              }
            </section>

            <!-- Account Summary -->
            <section>
              <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-6">Account Summary</h2>
              <div class="card p-6">
                <div class="flex items-center space-x-4 mb-6 pb-6 border-b border-surface-100 dark:border-surface-700">
                  <div class="w-14 h-14 bg-primary-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                    {{ authService.userInitials() }}
                  </div>
                  <div>
                    <p class="font-semibold text-surface-900 dark:text-surface-100">{{ authService.user()?.name }}</p>
                    <div class="flex items-center space-x-2">
                        <p class="text-sm text-surface-500 dark:text-surface-400">{{ authService.user()?.email }}</p>
                        @if (permissionsService.isPremium()) {
                            <span class="px-1.5 py-0.5 bg-accent-100 text-accent-700 text-[10px] font-bold rounded uppercase">Pro</span>
                        } @else {
                            <span class="px-1.5 py-0.5 bg-surface-200 text-surface-600 text-[10px] font-bold rounded uppercase">Free</span>
                        }
                    </div>
                  </div>
                </div>

                <div class="space-y-4">
                  <div class="flex justify-between">
                    <span class="text-surface-600 dark:text-surface-400">Plan</span>
                    <span class="font-medium text-surface-900 dark:text-surface-100">{{ permissionsService.isPremium() ? 'Pro Tier' : 'Free Tier' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-surface-600 dark:text-surface-400">Strategies</span>
                    <span class="font-medium text-surface-900 dark:text-surface-100">
                        {{ quickStats().savedStrategies }} / {{ permissionsService.isPremium() ? '∞' : permissionsService.maxStrategies() }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-surface-600 dark:text-surface-400">Iterations/Sim</span>
                    <span class="font-medium text-surface-900 dark:text-surface-100">
                        {{ permissionsService.maxIterations() | number }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-surface-600 dark:text-surface-400">Member Since</span>
                    <span class="font-medium text-surface-900 dark:text-surface-100">
                      {{ authService.user()?.createdAt | date:'MMM yyyy' }}
                    </span>
                  </div>
                </div>

                @if (!permissionsService.isPremium()) {
                    <button 
                      (click)="openPremiumDialog('Pro Features')"
                      class="w-full mt-6 btn-primary btn-md bg-gradient-to-r from-amber-400 to-orange-500 border-none shadow-lg hover:shadow-xl"
                    >
                      Upgrade to Pro
                    </button>
                } @else {
                    <button 
                      (click)="onManageSubscription()"
                      class="w-full mt-6 btn-secondary btn-md"
                    >
                      Manage Subscription
                    </button>
                }
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  readonly strategyService = inject(StrategyService);
  readonly permissionsService = inject(PermissionsService);
  readonly paymentService = inject(PaymentService);
  private readonly simulationService = inject(SimulationService);
  private readonly queueService = inject(SimulationQueueService);
  private readonly notificationService = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  private queueCompleteSub?: Subscription;

  readonly recentStrategies = signal<StrategySummary[]>([]);
  readonly activityItems = signal<ActivityItem[]>([]);
  readonly quickStats = signal<QuickStats>({
    savedStrategies: 0,
    simulationsRun: 0,
    lastActivity: 'Just now',
  });

  ngOnInit(): void {
    this.loadDashboardData();
    
    // Listen for background simulation completions to refresh dashboard
    this.queueCompleteSub = this.queueService.onComplete$.subscribe(() => {
      this.loadDashboardData();
    });
  }

  ngOnDestroy(): void {
    this.queueCompleteSub?.unsubscribe();
  }

  private loadDashboardData(): void {
    // Load recent strategies
    this.strategyService.loadStrategies({ pageSize: 4, sortBy: 'updatedAt', sortOrder: 'desc' })
      .subscribe(response => {
        this.recentStrategies.set(response.data);
        
        // Update quick stats
        const completedCount = response.data.filter(s => !!s.latestResultId).length;
        
        this.quickStats.update(stats => ({
          ...stats,
          savedStrategies: response.total,
          simulationsRun: completedCount, 
          lastActivity: response.data.length > 0 ? this.timeSince(response.data[0].updatedAt) : 'N/A'
        }));

        // Generate activity items from strategies
        this.generateActivityItems(response.data);
      });
  }

  private timeSince(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return "Just now";
  }

  private generateActivityItems(strategies: StrategySummary[]): void {
    const items: ActivityItem[] = strategies.map(s => ({
      id: s.id,
      type: s.latestResultId ? 'completed' : 'updated',
      strategyName: s.name,
      timestamp: s.updatedAt,
    }));
    this.activityItems.set(items.slice(0, 5));
  }

  canCreateStrategy(): boolean {
    return this.permissionsService.canCreateStrategy(this.quickStats().savedStrategies);
  }

  onNewStrategy(): void {
    if (this.canCreateStrategy()) {
      this.router.navigate(['/build']);
    } else {
      this.openPremiumDialog('Strategy Limit Reached');
    }
  }

  openPremiumDialog(feature: string): void {
    this.dialog.open(PremiumDialogComponent, {
      width: '450px',
      data: {
        featureName: feature,
        description: this.permissionsService.getLockReason('strategy_limit')
      }
    });
  }

  onRunStrategy(strategy: StrategySummary): void {
    this.strategyService.loadStrategy(strategy.id).subscribe({
      next: (fullStrategy) => {
        const dialogRef = this.dialog.open(SimulationProgressDialogComponent, {
          disableClose: true,
          width: '500px',
          data: { strategy: fullStrategy },
        });

        dialogRef.afterClosed().subscribe(result => {
          if (result?.success) {
            this.notificationService.success('Simulation completed successfully!');
            this.router.navigate(['/results', strategy.id]);
          } else if (result?.minimized) {
            this.queueService.registerRunning(fullStrategy as Strategy);
            this.notificationService.info('Simulation running in background. Check the indicator in the header.');
          } else if (result?.cancelled) {
            this.notificationService.info('Simulation cancelled.');
          }
          this.loadDashboardData();
        });
      },
      error: (err) => {
        this.notificationService.error('Failed to load strategy for simulation: ' + err.message);
      }
    });
  }

  onEditStrategy(strategy: StrategySummary): void {
    window.location.href = `/build?edit=${strategy.id}`;
  }

  onManageSubscription(): void {
    this.paymentService.manageSubscription();
  }

  onDeleteStrategy(strategy: StrategySummary): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Delete Strategy',
        message: `Are you sure you want to delete "${strategy.name}"? This action cannot be undone.`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      } as ConfirmationDialogData,
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.strategyService.deleteStrategy(strategy.id).subscribe({
          next: () => {
            this.notificationService.success('Strategy deleted');
            this.loadDashboardData();
          },
          error: () => {
            this.notificationService.error('Failed to delete strategy');
          },
        });
      }
    });
  }

  getActivityIconClass(type: ActivityItem['type']): string {
    const base = 'w-8 h-8 rounded-full flex items-center justify-center';
    const colors: Record<ActivityItem['type'], string> = {
      created: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      updated: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
      completed: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
      failed: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    };
    return `${base} ${colors[type]}`;
  }

  getActivityLabel(type: ActivityItem['type']): string {
    const labels: Record<ActivityItem['type'], string> = {
      created: 'Strategy created',
      updated: 'Strategy updated',
      completed: 'Simulation completed',
      failed: 'Simulation failed',
    };
    return labels[type];
  }
}