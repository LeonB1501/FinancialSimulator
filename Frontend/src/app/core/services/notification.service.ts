import { Injectable, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationOptions {
  duration?: number;
  action?: string;
  panelClass?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  private readonly defaultConfig: MatSnackBarConfig = {
    duration: 4000,
    horizontalPosition: 'right',
    verticalPosition: 'top',
  };

  success(message: string, options?: NotificationOptions): void {
    this.show(message, 'success', options);
  }

  error(message: string, options?: NotificationOptions): void {
    this.show(message, 'error', { ...options, duration: options?.duration ?? 6000 });
  }

  warning(message: string, options?: NotificationOptions): void {
    this.show(message, 'warning', options);
  }

  info(message: string, options?: NotificationOptions): void {
    this.show(message, 'info', options);
  }

  private show(message: string, type: NotificationType, options?: NotificationOptions): void {
    const panelClasses = [`${type}-snackbar`, options?.panelClass].filter(Boolean) as string[]; // FIX: Cast to string[]
    
    const config: MatSnackBarConfig = {
      ...this.defaultConfig,
      duration: options?.duration ?? this.defaultConfig.duration,
      panelClass: panelClasses,
    };

    this.snackBar.open(message, options?.action ?? 'Dismiss', config);
  }

  dismiss(): void {
    this.snackBar.dismiss();
  }
}
