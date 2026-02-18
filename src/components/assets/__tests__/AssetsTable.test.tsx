import React from 'react';
import { render, screen } from '@testing-library/react';
import { AssetsTable } from '../AssetsTable';
import { Asset } from '../../types';

describe('AssetsTable', () => {
  const mockAssets: Asset[] = [
    {
      id: 1,
      method: 'GET',
      path: '/api/users',
      status: 200,
      risk: 0,
      is_workbench: false,
      folder_id: null,
      source: 'Import',
      findings: [],
      request: {},
      response: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  ];

  const mockProps = {
    assets: mockAssets,
    selectedAssets: [],
    setSelectedAssets: jest.fn(),
    activeFolderId: null,
    setFilter: jest.fn(),
    filter: '',
    sort: { column: 'path', direction: 'asc' },
    setSort: jest.fn(),
    onAssetClick: jest.fn(),
    onAssetRightClick: jest.fn(),
    onAssetDoubleClick: jest.fn(),
    onAssetSelectionChange: jest.fn(),
    onAssetContextMenu: jest.fn(),
  };

  it('renders without crashing', () => {
    render(<AssetsTable {...mockProps} />);
    expect(screen.getByText(/GET/i)).toBeInTheDocument();
  });

  it('calls onAssetClick when asset is clicked', () => {
    render(<AssetsTable {...mockProps} />);
    // Add test for asset click
  });

  it('calls setSelectedAssets when selection changes', () => {
    render(<AssetsTable {...mockProps} />);
    // Add test for selection change
  });
});