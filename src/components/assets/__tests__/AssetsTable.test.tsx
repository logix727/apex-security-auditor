import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { AssetsTable } from '../AssetsTable';
import { Asset } from '../../../types';

describe('AssetsTable', () => {
  const mockAssets: Asset[] = [
    {
      id: 1,
      method: 'GET',
      url: '/api/users',
      status: 'Pending',
      status_code: 200,
      risk_score: 0,
      is_workbench: false,
      folder_id: null,
      source: 'Import',
      findings: [],
      request_headers: '',
      request_body: '',
      response_headers: '',
      response_body: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: '',
      triage_status: 'Unreviewed',
      is_documented: true,
      recursive: false,
      depth: 0,
    } as any
  ];

  const mockProps: any = {
    assets: mockAssets,
    selectedIds: new Set(),
    onMouseDown: vi.fn(),
    onContextMenu: vi.fn(),
    onSort: vi.fn(),
    sortConfig: null,
    getStatusBadge: () => <span>Status</span>,
    getDetectionBadges: () => <span>Detections</span>,
    getSourceIcon: () => <span>Icon</span>,
    visibleColumns: new Set(['url', 'method', 'status', 'risk', 'detections', 'source']),
  };

  it('renders without crashing', () => {
    render(<AssetsTable {...mockProps} />);
    expect(screen.getByText(/GET/i)).toBeInTheDocument();
  });
});