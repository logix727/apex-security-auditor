import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { FolderDown, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { 
  ImportOptions, 
  ImportProgress, 
  ImportDestination
} from '../types';

import { useImportProcessor } from '../hooks/useImportProcessor';
import { useImportHistory } from '../hooks/useImportHistory';

import { FileDropZone } from './import/FileDropZone';
import { StagedAssetsTable } from './import/StagedAssetsTable';
import { ImportSettings } from './import/ImportSettings';
import { ImportHistoryPanel } from './import/ImportHistoryPanel';
import { ImportProgressOverlay } from './import/ImportProgressOverlay';

interface ImportManagerProps {
  isOpen: boolean;
  initialFiles?: File[] | null;
  onClose: () => void;
  onImport: (assets: { url: string; method: string; recursive: boolean; source: string }[], destination: ImportDestination, options: ImportOptions) => Promise<void>;
  onAnalyze?: (report: any, content: string) => void;
  existingUrls: Set<string>;
}

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
  const [options, setOptions] = useState<ImportOptions>(DEFAULT_OPTIONS);
  const [importText, setImportText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  const {
    stagedAssets,
    setStagedAssets,
    isProcessing,
    errorMsg,
    setErrorMsg,
    isOpenApiSpec,
    rawSpecContent,
    processFiles,
    parseContent
  } = useImportProcessor(options, existingUrls);

  const {
    importHistory,
    isLoading: historyLoading,
    loadImportHistory,
    clearHistory
  } = useImportHistory();

  // Listen for background import events
  useEffect(() => {
    let unlistenProgress: UnlistenFn | null = null;
    let unlistenComplete: UnlistenFn | null = null;

    const setupListeners = async () => {
      unlistenProgress = await listen<ImportProgress>('import-progress', (event) => {
        setImportProgress(event.payload);
      });

      unlistenComplete = await listen<any>('import-complete', () => {
        setImportProgress(prev => prev ? { ...prev, status: 'completed', percentage: 100 } : null);
        loadImportHistory();
      });
    };

    setupListeners();
    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenComplete) unlistenComplete();
    };
  }, [loadImportHistory]);

  // Handle initialization
  useEffect(() => {
    if (isOpen) {
      setStagedAssets([]);
      setImportText('');
      setErrorMsg(null);
      setImportProgress(null);
      setOptions(DEFAULT_OPTIONS);
      loadImportHistory();

      if (initialFiles && initialFiles.length > 0) {
        processFiles(initialFiles);
      }
    }
  }, [isOpen, initialFiles, setStagedAssets, setErrorMsg, loadImportHistory, processFiles]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    } else {
      const text = e.dataTransfer.getData('text/plain');
      if (text) {
        const assets = await parseContent(text, 'text', 'Dropped Text');
        setStagedAssets(prev => [...prev, ...assets]);
      }
    }
  }, [processFiles, parseContent, setStagedAssets]);

  const validateUrls = async () => {
    const selected = stagedAssets.filter(a => a.selected && a.status !== 'duplicate');
    if (selected.length === 0) return true;

    try {
      const urls = selected.map(a => a.url);
      const results = await invoke<{ url: string; is_valid: boolean; message: string }[]>('validate_urls', { urls });

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
      return true;
    }
  };

  const handleImportConfirm = async () => {
    const selected = stagedAssets.filter(a => a.selected);
    if (selected.length === 0) return;

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
      if (options.validateUrls) {
        const valid = await validateUrls();
        if (!valid) {
          setErrorMsg('Some URLs are invalid. Please review and fix errors.');
          setImportProgress(null);
          return;
        }
      }

      const formatted = selected
        .filter(a => a.status !== 'invalid')
        .map(a => ({ 
          url: a.url, 
          method: a.method, 
          recursive: options.destination === 'asset_manager' ? true : a.recursive,
          source: a.source || 'Import'
        }));

      if (formatted.length === 0) {
        setErrorMsg('No valid assets to import.');
        setImportProgress(null);
        return;
      }

      await onImport(formatted, options.destination, options);
      setStagedAssets([]);
      toast.success(`Imported ${formatted.length} assets`);
      onClose();
    } catch (e) {
      setErrorMsg(`Import failed: ${e}`);
      setImportProgress(prev => prev ? { ...prev, status: 'failed' } : null);
    }
  };

  const handleAnalyzeShadowApi = async () => {
    if (!rawSpecContent) return;
    try {
      const report = await invoke('import_openapi_spec_and_detect_shadow_apis', { content: rawSpecContent });
      onAnalyze?.(report, rawSpecContent);
      onClose();
    } catch (e) {
      setErrorMsg(`Analysis failed: ${e}`);
      toast.error(`Analysis failed: ${e}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(4px)'
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      
      <div style={{
        background: 'var(--bg-primary)', width: '960px', height: '80vh',
        borderRadius: '16px', border: '1px solid var(--border-color)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', 
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)', position: 'relative'
      }}>
        
        {/* Progress Overlay */}
        {importProgress && (
          <ImportProgressOverlay 
            progress={importProgress} 
            onClose={() => setImportProgress(null)} 
          />
        )}

        {/* Header */}
        <div style={{
          padding: '24px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--bg-secondary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              background: 'var(--accent-color)', color: 'white',
              width: '48px', height: '48px', borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.3)'
            }}>
              <FolderDown size={28} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Asset Import Manager</h2>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                Multi-source parallel processing • Secure validation active
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-primary)', border: '1px solid var(--border-color)', 
              color: 'var(--text-secondary)', cursor: 'pointer', padding: '10px', 
              borderRadius: '10px', display: 'flex', alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Main Layout */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          
          {/* Left Panel: Input & Config */}
          <div style={{
            width: '380px', borderRight: '1px solid var(--border-color)',
            display: 'flex', flexDirection: 'column', background: 'var(--bg-sidebar)',
            padding: '24px', gap: '24px', overflowY: 'auto'
          }}>
            
            <FileDropZone 
              onFilesSelected={processFiles}
              onTextImport={async (text) => {
                const assets = await parseContent(text, 'text', 'Paste');
                setStagedAssets(prev => [...prev, ...assets]);
                setImportText('');
              }}
              isProcessing={isProcessing}
              dragActive={dragActive}
              onDrag={handleDrag}
              onDrop={handleDrop}
              importText={importText}
              setImportText={setImportText}
            />

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-dim)' }} />

            <ImportSettings 
              options={options}
              setOptions={setOptions}
            />

            <ImportHistoryPanel 
              history={importHistory}
              isLoading={historyLoading}
              onClear={clearHistory}
              onClose={() => {}} // Not needed in this layout
            />
          </div>

          {/* Right Panel: Staged Content */}
          <div style={{ 
            flex: 1, display: 'flex', flexDirection: 'column', 
            padding: '24px', gap: '20px', minHeight: 0, background: 'var(--bg-primary)' 
          }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Staged Assets</h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {stagedAssets.length} items ready for import
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setStagedAssets([])}
                  disabled={stagedAssets.length === 0}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: stagedAssets.length === 0 ? 0.5 : 1
                  }}
                >
                  Clear All
                </button>
                {stagedAssets.some(a => a.status === 'duplicate') && (
                  <button
                    onClick={() => setStagedAssets(prev => prev.filter(a => a.status !== 'duplicate'))}
                    style={{
                      padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)',
                      background: 'rgba(245, 158, 11, 0.1)', color: 'var(--status-warning)',
                      fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    CLEAR DUPES
                  </button>
                )}
                {isOpenApiSpec && (
                  <button
                    onClick={handleAnalyzeShadowApi}
                    style={{
                      padding: '8px 16px', borderRadius: '8px', border: 'none',
                      background: 'var(--status-safe)', color: 'white',
                      fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    Analyze Shadow APIs
                  </button>
                )}
                <button
                  onClick={handleImportConfirm}
                  disabled={stagedAssets.filter(a => a.selected).length === 0}
                  style={{
                    padding: '8px 20px', borderRadius: '8px', border: 'none',
                    background: 'var(--accent-color)', color: 'white',
                    fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.3)',
                    opacity: stagedAssets.filter(a => a.selected).length === 0 ? 0.5 : 1
                  }}
                >
                  Confirm Import ({stagedAssets.filter(a => a.selected).length})
                </button>
              </div>
            </div>

            {errorMsg && (
              <div style={{
                padding: '12px', background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: '8px', border: '1px solid var(--status-critical)',
                color: 'var(--status-critical)', fontSize: '12px', display: 'flex',
                alignItems: 'center', gap: '10px'
              }}>
                <AlertCircle size={18} /> {errorMsg}
              </div>
            )}

            <StagedAssetsTable 
              assets={stagedAssets}
              options={options}
              onToggleSelection={(id) => setStagedAssets(prev => prev.map(a => a.id === id ? { ...a, selected: !a.selected } : a))}
              onToggleRecursive={(id) => setStagedAssets(prev => prev.map(a => a.id === id ? { ...a, recursive: !a.recursive } : a))}
              onRemove={(id) => setStagedAssets(prev => prev.filter(a => a.id !== id))}
              onToggleAll={(selected) => setStagedAssets(prev => prev.map(a => ({ ...a, selected })))}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
