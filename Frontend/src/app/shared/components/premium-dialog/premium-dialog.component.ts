import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

export interface PremiumDialogData {
  featureName: string;
  description: string;
}

@Component({
  selector: 'qs-premium-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <div class="p-8 text-center max-w-md mx-auto">
      <!-- Icon -->
      <div class="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg transform -rotate-6">
        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg>
      </div>

      <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-2">
        Unlock {{ data.featureName }}
      </h2>
      
      <p class="text-surface-600 dark:text-surface-400 mb-8 leading-relaxed">
        {{ data.description }}
        <br><br>
        Upgrade to <span class="font-bold text-accent-600 dark:text-accent-400">QuantSim Pro</span> to access this feature and unleash the full power of the platform.
      </p>

      <div class="space-y-3">
        <button 
          (click)="onUpgrade()"
          class="w-full btn-primary btn-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
        >
          Upgrade to Pro
        </button>
        
        <button 
          (click)="dialogRef.close()"
          class="w-full btn-ghost btn-md"
        >
          Maybe Later
        </button>
      </div>
    </div>
  `,
})
export class PremiumDialogComponent {
  readonly data = inject<PremiumDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<PremiumDialogComponent>);
  private readonly router = inject(Router);

  onUpgrade(): void {
    this.dialogRef.close();
    // We will build the /upgrade page in Phase 5. 
    // For now, this just closes the dialog.
    this.router.navigate(['/upgrade']); 
  }
}