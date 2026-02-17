
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigation } from '../context/NavigationContext';
import { useAnalysis } from '../context/AnalysisContext';
import { Header } from './layout/Header';
import { Sidebar } from './layout/Sidebar';
import { DashboardView } from './dashboard/DashboardView';
import { WorkbenchView } from './workbench/WorkbenchView';
import { AssetsView } from './assets/AssetsView';
import { SurfaceView } from './surface/SurfaceView';
import { DiscoveryView } from './discovery/DiscoveryView';
import { SettingsView } from './Settings';
import { Inspector } from './Inspector';
import { ImportManager } from './ImportManager';
import { SmartFilterCommandBar } from './summary/SmartFilterCommandBar';
import { SequenceAnalysisModal } from './modals/SequenceAnalysisModal';
import { ShadowApiReport } from './assets/ShadowApiReport';
import { DebugConsole, useDebugLogger } from './DebugConsole';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { 
    Asset, 
    TreeNode, 
    ImportOptions, 
    ImportDestination, 
    ImportProgress,
    ImportQueueItem
} from '../types';
import { getDetectionBadges, getSourceIcon, getStatusBadge } from '../utils/assetUtils';
import { Activity, Folder as FolderIcon } from 'lucide-react';

export const AppContent: React.FC = () => {
    const { 
        activeView, setActiveView, 
        assetSidebarView, setAssetSidebarView,
        inspectorWidth, setInspectorWidth,
        activeInspectorTab, setActiveInspectorTab,
        isDebugConsoleOpen, setIsDebugConsoleOpen
    } = useNavigation();

    const {
        assets, setAssets, 
        folders, loadFolders, loadAssets, refreshData,
        activeFolderId, setActiveFolderId,
        selectedIds, setSelectedIds,
        lastClickedId, setLastClickedId,
        selectedTreePath, setSelectedTreePath,
        workbenchIds, setWorkbenchIds,
        contextMenu, setContextMenu,
        handleAssetMouseDown, handleContextMenu,
        workbenchFilterAdapter,
        filterMethod, setFilterMethod,
        filterStatus, setFilterStatus,
        searchTerm, setSearchTerm,
        filteredAssets, handleSort, sortConfig,
        bodySearchTerm, setBodySearchTerm
    } = useApp();

    const {
        smartFilter, setSmartFilter,
        showCommandBar, setShowCommandBar,
        commandQuery, setCommandQuery,
        isSequenceModalOpen, setIsSequenceModalOpen,
        sequenceAnalysis, 
        isAnalyzingSequence,
        sequenceFlowName, setSequenceFlowName,
        proxyRunning, handleToggleProxy,
        activeShadowApiReport, setActiveShadowApiReport,
        lastSpecContent, setLastSpecContent,
        handleAnalyzeFlow
    } = useAnalysis();

    // Import State
    const [isImportManagerOpen, setIsImportManagerOpen] = useState(false);
    const [droppedFiles, setDroppedFiles] = useState<File[] | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [_dragCounter, setDragCounter] = useState(0);
    const [, setImportQueue] = useState<ImportQueueItem[]>([]);
    const [, setActiveImportProgress] = useState<ImportProgress | null>(null);
    const { info, error, success } = useDebugLogger();

    // Domain Tree Construction
    const domainTree = useMemo(() => {
        const root: { [key: string]: TreeNode } = {};
        assets.forEach(asset => {
          try {
            const url = new URL(asset.url);
            const host = url.hostname || asset.url.split('/')[2] || asset.url;
            const paths = url.pathname.split('/').filter(p => p);
            if (!root[host]) {
              root[host] = { name: host, path: host, children: {}, assetIds: [] };
            }
            let current = root[host];
            current.assetIds.push(asset.id);
            let currentPath = host;
            paths.forEach(p => {
              currentPath += '/' + p;
              if (!current.children[p]) {
                current.children[p] = { name: '/' + p, path: currentPath, children: {}, assetIds: [] };
              }
              current = current.children[p];
              current.assetIds.push(asset.id);
            });
          } catch (e) {
              const host = asset.url.split('/')[2] || asset.url;
              if (!root[host]) root[host] = { name: host, path: host, children: {}, assetIds: [] };
              root[host].assetIds.push(asset.id);
          }
        });
        return root;
      }, [assets]);

    // Handlers
    const handleAddFolder = async (parentId: number | null = null) => {
        const name = prompt("New Folder Name:");
        if (name) {
            await invoke('add_folder', { name, parent_id: parentId });
            loadFolders();
        }
    };

    const handleMoveToFolder = async (folderId: number, ids?: number[]) => {
        const idsToMove = ids || Array.from(selectedIds);
        if (idsToMove.length === 0) return;
        
        await invoke('move_assets_to_folder', { ids: idsToMove, folderId });
        loadAssets();
    };

    const handlePurgeRecursive = async () => {
        if (confirm("Purge all out-of-scope recursive discoveries? This will remove domains that were not manually imported.")) {
            try {
                const count = await invoke<number>('purge_recursive_assets');
                success('db', `Successfully purged ${count} out-of-scope assets.`);
                await loadAssets();
            } catch (e) {
                error('db', `Purge failed: ${e}`);
            }
        }
    };

    const handleAddToWorkbench = async (id?: number) => {
        const ids = id ? [id] : Array.from(selectedIds);
        if (ids.length === 0) return;
        
        for (const assetId of ids) {
            await invoke('update_asset_source', { id: assetId, source: 'Workbench' });
        }
        // Optimistic update
        setAssets(prev => prev.map(a => ids.includes(a.id) ? { ...a, source: 'Workbench' } : a));
        setWorkbenchIds(prev => {
            const next = new Set(prev);
            ids.forEach(i => next.add(i));
            return next;
        });
        success('workbench', `Added ${ids.length} to Workbench session`);
    };

    const handlePromoteToAssetManager = async (id?: number) => {
        const ids = id ? [id] : Array.from(selectedIds);
        if (ids.length === 0) return;
        
        for (const assetId of ids) {
            await invoke('update_asset_source', { id: assetId, source: 'User' });
        }
        setAssets(prev => prev.map(a => ids.includes(a.id) ? { ...a, source: 'User' } : a));
        setWorkbenchIds(prev => {
            const next = new Set(prev);
            ids.forEach(i => next.delete(i));
            return next;
        });
        success('db', `Sent ${ids.length} asset(s) to Asset Manager`);
    };

    const handleRescan = async (id?: number) => {
        const idsToRescan = id ? [id] : (selectedIds.size > 0 ? Array.from(selectedIds) : (lastClickedId ? [lastClickedId] : []));
        info('scanner', `Starting rescan of ${idsToRescan.length} assets`);
        for (const rescanId of idsToRescan) {
            try {
                await invoke('rescan_asset', { id: rescanId });
                success('scanner', `Successfully initiated rescan for asset ${rescanId}`);
            } catch (e) {
                error('scanner', `Failed to rescan asset ${rescanId}: ${e}`);
            }
        }
    };

    const handleImportMissing = async () => {
        if (!lastSpecContent) return;
        try {
            const count = await invoke<number>('import_missing_endpoints', { content: lastSpecContent });
            success('import', `Successfully imported ${count} missing endpoints from spec.`);
            setActiveShadowApiReport(null);
            await loadAssets();
        } catch (e) {
            error('import', `Failed to import missing endpoints: ${e}`);
        }
    };

    const handleClearDocStatus = async () => {
        try {
            await invoke('clear_documentation_status');
            success('system', `Documentation status cleared for all assets.`);
            setActiveShadowApiReport(null);
            await loadAssets();
        } catch (e) {
            error('system', `Failed to clear documentation status: ${e}`);
        }
    };

    const handleResetDb = async () => {
        if (confirm("Permanently delete ALL assets? This cannot be undone.")) {
            await invoke('clear_database');
            loadAssets();
        }
    };

    const handleImport = async (assetsToImport: { url: string; method: string; recursive: boolean; source: string }[], destination: ImportDestination, options: ImportOptions) => {
          const globalSource = destination === 'workbench' ? 'Workbench' : 'Import';
          if (assetsToImport.length === 0) {
              info('import', "No assets were selected for import.");
              return;
          }
    
          const batchSize = options.batchMode ? (options.batchSize || 5) : assetsToImport.length;
          const rateLimitMs = options.batchMode ? (options.rateLimitMs || 100) : 0;
          const totalAssets = assetsToImport.length;
          
          info('import', `Starting structured import of ${totalAssets} assets to ${destination}. Batch: ${batchSize}, Rate: ${rateLimitMs}ms`);
          
          let allNewIds: number[] = [];
          
          try {
            for (let i = 0; i < totalAssets; i += batchSize) {
                const batch = assetsToImport.slice(i, i + batchSize);
                const batchNum = Math.floor(i / batchSize) + 1;
                const totalBatches = Math.ceil(totalAssets / batchSize);
                
                if (totalBatches > 1) {
                    info('import', `Importing batch ${batchNum}/${totalBatches} (${batch.length} assets)...`);
                }
    
                const newIds = await invoke<number[]>('import_staged_assets', {
                  assets: batch,
                  source: globalSource
                });
                
                allNewIds = [...allNewIds, ...newIds];
    
                if (i + batchSize < totalAssets && rateLimitMs > 0) {
                    await new Promise(resolve => setTimeout(resolve, rateLimitMs));
                }
            }
            
            if (allNewIds.length === 0) {
                info('import', `Backend returned 0 imported assets.`);
            }
    
            if (destination === 'workbench') {
                setWorkbenchIds(prev => {
                    const next = new Set(prev);
                    allNewIds.forEach(id => next.add(id));
                    return next;
                });
                setActiveView('workbench');
                setSearchTerm('');
                setFilterMethod('All');
                setFilterStatus('All');
                
                success('workbench', `Added ${allNewIds.length} assets to Workbench session.`);
            } else {
                 setActiveView('assets');
                 setActiveFolderId(1);
                 setSearchTerm('');
                 setFilterMethod('All');
                 setFilterStatus('All');
                 setSelectedTreePath(null);
                 success('import', `Successfully imported ${allNewIds.length} assets.`);
            }
          } catch (e) {
            error('import', `Structured import failed: ${e}`);
          }
          await loadAssets();
    };

    // Drag and Drop Effects
    useEffect(() => {
        const handleDragEnter = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setDragCounter(prev => prev + 1);
            if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.indexOf('Files') !== -1) {
                setDragActive(true);
            }
        };

        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setDragCounter(prev => {
                const newCounter = prev - 1;
                if (newCounter === 0) {
                    setDragActive(false);
                }
                return newCounter;
            });
        };

        const handleDragOver = (e: DragEvent) => { 
            e.preventDefault(); 
            e.stopPropagation(); 
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
        };

        const handleDrop = async (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
            setDragCounter(0);
            
            if (e.dataTransfer?.files?.length) {
                const files = Array.from(e.dataTransfer.files);
                setDroppedFiles(files);
                setIsImportManagerOpen(true);
            }
        };

        document.body.addEventListener('dragenter', handleDragEnter);
        document.body.addEventListener('dragleave', handleDragLeave);
        document.body.addEventListener('dragover', handleDragOver);
        document.body.addEventListener('drop', handleDrop);
        
        return () => {
            document.body.removeEventListener('dragenter', handleDragEnter);
            document.body.removeEventListener('dragleave', handleDragLeave);
            document.body.removeEventListener('dragover', handleDragOver);
            document.body.removeEventListener('drop', handleDrop);
        };
    }, []);

    // Listeners
    useEffect(() => {
         let cleanup: (() => void)[] = [];
         // Add listeners for import progress, scan update, etc.
         // (Simplified for now, similar to App.tsx)
         const setupListeners = async () => {
             const u1 = await listen<ImportProgress>('import-progress', (event) => {
                 setActiveImportProgress(event.payload);
             });
             cleanup.push(() => u1());
             
             // Add other listeners as needed
         };
         setupListeners();
         return () => cleanup.forEach(f => f());
    }, []);


    // Resizing Logic
    const isResizing = useRef(false);
    const startResizing = () => { isResizing.current = true; document.body.style.cursor = 'col-resize'; };
    const stopResizing = () => { isResizing.current = false; document.body.style.cursor = 'default'; };
    const resize = useCallback((e: MouseEvent) => {
        if (!isResizing.current) return;
        const newWidth = window.innerWidth - e.clientX;
        const minWidth = 300;
        const maxWidth = 800;
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            setInspectorWidth(newWidth);
        }
    }, [setInspectorWidth]);

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize]);


    const handleExport = async (format: 'markdown' | 'csv') => {
        try {
            const command = format === 'markdown' ? 'generate_audit_report' : 'export_to_csv_final_v5';
            const result = await invoke<string>(command);
            const blob = new Blob([result], { type: format === 'markdown' ? 'text/markdown' : 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `APEX_Export_${new Date().toLocaleDateString()}.${format === 'markdown' ? 'md' : 'csv'}`;
            a.click();
            success('export', `Exported as ${format}`);
        } catch(e) {
            error('export', `Export failed: ${e}`);
        }
    };
    
    // View Rendering
    const renderContent = () => {
        switch (activeView) {
            case 'dashboard':
                return <DashboardView 
                    assets={assets} 
                    folders={folders} 
                    setActiveView={setActiveView} 
                />;
            case 'workbench':
                return <WorkbenchView 
                    assets={assets} 
                    workbenchIds={workbenchIds} 
                    setWorkbenchIds={setWorkbenchIds}
                    selectedIds={selectedIds}
                    handleAssetMouseDown={handleAssetMouseDown}
                    handleContextMenu={handleContextMenu}
                    workbenchSort={{ sortConfig, handleSort }}
                    workbenchFilter={workbenchFilterAdapter}
                    onPromoteToAssetManager={handlePromoteToAssetManager}
                    onExportMarkdown={() => handleExport('markdown')}
                    onExportCsv={() => handleExport('csv')}
                    onSelectionChange={setSelectedIds}
                    smartFilter={smartFilter}
                    setSmartFilter={setSmartFilter}
                    proxyRunning={proxyRunning}
                    onToggleProxy={handleToggleProxy}
                />;
            case 'assets':
                return <AssetsView 
                    processedAssets={filteredAssets}
                    folders={folders}
                    activeFolderId={activeFolderId}
                    setActiveFolderId={setActiveFolderId}
                    assetSidebarView={assetSidebarView}
                    setAssetSidebarView={setAssetSidebarView}
                    selectedIds={selectedIds}
                    setSelectedIds={setSelectedIds}
                    onMouseDown={handleAssetMouseDown}
                    onContextMenu={handleContextMenu}
                    onSort={handleSort}
                    sortConfig={sortConfig}
                    selectedTreePath={selectedTreePath}
                    setSelectedTreePath={setSelectedTreePath}
                    filterMethod={filterMethod}
                    setFilterMethod={setFilterMethod}
                    filterStatus={filterStatus}
                    setFilterStatus={setFilterStatus}
                    smartFilter={smartFilter}
                    setSmartFilter={setSmartFilter}
                    
                    domainTree={domainTree}
                    onAddFolder={handleAddFolder}
                    onMoveToFolder={handleMoveToFolder}
                    onPurge={handlePurgeRecursive}
                    onAddToWorkbench={handleAddToWorkbench}
                    onOpenImport={() => setIsImportManagerOpen(true)}
                    onAnalyzeFlow={handleAnalyzeFlow}
                    
                    getStatusBadge={getStatusBadge}
                    getDetectionBadges={getDetectionBadges}
                    getSourceIcon={getSourceIcon}
                    visibleColumns={new Set(['url', 'method', 'status', 'detections', 'source'])} // Defaults
                    setVisibleColumns={() => {}} // Not implemented in context yet, stubbing
                />;
            case 'surface':
                return <SurfaceView assets={assets} />;
            case 'discovery':
                return <DiscoveryView />;
            case 'settings':
                return <SettingsView 
                    llmEngineType={useAnalysis().llmEngineType}
                    setLlmEngineType={useAnalysis().setLlmEngineType}
                    llmFormProvider={useAnalysis().llmFormProvider}
                    setLlmFormProvider={useAnalysis().setLlmFormProvider}
                    llmFormEndpoint={useAnalysis().llmFormEndpoint}
                    setLlmFormEndpoint={useAnalysis().setLlmFormEndpoint}
                    llmFormModel={useAnalysis().llmFormModel}
                    setLlmFormModel={useAnalysis().setLlmFormModel}
                    llmFormKey={useAnalysis().llmFormApiKey}
                    setLlmFormKey={useAnalysis().setLlmFormApiKey}
                    localModelReady={useAnalysis().localModelReady}
                    pullingModel={useAnalysis().pullingModel}
                    handlePullModel={useAnalysis().handlePullModel}
                    handleSaveLlmConfig={useAnalysis().handleSaveLlmConfig}
                    handleResetDb={handleResetDb}
                    handleProviderChange={useAnalysis().handleProviderChange}
                    proxyPort={useAnalysis().proxyPort}
                    setProxyPort={useAnalysis().setProxyPort}
                    proxyRunning={useAnalysis().proxyRunning}
                    handleToggleProxy={useAnalysis().handleToggleProxy}
                />;
            default:
                return <div>Unknown View</div>;
        }
    };

    const selectedAsset = selectedIds.size === 1 
        ? assets.find(a => a.id === Array.from(selectedIds)[0]) || null 
        : null;

    const showInspector = activeView === 'workbench' || (activeView === 'assets' && selectedIds.size === 1);

    // Helpers function from useDebugLogger we can't easily destructure in top scope due to rules of hooks?
    // useDebugLogger returns { info, error, success } which we already have.

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-family)', overflow: 'hidden' }}>
            <Header 
                setActiveView={setActiveView}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                setIsImportModalOpen={setIsImportManagerOpen}
                isDebugConsoleOpen={isDebugConsoleOpen}
                setIsDebugConsoleOpen={setIsDebugConsoleOpen}
            />
            
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <Sidebar 
                    activeView={activeView} 
                    setActiveView={setActiveView} 
                    workbenchCount={workbenchIds.size}
                />
                
                <main style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                       {renderContent()}
                    </div>
                </main>
                
                {showInspector && (
                    <>
                        <div 
                            onMouseDown={startResizing}
                            style={{ width: '4px', cursor: 'col-resize', background: 'var(--border-color)', transition: 'background 0.2s', zIndex: 50 }}
                        />
                        <div style={{ width: inspectorWidth, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                            <Inspector 
                                asset={selectedAsset}
                                width={inspectorWidth}
                                activeTab={activeInspectorTab}
                                onTabChange={setActiveInspectorTab}
                                onClose={() => setSelectedIds(new Set())}
                                onAnalyze={handleAnalyzeFlow}
                                isAnalyzing={isAnalyzingSequence}
                                analysisResult={sequenceAnalysis}
                                bodySearchTerm={bodySearchTerm}
                                setBodySearchTerm={setBodySearchTerm}
                                selectedCount={selectedIds.size}
                                handleRescan={handleRescan}
                            />
                        </div>
                    </>
                )}
            </div>

            {/* Modals & Overlays */}
            <SmartFilterCommandBar 
                isOpen={showCommandBar} 
                onClose={() => setShowCommandBar(false)}
                query={commandQuery}
                setQuery={setCommandQuery}
                onExecute={(q) => {
                    const term = q.trim();
                    if (['Critical', 'PII', 'Secrets', 'Shadow'].includes(term)) {
                        setSmartFilter(term as any);
                    } else if (term === 'Reset') {
                        setSmartFilter('All');
                        setSearchTerm('');
                    } else {
                        setSearchTerm(term);
                    }
                }} 
            />
            
            <ImportManager 
                isOpen={isImportManagerOpen}
                initialFiles={droppedFiles}
                onClose={() => { setIsImportManagerOpen(false); setDroppedFiles(null); }}
                onImport={handleImport}
                onAnalyze={(report, content) => {
                    setActiveShadowApiReport(report);
                    setLastSpecContent(content);
                }}
                existingUrls={new Set(assets.map(a => a.url))}
            />
            
            {dragActive && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 9999, background: 'var(--bg-primary)', opacity: 0.95,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    border: '8px dashed var(--accent-color)', pointerEvents: 'none'
                }}>
                    <div style={{ background: 'var(--accent-color)', padding: '30px', borderRadius: '50%', marginBottom: '24px' }}>
                        <FolderIcon size={64} color="white" />
                    </div>
                    <h2 style={{ fontSize: '32px', fontWeight: '900', color: 'white' }}>Drop Files to Import</h2>
                </div>
            )}
            
            {activeShadowApiReport && (
                <ShadowApiReport 
                    report={activeShadowApiReport}
                    onClose={() => setActiveShadowApiReport(null)}
                    onImportMissing={handleImportMissing}
                    onClearStatus={handleClearDocStatus}
                />
            )}
            
            {isSequenceModalOpen && (
                 <SequenceAnalysisModal
                    isOpen={isSequenceModalOpen}
                    onClose={() => setIsSequenceModalOpen(false)}
                    flowName={sequenceFlowName}
                    analysis={sequenceAnalysis}
                    isLoading={isAnalyzingSequence}
                />
            )}
            
            {isDebugConsoleOpen && <DebugConsole />}
        </div>
    );
};


