import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { SimulationResults, HistoricBacktestResults } from '../models/results.model';

export interface PdfSection {
  title: string;
  element: HTMLElement;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  constructor() { }

  // ==========================================================================
  // PDF EXPORT
  // ==========================================================================

  async exportToPdf(results: SimulationResults | HistoricBacktestResults, sections: PdfSection[]): Promise<void> {
    const isHistoric = this.isHistoricResults(results);
    const filename = this.getFilename(results.strategyName, 'pdf');
    
    // 1. Initialize PDF (A4 Portrait)
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    
    let cursorY = 20;

    // 2. Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(30, 58, 95); // QuantSim Primary Blue
    doc.text('QuantSim Strategy Report', margin, cursorY);
    
    cursorY += 8;
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on ${new Date().toLocaleString()}`, margin, cursorY);

    cursorY += 12;
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.line(margin, cursorY, pageWidth - margin, cursorY); // Divider line
    
    // 3. Strategy Title & Mode
    cursorY += 10;
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.setFont('helvetica', 'bold');
    doc.text(results.strategyName, margin, cursorY);
    
    cursorY += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(71, 85, 105); // Slate-600
    const modeLabel = isHistoric ? 'Historic Backtest' : 'Monte Carlo Simulation';
    doc.text(`${modeLabel} • ID: ${results.id.substring(0, 8)}`, margin, cursorY);

    // 4. Executive Summary (Metrics Grid)
    cursorY += 15;
    this.addSectionHeader(doc, 'Executive Summary', margin, cursorY);
    cursorY += 8;

    const summaryData = this.generateSummaryData(results, isHistoric);
    
    // Render metrics grid
    doc.setFontSize(10);
    const colWidth = contentWidth / 2;
    const rowHeight = 7;
    
    summaryData.forEach((item, index) => {
      // Skip metadata we already printed in header
      if (['Strategy Name', 'Generated At', 'Simulation Mode'].includes(item.Metric)) return;

      const colIndex = index % 2; // 0 for left, 1 for right
      const xPos = margin + (colIndex * colWidth);
      
      // Increment Y only after filling a row (every 2 items)
      if (colIndex === 0 && index > 0) cursorY += rowHeight;

      // Label
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(item.Metric, xPos, cursorY);

      // Value
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      // Align value to the right of the column
      doc.text(String(item.Value), xPos + colWidth - 10, cursorY, { align: 'right' });
    });

    cursorY += 15;

    // 5. Visual Sections
    for (const section of sections) {
      // Check for page break
      if (cursorY + 60 > pageHeight) {
        doc.addPage();
        cursorY = 20;
      }

      // Section Title
      this.addSectionHeader(doc, section.title, margin, cursorY);
      cursorY += 8;

      if (section.description) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(section.description, margin, cursorY);
        cursorY += 6;
      }

      try {
        // Capture Element
        const canvas = await html2canvas(section.element, { 
          scale: 2, 
          backgroundColor: '#ffffff',
          logging: false,
          ignoreElements: (el) => el.classList.contains('no-print')
        });

        const imgData = canvas.toDataURL('image/png');
        const imgProps = doc.getImageProperties(imgData);
        
        // Scale to fit width
        const pdfImgWidth = contentWidth;
        const pdfImgHeight = (imgProps.height * pdfImgWidth) / imgProps.width;

        // Check if image fits on page, else new page
        if (cursorY + pdfImgHeight > pageHeight - margin) {
          doc.addPage();
          cursorY = 20;
        }

        doc.addImage(imgData, 'PNG', margin, cursorY, pdfImgWidth, pdfImgHeight);
        cursorY += pdfImgHeight + 10;

      } catch (err) {
        console.error(`Error capturing ${section.title}:`, err);
        doc.setTextColor(220, 38, 38);
        doc.setFontSize(9);
        doc.text(`[Could not render ${section.title}]`, margin, cursorY);
        cursorY += 10;
      }
    }

    // 6. Footer (Page Numbers)
    const pageCount = doc.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate-400
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(`Page ${i} of ${pageCount} - QuantSim`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    doc.save(filename);
  }

  private addSectionHeader(doc: jsPDF, text: string, x: number, y: number) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 95);
    doc.text(text, x, y);
    // Underline
    doc.setDrawColor(30, 58, 95);
    doc.setLineWidth(0.5);
    doc.line(x, y + 2, x + 10, y + 2);
  }

  // ==========================================================================
  // CSV & EXCEL EXPORT
  // ==========================================================================

  exportToCsv(results: SimulationResults | HistoricBacktestResults): void {
    const isHistoric = this.isHistoricResults(results);
    const filename = this.getFilename(results.strategyName, 'csv');
    
    let data: any[] = [];

    if (isHistoric) {
      data = this.flattenHistoricData(results as HistoricBacktestResults);
    } else {
      data = this.flattenMonteCarloData(results as SimulationResults);
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
    
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, filename);
  }

  exportToExcel(results: SimulationResults | HistoricBacktestResults): void {
    const isHistoric = this.isHistoricResults(results);
    const filename = this.getFilename(results.strategyName, 'xlsx');
    
    // 1. Create Workbook
    const wb = XLSX.utils.book_new();

    // 2. Summary Sheet
    const summaryData = this.generateSummaryData(results, isHistoric);
    // Add Strategy Name/Date to summary for Excel
    summaryData.unshift(
        { Metric: 'Strategy Name', Value: results.strategyName },
        { Metric: 'Date', Value: new Date().toLocaleDateString() }
    );

    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // 3. Time Series Data Sheet
    let timeSeriesData: any[] = [];
    if (isHistoric) {
      timeSeriesData = this.flattenHistoricData(results as HistoricBacktestResults);
    } else {
      timeSeriesData = this.flattenMonteCarloData(results as SimulationResults);
    }
    const dataWs = XLSX.utils.json_to_sheet(timeSeriesData);
    XLSX.utils.book_append_sheet(wb, dataWs, 'Data');

    // 4. Trades Sheet (Historic Only)
    if (isHistoric) {
      const historicRes = results as HistoricBacktestResults;
      if (historicRes.transactions && historicRes.transactions.length > 0) {
        const tradesData = historicRes.transactions.map(t => ({
          Date: new Date(t.date).toLocaleDateString(),
          Ticker: t.ticker.toUpperCase(),
          Type: t.type,
          Quantity: t.quantity,
          Price: t.price,
          Value: t.value,
          Tag: t.tag || '-'
        }));
        const tradesWs = XLSX.utils.json_to_sheet(tradesData);
        XLSX.utils.book_append_sheet(wb, tradesWs, 'Trades');
      }
    }

    // 5. Write File
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, filename);
  }

  // ==========================================================================
  // HELPERS: Data Flattening
  // ==========================================================================

  private flattenMonteCarloData(results: SimulationResults): any[] {
    const paths = results.samplePaths;
    const length = paths.p50.values.length;
    const data: any[] = [];

    for (let i = 0; i < length; i++) {
      const timestamp = paths.p50.timestamps[i];
      // If timestamp looks like an index (small number), treat as Step, else Date
      const isDate = timestamp > 100000000000; 
      
      const row: any = {
        Step: i,
      };

      if (isDate) {
        row['Date'] = new Date(timestamp).toLocaleDateString();
      }

      row['P10 (Bear)'] = paths.p10.values[i];
      row['P25'] = paths.p25.values[i];
      row['P50 (Median)'] = paths.p50.values[i];
      row['P75'] = paths.p75.values[i];
      row['P90 (Bull)'] = paths.p90.values[i];

      data.push(row);
    }

    return data;
  }

  private flattenHistoricData(results: HistoricBacktestResults): any[] {
    const length = results.equityCurve.length;
    const data: any[] = [];

    for (let i = 0; i < length; i++) {
      const dateStr = results.dates[i];
      
      data.push({
        Date: new Date(dateStr).toLocaleDateString(),
        'Strategy Equity': results.equityCurve[i],
        'Benchmark Equity': results.benchmarkCurve[i],
        'Drawdown %': results.drawdownCurve[i]
      });
    }

    return data;
  }

  private generateSummaryData(results: SimulationResults | HistoricBacktestResults, isHistoric: boolean): any[] {
    if (isHistoric) {
      const r = results as HistoricBacktestResults;
      return [
        { Metric: 'Total Return', Value: this.formatPercent(r.totalReturn) },
        { Metric: 'Benchmark Return', Value: this.formatPercent(r.benchmarkReturn) },
        { Metric: 'Alpha', Value: this.formatPercent(r.totalReturn - r.benchmarkReturn) },
        { Metric: 'Sharpe Ratio', Value: r.sharpeRatio.toFixed(2) },
        { Metric: 'Max Drawdown', Value: this.formatPercent(r.maxDrawdown) },
        { Metric: 'Volatility', Value: this.formatPercent(r.volatility) },
        { Metric: 'Total Trades', Value: r.transactions ? r.transactions.length : 0 }
      ];
    } else {
      const r = results as SimulationResults;
      return [
        { Metric: 'Success Probability', Value: this.formatPercent(r.successProbability) },
        { Metric: 'Median Wealth', Value: this.formatCurrency(r.terminalWealthStats.median) },
        { Metric: 'Median Sharpe', Value: r.riskMetrics.sharpeRatio.median.toFixed(2) },
        { Metric: 'Median Max DD', Value: this.formatPercent(r.riskMetrics.maxDrawdown.median) },
        { Metric: 'Iterations', Value: r.metadata.iterations.toLocaleString() },
        { Metric: 'Model', Value: r.metadata.model }
      ];
    }
  }

  // ==========================================================================
  // HELPERS: Utilities
  // ==========================================================================

  private formatCurrency(value: number): string {
    if (value === undefined || value === null) return '-';
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(2)}`;
  }

  private formatPercent(value: number): string {
    if (value === undefined || value === null) return '-';
    return `${(value * 100).toFixed(2)}%`;
  }

  private getFilename(strategyName: string, extension: string): string {
    const safeName = strategyName.replace(/[^a-z0-9 \-_]/gi, '').trim().replace(/\s+/g, '_');
    const date = new Date().toISOString().split('T')[0];
    return `QuantSim_${safeName}_${date}.${extension}`;
  }

  private isHistoricResults(results: any): boolean {
    return 'equityCurve' in results;
  }
}