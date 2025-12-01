import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { HeaderComponent } from '@shared/components/header/header.component';
import { StrategyCardComponent } from '@shared/components/strategy-card/strategy-card.component';
import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { ConfirmationDialogComponent, ConfirmationDialogData } from '@shared/components/confirmation-dialog/confirmation-dialog.component';
import { AuthService } from '@core/services/auth.service';
import { StrategyService } from '@core/services/strategy.service';
import { SimulationService } from '@core/services/simulation.service';
import { NotificationService } from '@core/services/notification.service';
import { StrategySummary } from '@core/models';

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
    
    <div class="pt-[72px] min-h-screen bg-surface-50">
      <div class="flex">
        <!-- Left Sidebar -->
        <aside class="hidden lg:block w-[280px] flex-shrink-0 border-r border-surface-200 bg-white min-h-[calc(100vh-72px)] p-6">
          <!-- Quick Stats -->
          <div class="space-y-4 mb-8">
            <div class="card p-4">
              <p class="text-sm text-surface-500 mb-1">Saved Strategies</p>
              <p class="text-2xl font-bold text-surface-900">{{ quickStats().savedStrategies }}</p>
            </div>
            <div class="card p-4">
              <p class="text-sm text-surface-500 mb-1">Simulations Run</p>
              <p class="text-2xl font-bold text-surface-900">{{ quickStats().simulationsRun }}</p>
            </div>
            <div class="card p-4">
              <p class="text-sm text-surface-500 mb-1">Last Activity</p>
              <p class="text-lg font-medium text-surface-700">{{ quickStats().lastActivity }}</p>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="space-y-3">
            <a 
              routerLink="/build" 
              class="flex items-center justify-center space-x-2 w-full btn-primary btn-md"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
              </svg>
              <span>New Strategy</span>
            </a>
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
          <div class="mb-8">
            <h1 class="text-2xl lg:text-3xl font-bold text-surface-900 mb-2">
              Welcome back, {{ (authService.user()?.name?.split(' ')?.[0]) || 'there' }}!
            </h1>
            <p class="text-surface-600">
              Here's an overview of your strategies and recent activity.
            </p>
          </div>

          <!-- Mobile Quick Actions -->
          <div class="lg:hidden flex space-x-3 mb-8">
            <a routerLink="/build" class="flex-1 btn-primary btn-md text-center">
              <svg class="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
              </svg>
              New Strategy
            </a>
            <a routerLink="/strategies" class="flex-1 btn-secondary btn-md text-center">
              View All
            </a>
          </div>

          <!-- Recent Strategies -->
          <section class="mb-10">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-xl font-semibold text-surface-900">Recent Strategies</h2>
              <a routerLink="/strategies" class="text-accent-600 hover:text-accent-700 text-sm font-medium">
                View all →
              </a>
            </div>

            @if (strategyService.loading()) {
              <div class="grid md:grid-cols-2 gap-6">
                @for (i of [1, 2, 3, 4]; track i) {
                  <div class="card p-6 animate-pulse">
                    <div class="h-6 bg-surface-200 rounded w-3/4 mb-4"></div>
                    <div class="h-4 bg-surface-100 rounded w-1/2 mb-4"></div>
                    <div class="flex space-x-2 mb-4">
                      <div class="h-6 bg-surface-100 rounded-full w-16"></div>
                      <div class="h-6 bg-surface-100 rounded-full w-16"></div>
                    </div>
                    <div class="h-4 bg-surface-100 rounded w-1/3"></div>
                  </div>
                }
              </div>
            } @else if (recentStrategies().length === 0) {
              <div class="card p-12 text-center">
                <div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg class="w-8 h-8 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                  </svg>
                </div>
                <h3 class="text-lg font-medium text-surface-900 mb-2">No strategies yet</h3>
                <p class="text-surface-600 mb-6">Create your first strategy to start backtesting.</p>
                <a routerLink="/build" class="btn-primary btn-md inline-flex">
                  <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                  </svg>
                  Create Strategy
                </a>
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
              <h2 class="text-xl font-semibold text-surface-900 mb-6">Recent Activity</h2>
              
              @if (activityItems().length === 0) {
                <div class="card p-8 text-center">
                  <p class="text-surface-500">No recent activity to show.</p>
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
                            <p class="font-medium text-surface-900">{{ item.strategyName }}</p>
                            <p class="text-sm text-surface-500">{{ getActivityLabel(item.type) }}</p>
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
              <h2 class="text-xl font-semibold text-surface-900 mb-6">Account Summary</h2>
              <div class="card p-6">
                <div class="flex items-center space-x-4 mb-6 pb-6 border-b border-surface-100">
                  <div class="w-14 h-14 bg-primary-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                    {{ authService.userInitials() }}
                  </div>
                  <div>
                    <p class="font-semibold text-surface-900">{{ authService.user()?.name }}</p>
                    <p class="text-sm text-surface-500">{{ authService.user()?.email }}</p>
                  </div>
                </div>

                <div class="space-y-4">
                  <div class="flex justify-between">
                    <span class="text-surface-600">Plan</span>
                    <span class="font-medium text-surface-900">Free Tier</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-surface-600">Iterations/Sim</span>
                    <span class="font-medium text-surface-900">10,000</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-surface-600">Member Since</span>
                    <span class="font-medium text-surface-900">
                      {{ authService.user()?.createdAt | date:'MMM yyyy' }}
                    </span>
                  </div>
                </div>

                <button 
                  disabled
                  class="w-full mt-6 btn-secondary btn-md opacity-50 cursor-not-allowed"
                >
                  Upgrade Plan (Coming Soon)
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly strategyService = inject(StrategyService);
  private readonly simulationService = inject(SimulationService);
  private readonly notificationService = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

  readonly recentStrategies = signal<StrategySummary[]>([]);
  readonly activityItems = signal<ActivityItem[]>([]);
  readonly quickStats = signal<QuickStats>({
    savedStrategies: 0,
    simulationsRun: 0,
    lastActivity: 'Just now',
  });

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    // Load recent strategies
    this.strategyService.loadStrategies({ pageSize: 4, sortBy: 'updatedAt', sortOrder: 'desc' })
      .subscribe(response => {
        this.recentStrategies.set(response.data);
        
        // Update quick stats
        this.quickStats.update(stats => ({
          ...stats,
          savedStrategies: response.total,
        }));

        // Generate activity items from strategies
        this.generateActivityItems(response.data);
      });

    // In a real app, you'd load these from a separate endpoint
    this.quickStats.update(stats => ({
      ...stats,
      simulationsRun: 847,
      lastActivity: '2 hours ago',
    }));
  }

  private generateActivityItems(strategies: StrategySummary[]): void {
    const items: ActivityItem[] = strategies.map(s => ({
      id: s.id,
      type: s.hasResults ? 'completed' : 'updated',
      strategyName: s.name,
      timestamp: s.updatedAt,
    }));
    this.activityItems.set(items.slice(0, 5));
  }

  onRunStrategy(strategy: StrategySummary): void {
    this.strategyService.loadStrategy(strategy.id).subscribe(fullStrategy => {
      this.simulationService.runSimulation(fullStrategy).subscribe({
        next: () => {
          this.notificationService.success('Simulation completed!');
          this.loadDashboardData();
        },
        error: (err) => {
          this.notificationService.error(err.message || 'Simulation failed');
        },
      });
    });
  }

  onEditStrategy(strategy: StrategySummary): void {
    // Navigate to strategy builder with strategy loaded
    window.location.href = `/build?edit=${strategy.id}`;
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
      created: 'bg-blue-100 text-blue-600',
      updated: 'bg-amber-100 text-amber-600',
      completed: 'bg-green-100 text-green-600',
      failed: 'bg-red-100 text-red-600',
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
