import { Component, Input, Output, EventEmitter, signal, computed, OnInit, inject, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, switchMap, tap } from 'rxjs/operators';

import { StrategyDraft, StochasticModel } from '@core/models';
import { StrategyService } from '@core/services/strategy.service';
import { DslValidationService } from '@core/services/dsl-validation.service';
import { ThemeService } from '@core/services/theme.service';
import { AiChatComponent } from '../../components/ai-chat/ai-chat.component';

interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  code: string;
}

@Component({
  selector: 'qs-dsl-editor',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    MatMenuModule, 
    MatButtonModule, 
    MonacoEditorModule, 
    AiChatComponent
  ],
  template: `
    <!-- Dynamic container width -->
    <div [class]="containerClasses()">
      
      <div class="mb-8">
        <h1 class="text-2xl lg:text-3xl font-bold text-surface-900 dark:text-surface-100 mb-2">
          Strategy DSL
        </h1>
        <p class="text-surface-600 dark:text-surface-400">
          Define your trading rules and strategy logic using our domain-specific language.
        </p>
      </div>

      <!-- Toolbar -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center space-x-2">
          <button (click)="formatCode()" class="btn-ghost btn-sm dark:text-surface-300 dark:hover:bg-surface-800 border border-surface-200 dark:border-surface-700">Format</button>
          <button (click)="clearCode()" class="btn-ghost btn-sm dark:text-surface-300 dark:hover:bg-surface-800 border border-surface-200 dark:border-surface-700">Clear</button>
          <div class="w-px h-6 bg-surface-200 dark:bg-surface-700 mx-2"></div>
          
          <!-- Templates Dropdown -->
          <button [matMenuTriggerFor]="templatesMenu" class="btn-ghost btn-sm dark:text-surface-300 dark:hover:bg-surface-800 border border-surface-200 dark:border-surface-700">
            Insert Template
            <svg class="w-4 h-4 ml-1.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <mat-menu #templatesMenu="matMenu">
            @for (template of strategyTemplates; track template.id) {
              <button mat-menu-item (click)="insertTemplate(template.code)">
                <div class="flex flex-col py-1">
                  <span class="font-medium">{{ template.name }}</span>
                  <span class="text-xs opacity-75">{{ template.description }}</span>
                </div>
              </button>
            }
          </mat-menu>
        </div>

        <div class="flex items-center space-x-3">
          <!-- Validation Status -->
          <div class="flex items-center space-x-2 mr-2">
            @if (isValidating()) {
              <span class="text-sm text-surface-500">Validating...</span>
            } @else if (hasErrors()) {
              <span class="flex items-center text-sm text-red-600 font-medium">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                {{ errorCount() }} error(s)
              </span>
            } @else if (code().length > 0) {
              <span class="flex items-center text-sm text-green-600 font-medium">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                Valid
              </span>
            }
          </div>

          <!-- AI Toggle -->
          <button 
            (click)="toggleChat()"
            [class.ring-2]="showChat()"
            class="btn-primary btn-sm flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-indigo-600 border-none shadow-lg hover:shadow-purple-500/20 ring-offset-2 ring-purple-500 transition-all"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <span>Ask Nanci</span>
          </button>
        </div>
      </div>

      <!-- Main Layout -->
      <div class="flex flex-1 gap-6 h-[calc(100vh_-_280px)]">
        
        <!-- Editor Column -->
        <div class="flex-1 flex flex-col min-w-0">
          <div class="card flex flex-col flex-1 overflow-hidden mb-6 border-surface-200 dark:border-surface-700 shadow-sm relative">
            
            <!-- Monaco Editor Container -->
              <div class="flex-1 bg-white dark:bg-surface-900 relative">
              <ngx-monaco-editor 
                class="w-full h-full absolute inset-0"
                [options]="editorOptions()"
                [ngModel]="code()"
                (ngModelChange)="onCodeChange($event)"
                (onInit)="onEditorInit($event)"
              ></ngx-monaco-editor>
            </div>

            <!-- Error Panel (Fixed at bottom) -->
            @if (hasErrors()) {
              <div class="border-t border-surface-200 dark:border-surface-700 bg-red-50 dark:bg-red-900/20 p-3 max-h-32 overflow-y-auto absolute bottom-0 left-0 right-0 z-10 backdrop-blur-sm">
                <ul class="space-y-1">
                  @for (error of errors(); track $index) {
                    <li class="flex items-start text-xs text-red-700 dark:text-red-400 font-mono cursor-pointer hover:underline" (click)="jumpToError(error)">
                      <span class="font-bold mr-2">Ln {{ error.line }}:</span>
                      {{ error.message }}
                    </li>
                  }
                </ul>
              </div>
            }
          </div>

          <!-- Reference Cards -->
          <div class="grid md:grid-cols-2 gap-4 h-48 animate-in fade-in">
            <!-- Quick Reference -->
            <div class="card p-4 dark:bg-surface-800 dark:border-surface-700 overflow-y-auto">
              <div class="flex items-center justify-between mb-2">
                <h3 class="font-semibold text-surface-900 dark:text-surface-100 text-sm">Quick Reference</h3>
                <button
                  (click)="showReferenceGuide = true"
                  class="text-xs text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 font-medium flex items-center gap-1"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                  Full Guide
                </button>
              </div>
              <div class="space-y-2 text-xs">
                <div>
                  <span class="text-surface-500 dark:text-surface-400 block mb-1">Control Flow</span>
                  <div class="flex flex-wrap gap-1">
                    @for (kw of ['define', 'as', 'when', 'end', 'for_any_position', 'set', 'to']; track kw) { <code class="px-1.5 py-0.5 bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300 rounded border border-accent-200 dark:border-accent-800 cursor-pointer hover:bg-accent-100 dark:hover:bg-accent-900/50" (click)="insertText(kw)">{{kw}}</code> }
                  </div>
                </div>
                <div>
                  <span class="text-surface-500 dark:text-surface-400 block mb-1">Actions</span>
                  <div class="flex flex-wrap gap-1">
                    @for (act of ['buy', 'sell', 'buy_max', 'sell_all', 'rebalance_to']; track act) { <code class="px-1.5 py-0.5 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-800 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/50" (click)="insertText(act)">{{act}}</code> }
                  </div>
                </div>
                <div>
                  <span class="text-surface-500 dark:text-surface-400 block mb-1">Operators</span>
                  <div class="flex flex-wrap gap-1">
                    @for (op of ['and', 'or', 'not', '>', '<', '>=', '<=', '==', '!=']; track op) { <code class="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded border border-amber-200 dark:border-amber-800 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/50" (click)="insertText(op)">{{op}}</code> }
                  </div>
                </div>
                <div>
                  <span class="text-surface-500 dark:text-surface-400 block mb-1">Literals</span>
                  <div class="flex flex-wrap gap-1">
                    @for (lit of ['true', 'false']; track lit) { <code class="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50" (click)="insertText(lit)">{{lit}}</code> }
                  </div>
                </div>
              </div>
            </div>

            <!-- Example -->
            <div class="card p-4 dark:bg-surface-800 dark:border-surface-700 overflow-y-auto">
              <div class="flex justify-between items-center mb-2">
                <h3 class="font-semibold text-surface-900 dark:text-surface-100 text-sm">Example</h3>
                <button (click)="insertTemplate(strategyTemplates[0].code)" class="text-xs text-accent-600 hover:text-accent-700 font-medium">Use This</button>
              </div>
              <pre class="bg-surface-900 dark:bg-surface-950 text-surface-100 p-3 rounded text-[10px] font-mono overflow-x-auto border border-surface-700"><code>{{ strategyTemplates[2].code }}</code></pre>
            </div>
          </div>
        </div>

        <!-- AI Chat Sidebar -->
        @if (showChat()) {
          <div class="w-[400px] flex-shrink-0 h-full z-10 transition-all duration-300 animate-in slide-in-from-right shadow-2xl rounded-xl overflow-hidden border border-surface-200 dark:border-surface-700">
            <qs-ai-chat
              [currentCode]="code()"
              [context]="getAiContext()"
              (close)="toggleChat()"
              (codeGenerated)="onAiCodeGenerated($event)"
            />
          </div>
        }
      </div>
    </div>

    <!-- DSL Reference Guide Modal -->
    @if (showReferenceGuide) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" (click)="showReferenceGuide = false"></div>

        <!-- Modal Content -->
        <div class="relative bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-surface-700 flex-shrink-0">
            <div>
              <h2 class="text-xl font-bold text-surface-900 dark:text-surface-100">QuantSim DSL Reference Guide</h2>
              <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">Complete language reference for defining trading strategies</p>
            </div>
            <button
              (click)="showReferenceGuide = false"
              class="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <!-- Scrollable Content -->
          <div class="flex-1 overflow-y-auto p-6 space-y-8">

            <!-- Overview Section -->
            <section>
              <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-3 flex items-center gap-2">
                <span class="w-8 h-8 bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400 rounded-lg flex items-center justify-center text-sm font-bold">1</span>
                Overview
              </h3>
              <div class="prose dark:prose-invert max-w-none text-sm text-surface-600 dark:text-surface-300">
                <p>The QuantSim DSL (Domain-Specific Language) allows you to define trading strategies using simple, readable syntax. Strategies are executed on each simulation step, evaluating conditions and executing trades based on your rules.</p>
                <p class="mt-2"><strong>Key Principles:</strong></p>
                <ul class="list-disc list-inside space-y-1 mt-1">
                  <li>Statements are executed top-to-bottom on each simulation tick</li>
                  <li>All asset symbols are case-insensitive (SPY, spy, Spy are equivalent)</li>
                  <li>Percentages are relative to total portfolio value</li>
                  <li>The DSL is declarative - you describe what you want, not how to achieve it</li>
                </ul>
              </div>
            </section>

            <!-- Actions Section -->
            <section>
              <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-3 flex items-center gap-2">
                <span class="w-8 h-8 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg flex items-center justify-center text-sm font-bold">2</span>
                Trading Actions
              </h3>
              <div class="space-y-4">
                <div class="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                  <h4 class="font-mono text-red-600 dark:text-red-400 font-semibold mb-2">buy &lt;quantity&gt; &lt;asset&gt;</h4>
                  <p class="text-sm text-surface-600 dark:text-surface-400 mb-2">Purchase a specific quantity of an asset.</p>
                  <pre class="bg-surface-900 dark:bg-surface-950 text-surface-100 p-3 rounded-lg text-xs font-mono">buy 100 spy          // Buy 100 shares of SPY
buy 50% spy          // Buy SPY worth 50% of portfolio</pre>
                </div>

                <div class="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                  <h4 class="font-mono text-red-600 dark:text-red-400 font-semibold mb-2">sell &lt;quantity&gt; &lt;asset&gt;</h4>
                  <p class="text-sm text-surface-600 dark:text-surface-400 mb-2">Sell a specific quantity of an asset.</p>
                  <pre class="bg-surface-900 dark:bg-surface-950 text-surface-100 p-3 rounded-lg text-xs font-mono">sell 50 spy          // Sell 50 shares of SPY
sell 25% spy         // Sell 25% of SPY holdings</pre>
                </div>

                <div class="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                  <h4 class="font-mono text-red-600 dark:text-red-400 font-semibold mb-2">buy_max &lt;asset&gt;</h4>
                  <p class="text-sm text-surface-600 dark:text-surface-400 mb-2">Buy as much of the asset as possible with available cash.</p>
                  <pre class="bg-surface-900 dark:bg-surface-950 text-surface-100 p-3 rounded-lg text-xs font-mono">buy_max spy          // Use all available cash to buy SPY</pre>
                </div>

                <div class="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                  <h4 class="font-mono text-red-600 dark:text-red-400 font-semibold mb-2">sell_all &lt;asset&gt;</h4>
                  <p class="text-sm text-surface-600 dark:text-surface-400 mb-2">Sell entire position in an asset.</p>
                  <pre class="bg-surface-900 dark:bg-surface-950 text-surface-100 p-3 rounded-lg text-xs font-mono">sell_all spy         // Liquidate entire SPY position</pre>
                </div>

                <div class="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                  <h4 class="font-mono text-red-600 dark:text-red-400 font-semibold mb-2">rebalance_to &lt;percentage&gt; &lt;asset&gt;</h4>
                  <p class="text-sm text-surface-600 dark:text-surface-400 mb-2">Automatically buy or sell to reach the target portfolio allocation.</p>
                  <pre class="bg-surface-900 dark:bg-surface-950 text-surface-100 p-3 rounded-lg text-xs font-mono">rebalance_to 60% spy // Adjust SPY to exactly 60% of portfolio
rebalance_to 40% agg // Adjust AGG to exactly 40% of portfolio</pre>
                </div>
              </div>
            </section>

            <!-- Control Flow Section -->
            <section>
              <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-3 flex items-center gap-2">
                <span class="w-8 h-8 bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400 rounded-lg flex items-center justify-center text-sm font-bold">3</span>
                Control Flow & Conditions
              </h3>
              <div class="space-y-4">
                <div class="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                  <h4 class="font-mono text-accent-600 dark:text-accent-400 font-semibold mb-2">when &lt;condition&gt;: ... end</h4>
                  <p class="text-sm text-surface-600 dark:text-surface-400 mb-2">Execute actions only when a condition is true.</p>
                  <pre class="bg-surface-900 dark:bg-surface-950 text-surface-100 p-3 rounded-lg text-xs font-mono">when spy > spy_sma_200:
  buy_max spy
end

when spy < spy_sma_200:
  sell_all spy
end</pre>
                </div>

                <div class="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                  <h4 class="font-mono text-accent-600 dark:text-accent-400 font-semibold mb-2">define &lt;name&gt; as &lt;expression&gt;</h4>
                  <p class="text-sm text-surface-600 dark:text-surface-400 mb-2">Create named variables or aliases for reuse.</p>
                  <pre class="bg-surface-900 dark:bg-surface-950 text-surface-100 p-3 rounded-lg text-xs font-mono">define trend as spy_sma_200
define momentum as spy_rsi_14

when spy > trend and momentum < 70:
  buy 10% spy
end</pre>
                </div>

                <div class="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                  <h4 class="font-mono text-accent-600 dark:text-accent-400 font-semibold mb-2">for_any_position: ... end</h4>
                  <p class="text-sm text-surface-600 dark:text-surface-400 mb-2">Iterate over all current positions. Useful for portfolio-wide rules.</p>
                  <pre class="bg-surface-900 dark:bg-surface-950 text-surface-100 p-3 rounded-lg text-xs font-mono">for_any_position:
  when position.loss > 10%:
    sell_all position
  end
end</pre>
                </div>

                <div class="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                  <h4 class="font-mono text-accent-600 dark:text-accent-400 font-semibold mb-2">set &lt;variable&gt; to &lt;value&gt;</h4>
                  <p class="text-sm text-surface-600 dark:text-surface-400 mb-2">Assign or update a variable's value.</p>
                  <pre class="bg-surface-900 dark:bg-surface-950 text-surface-100 p-3 rounded-lg text-xs font-mono">set target_allocation to 60%
set stop_loss to 5%</pre>
                </div>
              </div>
            </section>

            <!-- Operators Section -->
            <section>
              <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-3 flex items-center gap-2">
                <span class="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg flex items-center justify-center text-sm font-bold">4</span>
                Operators
              </h3>
              <div class="grid md:grid-cols-2 gap-4">
                <div class="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                  <h4 class="font-semibold text-surface-900 dark:text-surface-100 mb-2">Comparison Operators</h4>
                  <ul class="text-sm text-surface-600 dark:text-surface-400 space-y-1 font-mono">
                    <li><code class="text-amber-600 dark:text-amber-400">></code> Greater than</li>
                    <li><code class="text-amber-600 dark:text-amber-400"><</code> Less than</li>
                    <li><code class="text-amber-600 dark:text-amber-400">>=</code> Greater than or equal</li>
                    <li><code class="text-amber-600 dark:text-amber-400"><=</code> Less than or equal</li>
                    <li><code class="text-amber-600 dark:text-amber-400">==</code> Equal to</li>
                    <li><code class="text-amber-600 dark:text-amber-400">!=</code> Not equal to</li>
                  </ul>
                </div>
                <div class="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                  <h4 class="font-semibold text-surface-900 dark:text-surface-100 mb-2">Logical Operators</h4>
                  <ul class="text-sm text-surface-600 dark:text-surface-400 space-y-1 font-mono">
                    <li><code class="text-amber-600 dark:text-amber-400">and</code> Both conditions must be true</li>
                    <li><code class="text-amber-600 dark:text-amber-400">or</code> At least one condition true</li>
                    <li><code class="text-amber-600 dark:text-amber-400">not</code> Negates a condition</li>
                  </ul>
                </div>
              </div>
            </section>

            <!-- Indicators Section -->
            <section>
              <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-3 flex items-center gap-2">
                <span class="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center text-sm font-bold">5</span>
                Technical Indicators
              </h3>
              <p class="text-sm text-surface-600 dark:text-surface-400 mb-3">Append indicator suffixes to any ticker symbol:</p>
              <div class="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                <div class="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 class="font-semibold text-surface-900 dark:text-surface-100 mb-2">Moving Averages</h4>
                    <ul class="text-surface-600 dark:text-surface-400 space-y-1 font-mono">
                      <li><code class="text-emerald-600 dark:text-emerald-400">spy_sma_20</code> 20-day Simple MA</li>
                      <li><code class="text-emerald-600 dark:text-emerald-400">spy_ema_50</code> 50-day Exponential MA</li>
                      <li><code class="text-emerald-600 dark:text-emerald-400">spy_sma_200</code> 200-day Simple MA</li>
                    </ul>
                  </div>
                  <div>
                    <h4 class="font-semibold text-surface-900 dark:text-surface-100 mb-2">Momentum & Volatility</h4>
                    <ul class="text-surface-600 dark:text-surface-400 space-y-1 font-mono">
                      <li><code class="text-emerald-600 dark:text-emerald-400">spy_rsi_14</code> 14-day RSI</li>
                      <li><code class="text-emerald-600 dark:text-emerald-400">spy_vol_30</code> 30-day Volatility</li>
                      <li><code class="text-emerald-600 dark:text-emerald-400">spy_return_5</code> 5-day Return</li>
                    </ul>
                  </div>
                </div>
                <div class="mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
                  <h4 class="font-semibold text-surface-900 dark:text-surface-100 mb-2">Historical Prices</h4>
                  <ul class="text-surface-600 dark:text-surface-400 space-y-1 font-mono text-sm">
                    <li><code class="text-emerald-600 dark:text-emerald-400">spy_pastprice_30</code> Price from 30 days ago</li>
                  </ul>
                </div>
              </div>
            </section>

            <!-- Leveraged Positions Section -->
            <section>
              <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-3 flex items-center gap-2">
                <span class="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center text-sm font-bold">6</span>
                Leveraged Positions
              </h3>
              <div class="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                <p class="text-sm text-surface-600 dark:text-surface-400 mb-3">Add leverage multipliers to simulate leveraged ETFs or margin positions:</p>
                <pre class="bg-surface-900 dark:bg-surface-950 text-surface-100 p-3 rounded-lg text-xs font-mono mb-3">spy_3x              // 3x leveraged long SPY (like UPRO)
spy_minus1x         // 1x inverse SPY (like SH)
spy_minus3x         // 3x leveraged short SPY (like SPXU)
tlt_3x              // 3x leveraged long TLT (like TMF)</pre>
                <p class="text-xs text-surface-500 dark:text-surface-400"><strong>Example - HFEA Strategy:</strong></p>
                <pre class="bg-surface-900 dark:bg-surface-950 text-surface-100 p-3 rounded-lg text-xs font-mono">// Hedgefundie's Excellent Adventure
rebalance_to 55% spy_3x
rebalance_to 45% tlt_3x</pre>
              </div>
            </section>

            <!-- Options Section -->
            <section>
              <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-3 flex items-center gap-2">
                <span class="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-lg flex items-center justify-center text-sm font-bold">7</span>
                Options Contracts
              </h3>
              <div class="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                <p class="text-sm text-surface-600 dark:text-surface-400 mb-3">Define options using the format: <code class="bg-surface-200 dark:bg-surface-700 px-1.5 py-0.5 rounded">ticker_&lt;DTE&gt;dte_&lt;delta&gt;delta</code></p>

                <div class="space-y-3">
                  <div>
                    <h4 class="font-semibold text-surface-900 dark:text-surface-100 mb-1 text-sm">Call Options (positive delta)</h4>
                    <pre class="bg-surface-900 dark:bg-surface-950 text-surface-100 p-3 rounded-lg text-xs font-mono">spy_30dte_30delta      // 30 DTE, 0.30 delta call
spy_45dte_50delta      // 45 DTE, ATM call</pre>
                  </div>

                  <div>
                    <h4 class="font-semibold text-surface-900 dark:text-surface-100 mb-1 text-sm">Put Options (negative delta)</h4>
                    <pre class="bg-surface-900 dark:bg-surface-950 text-surface-100 p-3 rounded-lg text-xs font-mono">spy_30dte_minus30delta // 30 DTE, -0.30 delta put
spy_45dte_minus16delta // 45 DTE, 16 delta put</pre>
                  </div>

                  <div>
                    <h4 class="font-semibold text-surface-900 dark:text-surface-100 mb-1 text-sm">Using with define</h4>
                    <pre class="bg-surface-900 dark:bg-surface-950 text-surface-100 p-3 rounded-lg text-xs font-mono">// Covered Call Strategy
define short_call as sell 1 spy_30dte_30delta

buy 100 spy
buy 1 short_call

// Iron Condor
define short_put as sell 1 spy_45dte_minus20delta
define long_put as buy 1 spy_45dte_minus10delta
define short_call as sell 1 spy_45dte_20delta
define long_call as buy 1 spy_45dte_10delta</pre>
                  </div>
                </div>
              </div>
            </section>

            <!-- Scoping Rules Section -->
            <section>
              <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-3 flex items-center gap-2">
                <span class="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center text-sm font-bold">8</span>
                Scoping Rules
              </h3>
              <div class="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                <ul class="text-sm text-surface-600 dark:text-surface-400 space-y-2">
                  <li><strong>Global scope:</strong> Variables defined at the top level are available throughout the strategy.</li>
                  <li><strong>Block scope:</strong> Variables defined inside <code class="bg-surface-200 dark:bg-surface-700 px-1 rounded">when...end</code> blocks are local to that block.</li>
                  <li><strong>Position scope:</strong> Inside <code class="bg-surface-200 dark:bg-surface-700 px-1 rounded">for_any_position</code>, the <code class="bg-surface-200 dark:bg-surface-700 px-1 rounded">position</code> variable refers to the current iteration's position.</li>
                  <li><strong>Shadowing:</strong> Inner scopes can shadow outer variable names.</li>
                </ul>
                <pre class="bg-surface-900 dark:bg-surface-950 text-surface-100 p-3 rounded-lg text-xs font-mono mt-3">define threshold to 200      // Global

when spy > threshold:        // Uses global threshold
  define threshold to 180    // Local shadow
  // ... actions use local threshold
end

// Back to global threshold here</pre>
              </div>
            </section>

            <!-- Complete Example -->
            <section>
              <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-3 flex items-center gap-2">
                <span class="w-8 h-8 bg-gradient-to-br from-accent-500 to-purple-500 text-white rounded-lg flex items-center justify-center text-sm font-bold">!</span>
                Complete Example
              </h3>
              <div class="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-surface-700">
                <p class="text-sm text-surface-600 dark:text-surface-400 mb-3">A trend-following strategy with RSI filter and stop-loss:</p>
                <pre class="bg-surface-900 dark:bg-surface-950 text-surface-100 p-4 rounded-lg text-xs font-mono overflow-x-auto">// Define indicators
define trend as spy_sma_200
define momentum as spy_rsi_14
define volatility as spy_vol_30

// Entry conditions
when spy > trend and momentum < 70 and momentum > 30:
  rebalance_to 80% spy
  rebalance_to 20% agg
end

// Exit on trend break
when spy < trend:
  sell_all spy
  rebalance_to 100% t_bills
end

// Risk management
for_any_position:
  when position.loss > 15%:
    sell_all position
  end
end</pre>
              </div>
            </section>

          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 flex-shrink-0">
            <div class="flex items-center justify-between">
              <p class="text-xs text-surface-500 dark:text-surface-400">Press <kbd class="px-1.5 py-0.5 bg-surface-200 dark:bg-surface-700 rounded text-xs">Esc</kbd> to close</p>
              <button
                (click)="showReferenceGuide = false"
                class="btn-primary btn-sm"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* Ensure textarea doesn't overflow horizontally */
    textarea { font-variant-ligatures: none; white-space: pre; overflow-x: auto; }
    
    /* Custom menu styling override */
    ::ng-deep .custom-menu {
      min-width: 240px !important;
      border-radius: 0.75rem !important;
    }

    /* CRITICAL: Force Monaco to take up space */
    :host {
      display: block;
      width: 100%;
    }
    
    ngx-monaco-editor {
      display: block;
      height: 100%;
      width: 100%;
    }
  `]
})
export class DslEditorComponent implements OnInit, OnDestroy, OnChanges {
  @Input({ required: true }) draft!: StrategyDraft;
  @Output() codeChanged = new EventEmitter<string>();

  private strategyService = inject(StrategyService);
  private validationService = inject(DslValidationService);
  private themeService = inject(ThemeService);

  readonly code = signal('');
  readonly errors = signal<Array<{ line: number; column: number; message: string }>>([]);
  readonly isValidating = signal(false);
  readonly showChat = signal(false);
  showReferenceGuide = false;

  readonly containerClasses = computed(() => {
    return this.showChat() 
      ? 'w-full px-6 transition-all duration-300' 
      : 'max-w-5xl mx-auto transition-all duration-300';
  });

  readonly editorOptions = computed(() => ({
    theme: this.themeService.isDark() ? 'quantsim-dark' : 'quantsim-light',
    language: 'quantsim',
    scrollBeyondLastLine: false,
    minimap: { enabled: false },
    fontSize: 14,
    fontFamily: "'JetBrains Mono', monospace",
    lineHeight: 24,
    padding: { top: 16, bottom: 16 },
    renderLineHighlight: 'all',
    bracketPairColorization: { enabled: true },
    automaticLayout: true,
    tabSize: 2
  }));

  private codeSubject = new Subject<string>();
  private validationSub?: Subscription;
  private editorInstance: any;

  readonly strategyTemplates: StrategyTemplate[] = [
    {
      id: '6040',
      name: 'Classic 60/40',
      description: '60% SPY, 40% AGG',
      code: `// Balanced Portfolio\nrebalance_to 60% spy\nrebalance_to 40% agg`
    },
    {
      id: 'hfea',
      name: 'HFEA',
      description: 'Leveraged Risk Parity',
      code: `// Hedgefundie's Excellent Adventure\nrebalance_to 55% spy_3x\nrebalance_to 45% tlt_3x`
    },
    {
      id: 'trend',
      name: 'Trend Following',
      description: 'SMA 200 Rotation',
      code: `// Trend Following Strategy\ndefine trend as spy_sma_200\n\nwhen spy > trend:\n  rebalance_to 100% spy\nend\n\nwhen spy < trend:\n  rebalance_to 100% t_bills\nend`
    },
    {
      id: 'covered_call',
      name: 'Covered Call',
      description: 'Long SPY + Short OTM Call',
      code: `// Covered Call Strategy\n// 1. Define the option (30 days out, 30 delta)\ndefine short_call as sell 1 spy_30dte_30delta\n\n// 2. Buy underlying and sell call\nbuy 100 spy\nbuy 1 short_call`
    },
    {
      id: 'iron_condor',
      name: 'Iron Condor',
      description: 'Market Neutral Volatility Harvest',
      code: `// Iron Condor Setup\n// Put Spread\ndefine long_put  as buy 1 spy_45dte_minus10delta\ndefine short_put as sell 1 spy_45dte_minus20delta\n\n// Call Spread\ndefine long_call  as buy 1 spy_45dte_10delta\ndefine short_call as sell 1 spy_45dte_20delta\n\n// Execution\nbuy 1 long_put\nbuy 1 short_put\nbuy 1 long_call\nbuy 1 short_call`
    }
  ];

  ngOnInit(): void {
    if (this.draft.dsl?.code) {
      this.code.set(this.draft.dsl.code);
    }

    this.updateTokenizer();

    this.validationSub = this.codeSubject.pipe(
      tap(() => this.isValidating.set(true)),
      debounceTime(300),
      switchMap(code => {
        const tickers = this.getAllTickers();
        return this.validationService.validate(code, tickers);
      })
    ).subscribe({
      next: (result) => {
        this.isValidating.set(false);
        this.errors.set(result.errors);
        
        this.strategyService.updateDraft({
            dsl: {
                code: this.code(),
                isValid: result.isValid,
                errors: result.errors,
                warnings: []
            }
        });

        this.updateEditorMarkers();
      },
      error: (err) => {
        console.error('Validation worker error', err);
        this.isValidating.set(false);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['draft'] && !changes['draft'].firstChange) {
      this.updateTokenizer();
    }
  }

  ngOnDestroy() {
    this.validationSub?.unsubscribe();
  }

  private getAllTickers(): string[] {
    const standardIndices = this.draft.indices?.map(i => i.symbol.toLowerCase()) || [];
    const customTickers = this.draft.customTickers?.map(t => t.symbol.toLowerCase()) || [];
    return Array.from(new Set([...standardIndices, ...customTickers]));
  }

  private updateTokenizer(): void {
    const monaco = (window as any).monaco;
    if (!monaco) return;

    const allTickers = this.getAllTickers();

    monaco.languages.setMonarchTokensProvider('quantsim', {
      defaultToken: 'source',
      ignoreCase: true,
      tickers: allTickers,
      tokenizer: {
        root: [
          [/\/\/.*$/, 'comment'],
          [/\d+%\b/, 'number.percent'],
          [/\$\d+(\.\d+)?/, 'number.currency'],
          [/\d+(\.\d+)?/, 'number'],
          [/\.\w+/, 'attribute.name'],
          [/_\d+dte_(?:minus|-)?[0-9.]+(?:delta|gamma|theta|vega|rho)/, 'function.option'],
          [/_(?:sma|ema|rsi|vol|return|pastprice)(?:_\d+)?/, 'function.indicator'],
          [/_(?:minus)?\d+x/, 'function.leverage'],
          [/_[\w]*/, 'identifier'],
          [/[a-zA-Z_][a-zA-Z0-9_]*/, {
            cases: {
              '@tickers': 'variable.ticker',
              'define|as|when|end|for_any_position|set|to': 'keyword',
              'buy|sell|buy_max|sell_all|rebalance_to': 'keyword.action',
              'and|or|not': 'keyword.operator',
              'true|false': 'constant.boolean',
              '@default': 'identifier'
            }
          }],
          [/>=|<=|==|!=|>|</, 'operator'],
          [/[+\-*/%]/, 'operator'],
        ]
      }
    });
  }

  onEditorInit(editor: any) {
    this.editorInstance = editor;
    if (this.code()) {
      this.codeSubject.next(this.code());
    }
  }

  onCodeChange(newCode: string): void {
    this.code.set(newCode);
    this.codeChanged.emit(newCode);
    this.codeSubject.next(newCode);
  }

  onAiCodeGenerated(newCode: string): void {
    this.code.set(newCode);
    this.codeChanged.emit(newCode);
    this.codeSubject.next(newCode);
  }

  toggleChat(): void {
    this.showChat.update(v => !v);
    setTimeout(() => {
      if (this.editorInstance) {
        this.editorInstance.layout();
      }
    }, 300);
  }

  private updateEditorMarkers() {
    if (!this.editorInstance) return;
    
    const monaco = (window as any).monaco;
    const model = this.editorInstance.getModel();
    
    const markers = this.errors().map(err => ({
      severity: monaco.MarkerSeverity.Error,
      message: err.message,
      startLineNumber: err.line,
      startColumn: err.column || 1,
      endLineNumber: err.line,
      endColumn: 1000
    }));

    monaco.editor.setModelMarkers(model, 'quantsim', markers);
  }

  jumpToError(error: {line: number}) {
    if (this.editorInstance) {
      this.editorInstance.revealLineInCenter(error.line);
      this.editorInstance.setPosition({ lineNumber: error.line, column: 1 });
      this.editorInstance.focus();
    }
  }

  formatCode(): void {
    if (this.editorInstance) {
      this.editorInstance.getAction('editor.action.formatDocument').run();
    }
  }

  clearCode(): void { 
    this.onCodeChange('');
  }

  insertTemplate(code: string): void { 
    this.onCodeChange(code);
  }

  insertText(text: string): void {
    if (this.editorInstance) {
      const selection = this.editorInstance.getSelection();
      const range = new (window as any).monaco.Range(
        selection.startLineNumber, 
        selection.startColumn, 
        selection.endLineNumber, 
        selection.endColumn
      );
      this.editorInstance.executeEdits('insert', [{ range, text: text + ' ', forceMoveMarkers: true }]);
      this.editorInstance.focus();
    }
  }

  getAiContext() {
    return {
      mode: this.draft.mode || 'Accumulation',
      model: this.draft.indices?.[0]?.model || StochasticModel.Heston,
      indices: this.draft.indices?.map(i => i.symbol) || [],
      parameters: { ...this.draft.simulationConfig, ...(this.draft.scenario as any) }
    };
  }

  readonly hasErrors = computed(() => this.errors().length > 0);
  readonly errorCount = computed(() => this.errors().length);
}