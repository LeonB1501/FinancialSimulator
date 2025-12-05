import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { DslError } from '../models/strategy.model';

interface ValidationResponse {
  id: string;
  isValid: boolean;
  errors: Array<{ Line: number; Column: number; Message: string }>;
}

@Injectable({
  providedIn: 'root'
})
export class DslValidationService {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, (res: { isValid: boolean; errors: DslError[] }) => void>();

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('../../workers/validation.worker', import.meta.url));
      
      this.worker.onmessage = ({ data }: { data: ValidationResponse }) => {
        const { id, isValid, errors } = data;
        const resolver = this.pendingRequests.get(id);
        
        if (resolver) {
          // Map F# PascalCase to TS camelCase
          const mappedErrors: DslError[] = errors.map(e => ({
            line: e.Line,
            column: e.Column,
            message: e.Message
          }));
          
          resolver({ isValid, errors: mappedErrors });
          this.pendingRequests.delete(id);
        }
      };
    }
  }

  validate(code: string, tickers: string[]): Observable<{ isValid: boolean; errors: DslError[] }> {
    return new Observable(observer => {
      if (!this.worker) {
        observer.error('Web Workers not supported');
        return;
      }

      const id = crypto.randomUUID();
      
      // Register callback
      this.pendingRequests.set(id, (result) => {
        observer.next(result);
        observer.complete();
      });

      // Send to worker
      this.worker.postMessage({ id, code, tickers });
    });
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.pendingRequests.clear();
  }
}