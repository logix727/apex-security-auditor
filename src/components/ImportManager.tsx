import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import {
  Upload, X, FolderDown, History, AlertCircle, File as FileIcon,
  Terminal, Database as DbIcon, ShieldAlert,
  Loader2
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import yaml from 'js-yaml';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  ImportAsset,
  ImportOptions,
  ImportProgress,
  ImportHistoryEntry,
  ImportDestination
} from '../types';

// Zod schema for input validation
export const AssetInputSchema = z.object({
  url: z.string().min(3, "URL/Path is too short"),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']).default('GET'),
  source: z.string().optional().default('Import'),
  recursive: z.boolean().optional().default(false),
});
import { SmartTable, Column } from './table/SmartTable';

interface ImportManagerProps {
  isOpen: boolean;
  initialFiles?: File[] | null;
  onClose: () => void;
  onImport: (assets: { url: string; method: string; recursive: boolean; source: string }[], destination: ImportDestination, options: ImportOptions) => Promise<void>;
  onAnalyze?: (report: any, content: string) => void;
  existingUrls: Set<string>;
}

// Default import options
const DEFAULT_OPTIONS: ImportOptions = {
  destination: 'asset_manager',
  recursive: false,
  batchMode: true,
  batchSize: 5,
  rateLimitMs: 100,
  skipDuplicates: true,
  validateUrls: true,
};

export const ImportManager: React.FC<ImportManagerProps> = ({
  isOpen,
  initialFiles,
  onClose,
  onImport,
  onAnalyze,
  existingUrls
}) => {
  // Core state
  const [importText, setImportText] = useState('');
  const [stagedAssets, setStagedAssets] = useState<ImportAsset[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>([]);
  const [isOpenApiSpec, setIsOpenApiSpec] = useState(false);
  const [rawSpecContent, setRawSpecContent] = useState<string | null>(null);
  const [options, setOptions] = useState<ImportOptions>(DEFAULT_OPTIONS);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Event listeners
  useEffect(() => {
    let unlistenProgress: UnlistenFn | null = null;
    let unlistenComplete: UnlistenFn | null = null;

    const setupListeners = async () => {
      unlistenProgress = await listen<ImportProgress>('import-progress', (event) => {
        setImportProgress(event.payload);
      });

      unlistenComplete = await listen<{
        import_id: string;
        successful: number;
        failed: number;
        duplicates: number;
      }>('import-complete', (event) => {
        // Use the payload to update progress state
        setImportProgress(prev => prev ? {
          ...prev,
          status: 'completed',
          percentage: 100
        } : null);

        // Log completion details for debugging
        console.log('Import complete:', event.payload);

        // Refresh history after completion
        loadImportHistory();
      });
    };

    setupListeners();

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenComplete) unlistenComplete();
    };
  }, []);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setStagedAssets([]);
      setImportText('');
      setErrorMsg(null);
      setImportProgress(null);
      setOptions(DEFAULT_OPTIONS);
      setIsOpenApiSpec(false);
      setRawSpecContent(null);
      loadImportHistory();

      if (initialFiles && initialFiles.length > 0) {
        processFiles(initialFiles);
      }
    }
  }, [isOpen, initialFiles]);

  // Load import history
  const loadImportHistory = async () => {
    try {
      const history = await invoke<ImportHistoryEntry[]>('get_import_history', {
        limit: 20,
        offset: 0
      });
      setImportHistory(history || []);
    } catch (e) {
      console.warn('Failed to load import history', e);
    }
  };

  // Clear import history
  const handleClearHistory = async () => {
    try {
      await invoke('clear_import_history');
      setImportHistory([]);
    } catch (e) {
      setErrorMsg(`Failed to clear history: ${e}`);
    }
  };

  // Handle Drag Events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Process files (shared between drag/drop and file input)
  const processFiles = async (files: FileList | File[]) => {
    setIsProcessing(true);
    setErrorMsg(null);

    let allNewAssets: ImportAsset[] = [];

    const fileArray = Array.isArray(files) ? files : Array.from(files);
    for (const file of fileArray) {
      try {
        // Validate file type first
        const validBinaryExtensions = ['.xlsx', '.xls'];
        const fileName = file.name.toLowerCase();

        const isKnownBinary = validBinaryExtensions.some(ext => fileName.endsWith(ext));

        let content = '';
        let type: 'text' | 'csv' | 'json' | 'yaml' = 'text';

        if (isKnownBinary) {
          // Handle Excel
          const buffer = await file.arrayBuffer();
          const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const csv = XLSX.utils.sheet_to_csv(worksheet);
          content = csv;
          type = 'csv';
        } else {
          // Only read as text if it's a validated text file
          content = await file.text();

          // Additional validation: check if content looks like binary data
          const isBinary = /[\x00-\x08\x0E-\x1F]/.test(content.substring(0, 1000));
          if (isBinary && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            console.warn(`File appears to be binary: ${file.name}`);
            setErrorMsg(`File "${file.name}" appears to be a binary file. Please use CSV, JSON, or TXT format.`);
            continue;
          }

          if (file.name.endsWith('.json')) type = 'json';
          else if (file.name.endsWith('.csv')) type = 'csv';
          else if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) type = 'yaml';
        }

        const assets = await parseContent(content, type, file.name);
        allNewAssets = [...allNewAssets, ...assets];
      } catch (err) {
        console.error(`Failed to read file ${file.name}`, err);
        setErrorMsg(`Failed to process file ${file.name}: ${err}`);
      }
    }

    setStagedAssets(prev => [...prev, ...allNewAssets]);
    setDragActive(false);
    setIsProcessing(false);
  };

  // Handle file input change
  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
      // Reset the input so the same file can be selected again
      e.target.value = '';
    }
  }, []);

  // Handle drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    } else {
      // Handle text drop
      const text = e.dataTransfer.getData('text/plain');
      if (text) {
        setIsProcessing(true);
        const assets = await parseContent(text, 'text', 'Dropped Text');
        setStagedAssets(prev => [...prev, ...assets]);
        setIsProcessing(false);
      }
    }
  }, []);

  // Parse Content Logic
  const parseContent = async (content: string, type: 'text' | 'csv' | 'json' | 'yaml', fileName: string) => {
    const newAssets: ImportAsset[] = [];
    
    const validateAsset = (data: any, fileName: string): ImportAsset | null => {
      const result = AssetInputSchema.safeParse({
        url: data.url,
        method: data.method || 'GET',
        source: fileName,
        recursive: options.destination === 'asset_manager' ? true : options.recursive,
      });

      if (!result.success) {
        console.warn("Validation failed for asset:", data, result.error.format());
        return null;
      }

      const validated = result.data;
      const isDuplicate = existingUrls.has(validated.url);

      return {
        id: crypto.randomUUID(),
        url: validated.url,
        method: validated.method,
        source: validated.source || fileName,
        selected: !isDuplicate || !options.skipDuplicates,
        recursive: validated.recursive,
        status: (isDuplicate ? 'duplicate' : 'valid') as any
      };
    };

    try {
      if (type === 'json') {
        try {
          const json = JSON.parse(content);
          // Swagger/OpenAPI Detection
          if (json.paths || json.openapi || json.swagger) {
            setIsOpenApiSpec(true);
            setRawSpecContent(content);
            Object.keys(json.paths).forEach((path: string) => {
              const methods = Object.keys(json.paths[path]);
              methods.forEach((method: string) => {
                let baseUrl = '';
                if (json.servers && json.servers.length > 0) {
                  baseUrl = json.servers[0].url;
                }

                const fullUrl = baseUrl ? (baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl) + path : path;
                const asset = validateAsset({ url: fullUrl, method: method.toUpperCase() }, fileName);
                if (asset) newAssets.push(asset);
              });
            });
          } else if (Array.isArray(json)) {
            // Array of strings or objects
            json.forEach((item: any) => {
              if (typeof item === 'string') {
                const asset = validateAsset({ url: item }, fileName);
                if (asset) newAssets.push(asset);
              } else if (typeof item === 'object' && item.url) {
                const asset = validateAsset({ url: item.url, method: item.method }, fileName);
                if (asset) newAssets.push(asset);
              }
            });
          }
        } catch (e) {
          console.warn("Failed to parse JSON", e);
          setErrorMsg(`Failed to parse JSON file: ${e}`);
        }
      } else if (type === 'yaml') {
        try {
          const doc = yaml.load(content) as any;
          if (doc && (doc.paths || doc.openapi || doc.swagger)) {
            setIsOpenApiSpec(true);
            setRawSpecContent(content);
            Object.keys(doc.paths).forEach((path: string) => {
              const methods = Object.keys(doc.paths[path]);
              methods.forEach((method: string) => {
                let baseUrl = '';
                if (doc.servers && doc.servers.length > 0) {
                  baseUrl = doc.servers[0].url;
                }
                const fullUrl = baseUrl ? (baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl) + path : path;
                const asset = validateAsset({ url: fullUrl, method: method.toUpperCase() }, fileName);
                if (asset) newAssets.push(asset);
              });
            });
          }
        } catch (e) {
          console.warn("Failed to parse YAML", e);
          setErrorMsg(`Failed to parse YAML file: ${e}`);
        }
      } else if (type === 'csv') {
        const results = Papa.parse(content, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true
        });

        const processRow = (row: any) => {
          let url = '';
          let method = 'GET';

          const isValidUrlStr = (s: any): boolean => {
            if (!s) return false;
            const str = String(s).trim();
            if (str === '' || str === 'null' || str === 'undefined' || str === '[object Object]') return false;
            return str.startsWith('http') || str.startsWith('/');
          };

          if (typeof row === 'object' && !Array.isArray(row)) {
            const keys = Object.keys(row);
            
            // 1. Try common column names
            const urlKey = keys.find(k => {
              const lower = k.toLowerCase();
              return lower === 'url' || lower === 'path' || lower === 'endpoint' || lower.includes('address') || lower.includes('asset');
            });
            
            if (urlKey && row[urlKey] != null) {
              const val = String(row[urlKey]).trim();
              if (val && val !== 'null' && val !== 'undefined') url = val;
            }

            const methodKey = keys.find(k => {
              const lower = k.toLowerCase();
              return lower === 'method' || lower === 'verb' || lower.includes('http_method');
            });
            if (methodKey && row[methodKey] != null) {
              const mVal = String(row[methodKey]).trim().toUpperCase();
              if (mVal && ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(mVal)) method = mVal;
            }
            
            // 2. Heuristic fallback: find first string that looks like a URL/Path
            if (!url) {
              const val = Object.values(row).find(isValidUrlStr);
              if (val) url = String(val).trim();
            }

            // 3. Heuristic fallback: find first string that looks like a Method
            if (method === 'GET') {
              const mVal = Object.values(row).find(v => 
                typeof v === 'string' && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(v.trim().toUpperCase())
              );
              if (mVal) method = String(mVal).trim().toUpperCase();
            }
          } else if (Array.isArray(row)) {
            const val = row.find(isValidUrlStr);
            if (val) url = String(val).trim();
            
            const mVal = row.find(v => 
              typeof v === 'string' && ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(v.trim().toUpperCase())
            );
            if (mVal) method = String(mVal).trim().toUpperCase();
          }

          if (url && url.length > 3) {
            const asset = validateAsset({ url, method }, fileName);
            if (asset) newAssets.push(asset);
          }
        };

        (results.data as any[]).forEach(processRow);
        
        // If nothing found with headers, try raw array access
        if (newAssets.length === 0) {
           const rawResults = Papa.parse(content, { header: false, skipEmptyLines: true });
           (rawResults.data as any[]).forEach(processRow);
        }
      } else {
        // Text: Use regex for aggressive extraction from any content
        const urlRegex = /(?:(GET|POST|PUT|DELETE|PATCH)\s+)?(https?:\/\/[^\s"\'<>]+|(?:(?:\/[^\s"\'<>]+){2,}))/gi;
        let match;
        while ((match = urlRegex.exec(content)) !== null) {
          const method = match[1]?.toUpperCase() || 'GET';
          const url = match[2];
          
          if (url) {
            const asset = validateAsset({ url, method }, fileName);
            if (asset) newAssets.push(asset);
          }
        }
      }
    } catch (e) {
      console.error("Parse error", e);
      setErrorMsg(`Parse error: ${e}`);
    }

    return newAssets;
  };

  const handleTextParse = async () => {
    setIsProcessing(true);
    const assets = await parseContent(importText, 'text', 'Paste');
    setStagedAssets(prev => [...prev, ...assets]);
    setImportText('');
    setIsProcessing(false);
  };

  // Validate URLs before import
  const validateUrls = async () => {
    const selected = stagedAssets.filter(a => a.selected && a.status !== 'duplicate');
    if (selected.length === 0) return true;

    try {
      const urls = selected.map(a => a.url);
      const results = await invoke<{ url: string; is_valid: boolean; message: string }[]>('validate_urls', {
        urls: urls
      });

      let hasErrors = false;
      const updatedAssets = stagedAssets.map(asset => {
        const result = results.find(r => r.url === asset.url);
        if (result) {
          if (!result.is_valid) hasErrors = true;
          return { 
            ...asset, 
            status: (result.is_valid ? 'valid' : 'invalid') as any,
            error: result.message
          };
        }
        return asset;
      });

      setStagedAssets(updatedAssets);
      return !hasErrors;
    } catch (e) {
      console.error('URL validation failed:', e);
      return true; // Continue anyway if validation fails
    }
  };

  const handleImportConfirm = async () => {
    const selected = stagedAssets.filter(a => a.selected);
    if (selected.length === 0) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setImportProgress({
      importId: crypto.randomUUID(),
      current: 0,
      total: selected.length,
      percentage: 0,
      status: 'importing',
      startTime: new Date().toISOString(),
      errors: []
    });

    try {
      // Validate URLs if option is enabled
      if (options.validateUrls) {
        const valid = await validateUrls();
        if (!valid) {
          setErrorMsg('Some URLs are invalid. Please review and fix errors before importing.');
          setIsProcessing(false);
          setImportProgress(null);
          return;
        }
      }

      // Convert to required format - preserve the recursive flag!
      // Force recursive if Asset Manager is destination
      const formatted = selected
        .filter(a => a.status !== 'invalid')
        .map(a => ({ 
          url: a.url, 
          method: a.method, 
          recursive: options.destination === 'asset_manager' ? true : a.recursive,
          source: a.source || (options.source === 'Clipboard' ? 'User' : 'Import')
        }));

      if (formatted.length === 0) {
          setErrorMsg('No valid assets to import (all selected assets are marked invalid/duplicate).');
          setIsProcessing(false);
          setImportProgress(null);
          return;
      }

      await onImport(formatted, options.destination, options);

      // Clear staged assets on success
      setStagedAssets([]);
      toast.success(`Successfully imported ${formatted.length} assets to ${options.destination === 'asset_manager' ? 'Asset Manager' : 'Workbench'}`);
      onClose();
    } catch (e) {
      setErrorMsg(`Import failed: ${e}`);
      setImportProgress(prev => prev ? { ...prev, status: 'failed' } : null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyzeShadowApi = async () => {
    if (!rawSpecContent) return;
    setIsProcessing(true);
    try {
      const report = await invoke('import_openapi_spec_and_detect_shadow_apis', { content: rawSpecContent });
      onAnalyze?.(report, rawSpecContent);
      onClose();
    } catch (e) {
      setErrorMsg(`Analysis failed: ${e}`);
      toast.error(`Shadow API Discovery failed: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelection = (id: string) => {
    setStagedAssets(prev => prev.map(a => a.id === id ? { ...a, selected: !a.selected } : a));
  };

  const toggleRecursive = (id: string) => {
    // If destination is asset_manager, we force recursive to true, so don't allow toggling off
    if (options.destination === 'asset_manager') return;
    setStagedAssets(prev => prev.map(a => a.id === id ? { ...a, recursive: !a.recursive } : a));
  };

  const toggleAllSelection = (selected: boolean) => {
    setStagedAssets(prev => prev.map(a => ({ ...a, selected })));
  };

  const removeAsset = (id: string) => {
    setStagedAssets(prev => prev.filter(a => a.id !== id));
  };

  const removeDuplicates = () => {
    setStagedAssets(prev => prev.filter(a => a.status !== 'duplicate'));
  };

  const removeInvalid = () => {
    setStagedAssets(prev => prev.filter(a => a.status !== 'invalid'));
  };

  const columns: Column<ImportAsset>[] = [
    {
      id: 'selected',
      label: '',
      width: '40px',
      render: (item: ImportAsset) => (
        <input
          type="checkbox"
          checked={item.selected}
          onChange={() => toggleSelection(item.id)}
          style={{ cursor: 'pointer' }}
        />
      )
    },
    {
      id: 'recursive',
      label: 'Rec',
      width: '40px',
      render: (item: ImportAsset) => (
        <input
          type="checkbox"
          checked={options.destination === 'asset_manager' ? true : item.recursive}
          onChange={() => toggleRecursive(item.id)}
          disabled={options.destination === 'asset_manager'}
          title={options.destination === 'asset_manager' ? "Recursive scan is mandatory for Asset Manager" : "Recursive Discovery"}
          style={{ cursor: options.destination === 'asset_manager' ? 'not-allowed' : 'pointer', opacity: options.destination === 'asset_manager' ? 0.7 : 1 }}
        />
      )
    },
    {
      id: 'method',
      label: 'Method',
      sortable: true,
      width: '100px',
      render: (item: ImportAsset) => (
        <span style={{
          padding: '2px 6px', borderRadius: '3px',
          background: item.method === 'GET' ? 'rgba(16, 185, 129, 0.1)' :
            item.method === 'POST' ? 'rgba(59, 130, 246, 0.1)' :
              item.method === 'PUT' ? 'rgba(245, 158, 11, 0.1)' :
                item.method === 'DELETE' ? 'rgba(239, 68, 68, 0.1)' :
                  'rgba(107, 114, 128, 0.1)',
          color: item.method === 'GET' ? 'var(--status-safe)' :
            item.method === 'POST' ? 'var(--accent-color)' :
              item.method === 'PUT' ? 'var(--status-warning)' :
                item.method === 'DELETE' ? 'var(--status-critical)' :
                  'var(--text-secondary)'
        }}>
          {item.method}
        </span>
      )
    },
    {
      id: 'url',
      label: 'URL',
      sortable: true,
      render: (item: ImportAsset) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span title={item.url} style={{
            color: item.status === 'duplicate' ? 'var(--text-secondary)' : 'var(--text-primary)',
            opacity: item.status === 'duplicate' ? 0.6 : 1,
            textDecoration: item.status === 'duplicate' ? 'line-through' : 'none',
            fontFamily: 'monospace', wordBreak: 'break-all'
          }}>
            {stripContent(item.url, 60)}
          </span>
          {item.error && (
            <div style={{ fontSize: '10px', color: 'var(--status-critical)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertCircle size={10} />
              {item.error}
            </div>
          )}
        </div>
      )
    },
    {
      id: 'source',
      label: 'Source',
      sortable: true,
      width: '100px',
      render: (item: ImportAsset) => (
        <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{item.source}</span>
      )
    },
    {
      id: 'status',
      label: 'Status',
      sortable: true,
      width: '80px',
      render: (item: ImportAsset) => (
        <span style={{
          fontSize: '10px',
          padding: '2px 6px',
          borderRadius: '3px',
          background: `${getStatusColor(item.status)}20`,
          color: getStatusColor(item.status)
        }}>
          {item.status || 'pending'}
        </span>
      )
    },
    {
      id: 'actions',
      label: '',
      width: '40px',
      render: (item: ImportAsset) => (
        <button
          onClick={() => removeAsset(item.id)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', opacity: 0.5 }}
          title="Remove"
        >
          <X size={14} />
        </button>
      )
    }
  ];

  // Strip content for cleaner display
  const stripContent = (content: string, maxLength: number = 100): string => {
    if (!content) return '';
    const stripped = content.replace(/\s+/g, ' ').trim();
    if (stripped.length <= maxLength) return stripped;
    return stripped.substring(0, maxLength) + '...';
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  // Get status color
  const getStatusColor = (status?: string): string => {
    switch (status) {
      case 'valid': return 'var(--status-safe)';
      case 'invalid': return 'var(--status-critical)';
      case 'duplicate': return 'var(--status-warning)';
      default: return 'var(--text-secondary)';
    }
  };

  // Count assets by status
  const duplicateCount = stagedAssets.filter(a => a.status === 'duplicate').length;
  const invalidCount = stagedAssets.filter(a => a.status === 'invalid').length;
  const selectedCount = stagedAssets.filter(a => a.selected).length;

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(4px)'
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--bg-primary)', width: '900px', maxHeight: '90vh',
        borderRadius: '12px', border: '1px solid var(--border-color)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--bg-secondary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: 'var(--accent-color)', color: 'white',
              width: '40px', height: '40px', borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <FolderDown size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Asset Import Manager</h2>
                <span style={{ 
                  fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.05em',
                  padding: '2px 6px', borderRadius: '4px', background: 'var(--accent-color)',
                  color: 'white', textTransform: 'uppercase'
                }}>Enterprise Edition</span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                Multi-source parallel processing • {new Set(stagedAssets.map(a => a.source)).size} Sources Active
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-secondary)',
              cursor: 'pointer', padding: '8px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Main Content */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Left Panel: Input Area - CONSOLDATED (NO TABS) */}
          <div style={{
            width: '420px', borderRight: '1px solid var(--border-color)',
            display: 'flex', flexDirection: 'column', background: 'var(--bg-sidebar)',
            padding: '24px', gap: '20px', overflow: 'auto'
          }}>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', position: 'relative',
                minHeight: '350px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Input Data or Drop Files
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ fontSize: '9px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-color)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>JSON</span>
                  <span style={{ fontSize: '9px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-safe)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>CSV/XLSX</span>
                </div>
              </div>

              <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                placeholder="Paste lists of URLs, [METHOD] URL, or raw JSON specs...&#10;Or simply drag & drop your files directly here!"
                style={{
                  flex: 1, width: '100%', background: 'var(--bg-primary)',
                  border: dragActive ? '2px dashed var(--accent-color)' : '1px solid var(--border-color)',
                  borderRadius: '12px', padding: '16px', color: 'var(--text-primary)', resize: 'none',
                  fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', transition: 'all 0.2s',
                  boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.1)',
                  lineHeight: '1.5'
                }}
              />

              {dragActive && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(59, 130, 246, 0.2)', borderRadius: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none', border: '2px dashed var(--accent-color)',
                  backdropFilter: 'blur(4px)', zIndex: 50
                }}>
                  <div style={{ textAlign: 'center', transform: 'scale(1.1)' }}>
                    <div style={{ background: 'var(--accent-color)', padding: '15px', borderRadius: '50%', marginBottom: '16px', display: 'inline-block', boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)' }}>
                      <FolderDown size={40} color="white" />
                    </div>
                    <p style={{ marginTop: '0', fontWeight: '900', fontSize: '18px', color: 'white' }}>Drop Files to Stage</p>
                    <p style={{ marginTop: '4px', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>CSV, JSON, Excel, TXT supported</p>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    flex: 1, padding: '14px', background: 'var(--bg-secondary)', color: 'white',
                    border: '1px solid var(--border-color)', borderRadius: '10px', cursor: 'pointer',
                    fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    fontSize: '12px', transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-primary)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                >
                  <FileIcon size={16} color="var(--accent-color)" /> Import File...
                </button>
                <button
                  onClick={handleTextParse}
                  disabled={!importText.trim()}
                  style={{
                    flex: 1, padding: '14px', background: 'linear-gradient(135deg, var(--accent-color), #4f46e5)', color: 'white',
                    border: 'none', borderRadius: '10px', cursor: 'pointer', opacity: !importText.trim() ? 0.5 : 1,
                    fontWeight: '800', fontSize: '12px', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                  }}
                >Stage Content</button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.csv,.json,.xlsx,.xls"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />
            </div>

            {/* Recent History Section */}
            {importHistory.length > 0 && (
              <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <History size={10} style={{ marginRight: '4px' }} /> Recent Imports
                  </span>
                  <button onClick={handleClearHistory} style={{ background: 'transparent', border: 'none', color: 'var(--status-critical)', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>CLEAR</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflow: 'auto', paddingRight: '4px' }}>
                  {importHistory.slice(0, 3).map((entry, idx) => (
                    <div key={idx} style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 'bold' }}>{entry.source}</span>
                        <span style={{ opacity: 0.5 }}>{formatDate(entry.created_at)}</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        <span style={{ color: 'var(--status-safe)' }}>{entry.successful} staged</span>
                        {entry.failed > 0 && <span style={{ marginLeft: '6px', color: 'var(--status-critical)' }}>{entry.failed} failed</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Staging & Config */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Config Bar */}
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
              {/* Destination Toggle */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>Destination</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                        setOptions(prev => ({ ...prev, destination: 'asset_manager', recursive: true }));
                        setStagedAssets(prev => prev.map(a => ({ ...a, recursive: true })));
                    }}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center',
                      background: options.destination === 'asset_manager' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                      border: `1px solid ${options.destination === 'asset_manager' ? 'var(--accent-color)' : 'var(--border-color)'}`,
                      color: options.destination === 'asset_manager' ? 'var(--accent-color)' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    <DbIcon size={14} /> Asset Manager
                  </button>
                  <button
                    onClick={() => {
                         setOptions(prev => ({ ...prev, destination: 'workbench', recursive: false }));
                         setStagedAssets(prev => prev.map(a => ({ ...a, recursive: false })));
                    }}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center',
                      background: options.destination === 'workbench' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                      border: `1px solid ${options.destination === 'workbench' ? 'var(--accent-color)' : 'var(--border-color)'}`,
                      color: options.destination === 'workbench' ? 'var(--accent-color)' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    <Terminal size={14} /> Workbench Session
                  </button>
                </div>
              </div>

              {/* Advanced Options (Always Visible) */}
              <div style={{ padding: '0 4px' }}>
                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: 'bold' }}>
                  Configuration Settings
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="skipDupes"
                      checked={options.skipDuplicates}
                      onChange={e => setOptions(prev => ({ ...prev, skipDuplicates: e.target.checked }))}
                    />
                    <label htmlFor="skipDupes" style={{ fontSize: '11px', color: 'var(--text-primary)' }}>Skip Duplicates</label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="validateUrls"
                      checked={options.validateUrls}
                      onChange={e => setOptions(prev => ({ ...prev, validateUrls: e.target.checked }))}
                    />
                    <label htmlFor="validateUrls" style={{ fontSize: '11px', color: 'var(--text-primary)' }}>Validate Assets</label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="recursiveGlobal"
                      checked={options.destination === 'asset_manager' ? true : options.recursive}
                      onChange={e => {
                        const val = e.target.checked;
                        setOptions(prev => ({ ...prev, recursive: val }));
                        // Also update all currently staged assets if user toggles global
                        setStagedAssets(prev => prev.map(a => ({ ...a, recursive: val })));
                      }}
                      disabled={options.destination === 'asset_manager'}
                      style={{ cursor: options.destination === 'asset_manager' ? 'not-allowed' : 'pointer', opacity: options.destination === 'asset_manager' ? 0.7 : 1 }}
                    />
                    <label htmlFor="recursiveGlobal" style={{ fontSize: '11px', color: 'var(--accent-color)', fontWeight: 'bold' }}>
                      {options.destination === 'asset_manager' ? 'Recursive (Forced)' : 'Recursive Search'}
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Table Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
              {stagedAssets.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                  <Upload size={48} style={{ marginBottom: '16px' }} />
                  <p>No assets staged for import</p>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
                      <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>{selectedCount} Selected</span>
                      {duplicateCount > 0 && <span style={{ color: 'var(--status-warning)' }}>{duplicateCount} Duplicates</span>}
                      {invalidCount > 0 && <span style={{ color: 'var(--status-critical)' }}>{invalidCount} Invalid</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {duplicateCount > 0 && <button onClick={removeDuplicates} style={{ background: 'transparent', border: 'none', color: 'var(--status-warning)', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold' }}>CLEAR DUPES</button>}
                      {invalidCount > 0 && <button onClick={removeInvalid} style={{ background: 'transparent', border: 'none', color: 'var(--status-critical)', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold' }}>CLEAR INVALID</button>}
                      <button onClick={() => toggleAllSelection(true)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-color)', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold' }}>SELECT ALL</button>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <SmartTable<ImportAsset>
                      data={stagedAssets}
                      columns={columns}
                      idField="id"
                    />
                  </div>
                </div>
              )}

              {/* Import Progress Overlay */}
              {importProgress && importProgress.status !== 'completed' && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', padding: '40px'
                }}>
                  <div style={{ width: '100%', maxWidth: '400px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                      <span>{importProgress.status === 'validating' ? 'Validating Assets...' : 'Importing...'}</span>
                      <span>{Math.round(importProgress.percentage)}%</span>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
                      <div style={{ width: `${importProgress.percentage}%`, height: '100%', background: 'var(--accent-color)', transition: 'width 0.3s ease' }} />
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      Processed {importProgress.current} of {importProgress.total} assets
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div style={{
              padding: '16px 24px', borderTop: '1px solid var(--border-color)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--bg-secondary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isOpenApiSpec && (
                  <button
                    onClick={handleAnalyzeShadowApi}
                    style={{
                      padding: '10px 20px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-safe)',
                      border: '1px solid var(--status-safe)', borderRadius: '8px', cursor: 'pointer',
                      fontWeight: '800', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                  >
                    <ShieldAlert size={16} /> Run Shadow API Discovery
                  </button>
                )}
                {errorMsg && (
                  <div style={{ color: 'var(--status-critical)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} /> {errorMsg}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: '10px 24px', background: 'transparent', color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer',
                    fontWeight: '700', fontSize: '13px'
                  }}
                >Cancel</button>
                <button
                  onClick={handleImportConfirm}
                  disabled={selectedCount === 0 || isProcessing}
                  style={{
                    padding: '10px 32px', background: 'var(--accent-color)', color: 'white',
                    border: 'none', borderRadius: '8px', cursor: 'pointer',
                    fontWeight: '900', fontSize: '14px', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    opacity: (selectedCount === 0 || isProcessing) ? 0.5 : 1
                  }}
                >
                  {isProcessing ? <Loader2 size={18} className="spin" /> : <FileIcon size={18} />}
                  Import {selectedCount} Assets
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
