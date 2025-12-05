import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { environment } from '@env/environment';

export interface AiContext {
  mode: string;
  model: string;
  indices: string[];
  parameters: Record<string, any>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  type: 'token' | 'code';
  content: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private authService = inject(AuthService);
  private apiUrl = environment.apiUrl;

  // Signal to hold the "live" message being generated
  readonly streamingContent = signal<string>('');

  async *streamMessage(userMessage: string, currentCode: string, history: ChatMessage[], context: AiContext) {
    this.streamingContent.set('');

    const token = this.authService.token();
    
    try {
        const response = await fetch(`${this.apiUrl}/ai/chat/stream`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
              userMessage,
              currentDslCode: currentCode,
              history,
              context, // <--- This contains your Tickers/Params
          })
        });

        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                      const jsonStr = line.substring(6);
                      if (!jsonStr.trim()) continue;
                      
                      const event = JSON.parse(jsonStr);

                      if (event.Type === 'token') {
                          // Append text to the UI signal
                          this.streamingContent.update(c => c + (event.Content || ''));
                          yield { type: 'token', content: event.Content } as StreamChunk;
                      } 
                      else if (event.Type === 'code_update') {
                          // Emit code update event
                          yield { type: 'code', content: event.Content } as StreamChunk;
                      }
                      else if (event.Type === 'error') {
                          console.error('AI Error:', event.Content);
                          this.streamingContent.update(c => c + `\n[Error: ${event.Content}]`);
                      }
                  } catch (e) {
                      console.warn('Error parsing stream chunk', e);
                  }
                }
            }
        }
    } catch (e) {
        console.error("AI Stream Error", e);
        this.streamingContent.set("Sorry, I couldn't connect to the server. Please check your connection.");
        throw e;
    }
  }
}