import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAssetApi, useBulkAssetOperations, clearApiCache } from '../useAssetApi';
import { invoke } from '@tauri-apps/api/core';

// Mock dependencies
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock asset data
const mockAssets = [
  { id: 1, url: 'https://example.com/api', method: 'GET', status: 'active', status_code: 200, risk_score: 0, findings: [], folder_id: 1, response_headers: '', response_body: '', request_headers: '', request_body: '', created_at: '2024-01-01', updated_at: '2024-01-01', notes: '', triage_status: 'pending', is_documented: true, source: 'import', recursive: false, is_workbench: false, depth: 0 },
  { id: 2, url: 'https://example.com/admin', method: 'GET', status: 'active', status_code: 200, risk_score: 5, findings: [], folder_id: 1, response_headers: '', response_body: '', request_headers: '', request_body: '', created_at: '2024-01-01', updated_at: '2024-01-01', notes: '', triage_status: 'pending', is_documented: true, source: 'import', recursive: false, is_workbench: false, depth: 0 },
];

const mockFolders = [
  { id: 1, name: 'Default', parent_id: null },
  { id: 2, name: 'API', parent_id: null },
];

describe('useAssetApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearApiCache();
  });

  afterEach(() => {
    clearApiCache();
  });

  describe('fetchAssets', () => {
    it('should fetch assets successfully', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(mockAssets);

      const { result } = renderHook(() => useAssetApi());

      await act(async () => {
        await result.current.fetchAssets();
      });

      expect(invoke).toHaveBeenCalledWith('get_assets');
      expect(result.current.assets.data).toEqual(mockAssets);
      expect(result.current.assets.loading).toBe(false);
      expect(result.current.lastRefresh).toBeInstanceOf(Date);
    });

    it('should use cached data when available', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(mockAssets);

      const { result } = renderHook(() => useAssetApi());

      // First fetch
      await act(async () => {
        await result.current.fetchAssets();
      });

      // Second fetch should use cache
      await act(async () => {
        await result.current.fetchAssets(false);
      });

      // Invoke should only be called once
      expect(invoke).toHaveBeenCalledTimes(1);
    });

    it('should force refresh when requested', async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce(mockAssets)
        .mockResolvedValueOnce([...mockAssets, { id: 3, url: 'https://new.com', method: 'GET', status: 'active', status_code: 200, risk_score: 0, findings: [], folder_id: 1, response_headers: '', response_body: '', request_headers: '', request_body: '', created_at: '2024-01-01', updated_at: '2024-01-01', notes: '', triage_status: 'pending', is_documented: true, source: 'import', recursive: false, is_workbench: false, depth: 0 }]);

      const { result } = renderHook(() => useAssetApi());

      await act(async () => {
        await result.current.fetchAssets();
      });

      await act(async () => {
        await result.current.fetchAssets(true);
      });

      expect(invoke).toHaveBeenCalledTimes(2);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Database error'));

      const { result } = renderHook(() => useAssetApi());

      await act(async () => {
        try {
          await result.current.fetchAssets();
        } catch (e) {
          // Expected to throw
        }
      });

      expect(result.current.assets.error).toBe('Database error');
    });
  });

  describe('fetchFolders', () => {
    it('should fetch folders successfully', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(mockFolders);

      const { result } = renderHook(() => useAssetApi());

      await act(async () => {
        await result.current.fetchFolders();
      });

      expect(invoke).toHaveBeenCalledWith('get_folders');
      expect(result.current.folders.data).toEqual(mockFolders);
    });
  });

  describe('importAssets', () => {
    it('should import assets successfully', async () => {
      const importResult = {
        importId: 'test-123',
        successful: 2,
        failed: 0,
        duplicates: 0,
        total: 2,
        duration: 1000,
        errors: [],
        assetIds: [1, 2],
      };

      vi.mocked(invoke).mockResolvedValueOnce(importResult);

      const { result } = renderHook(() => useAssetApi());

      const options = {
        destination: 'asset_manager' as const,
        recursive: false,
        batchMode: true,
        batchSize: 10,
        rateLimit: 100,
        skipDuplicates: true,
        validateUrls: true,
        autoTriage: false,
      };

      let response;
      await act(async () => {
        response = await result.current.importAssets('https://example.com', 'text', options);
      });

      expect(invoke).toHaveBeenCalledWith('enhanced_import_assets', {
        content: 'https://example.com',
        format: 'text',
        options,
      });
      expect(response?.successful).toBe(2);
    });
  });

  describe('deleteAsset', () => {
    it('should delete asset successfully', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      vi.mocked(invoke).mockResolvedValueOnce(mockAssets);

      const { result } = renderHook(() => useAssetApi());

      // First populate cache
      await act(async () => {
        await result.current.fetchAssets();
      });

      // Then delete
      await act(async () => {
        await result.current.deleteAsset(1);
      });

      expect(invoke).toHaveBeenCalledWith('delete_asset', { id: 1 });
    });
  });

  describe('addFolder', () => {
    it('should add folder successfully', async () => {
      const newFolder = { id: 3, name: 'Test', parent_id: null };
      vi.mocked(invoke).mockResolvedValueOnce(newFolder);

      const { result } = renderHook(() => useAssetApi());

      await act(async () => {
        await result.current.addFolder('Test');
      });

      expect(invoke).toHaveBeenCalledWith('add_folder', { name: 'Test', parentId: undefined });
    });
  });
});

describe('useBulkAssetOperations', () => {
  it('should initialize with empty selection', () => {
    const { result } = renderHook(() => useBulkAssetOperations());
    
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.hasSelection).toBe(false);
    expect(result.current.selectionCount).toBe(0);
  });

  it('should toggle selection correctly', () => {
    const { result } = renderHook(() => useBulkAssetOperations());

    act(() => {
      result.current.toggleSelection(1);
    });

    expect(result.current.selectedIds.has(1)).toBe(true);
    expect(result.current.hasSelection).toBe(true);
    expect(result.current.selectionCount).toBe(1);

    // Toggle again should remove
    act(() => {
      result.current.toggleSelection(1);
    });

    expect(result.current.selectedIds.has(1)).toBe(false);
  });

  it('should select all correctly', () => {
    const { result } = renderHook(() => useBulkAssetOperations());

    act(() => {
      result.current.selectAll([1, 2, 3]);
    });

    expect(result.current.selectionCount).toBe(3);
    expect(result.current.selectedIds.has(1)).toBe(true);
    expect(result.current.selectedIds.has(2)).toBe(true);
    expect(result.current.selectedIds.has(3)).toBe(true);
  });

  it('should clear selection', () => {
    const { result } = renderHook(() => useBulkAssetOperations());

    act(() => {
      result.current.selectAll([1, 2, 3]);
    });

    expect(result.current.selectionCount).toBe(3);

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectionCount).toBe(0);
  });
});
