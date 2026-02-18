import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { AssetsView } from '../AssetsView';

describe('AssetsView', () => {
  const mockProps: any = {
    processedAssets: [],
    folders: [],
    activeFolderId: null,
    setActiveFolderId: vi.fn(),
    selectedTreePath: null,
    setSelectedTreePath: vi.fn(),
    domainTree: {},
    assetSidebarView: 'tree',
    setAssetSidebarView: vi.fn(),
    onAddFolder: vi.fn(),
    onMoveToFolder: vi.fn(),
    selectedIds: new Set(),
    setSelectedIds: vi.fn(),
    onMouseDown: vi.fn(),
    onSort: vi.fn(),
    sortConfig: null,
    getStatusBadge: () => null,
    getDetectionBadges: () => null,
    getSourceIcon: () => null,
    visibleColumns: new Set(),
    setVisibleColumns: vi.fn(),
    filterMethod: 'All',
    setFilterMethod: vi.fn(),
    filterStatus: 'All',
    setFilterStatus: vi.fn(),
    smartFilter: 'All',
    setSmartFilter: vi.fn(),
    filterSource: 'All',
    setFilterSource: vi.fn(),
    onAddToWorkbench: vi.fn(),
    onOpenImport: vi.fn(),
    onPurge: vi.fn(),
    onRunActiveScan: vi.fn(),
    onDeleteAsset: vi.fn(),
  };

  it('renders without crashing', () => {
    render(<AssetsView {...mockProps} />);
    // Since processedAssets is empty, it should show empty state or sidebar
    expect(screen.getByTestId('empty-no-assets')).toBeInTheDocument();
  });
});