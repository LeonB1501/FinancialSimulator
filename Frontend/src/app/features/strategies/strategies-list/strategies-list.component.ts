import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HeaderComponent } from '@shared/components/header/header.component';
import { StrategyCardComponent } from '@shared/components/strategy-card/strategy-card.component';
import { StrategyService } from '@core/services/strategy.service';
import { SimulationService } from '@core/services/simulation.service';
import { StrategySummary, SimulationMode, StrategyStatus } from '@core/models';

@Component({
  selector: 'qs-strategies-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, HeaderComponent, StrategyCardComponent],
  template: `
    <qs-header />
    
    <div class="pt-[72px] min-h-screen bg-surface-50">
      <div class="container-fluid py-8">
        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 class="text-2xl lg:text-3xl font-bold text-surface-900">My Strategies</h1>
            <p class="text-surface-600 mt-1">Manage and organize your investment strategies.</p>
          </div>
          <a routerLink="/build" class="px-4 py-2 bg-accent-500 text-white font-medium rounded-lg hover:bg-accent-600 transition-colors flex items-center shadow-soft">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
            New Strategy
          </a>
        </div>

        <!-- Filters -->
        <div class="bg-white rounded-2xl border border-surface-200 p-4 mb-8 shadow-soft">
          <div class="grid md:grid-cols-4 gap-4">
            <!-- Search -->
            <div class="md:col-span-2">
              <div class="relative">
                <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-surface-400">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </span>
                <input 
                  type="text" 
                  [(ngModel)]="searchQuery"
                  (input)="onSearch()"
                  placeholder="Search strategies..." 
                  class="w-full pl-10 pr-4 py-2.5 border border-surface-200 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none transition-all text-surface-900 placeholder-surface-400"
                >
              </div>
            </div>

            <!-- Mode Filter -->
            <div>
              <select 
                [(ngModel)]="modeFilter" 
                (change)="onFilterChange()"
                class="w-full px-4 py-2.5 border border-surface-200 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none bg-white text-surface-900"
              >
                <option value="">All Modes</option>
                <option [value]="SimulationMode.Accumulation">Accumulation</option>
                <option [value]="SimulationMode.Retirement">Retirement</option>
              </select>
            </div>

            <!-- Status Filter -->
            <div>
              <select 
                [(ngModel)]="statusFilter" 
                (change)="onFilterChange()"
                class="w-full px-4 py-2.5 border border-surface-200 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none bg-white text-surface-900"
              >
                <option value="">All Statuses</option>
                <option [value]="StrategyStatus.Draft">Draft</option>
                <option [value]="StrategyStatus.Ready">Ready</option>
                <option [value]="StrategyStatus.Completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Results Summary -->
        <div class="flex items-center justify-between mb-6">
          <p class="text-surface-600">
            {{ filteredStrategies().length }} {{ filteredStrategies().length === 1 ? 'strategy' : 'strategies' }}
          </p>
          <div class="flex items-center space-x-2">
            <span class="text-sm text-surface-500">Sort by:</span>
            <select 
              [(ngModel)]="sortBy" 
              (change)="onSortChange()"
              class="px-3 py-1.5 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-accent-500 outline-none bg-white text-surface-900"
            >
              <option value="updatedAt">Last Updated</option>
              <option value="name">Name</option>
              <option value="createdAt">Created</option>
            </select>
          </div>
        </div>

        <!-- Strategy Grid -->
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            @for (strategy of filteredStrategies(); track strategy.id) {
              <qs-strategy-card 
                [strategy]="strategy"
                (run)="onRunStrategy($event)"
                (edit)="onEditStrategy($event)"
                (delete)="onDeleteStrategy($event)"
              />
            }
        </div>
      </div>
    </div>
  `
})
export class StrategiesListComponent implements OnInit {
  readonly strategyService = inject(StrategyService);
  private readonly simulationService = inject(SimulationService);
  
  readonly SimulationMode = SimulationMode;
  readonly StrategyStatus = StrategyStatus;

  searchQuery = '';
  modeFilter: SimulationMode | '' = '';
  statusFilter: StrategyStatus | '' = '';
  sortBy = 'updatedAt';
  
  readonly filteredStrategies = signal<StrategySummary[]>([]);

  ngOnInit() {
    this.loadStrategies();
  }

  loadStrategies() {
    this.strategyService.loadStrategies({
      search: this.searchQuery || undefined,
      mode: this.modeFilter || undefined,
      status: this.statusFilter || undefined,
      sortBy: this.sortBy as any,
      sortOrder: 'desc'
    }).subscribe(res => {
      this.filteredStrategies.set(res.data);
    });
  }

  onSearch() { this.loadStrategies(); }
  onFilterChange() { this.loadStrategies(); }
  onSortChange() { this.loadStrategies(); }
  
  onRunStrategy(s: StrategySummary) { /* ... */ }
  onEditStrategy(s: StrategySummary) { window.location.href = `/build?edit=${s.id}`; }
  onDeleteStrategy(s: StrategySummary) { /* ... */ }
}