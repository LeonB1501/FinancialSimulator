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
              <h3 class="font-semibold text-surface-900 dark:text-surface-100 mb-2 text-sm">Quick Reference</h3>
              <div class="space-y-3 text-xs">
                <div>
                  <span class="text-surface-500 dark:text-surface-400 block mb-1">Keywords</span>
                  <div class="flex flex-wrap gap-1">
                    @for (kw of ['define', 'as', 'when', 'end']; track kw) { <code class="px-1.5 py-0.5 bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300 rounded border border-accent-200 dark:border-accent-800 cursor-pointer hover:bg-accent-100" (click)="insertText(kw)">{{kw}}</code> }
                  </div>
                </div>
                <div>
                  <span class="text-surface-500 dark:text-surface-400 block mb-1">Actions</span>
                  <div class="flex flex-wrap gap-1">
                    @for (act of ['buy', 'sell', 'rebalance_to']; track act) { <code class="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100" (click)="insertText(act)">{{act}}</code> }
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
          [/[a-zA-Z][a-zA-Z0-9]*/, {
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