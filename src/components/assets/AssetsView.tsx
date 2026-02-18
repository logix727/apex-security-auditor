import React from 'react';
import { Asset, Folder, TreeNode, AssetSidebarView, Badge, SortConfig } from '../../types';
import { AssetsContainer } from './AssetsContainer';
import { AssetsSidebar } from './AssetsSidebar';
import { AssetsTable } from './AssetsTable';
import { Breadcrumbs, useBreadcrumbs } from '../layout/Breadcrumbs';
import { EmptyState, EmptyStateVariants } from '../common/EmptyState';
import { SelectionToolbar } from '../common/SelectionToolbar';
import { ContextMenu, ContextMenuAction } from '../common/ContextMenu';
import { Inbox, Filter, ArrowRight, Trash2, Zap } from 'lucide-react';

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
  onSort: (key: keyof Asset) => void;
  sortConfig: SortConfig | null;
  getStatusBadge: (code: number, findings: Badge[]) => React.ReactNode;
  getDetectionBadges: (findings: Badge[]) => React.ReactNode;
  getSourceIcon: (source: string, isRecursive?: boolean) => React.ReactNode;
  visibleColumns: Set<string>;
  setVisibleColumns: (cols: Set<string>) => void;
  
  // Filter Props
  filterMethod: string;
  setFilterMethod: (method: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  smartFilter: 'All' | 'Critical' | 'PII' | 'Secrets' | 'Shadow';
  setSmartFilter: (filter: 'All' | 'Critical' | 'PII' | 'Secrets' | 'Shadow') => void;
  filterSource: string;
  setFilterSource: (source: string) => void;

  // Actions
  onAddToWorkbench: () => void;
  onOpenImport: () => void;
  onPurge: () => void;
  onRunActiveScan: (id?: number) => void;
  onDeleteAsset: (id?: number) => void;
  onAnalyzeFlow?: () => void;
}

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
  onSort,
  sortConfig,
  getStatusBadge,
  getDetectionBadges,
  getSourceIcon,
  visibleColumns,
  setVisibleColumns: _setVisibleColumns,
  
  filterMethod,
  setFilterMethod,
  filterStatus,
  setFilterStatus,
  smartFilter,
  setSmartFilter,
  filterSource,
  setFilterSource,
  
  onAddToWorkbench,
  onOpenImport,
  onPurge: _onPurge,
  onRunActiveScan,
  onDeleteAsset,
  onAnalyzeFlow: _onAnalyzeFlow
}) => {
  // Generate breadcrumbs based on navigation state
  const breadcrumbs = useBreadcrumbs(
    'assets',
    activeFolderId,
    selectedTreePath,
    folders
  );

  const hasActiveFilter = filterMethod !== 'All' || filterStatus !== 'All' || 
    smartFilter !== 'All' || filterSource !== 'All';

  const [contextMenu, setContextMenu] = React.useState<{ x: number, y: number, id: number } | null>(null);

  const handleContextMenu = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, id });
  };

  const getContextMenuActions = (id: number): ContextMenuAction[] => {
    return [
      {
        label: 'Add to Workbench',
        icon: ArrowRight,
        onClick: () => onAddToWorkbench()
      },
      {
        label: 'Active Scan',
        icon: Zap,
        onClick: () => onRunActiveScan(id)
      },
      {
        label: 'Delete Asset',
        icon: Trash2,
        variant: 'danger',
        onClick: () => onDeleteAsset(id)
      }
    ];
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(processedAssets.map(a => a.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  return (
    <AssetsContainer>
      <AssetsSidebar 
        folders={folders}
        activeFolderId={activeFolderId}
        setActiveFolderId={setActiveFolderId}
        selectedTreePath={selectedTreePath}
        setSelectedTreePath={setSelectedTreePath}
        domainTree={domainTree}
        view={assetSidebarView}
        setView={setAssetSidebarView}
        onAddFolder={onAddFolder}
        onMoveToFolder={onMoveToFolder}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Breadcrumb Navigation */}
        {breadcrumbs.length > 0 && (
          <Breadcrumbs 
            items={breadcrumbs}
            maxItems={4}
          />
        )}
        
        {/* Active Filter Indicator */}
        {hasActiveFilter && (
          <div 
            role="status"
            aria-live="polite"
            style={{
              padding: '8px 16px',
              background: 'rgba(99, 102, 241, 0.05)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: 'var(--text-secondary)'
            }}
          >
            <Filter size={14} color="var(--accent-color)" />
            <span>Active filters: </span>
            <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
              {[filterMethod !== 'All' && `Method: ${filterMethod}`, 
                filterStatus !== 'All' && `Status: ${filterStatus}`, 
                smartFilter !== 'All' && `Smart: ${smartFilter}`,
                filterSource !== 'All' && `Source: ${filterSource}`
              ].filter(Boolean).join(', ')}
            </span>
          </div>
        )}
        
        {/* Main Content Area */}
        {processedAssets.length === 0 ? (
          hasActiveFilter ? (
            <EmptyState 
              {...EmptyStateVariants.NoSearchResults}
              action={{
                label: 'Clear Filters',
                onClick: () => {
                  setFilterMethod('All');
                  setFilterStatus('All');
                  setSmartFilter('All');
                  setFilterSource('All');
                },
                icon: Filter
              }}
              testId="empty-no-results"
            />
          ) : (
            <EmptyState 
              {...EmptyStateVariants.NoAssets}
              action={{
                label: 'Import Assets',
                onClick: onOpenImport,
                icon: Inbox
              }}
              testId="empty-no-assets"
            />
          )
        ) : (
          <AssetsTable 
            assets={processedAssets}
            selectedIds={selectedIds}
            onMouseDown={onMouseDown}
            onContextMenu={handleContextMenu}
            onSort={onSort}
            sortConfig={sortConfig}
            getStatusBadge={getStatusBadge}
            getDetectionBadges={getDetectionBadges}
            getSourceIcon={getSourceIcon}
            visibleColumns={visibleColumns}
            onSelectAll={handleSelectAll}
            allSelected={processedAssets.length > 0 && selectedIds.size === processedAssets.length}
          />
        )}

        <SelectionToolbar 
          count={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          onAddToWorkbench={onAddToWorkbench}
          onActiveScan={() => onRunActiveScan()}
          onDelete={() => onDeleteAsset()}
        />

        {contextMenu && (
          <ContextMenu 
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            actions={getContextMenuActions(contextMenu.id)}
          />
        )}
      </div>
    </AssetsContainer>
  );
};