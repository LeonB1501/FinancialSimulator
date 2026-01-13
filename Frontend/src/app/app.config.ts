import { ApplicationConfig, provideZoneChangeDetection, importProvidersFrom } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { NgChartsModule } from 'ng2-charts';
import { NGX_MONACO_EDITOR_CONFIG, NgxMonacoEditorConfig } from 'ngx-monaco-editor-v2';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { mockBackendInterceptor } from '@core/interceptors/mock-backend.interceptor';

const monacoConfig: NgxMonacoEditorConfig = {
  defaultOptions: { scrollBeyondLastLine: false, automaticLayout: true },
  onMonacoLoad: () => {
    
    const self = window as any;
    self.MonacoEnvironment = {
      getWorkerUrl: function (moduleId: any, label: string) {
        if (label === 'json') {
          return './assets/monaco/min/vs/language/json/json.worker.js';
        }
        if (label === 'css' || label === 'scss' || label === 'less') {
          return './assets/monaco/min/vs/language/css/css.worker.js';
        }
        if (label === 'html' || label === 'handlebars' || label === 'razor') {
          return './assets/monaco/min/vs/language/html/html.worker.js';
        }
        if (label === 'typescript' || label === 'javascript') {
          return './assets/monaco/min/vs/language/typescript/ts.worker.js';
        }
        return './assets/monaco/min/vs/editor/editor.worker.js';
      },
    };

    const monaco = (window as any).monaco;

    monaco.languages.register({ id: 'quantsim' });

    monaco.editor.defineTheme('quantsim-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '64748B', fontStyle: 'italic' },
        
        { token: 'keyword', foreground: 'C084FC', fontStyle: 'bold' }, 
        
        { token: 'keyword.action', foreground: 'F87171', fontStyle: 'bold' }, 
        
        { token: 'keyword.operator', foreground: 'FBBF24', fontStyle: 'bold' }, 
        
        { token: 'variable.ticker', foreground: '22D3EE', fontStyle: 'bold' }, 
        
        { token: 'function.option', foreground: 'FCD34D' }, 
        
        { token: 'function.indicator', foreground: '34D399' }, 
        
        { token: 'function.leverage', foreground: 'A78BFA' }, 
        
        { token: 'attribute.name', foreground: '94A3B8' }, 
        
        { token: 'identifier', foreground: 'E2E8F0' },

        { token: 'number', foreground: 'F1F5F9' },
        { token: 'number.percent', foreground: 'FBBF24' },
        { token: 'number.currency', foreground: '34D399' },
        { token: 'constant.boolean', foreground: '60A5FA' },
      ],
      colors: {
        'editor.background': '#0F172A', 
        'editor.lineHighlightBackground': '#1E293B',
        'editorLineNumber.foreground': '#475569'
      }
    });

    monaco.editor.defineTheme('quantsim-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '94A3B8', fontStyle: 'italic' },
        { token: 'keyword', foreground: '7C3AED', fontStyle: 'bold' },
        { token: 'keyword.action', foreground: 'DC2626', fontStyle: 'bold' },
        { token: 'keyword.operator', foreground: 'D97706', fontStyle: 'bold' },
        { token: 'variable.ticker', foreground: '0891B2', fontStyle: 'bold' },
        { token: 'function.option', foreground: 'B45309' }, 
        { token: 'function.indicator', foreground: '059669' }, 
        { token: 'function.leverage', foreground: '7C3AED' },
        { token: 'attribute.name', foreground: '64748B' },
        { token: 'identifier', foreground: '334155' },
        { token: 'number', foreground: '0F172A' },
        { token: 'number.percent', foreground: 'D97706' },
        { token: 'number.currency', foreground: '059669' },
        { token: 'constant.boolean', foreground: '2563EB' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.lineHighlightBackground': '#F1F5F9',
        'editorLineNumber.foreground': '#CBD5E1'
      }
    });
  }
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideHttpClient(withInterceptors([mockBackendInterceptor, authInterceptor])),
    provideAnimationsAsync(),
    importProvidersFrom(NgChartsModule),
    { provide: NGX_MONACO_EDITOR_CONFIG, useValue: monacoConfig }
  ]
};