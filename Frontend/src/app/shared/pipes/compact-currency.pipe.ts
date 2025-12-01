import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'compactCurrency',
  standalone: true,
})
export class CompactCurrencyPipe implements PipeTransform {
  transform(value: number | null | undefined, decimals: number = 0): string {
    if (value === null || value === undefined) return '-';
    
    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    
    if (absValue >= 1_000_000_000) {
      return `${sign}$${(absValue / 1_000_000_000).toFixed(decimals)}B`;
    }
    if (absValue >= 1_000_000) {
      return `${sign}$${(absValue / 1_000_000).toFixed(decimals)}M`;
    }
    if (absValue >= 1_000) {
      return `${sign}$${(absValue / 1_000).toFixed(decimals)}K`;
    }
    
    return `${sign}$${absValue.toFixed(decimals)}`;
  }
}
