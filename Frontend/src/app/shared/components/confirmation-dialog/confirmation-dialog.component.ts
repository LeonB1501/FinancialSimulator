import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface ConfirmationDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'warn' | 'accent';
}

@Component({
  selector: 'qs-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <div class="p-6">
      <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-3">{{ data.title }}</h2>
      <p class="text-surface-600 dark:text-surface-400 mb-6">{{ data.message }}</p>
      
      <div class="flex justify-end space-x-3">
        <button 
          mat-button 
          (click)="dialogRef.close(false)"
          class="btn-secondary btn-md"
        >
          {{ data.cancelText || 'Cancel' }}
        </button>
        <button 
          mat-flat-button 
          [color]="data.confirmColor || 'primary'"
          (click)="dialogRef.close(true)"
          [class.bg-red-500]="data.confirmColor === 'warn'"
          [class.hover:bg-red-600]="data.confirmColor === 'warn'"
          class="btn-md"
        >
          {{ data.confirmText || 'Confirm' }}
        </button>
      </div>
    </div>
  `,
})
export class ConfirmationDialogComponent {
  readonly data = inject<ConfirmationDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<ConfirmationDialogComponent>);
}
