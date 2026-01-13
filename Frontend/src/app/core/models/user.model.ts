export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  subscriptionTier: 'Free' | 'Pro';
  subscriptionStatus: 'Inactive' | 'Active' | 'PastDue' | 'Canceled';
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresIn: number;
}