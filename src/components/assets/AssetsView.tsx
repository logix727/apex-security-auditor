import React from 'react';
import { AssetSidebar } from './AssetSidebar';
import { AssetTable } from './AssetTable';
import { 
  Asset, 
  Folder, 
  TreeNode, 
  AssetSidebarView, 
  Badge,
  SortConfig
} from '../../types';
import { FileCode, X, Folder as FolderIcon, Filter, BrainCircuit } from 'lucide-react';


interface AssetsViewProps {
  processedAssets: Asset[];
  folders: Folder[];
  activeFolderId: number | null;
  setActiveFolderId: (id: number | null) => void;
  selectedTreePath: string | null;
  setSelectedTreePath: (path: string | null) => void;
  domainTree: Record<string, TreeNode>;
  assetSidebarView: AssetSidebarView;
  setAssetSidebarView: (view: AssetSidebarView) => void;
  onAddFolder: (parentId?: number) => void;
  onMoveToFolder: (folderId: number) => void;
  
  // Table Props
  selectedIds: Set<number>;
  setSelectedIds: (ids: Set<number>) => void;
  onMouseDown: (id: number, e: React.MouseEvent) => void;
  onContextMenu?: (id: number, e: React.MouseEvent) => void;
  onSort: (key: keyof Asset) => void;
  sortConfig: SortConfig | null;
  getStatusBadge: (code: number, findings: Badge[]) => React.ReactNode;
  getDetectionBadges: (findings: Badge[]) => React.ReactNode;
  getSourceIcon: (source: string) => React.ReactNode;
  visibleColumns: Set<string>;
  setVisibleColumns: (cols: Set<string>) => void;
  
  // Filter Props
  filterMethod: string;
  setFilterMethod: (method: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  smartFilter: 'All' | 'Critical' | 'PII' | 'Secrets' | 'Shadow';
  setSmartFilter: (filter: 'All' | 'Critical' | 'PII' | 'Secrets' | 'Shadow') => void;

  
  // Actions
  onAddToWorkbench: () => void;
  onOpenImport: () => void;
  onPurge: () => void;
  onAnalyzeFlow?: () => void;
}

import { EmptyState } from '../common/EmptyState';
import { Database, Plus } from 'lucide-react';

export const AssetsView: React.FC<AssetsViewProps> = ({
  processedAssets,
  folders,
  activeFolderId,
  setActiveFolderId,
  selectedTreePath,
  setSelectedTreePath,
  domainTree,
  assetSidebarView,
  setAssetSidebarView,
  onAddFolder,
  onMoveToFolder,
  
  selectedIds,
  setSelectedIds,
  onMouseDown,
  onContextMenu,
  onSort,
  sortConfig,
  getStatusBadge,
  getDetectionBadges,
  getSourceIcon,
  visibleColumns,
  setVisibleColumns,
  
  filterMethod,
  setFilterMethod,
  filterStatus,
  setFilterStatus,
  smartFilter,
  setSmartFilter,
  
  onAddToWorkbench,
  onOpenImport,
  onPurge,
  onAnalyzeFlow
}) => {
  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: '20px', overflow: 'hidden' }}>
      <AssetSidebar 
        view={assetSidebarView}
        setView={setAssetSidebarView}
        folders={folders}
        activeFolderId={activeFolderId}
        setActiveFolderId={setActiveFolderId}
        selectedTreePath={selectedTreePath}
        setSelectedTreePath={setSelectedTreePath}
        domainTree={domainTree}
        onAddFolder={onAddFolder}
        onMoveToFolder={onMoveToFolder}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '8px 16px', display: 'flex', gap: '12px', alignItems: 'center', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-sidebar)', fontSize: '11px', color: 'var(--text-secondary)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
           {/* Primary Filters - Visible on top */}
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{position: 'relative', display: 'flex', alignItems: 'center'}}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-secondary)', marginRight: '6px' }}>METHOD</span>
                    <select
                        value={filterMethod}
                        onChange={(e) => setFilterMethod(e.target.value)}
                        style={{
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            fontSize: '11px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            outline: 'none',
                            minWidth: '80px',
                            cursor: 'pointer'
                        }}
                    >
                        {['All', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>

                <div style={{position: 'relative', display: 'flex', alignItems: 'center'}}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-secondary)', marginRight: '6px' }}>STATUS</span>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        style={{
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            fontSize: '11px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            outline: 'none',
                            minWidth: '100px',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="All">All Status</option>
                        <option value="2xx">2xx Success</option>
                        <option value="3xx">3xx Redirect</option>
                        <option value="4xx">4xx Client Error</option>
                        <option value="5xx">5xx Server Error</option>
                        <option value="0">Failed / Unknown</option>
                    </select>
                </div>

                <div style={{ width: '1px', height: '16px', background: 'var(--border-color)', margin: '0 4px' }}></div>

                {/* Smart Filters (User Requested) */}
                <div style={{ display: 'flex', gap: '4px' }}>
                    {[
                        { id: 'All', label: 'All', icon: null },
                        { id: 'Critical', label: 'Critical', icon: '🚨' },
                        { id: 'PII', label: 'PII Found', icon: '👤' },
                        { id: 'Secrets', label: 'Secrets', icon: '🔑' },
                        { id: 'Shadow', label: 'Shadow APIs', icon: '🌑' }
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => setSmartFilter(f.id as any)}
                            style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: smartFilter === f.id ? '700' : '500',
                                border: `1px solid ${smartFilter === f.id ? 'var(--accent-color)' : 'var(--border-color)'}`,
                                background: smartFilter === f.id ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-primary)',
                                color: smartFilter === f.id ? 'var(--accent-color)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            {f.icon && <span>{f.icon}</span>}
                            {f.label}
                        </button>
                    ))}
                </div>
           </div>

           <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
               {/* Columns Dropdown Group */}
               <div className="dropdown-container" style={{ position: 'relative', marginRight: '8px' }}>
                   <button 
                      className="menu-item"
                      style={{ 
                          padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px',
                          border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-primary)'
                      }}
                       onClick={(e) => {
                           const el = e.currentTarget.nextElementSibling as HTMLElement;
                           if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
                       }}
                       onBlur={(e) => {
                            // Delay closing to allow clicks inside
                            setTimeout(() => {
                                const el = e.currentTarget.nextElementSibling as HTMLElement;
                                if (el) el.style.display = 'none';
                            }, 200);
                       }}
                   >
                       Columns <Filter size={10} />
                   </button>
                   <div style={{
                       display: 'none',
                       position: 'absolute',
                       top: '100%',
                       right: 0,
                       background: 'var(--bg-primary)',
                       border: '1px solid var(--border-color)',
                       borderRadius: '4px',
                       padding: '8px',
                       zIndex: 50,
                       width: '150px',
                       boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                       marginTop: '4px'
                   }}>
                        {['method', 'source', 'status', 'risk', 'detections'].map(col => (
                           <div key={col} style={{display: 'flex', alignItems: 'center', marginBottom: '4px', fontSize: '11px'}}>
                               <input 
                                   type="checkbox" 
                                   checked={visibleColumns.has(col)}
                                   onChange={() => setVisibleColumns(new Set(
                                     visibleColumns.has(col) 
                                       ? Array.from(visibleColumns).filter(c => c !== col)
                                       : [...Array.from(visibleColumns), col]
                                   ))}
                                   style={{marginRight: '6px'}}
                               />
                               <span style={{textTransform: 'capitalize'}}>{col}</span>
                           </div>
                       ))}
                   </div>
               </div>

               <button 
                  className="menu-item"
                  title="Purge Out-of-Scope Assets"
                  onClick={onPurge}
                  style={{ 
                      padding: '2px 8px', fontSize: '10px', 
                      display: 'flex', alignItems: 'center', gap: '4px',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-color)',
                  }}
               >
                  <Filter size={12} /> Purge
               </button>
               
               <button 
                  className="menu-item"
                  title="Send selected assets to Workbench"
                  onClick={onAddToWorkbench}
                  disabled={selectedIds.size === 0}
                  style={{ 
                      padding: '2px 8px', fontSize: '10px', 
                      display: 'flex', alignItems: 'center', gap: '4px',
                      opacity: selectedIds.size > 0 ? 1 : 0.5,
                      cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
                      color: selectedIds.size > 0 ? 'var(--accent-color)' : 'var(--text-secondary)',
                      border: '1px solid var(--border-color)'
                  }}
               >
                  <FileCode size={12} /> To Workbench
                  {selectedIds.size > 0 && <span style={{background: 'var(--accent-color)', color: 'white', padding: '0 4px', borderRadius: '4px', fontSize: '9px'}}>{selectedIds.size}</span>}
               </button>
           </div>
        </div>

        <div className="table-container" style={{ flex: 1, minHeight: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
            {processedAssets.length === 0 ? (
                <EmptyState
                    icon={Database}
                    title="No Assets Found"
                    description="Populate your inventory by importing traffic logs, OpenAPI specs, or starting the active proxy service."
                    action={{
                        label: 'Import Assets',
                        onClick: onOpenImport,
                        icon: Plus
                    }}
                />
            ) : (
                <AssetTable 
                  assets={processedAssets}
                  selectedIds={selectedIds}
                  onMouseDown={onMouseDown}
                  onContextMenu={onContextMenu}
                  onSort={onSort}
                  sortConfig={sortConfig}
                  getStatusBadge={getStatusBadge}
                  getDetectionBadges={getDetectionBadges}
                  getSourceIcon={getSourceIcon}
                  visibleColumns={visibleColumns}
                />
            )}
        </div>
      </div>

      {/* Sticky Bulk Action Bar */}
      {selectedIds.size > 1 && (
          <div className="sticky-action-bar glass-morphism" style={{ 
              position: 'absolute', 
              bottom: '32px', 
              left: '50%', 
              transform: 'translateX(-50%)',
              borderRadius: '12px',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
              zIndex: 100,
              animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
              <div style={{ 
                  fontSize: '11px', 
                  fontWeight: '700', 
                  color: 'white', 
                  background: 'var(--accent-color)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
              }}>
                  <Database size={12} /> {selectedIds.size} Selected
              </div>
              
              <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }}></div>

              <div style={{ display: 'flex', gap: '4px' }}>
                  <button 
                    onClick={onAddToWorkbench} 
                    className="title-btn" 
                    style={{ fontSize: '11px', gap: '6px', padding: '6px 10px' }}
                    title="Send to Workbench"
                  >
                      <FileCode size={14} /> Workbench
                  </button>

                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'var(--bg-primary)', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <FolderIcon size={12} color="var(--text-secondary)" />
                        <select 
                            onChange={(e) => {
                                onMoveToFolder(Number(e.target.value));
                                e.target.value = "";
                            }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '11px', outline: 'none', padding: '6px 4px', cursor: 'pointer' }}
                            value=""
                        >
                            <option value="" disabled>Move To...</option>
                            {folders.map(f => (
                                <option key={f.id} value={f.id} style={{background: 'var(--bg-secondary)'}}>{f.name}</option>
                            ))}
                        </select>
                  </div>

                  {onAnalyzeFlow && (
                      <button 
                        onClick={onAnalyzeFlow} 
                        className="title-btn" 
                        style={{ fontSize: '11px', gap: '6px', padding: '6px 10px', color: 'var(--accent-color)' }}
                        title="Analyze Sequence Flow"
                      >
                          <BrainCircuit size={14} /> Analyze Flow
                      </button>
                  )}

                  <button 
                    onClick={() => setSelectedIds(new Set())} 
                    className="title-btn" 
                    style={{ fontSize: '11px', padding: '6px 10px' }}
                    title="Clear Selection"
                  >
                      <X size={14} />
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};
