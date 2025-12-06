import { Component, EventEmitter, Input, Output, inject, signal, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { AiService, ChatMessage, AiContext } from '@core/services/ai.service';
import { PermissionsService } from '@core/services/permissions.service';
import { PremiumDialogComponent } from '@shared/components/premium-dialog/premium-dialog.component';

@Component({
  selector: 'qs-ai-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col h-full bg-white dark:bg-surface-900 border-l border-surface-200 dark:border-surface-700 shadow-xl relative">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
        <div class="flex items-center space-x-2">
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
            AI
          </div>
          <div>
            <h3 class="font-semibold text-surface-900 dark:text-surface-100">Nanci</h3>
            <p class="text-xs text-surface-500">Quant Strategy Assistant</p>
          </div>
        </div>
        <button (click)="close.emit()" class="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Messages -->
      <div #scrollContainer class="flex-1 overflow-y-auto p-4 space-y-4">
        
        <!-- Welcome Message -->
        <div class="flex items-start space-x-3">
          <div class="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex-shrink-0 flex items-center justify-center text-white text-xs">N</div>
          <div class="bg-surface-100 dark:bg-surface-800 rounded-2xl rounded-tl-none p-3 text-sm text-surface-700 dark:text-surface-200">
            Hi! I can help you write strategies. Try "Create a mean reversion strategy for SPY" or "Explain how options work".
          </div>
        </div>

        @for (msg of history(); track $index) {
          <div class="flex items-start space-x-3" [class.flex-row-reverse]="msg.role === 'user'">
            <div 
              class="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs"
              [class]="msg.role === 'user' ? 'bg-surface-400 ml-3' : 'bg-gradient-to-br from-purple-500 to-indigo-600 mr-3'"
            >
              {{ msg.role === 'user' ? 'U' : 'N' }}
            </div>
            <div 
              class="max-w-[85%] rounded-2xl p-3 text-sm whitespace-pre-wrap"
              [class.bg-accent-500]="msg.role === 'user'"
              [class.text-white]="msg.role === 'user'"
              [class.rounded-tr-none]="msg.role === 'user'"
              [class.bg-surface-100]="msg.role === 'assistant'"
              [class.dark:bg-surface-800]="msg.role === 'assistant'"
              [class.text-surface-700]="msg.role === 'assistant'"
              [class.dark:text-surface-200]="msg.role === 'assistant'"
              [class.rounded-tl-none]="msg.role === 'assistant'"
            >
              {{ msg.content }}
            </div>
          </div>
        }

        <!-- Streaming Content -->
        @if (isStreaming()) {
          <div class="flex items-start space-x-3">
            <div class="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex-shrink-0 flex items-center justify-center text-white text-xs">N</div>
            <div class="bg-surface-100 dark:bg-surface-800 rounded-2xl rounded-tl-none p-3 text-sm text-surface-700 dark:text-surface-200 animate-pulse-subtle whitespace-pre-wrap">
              {{ aiService.streamingContent() }}<span class="inline-block w-1.5 h-3 bg-surface-400 ml-1 animate-blink"></span>
            </div>
          </div>
        }
      </div>

      <!-- Input Area -->
      <div class="p-4 border-t border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 relative">
        
        <!-- Premium Lock Overlay -->
        @if (!permissions.canUseAiAssistant()) {
          <div class="absolute inset-0 bg-white/80 dark:bg-surface-900/80 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-4">
            <div class="flex items-center space-x-2 mb-2">
              <svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              <span class="font-bold text-surface-900 dark:text-surface-100">Nanci AI is Locked</span>
            </div>
            <p class="text-xs text-surface-600 dark:text-surface-400 text-center mb-3">Upgrade to Pro to get AI-powered strategy generation.</p>
            <button (click)="openPremiumDialog()" class="btn-primary btn-sm w-full shadow-lg">Unlock Nanci</button>
          </div>
        }

        <div class="flex items-center space-x-2">
          <input 
            type="text" 
            [(ngModel)]="currentInput"
            (keyup.enter)="sendMessage()"
            [disabled]="isStreaming() || !permissions.canUseAiAssistant()"
            placeholder="Ask Nanci..."
            class="flex-1 input bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700 h-10 text-sm"
          >
          <button 
            (click)="sendMessage()"
            [disabled]="!currentInput.trim() || isStreaming() || !permissions.canUseAiAssistant()"
            class="btn-primary p-2 rounded-lg disabled:opacity-50"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .animate-blink { animation: blink 1s infinite; }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
  `]
})
export class AiChatComponent {
  @Input() currentCode = '';
  @Input() context: AiContext = { 
    mode: '', model: '', indices: [], parameters: {} 
  }; 
  
  @Output() close = new EventEmitter<void>();
  @Output() codeGenerated = new EventEmitter<string>();

  aiService = inject(AiService);
  readonly permissions = inject(PermissionsService);
  private readonly dialog = inject(MatDialog);
  
  history = signal<ChatMessage[]>([]);
  currentInput = '';
  isStreaming = signal(false);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  constructor() {
    effect(() => {
      this.aiService.streamingContent(); 
      this.scrollToBottom();
    });
  }

  async sendMessage() {
    if (!this.currentInput.trim() || this.isStreaming()) return;

    if (!this.permissions.canUseAiAssistant()) {
      this.openPremiumDialog();
      return;
    }

    const userMsg = this.currentInput;
    this.currentInput = '';
    
    this.history.update(h => [...h, { role: 'user', content: userMsg }]);
    this.scrollToBottom();

    this.isStreaming.set(true);

    try {
      let finalMessage = '';
      
      const stream = this.aiService.streamMessage(
        userMsg, 
        this.currentCode, 
        this.history(),
        this.context
      );

      for await (const chunk of stream) {
        if (chunk.type === 'token') {
          finalMessage += chunk.content;
        } 
        else if (chunk.type === 'code') {
          this.codeGenerated.emit(chunk.content);
          finalMessage += '\n\n[Code updated in editor]';
        }
      }

      this.history.update(h => [...h, { role: 'assistant', content: finalMessage }]);

    } catch (err) {
      console.error(err);
      this.history.update(h => [...h, { role: 'assistant', content: 'Sorry, I encountered an error connecting to the AI.' }]);
    } finally {
      this.isStreaming.set(false);
    }
  }

  openPremiumDialog() {
    this.dialog.open(PremiumDialogComponent, {
      width: '450px',
      data: {
        featureName: 'AI Strategy Assistant',
        description: this.permissions.getLockReason('ai')
      }
    });
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    }, 10);
  }
}