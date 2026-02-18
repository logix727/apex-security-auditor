import { render, screen, waitFor } from '@testing-library/react';
import { Inspector } from '../Inspector';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Asset } from '../../../types';

// Mock Tauri invoke
const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args: any) => mockInvoke(cmd, args),
}));

// Mock ResponseDiff
vi.mock('../../common/ResponseDiff', () => ({
  ResponseDiff: ({ old, new: modified }: { old: string, new: string }) => (
    <div data-testid="mock-response-diff">
      <div data-testid="diff-original">{old}</div>
      <div data-testid="diff-modified">{modified}</div>
    </div>
  ),
}));

// Mock Sub-components to isolate Inspector logic if needed. 
// However, Inspector renders them conditionally. 
// InspectorTabs is simple enough.

describe('Inspector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAsset: Asset = {
    id: 1,
    url: 'https://api.example.com',
    method: 'GET',
    status: 'Safe',
    status_code: 200,
    risk_score: 0,
    folder_id: 1,
    triage_status: 'Unreviewed',
    findings: [],
    response_body: '{"current": "value"}',
    request_body: '',
    request_headers: '',
    response_headers: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    notes: '',
    is_documented: false,
    source: 'test',
    recursive: false,
    is_workbench: false,
    depth: 0,
  };

  const mockHistory = [
    { id: 10, asset_id: 1, response_body: '{"old": "value"}', scand_at: '2023-01-01T10:00:00Z', status_code: 200 },
    { id: 11, asset_id: 1, response_body: '{"older": "val"}', scand_at: '2023-01-01T09:00:00Z', status_code: 200 }
  ];

  const defaultProps = {
    inspectorAsset: mockAsset,
    workbenchSummary: null,
    activeInspectorTab: 'Diff' as const,
    setActiveInspectorTab: vi.fn(),
    bodySearchTerm: '',
    setBodySearchTerm: vi.fn(),
    handleRescan: vi.fn(),
    showInspector: true,
    inspectorWidth: 500,
    selectedIdsCount: 1,
    activeView: 'workbench',
    decodedJwt: null,
    setDecodedJwt: vi.fn(),
    onRefresh: vi.fn(),
  };

  it('renders Diff view and fetches history', async () => {
    mockInvoke.mockResolvedValueOnce(mockHistory);

    render(<Inspector {...defaultProps} />);

    // Verify it calls history
    expect(mockInvoke).toHaveBeenCalledWith('get_asset_history', { assetId: 1 });

    // Wait for history to load and Diff to render
    await waitFor(() => {
      expect(screen.getByTestId('mock-response-diff')).toBeInTheDocument();
    });

    // Check if correct values are passed to DiffEditor
    // Default behavior uses first history item as base
    expect(screen.getByTestId('diff-original')).toHaveTextContent('{"old": "value"}');
    expect(screen.getByTestId('diff-modified')).toHaveTextContent('{"current": "value"}');
  });

  it('renders with large response body without crashing', async () => {
    const largeBody = '{"key": "' + 'a'.repeat(10000) + '"}';
    const largeAsset = { ...mockAsset, response_body: largeBody };
    
    mockInvoke.mockResolvedValueOnce(mockHistory);

    render(<Inspector {...defaultProps} inspectorAsset={largeAsset} />);

    await waitFor(() => {
        expect(screen.getByTestId('mock-response-diff')).toBeInTheDocument();
    });

    // We mainly check that it rendered successfully
    expect(screen.getByTestId('diff-modified')).toHaveTextContent(largeBody);
  });
});
