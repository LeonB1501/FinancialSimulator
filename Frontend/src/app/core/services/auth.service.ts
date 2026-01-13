import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { ThemeService } from './theme.service';
import { 
  User, 
  AuthState, 
  LoginCredentials, 
  RegisterCredentials, 
  AuthResponse 
} from '../models/user.model';

const AUTH_TOKEN_KEY = 'quantsim_token';
const AUTH_USER_KEY = 'quantsim_user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);

  // State signals
  private readonly _user = signal<User | null>(null);
  private readonly _token = signal<string | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  // Public computed signals
  readonly user = this._user.asReadonly();
  readonly token = this._token.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  
  readonly isAuthenticated = computed(() => !!this._token() && !!this._user());
  readonly userInitials = computed(() => {
    const user = this._user();
    if (!user?.name) return '';
    return user.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  });

  constructor() {
    this.loadStoredAuth();
  }

  private loadStoredAuth(): void {
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      const userJson = localStorage.getItem(AUTH_USER_KEY);
      
      if (token && userJson) {
        const user = JSON.parse(userJson) as User;
        this._token.set(token);
        this._user.set(user);
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
      this.clearAuth();
    }
  }

  private storeAuth(token: string, user: User): void {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    this._token.set(token);
    this._user.set(user);
  }

  private clearAuth(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    this._token.set(null);
    this._user.set(null);
  }

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    this._loading.set(true);
    this._error.set(null);

    return this.api.post<AuthResponse>('/auth/login', credentials).pipe(
      tap(response => {
        this.storeAuth(response.token, response.user);
        this._loading.set(false);
      }),
      catchError(error => {
        this._loading.set(false);
        this._error.set(error.message || 'Login failed');
        return throwError(() => error);
      })
    );
  }

  register(credentials: RegisterCredentials): Observable<AuthResponse> {
    this._loading.set(true);
    this._error.set(null);

    return this.api.post<AuthResponse>('/auth/register', credentials).pipe(
      tap(response => {
        this.storeAuth(response.token, response.user);
        this._loading.set(false);
      }),
      catchError(error => {
        this._loading.set(false);
        this._error.set(error.message || 'Registration failed');
        return throwError(() => error);
      })
    );
  }

  loginWithGoogle(): void {
    // Matches the C# controller route: api/Auth/google
    window.location.href = `${this.api['baseUrl']}/auth/google`;
  }

  loginWithGithub(): void {
    // Redirect to GitHub OAuth
    window.location.href = `${this.api['baseUrl']}/auth/github`;
  }

  handleOAuthCallback(token: string): Observable<User> {
    this._loading.set(true);
    this._token.set(token);
    localStorage.setItem(AUTH_TOKEN_KEY, token);

    return this.api.get<User>('/auth/me').pipe(
      tap(user => {
        this._user.set(user);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        this._loading.set(false);
      }),
      catchError(error => {
        this._loading.set(false);
        this.clearAuth();
        return throwError(() => error);
      })
    );
  }

  logout(): void {
    this.clearAuth();
    this._error.set(null);
    // FIX: Reset theme to light mode on logout
    this.themeService.setTheme('light');
    this.router.navigate(['/']);
  }

  refreshToken(): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/refresh', {}).pipe(
      tap(response => {
        this.storeAuth(response.token, response.user);
      }),
      catchError(error => {
        this.logout();
        return throwError(() => error);
      })
    );
  }

  clearError(): void {
    this._error.set(null);
  }
}