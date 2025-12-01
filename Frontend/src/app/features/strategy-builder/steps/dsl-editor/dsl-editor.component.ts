import { Component, Input, Output, EventEmitter, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StrategyDraft } from '@core/models';

@Component({
  selector: 'qs-dsl-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-5xl">
      <div class="mb-8">
        <h1 class="text-2xl lg:text-3xl font-bold text-surface-900 mb-2">
          Strategy DSL
        </h1>
        <p class="text-surface-600">
          Define your trading rules and strategy logic using our domain-specific language.
        </p>
      </div>

      <!-- Toolbar -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center space-x-2">
          <button 
            (click)="formatCode()"
            class="btn-ghost btn-sm"
          >
            <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"/>
            </svg>
            Format
          </button>
          <button 
            (click)="clearCode()"
            class="btn-ghost btn-sm"
          >
            <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Clear
          </button>
          <div class="w-px h-6 bg-surface-200 mx-2"></div>
          <button 
            (click)="insertTemplate('basic')"
            class="btn-ghost btn-sm"
          >
            Insert Basic Template
          </button>
          <button 
            (click)="insertTemplate('options')"
            class="btn-ghost btn-sm"
          >
            Insert Options Template
          </button>
        </div>

        <!-- Validation Status -->
        <div class="flex items-center space-x-2">
          @if (isValidating()) {
            <span class="text-sm text-surface-500">Validating...</span>
          } @else if (hasErrors()) {
            <span class="flex items-center text-sm text-red-600">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {{ errorCount() }} error(s)
            </span>
          } @else if (code().length > 0) {
            <span class="flex items-center text-sm text-green-600">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Valid
            </span>
          }
        </div>
      </div>

      <!-- Editor Container -->
      <div class="card overflow-hidden mb-6">
        <!-- Line Numbers + Editor -->
        <div class="flex bg-surface-50">
          <!-- Line Numbers -->
          <div class="py-4 px-3 bg-surface-100 border-r border-surface-200 text-right font-mono text-sm text-surface-400 select-none min-w-[50px]">
            @for (line of lineNumbers(); track $index) {
              <div class="leading-6">{{ line }}</div>
            }
          </div>
          
          <!-- Code Editor -->
          <textarea
            [value]="code()"
            (input)="onCodeChange($event)"
            (keydown)="handleKeyDown($event)"
            class="flex-1 p-4 font-mono text-sm leading-6 bg-white text-surface-900 resize-none focus:outline-none min-h-[400px]"
            placeholder="// Enter your strategy DSL code here..."
            spellcheck="false"
          ></textarea>
        </div>

        <!-- Error Panel -->
        @if (hasErrors()) {
          <div class="border-t border-surface-200 bg-red-50 p-4">
            <h4 class="font-medium text-red-800 mb-2">Errors</h4>
            <ul class="space-y-1">
              @for (error of errors(); track $index) {
                <li class="flex items-start text-sm text-red-700">
                  <span class="font-mono text-red-500 mr-2">Line {{ error.line }}:</span>
                  {{ error.message }}
                </li>
              }
            </ul>
          </div>
        }
      </div>

      <!-- Help Section -->
      <div class="grid md:grid-cols-2 gap-6">
        <!-- Quick Reference -->
        <div class="card p-6">
          <h3 class="font-semibold text-surface-900 mb-4">Quick Reference</h3>
          <div class="space-y-4 text-sm">
            <div>
              <h4 class="font-medium text-surface-700 mb-2">Keywords</h4>
              <div class="flex flex-wrap gap-2">
                @for (keyword of keywords; track keyword) {
                  <code class="px-2 py-1 bg-accent-100 text-accent-700 rounded font-mono text-xs">{{ keyword }}</code>
                }
              </div>
            </div>
            <div>
              <h4 class="font-medium text-surface-700 mb-2">Actions</h4>
              <div class="flex flex-wrap gap-2">
                @for (action of actions; track action) {
                  <code class="px-2 py-1 bg-blue-100 text-blue-700 rounded font-mono text-xs">{{ action }}</code>
                }
              </div>
            </div>
            <div>
              <h4 class="font-medium text-surface-700 mb-2">Operators</h4>
              <div class="flex flex-wrap gap-2">
                @for (op of operators; track op) {
                  <code class="px-2 py-1 bg-surface-100 text-surface-700 rounded font-mono text-xs">{{ op }}</code>
                }
              </div>
            </div>
          </div>
        </div>

        <!-- Example -->
        <div class="card p-6">
          <h3 class="font-semibold text-surface-900 mb-4">Example Strategy</h3>
          <pre class="bg-surface-900 text-surface-100 p-4 rounded-lg text-xs font-mono overflow-x-auto"><code>{{ exampleCode }}</code></pre>
          <button 
            (click)="insertTemplate('example')"
            class="mt-4 btn-secondary btn-sm"
          >
            Use This Example
          </button>
        </div>
      </div>

      <!-- Optional Notice -->
      <div class="mt-8 p-4 bg-surface-100 rounded-xl text-center">
        <p class="text-sm text-surface-600">
          The DSL is optional. Leave blank to use a simple buy-and-hold strategy with equal weights.
        </p>
      </div>
    </div>
  `,
})
export class DslEditorComponent implements OnInit {
  @Input({ required: true }) draft!: StrategyDraft;
  @Output() codeChanged = new EventEmitter<string>();

  readonly code = signal('');
  readonly errors = signal<Array<{ line: number; message: string }>>([]);
  readonly isValidating = signal(false);

  readonly hasErrors = () => this.errors().length > 0;
  readonly errorCount = () => this.errors().length;
  readonly lineNumbers = () => {
    const lines = this.code().split('\n').length;
    return Array.from({ length: Math.max(lines, 15) }, (_, i) => i + 1);
  };

  readonly keywords = ['if', 'else', 'when', 'then', 'and', 'or', 'not', 'true', 'false'];
  readonly actions = ['buy', 'sell', 'hold', 'rebalance', 'set_allocation', 'exit'];
  readonly operators = ['>', '<', '>=', '<=', '==', '!=', '+', '-', '*', '/', '%'];

  readonly exampleCode = `// Simple momentum strategy
when price(SPY) > sma(SPY, 200) then
  set_allocation(SPY, 0.6)
  set_allocation(QQQ, 0.4)
else
  set_allocation(SPY, 0.3)
  set_allocation(QQQ, 0.2)
  hold_cash(0.5)
end

// Monthly rebalancing
on_schedule(monthly) then
  rebalance()
end`;

  readonly templates = {
    basic: `// Basic buy-and-hold strategy
set_allocation(SPY, 0.6)
set_allocation(QQQ, 0.4)

on_schedule(quarterly) then
  rebalance()
end`,
    options: `// Covered call strategy
when price(SPY) > entry_price(SPY) * 1.05 then
  sell_call(SPY, strike: atm + 2, expiry: 30)
end

when days_to_expiry(SPY_CALL) < 7 then
  close_position(SPY_CALL)
end`,
    example: '',
  };

  ngOnInit(): void {
    this.templates['example'] = this.exampleCode;
    if (this.draft.dsl?.code) {
      this.code.set(this.draft.dsl.code);
    }
  }

  onCodeChange(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.code.set(value);
    this.codeChanged.emit(value);
    this.validateCode(value);
  }

  handleKeyDown(event: KeyboardEvent): void {
    // Tab key inserts 2 spaces
    if (event.key === 'Tab') {
      event.preventDefault();
      const target = event.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const value = target.value;
      target.value = value.substring(0, start) + '  ' + value.substring(end);
      target.selectionStart = target.selectionEnd = start + 2;
      this.code.set(target.value);
      this.codeChanged.emit(target.value);
    }
  }

  formatCode(): void {
    // Simple formatting: trim lines, normalize indentation
    const lines = this.code().split('\n');
    const formatted = lines
      .map(line => line.trim())
      .map(line => {
        // Add indentation for lines inside blocks
        if (line.startsWith('set_') || line.startsWith('hold_') || line.startsWith('rebalance')) {
          return '  ' + line;
        }
        return line;
      })
      .join('\n');
    this.code.set(formatted);
    this.codeChanged.emit(formatted);
  }

  clearCode(): void {
    this.code.set('');
    this.codeChanged.emit('');
    this.errors.set([]);
  }

  insertTemplate(type: 'basic' | 'options' | 'example'): void {
    const template = this.templates[type];
    this.code.set(template);
    this.codeChanged.emit(template);
    this.validateCode(template);
  }

  private validateCode(code: string): void {
    this.isValidating.set(true);
    
    // Simulate validation delay
    setTimeout(() => {
      const newErrors: Array<{ line: number; message: string }> = [];
      
      // Simple validation rules
      const lines = code.split('\n');
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        
        // Check for unmatched parentheses
        const openParens = (trimmed.match(/\(/g) || []).length;
        const closeParens = (trimmed.match(/\)/g) || []).length;
        if (openParens !== closeParens) {
          newErrors.push({ line: index + 1, message: 'Unmatched parentheses' });
        }
        
        // Check for unknown keywords (simplified)
        if (trimmed.startsWith('wen ')) {
          newErrors.push({ line: index + 1, message: 'Unknown keyword "wen". Did you mean "when"?' });
        }
      });
      
      this.errors.set(newErrors);
      this.isValidating.set(false);
    }, 300);
  }
}
