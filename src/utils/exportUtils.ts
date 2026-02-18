import { Asset, ImportAsset } from '../types';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

/**
 * Export format types
 */
export type ExportFormat = 'csv' | 'json' | 'xlsx' | 'txt';

/**
 * Export scope types
 */
export type ExportScope = 'all' | 'selected' | 'filtered' | 'findings';

/**
 * Export options
 */
export interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  includeHeaders?: boolean;
  includeFindings?: boolean;
  includeNotes?: boolean;
  filename?: string;
}

/**
 * Convert assets to CSV format
 */
function assetsToCSV(assets: Asset[], options: ExportOptions): string {
  const headers = ['id', 'url', 'method', 'status', 'status_code', 'risk_score', 
    'source', 'triage_status', 'created_at'];
  
  if (options.includeFindings) {
    headers.push('findings');
  }
  if (options.includeNotes) {
    headers.push('notes');
  }

  const rows = assets.map(asset => {
    const row: any = {
      id: asset.id,
      url: asset.url,
      method: asset.method,
      status: asset.status,
      status_code: asset.status_code,
      risk_score: asset.risk_score,
      source: asset.source,
      triage_status: asset.triage_status,
      created_at: asset.created_at,
    };

    if (options.includeFindings) {
      row.findings = asset.findings.map(f => f.short).join('; ');
    }
    if (options.includeNotes) {
      row.notes = asset.notes;
    }

    return row;
  });

  return Papa.unparse(rows, {
    header: options.includeHeaders !== false,
    columns: headers,
  });
}

/**
 * Convert assets to JSON format
 */
function assetsToJSON(assets: Asset[], options: ExportOptions): string {
  let exportData = assets.map(asset => {
    const item: any = {
      id: asset.id,
      url: asset.url,
      method: asset.method,
      status: asset.status,
      status_code: asset.status_code,
      risk_score: asset.risk_score,
      source: asset.source,
      triage_status: asset.triage_status,
      created_at: asset.created_at,
    };

    if (options.includeFindings) {
      item.findings = asset.findings;
    }
    if (options.includeNotes) {
      item.notes = asset.notes;
    }

    return item;
  });

  return JSON.stringify(exportData, null, 2);
}

/**
 * Convert assets to XLSX format
 */
function assetsToXLSX(assets: Asset[], options: ExportOptions): Uint8Array {
  const headers = ['id', 'url', 'method', 'status', 'status_code', 'risk_score', 
    'source', 'triage_status', 'created_at'];
  
  if (options.includeFindings) {
    headers.push('findings');
  }
  if (options.includeNotes) {
    headers.push('notes');
  }

  const rows = assets.map(asset => {
    const row: any = {
      ID: asset.id,
      URL: asset.url,
      Method: asset.method,
      Status: asset.status,
      'Status Code': asset.status_code,
      'Risk Score': asset.risk_score,
      Source: asset.source,
      'Triage Status': asset.triage_status,
      'Created At': asset.created_at,
    };

    if (options.includeFindings) {
      row.Findings = asset.findings.map(f => f.short).join('; ');
    }
    if (options.includeNotes) {
      row.Notes = asset.notes;
    }

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets');
  
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
}

/**
 * Convert assets to plain text format
 */
function assetsToText(assets: Asset[]): string {
  return assets
    .map(asset => `${asset.method} ${asset.url} [${asset.status_code}] (Risk: ${asset.risk_score})`)
    .join('\n');
}

/**
 * Export staged import assets to various formats
 */
export function exportStagedAssets(
  assets: ImportAsset[],
  format: ExportFormat,
  filename?: string
): void {
  let content: string | Uint8Array;
  let mimeType: string;
  let extension: string;

  const baseFilename = filename || `assets_export_${Date.now()}`;

  switch (format) {
    case 'csv':
      content = Papa.unparse(assets.map(a => ({
        url: a.url,
        method: a.method,
        source: a.source,
        status: a.status,
        recursive: a.recursive,
      })), { header: true });
      mimeType = 'text/csv';
      extension = 'csv';
      break;

    case 'json':
      content = JSON.stringify(assets, null, 2);
      mimeType = 'application/json';
      extension = 'json';
      break;

    case 'xlsx':
      content = XLSX.write(XLSX.utils.book_new(), { 
        type: 'array', 
        bookType: 'xlsx' 
      });
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      extension = 'xlsx';
      break;

    case 'txt':
      content = assets.map(a => `${a.method} ${a.url}`).join('\n');
      mimeType = 'text/plain';
      extension = 'txt';
      break;

    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  downloadFile(content, `${baseFilename}.${extension}`, mimeType);
}

/**
 * Main export function for assets
 */
export function exportAssets(
  assets: Asset[],
  options: ExportOptions
): void {
  if (assets.length === 0) {
    throw new Error('No assets to export');
  }

  let content: string | Uint8Array;
  let mimeType: string;
  let extension: string;
  const baseFilename = options.filename || `assets_export_${Date.now()}`;

  // Filter based on scope
  let filteredAssets = assets;
  if (options.scope === 'findings') {
    filteredAssets = assets.filter(a => a.findings && a.findings.length > 0);
  }

  switch (options.format) {
    case 'csv':
      content = assetsToCSV(filteredAssets, options);
      mimeType = 'text/csv';
      extension = 'csv';
      break;

    case 'json':
      content = assetsToJSON(filteredAssets, options);
      mimeType = 'application/json';
      extension = 'json';
      break;

    case 'xlsx':
      content = assetsToXLSX(filteredAssets, options);
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      extension = 'xlsx';
      break;

    case 'txt':
      content = assetsToText(filteredAssets);
      mimeType = 'text/plain';
      extension = 'txt';
      break;

    default:
      throw new Error(`Unsupported format: ${options.format}`);
  }

  downloadFile(content, `${baseFilename}.${extension}`, mimeType);
}

/**
 * Trigger file download
 */
function downloadFile(content: string | Uint8Array, filename: string, mimeType: string): void {
  let blob: Blob;
  
  if (content instanceof Uint8Array) {
    blob = new Blob([content], { type: mimeType });
  } else {
    blob = new Blob([content], { type: mimeType });
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export findings to CSV format
 */
export function exportFindings(assets: Asset[], filename?: string): void {
  const findings: any[] = [];
  
  assets.forEach(asset => {
    asset.findings?.forEach(finding => {
      findings.push({
        asset_id: asset.id,
        url: asset.url,
        method: asset.method,
        severity: finding.severity,
        short: finding.short,
        description: finding.description,
        emoji: finding.emoji,
      });
    });
  });

  const content = Papa.unparse(findings, { header: true });
  downloadFile(content, filename || `findings_export_${Date.now()}.csv`, 'text/csv');
}

/**
 * Export to clipboard
 */
export async function exportToClipboard(assets: Asset[], format: 'url' | 'json' = 'url'): Promise<void> {
  let content: string;
  
  switch (format) {
    case 'json':
      content = JSON.stringify(assets.map(a => ({ url: a.url, method: a.method })), null, 2);
      break;
    case 'url':
    default:
      content = assets.map(a => `${a.method} ${a.url}`).join('\n');
  }

  await navigator.clipboard.writeText(content);
}
