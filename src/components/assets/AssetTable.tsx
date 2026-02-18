import React from 'react';
import { Asset, Badge, SortConfig } from '../../types';
import { SmartTable, Column } from '../table/SmartTable';

interface AssetTableProps {
  assets: Asset[];
  selectedIds: Set<number>;
  onMouseDown: (id: number, e: React.MouseEvent) => void;
  onContextMenu?: (id: number, e: React.MouseEvent) => void;
  onSort: (key: keyof Asset) => void;
  sortConfig: SortConfig | null;
  getStatusBadge: (code: number, findings: Badge[]) => React.ReactNode;
  getDetectionBadges: (findings: Badge[]) => React.ReactNode;
  getSourceIcon: (source: string, isRecursive?: boolean) => React.ReactNode;
  visibleColumns: Set<string>;
  onSelectAll?: (selected: boolean) => void;
  allSelected?: boolean;
}

export const AssetTable: React.FC<AssetTableProps> = ({
  assets,
  selectedIds,
  onMouseDown,
  onContextMenu,
  onSort,
  sortConfig,
  getStatusBadge,
  getDetectionBadges,
  getSourceIcon,
  visibleColumns,
  onSelectAll,
  allSelected
}) => {
  const columns: Column<Asset>[] = [
    {
      id: 'id',
      label: 'ID',
      width: '40px',
      render: (item: Asset) => <span style={{ opacity: 0.3, fontSize: '10px' }}>{item.id}</span>
    },
    {
      id: 'url',
      label: 'Asset URL',
      sortable: true,
      minWidth: '200px',
      // No fixed width, allows flex expansion handled by SmartTable or default auto
      render: (item: Asset) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.url}
        </div>
      )
    },
    {
      id: 'method',
      label: 'Method',
      sortable: true,
      width: '80px',
      render: (item: Asset) => (
        <span className={`method-badge ${item.method.toLowerCase()}`}>{item.method}</span>
      )
    },
    {
      id: 'status_code',
      label: 'Status',
      sortable: true,
      width: '100px',
      render: (item: Asset) => getStatusBadge(item.status_code, item.findings)
    },
    {
      id: 'risk_score',
      label: 'Risk',
      sortable: true,
      width: '80px',
      render: (item: Asset) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="risk-bar-bg" style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
            <div className="risk-bar-fill" style={{ 
              width: `${Math.min(100, item.risk_score)}%`, 
              height: '100%', 
              background: item.risk_score > 70 ? 'var(--status-critical)' : item.risk_score > 30 ? 'var(--status-warning)' : 'var(--status-safe)',
              borderRadius: '2px' 
            }} />
          </div>
          <span style={{ fontSize: '11px', minWidth: '20px', textAlign: 'right', opacity: 0.7 }}>{item.risk_score}</span>
        </div>
      )
    },
    {
      id: 'cvss_score',
      label: 'CVSS',
      sortable: true,
      width: '60px',
      render: (item: Asset) => {
        const maxCvss = item.findings.reduce((max, f) => Math.max(max, f.cvss_score || 0), 0);
        return maxCvss > 0 ? (
          <span style={{ 
            fontWeight: 'bold', 
            color: maxCvss >= 7 ? 'var(--status-critical)' : maxCvss >= 4 ? 'var(--status-warning)' : 'var(--status-safe)',
            background: maxCvss >= 7 ? 'rgba(239, 68, 68, 0.1)' : maxCvss >= 4 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px'
          }}>
            {maxCvss.toFixed(1)}
          </span>
        ) : <span style={{ opacity: 0.3, fontSize: '10px' }}>-</span>;
      }
    },
    {
      id: 'detections',
      label: 'Security Detections',
      minWidth: '150px',
      // No fixed width
      render: (item: Asset) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {getDetectionBadges(item.findings)}
        </div>
      )
    },
    {
      id: 'source',
      label: 'Source',
      sortable: true,
      width: '110px',
      render: (item: Asset) => getSourceIcon(item.source, item.recursive)
    }
  ].filter(col => col.id === 'id' || visibleColumns.has(col.id === 'status_code' ? 'status' : col.id === 'risk_score' ? 'risk' : col.id));

  return (
    <div className="table-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <SmartTable 
        data={assets}
        columns={columns}
        onRowMouseDown={(item, e) => onMouseDown(item.id, e)}
        onRowContextMenu={(item, e) => onContextMenu?.(item.id, e)}
        selectedIds={selectedIds} // Updated to support multiple selection visual
        selectedId={[...selectedIds][0]} // Legacy/Fall-back
        idField="id"
        initialSort={undefined}
        onSort={(columnId) => onSort(columnId as keyof Asset)}
        sortConfig={sortConfig ? { columnId: sortConfig.key, direction: sortConfig.direction } : null}
        onSelectAll={onSelectAll}
        allSelected={allSelected}
      />
    </div>
  );
};
