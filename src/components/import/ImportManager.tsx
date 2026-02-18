import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { FolderDown, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { 
  ImportOptions, 
  ImportProgress, 
  ImportDestination
} from '../../types';

import { useImportProcessor } from '../../hooks/useImportProcessor';

import { FileDropZone } from './FileDropZone';
import { TextInputArea } from './TextInputArea';
import { StagedAssetsTable } from './StagedAssetsTable';
import { ImportSettings } from './ImportSettings';
import { ImportProgressOverlay } from './ImportProgressOverlay';

interface ImportManagerProps {
  isOpen: boolean;
  initialFiles?: File[] | null;
  onClose: () => void;
  onImport: (assets: { url: string; method: string; recursive: boolean; source: string }[], destination: ImportDestination, options: ImportOptions) => Promise<void>;
  onAnalyze?: (report: any, content: string) => void;
  existingUrls: Set<string>;
}

const DEFAULT_OPTIONS: ImportOptions = {
  destination: 'workbench',
  recursive: false,
  batchMode: true,
  batchSize: 5,
  rateLimit: 100,
  skipDuplicates: true,
  validateUrls: true, // Always on
  autoTriage: false,
};

export const ImportManager: React.FC<ImportManagerProps> = ({
  isOpen,
  initialFiles,
  onClose,
  onImport,
  onAnalyze: _onAnalyze,
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
    processFiles,
    parseContent
  } = useImportProcessor(options, existingUrls);

  const [lastClickedId, setLastClickedId] = useState<string | null>(null);

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
      });
    };

    setupListeners();
    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenComplete) unlistenComplete();
    };
  }, []);

  // Auto-Speed Logic
  useEffect(() => {
    if (stagedAssets.length > 0) {
      if (stagedAssets.length < 5) {
        setOptions(prev => ({ ...prev, rateLimit: 0, batchSize: 20 })); // Turbo for small batches
      } else if (stagedAssets.length < 50) {
        setOptions(prev => ({ ...prev, rateLimit: 100, batchSize: 5 })); // Balanced
      } else {
        setOptions(prev => ({ ...prev, rateLimit: 1000, batchSize: 1 })); // Stealth for huge imports
      }
    }
  }, [stagedAssets.length]);

  // Handle initialization
  useEffect(() => {
    if (isOpen) {
      if (stagedAssets.length === 0) {
        setImportText('');
        setErrorMsg(null);
        setImportProgress(null);
        setLastClickedId(null);
        // Only reset options if we don't have items to avoid state loss while working
        setOptions(DEFAULT_OPTIONS);
      }

      if (initialFiles && initialFiles.length > 0) {
        processFiles(initialFiles);
      }
    }
  }, [isOpen, initialFiles, setStagedAssets, setErrorMsg, processFiles]);

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
        setImportText(text);
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
          recursive: a.recursive,
          source: a.source || 'User'
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

  const handleToggleSelection = useCallback((id: string) => {
    setStagedAssets(prev => prev.map(a => a.id === id ? { ...a, selected: !a.selected } : a));
    setLastClickedId(id);
  }, [setStagedAssets]);

  const handleRowMouseDown = useCallback((id: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    
    setStagedAssets(prev => {
      let nextSelection = [...prev];
      const targetIdx = nextSelection.findIndex(a => a.id === id);
      
      if (e.shiftKey && lastClickedId !== null) {
        const lastIdx = nextSelection.findIndex(a => a.id === lastClickedId);
        if (lastIdx !== -1 && targetIdx !== -1) {
          const start = Math.min(lastIdx, targetIdx);
          const end = Math.max(lastIdx, targetIdx);
          
          // Clear if no ctrl/meta
          const clearOther = !e.ctrlKey && !e.metaKey;
          
          return nextSelection.map((asset, idx) => {
            if (idx >= start && idx <= end) {
              return { ...asset, selected: true };
            }
            return clearOther ? { ...asset, selected: false } : asset;
          });
        }
      } else if (e.ctrlKey || e.metaKey) {
        return nextSelection.map(a => a.id === id ? { ...a, selected: !a.selected } : a);
      } else {
        // Normal click toggles this one (better for review lists)
        return nextSelection.map(a => a.id === id ? { ...a, selected: !a.selected } : a);
      }
      return nextSelection;
    });
    
    setLastClickedId(id);
  }, [lastClickedId, setStagedAssets]);

  const handleToggleRecursive = useCallback((id: string) => {
    setStagedAssets(prev => prev.map(a => a.id === id ? { ...a, recursive: !a.recursive } : a));
  }, [setStagedAssets]);

  const handleRemove = useCallback((id: string) => {
    setStagedAssets(prev => prev.filter(a => a.id !== id));
  }, [setStagedAssets]);

  const handleToggleAll = useCallback((selected: boolean) => {
    setStagedAssets(prev => prev.map(a => ({ ...a, selected })));
  }, [setStagedAssets]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(20px)', padding: '40px'
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      
      <div style={{
        background: 'var(--bg-primary)', width: '100%', maxWidth: '1440px', height: '100%',
        borderRadius: '32px', border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', 
        boxShadow: '0 48px 96px -12px rgba(0,0,0,0.9)', position: 'relative'
      }}>
        
        {/* Progress Overlay */}
        {importProgress && (
          <ImportProgressOverlay 
            progress={importProgress} 
            onClose={() => setImportProgress(null)} 
          />
        )}

        {/* Header Bar */}
        <div style={{
          padding: '24px 40px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(255,255,255,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                background: 'linear-gradient(135deg, var(--accent-color) 0%, #7c3aed 100%)', 
                color: 'white', width: '36px', height: '36px', borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <FolderDown size={20} />
              </div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900, letterSpacing: '-0.3px' }}>Import Assets</h2>
            </div>

            <ImportSettings options={options} setOptions={setOptions} />
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)', border: 'none', 
              color: 'var(--text-tertiary)', cursor: 'pointer', padding: '8px', 
              borderRadius: '8px', transition: 'all 0.2s', display: 'flex', alignItems: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 2-Column Main Area */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, padding: '32px', gap: '32px' }}>
          
          {/* Column 1: Ingestion */}
          <div style={{ width: '420px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
               <h3 style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                 Ingestion Methods
               </h3>
               <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-tertiary)' }}>Drag files or paste URLs to stage for import</p>
             </div>

             <div style={{ height: '320px' }}>
                <FileDropZone 
                  onFilesSelected={processFiles}
                  isProcessing={isProcessing}
                  dragActive={dragActive}
                  onDrag={handleDrag}
                  onDrop={handleDrop}
                />
             </div>

             <div style={{ flex: 1, minHeight: 0 }}>
                <TextInputArea 
                  value={importText}
                  onChange={setImportText}
                  onProcess={async () => {
                    const assets = await parseContent(importText, 'text', 'Paste');
                    setStagedAssets(prev => [...prev, ...assets]);
                    setImportText('');
                    toast.success(`Staged ${assets.length} items from paste`);
                  }}
                  isProcessing={isProcessing}
                />
             </div>
          </div>

          {/* Column 2: Review & Actions */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', minHeight: 0 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Staged Assets {stagedAssets.length > 0 && `(${stagedAssets.length})`}
                    </h3>
                     {stagedAssets.length > 0 && (
                       <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => handleToggleAll(true)}
                            style={{ background: 'none', border: 'none', color: 'var(--accent-color)', fontSize: '10px', fontWeight: 800, cursor: 'pointer', opacity: 0.7, textTransform: 'uppercase' }}
                          >
                            Select All
                          </button>
                          <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>|</span>
                          <button 
                            onClick={() => setStagedAssets([])}
                            style={{ background: 'none', border: 'none', color: 'var(--status-critical)', fontSize: '10px', fontWeight: 800, cursor: 'pointer', opacity: 0.7, textTransform: 'uppercase' }}
                          >
                            Clear All
                          </button>
                       </div>
                     )}
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={handleImportConfirm}
                    disabled={stagedAssets.filter(a => a.selected).length === 0}
                    style={{
                      padding: '10px 28px', borderRadius: '12px', border: 'none',
                      background: 'var(--accent-color)', color: 'white',
                      fontSize: '12px', fontWeight: 800, cursor: 'pointer',
                      boxShadow: '0 8px 24px -4px rgba(var(--accent-rgb), 0.4)',
                      opacity: stagedAssets.filter(a => a.selected).length === 0 ? 0.3 : 1,
                      transition: 'all 0.2s',
                      transform: stagedAssets.filter(a => a.selected).length > 0 ? 'scale(1.02)' : 'none'
                    }}
                  >
                    Confirm Import
                  </button>
                </div>
             </div>

             <div style={{ 
               flex: 1, background: 'rgba(255,255,255,0.01)', borderRadius: '24px', 
               border: '1px solid var(--border-color)', overflow: 'hidden',
               display: 'flex', flexDirection: 'column'
             }}>
                <StagedAssetsTable 
                  assets={stagedAssets}
                  onToggleSelection={handleToggleSelection}
                  onRowMouseDown={handleRowMouseDown}
                  onToggleRecursive={handleToggleRecursive}
                  onRemove={handleRemove}
                  onToggleAll={handleToggleAll}
                />
             </div>

             {errorMsg && (
                <div style={{ padding: '16px 24px', background: 'rgba(var(--status-critical-rgb), 0.05)', borderRadius: '16px', border: '1px solid rgba(var(--status-critical-rgb), 0.1)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                   <AlertCircle size={18} style={{ color: 'var(--status-critical)' }} />
                   <span style={{ fontSize: '12px', color: 'var(--status-critical)', fontWeight: 600 }}>{errorMsg}</span>
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};


