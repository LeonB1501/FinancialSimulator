import { Injectable, signal, effect } from '@angular/core';

const THEME_KEY = 'quantsim_theme';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly _theme = signal<Theme>(this.getInitialTheme());

  readonly theme = this._theme.asReadonly();
  readonly isDark = () => this._theme() === 'dark';

  constructor() {
    // Effect to sync theme changes to DOM and localStorage
    effect(() => {
      const theme = this._theme();
      this.applyTheme(theme);
      localStorage.setItem(THEME_KEY, theme);
    });
  }

  private getInitialTheme(): Theme {
    // Check localStorage first
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }

    // Fall back to system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    return 'light';
  }

  private applyTheme(theme: Theme): void {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }

  toggleTheme(): void {
    this._theme.update(current => current === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: Theme): void {
    this._theme.set(theme);
  }
}
