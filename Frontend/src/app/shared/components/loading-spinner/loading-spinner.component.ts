import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'qs-loading-spinner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="flex items-center justify-center"
      [class.p-8]="size === 'lg'"
      [class.p-4]="size === 'md'"
      [class.p-2]="size === 'sm'"
    >
      <div 
        class="animate-spin rounded-full border-accent-500 border-t-transparent"
        [class.w-12]="size === 'lg'"
        [class.h-12]="size === 'lg'"
        [class.border-4]="size === 'lg'"
        [class.w-8]="size === 'md'"
        [class.h-8]="size === 'md'"
        [class.border-3]="size === 'md'"
        [class.w-5]="size === 'sm'"
        [class.h-5]="size === 'sm'"
        [class.border-2]="size === 'sm'"
      ></div>
      @if (message) {
        <span 
          class="ml-3 text-surface-600"
          [class.text-lg]="size === 'lg'"
          [class.text-base]="size === 'md'"
          [class.text-sm]="size === 'sm'"
        >
          {{ message }}
        </span>
      }
    </div>
  `,
})
export class LoadingSpinnerComponent {
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() message?: string;
}
