import React from 'react';
import { Asset, Badge, SortConfig } from '../../types';
import { AssetTable } from './AssetTable';

interface AssetsTableProps {
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

export const AssetsTable: React.FC<AssetsTableProps> = ({
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
  return (
    <AssetTable 
      assets={assets}
      selectedIds={selectedIds}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
      onSort={onSort}
      sortConfig={sortConfig}
      getStatusBadge={getStatusBadge}
      getDetectionBadges={getDetectionBadges}
      getSourceIcon={getSourceIcon}
      visibleColumns={visibleColumns}
      onSelectAll={onSelectAll}
      allSelected={allSelected}
    />
  );
};
