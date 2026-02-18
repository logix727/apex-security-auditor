import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Asset, Folder, ImportOptions, ImportResult, Badge } from '../types';
import { toast } from 'sonner';

// Types for API responses
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  loading: boolean;
}

export interface AssetApiState {
  assets: ApiResponse<Asset[]>;
  folders: ApiResponse<Folder[]>;
  lastRefresh: Date | null;
}

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();

/**
 * Get cached data if still valid
 */
function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

/**
 * Set cache data
 */
function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Clear all cache
 */
export function clearApiCache(): void {
  cache.clear();
}

/**
 * Custom hook for asset API operations with caching and error handling
 */
export function useAssetApi() {
  const [state, setState] = useState<AssetApiState>({
    assets: { loading: false },
    folders: { loading: false },
    lastRefresh: null,
  });
  


  /**
   * Fetch all assets with caching
   */
  const fetchAssets = useCallback(async (forceRefresh = false): Promise<Asset[]> => {
    const cacheKey = 'assets';
    
    // Check cache first
    if (!forceRefresh) {
      const cached = getCached<Asset[]>(cacheKey);
      if (cached) {
        setState(prev => ({
          ...prev,
          assets: { data: cached, loading: false },
          lastRefresh: new Date(),
        }));
        return cached;
      }
    }

    setState(prev => ({ ...prev, assets: { loading: true } }));

    try {
      const data = await invoke<Asset[]>('get_assets');
      setCache(cacheKey, data);
      setState(prev => ({
        ...prev,
        assets: { data, loading: false },
        lastRefresh: new Date(),
      }));
      return data;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setState(prev => ({
        ...prev,
        assets: { error: errorMsg, loading: false },
      }));
      toast.error(`Failed to fetch assets: ${errorMsg}`);
      throw error;
    }
  }, []);

  /**
   * Fetch all folders with caching
   */
  const fetchFolders = useCallback(async (forceRefresh = false): Promise<Folder[]> => {
    const cacheKey = 'folders';
    
    if (!forceRefresh) {
      const cached = getCached<Folder[]>(cacheKey);
      if (cached) {
        setState(prev => ({
          ...prev,
          folders: { data: cached, loading: false },
        }));
        return cached;
      }
    }

    setState(prev => ({ ...prev, folders: { loading: true } }));

    try {
      const data = await invoke<Folder[]>('get_folders');
      setCache(cacheKey, data);
      setState(prev => ({
        ...prev,
        folders: { data, loading: false },
      }));
      return data;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setState(prev => ({
        ...prev,
        folders: { error: errorMsg, loading: false },
      }));
      toast.error(`Failed to fetch folders: ${errorMsg}`);
      throw error;
    }
  }, []);

  /**
   * Import assets from various sources
   */
  const importAssets = useCallback(async (
    content: string,
    format: string,
    options: ImportOptions
  ): Promise<ImportResult> => {
    try {
      const result = await invoke<ImportResult>('enhanced_import_assets', {
        content,
        format,
        options,
      });
      
      // Invalidate cache after import
      cache.delete('assets');
      toast.success(`Imported ${result.successful} assets successfully`);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Import failed: ${errorMsg}`);
      throw error;
    }
  }, []);

  /**
   * Delete a single asset
   */
  const deleteAsset = useCallback(async (id: number): Promise<void> => {
    try {
      await invoke('delete_asset', { id });
      
      // Update cache
      const cachedAssets = getCached<Asset[]>('assets');
      if (cachedAssets) {
        const updated = cachedAssets.filter(a => a.id !== id);
        setCache('assets', updated);
        setState(prev => ({
          ...prev,
          assets: { data: updated, loading: false },
        }));
      }
      
      toast.success('Asset deleted');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to delete asset: ${errorMsg}`);
      throw error;
    }
  }, []);

  /**
   * Update asset triage status
   */
  const updateAssetTriage = useCallback(async (
    id: number,
    status: string,
    notes: string
  ): Promise<void> => {
    try {
      await invoke('update_asset_triage', { id, status, notes });
      
      // Update cache
      const cachedAssets = getCached<Asset[]>('assets');
      if (cachedAssets) {
        const updated = cachedAssets.map(a => 
          a.id === id ? { ...a, triage_status: status, notes } : a
        );
        setCache('assets', updated);
        setState(prev => ({
          ...prev,
          assets: { data: updated, loading: false },
        }));
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to update triage: ${errorMsg}`);
      throw error;
    }
  }, []);

  /**
   * Add a new folder
   */
  const addFolder = useCallback(async (name: string, parentId?: number): Promise<Folder> => {
    try {
      const folder = await invoke<Folder>('add_folder', { name, parentId });
      
      // Update cache
      const cachedFolders = getCached<Folder[]>('folders');
      if (cachedFolders) {
        const updated = [...cachedFolders, folder];
        setCache('folders', updated);
        setState(prev => ({
          ...prev,
          folders: { data: updated, loading: false },
        }));
      }
      
      toast.success(`Folder "${name}" created`);
      return folder;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to create folder: ${errorMsg}`);
      throw error;
    }
  }, []);

  /**
   * Move assets to folder
   */
  const moveAssetsToFolder = useCallback(async (
    assetIds: number[],
    folderId: number
  ): Promise<void> => {
    try {
      await invoke('move_assets_to_folder', { assetIds, folderId });
      
      // Invalidate cache
      cache.delete('assets');
      await fetchAssets(true);
      toast.success(`Moved ${assetIds.length} assets`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to move assets: ${errorMsg}`);
      throw error;
    }
  }, [fetchAssets]);

  /**
   * Rescan a single asset
   */
  const rescanAsset = useCallback(async (id: number): Promise<void> => {
    try {
      await invoke('rescan_asset', { id });
      toast.success('Asset rescanning started');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to rescan asset: ${errorMsg}`);
      throw error;
    }
  }, []);

  /**
   * Analyze asset with AI
   */
  const analyzeAsset = useCallback(async (
    assetId: number
  ): Promise<Badge[]> => {
    try {
      const findings = await invoke<Badge[]>('analyze_asset_summary', { assetId });
      return findings;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to analyze asset: ${errorMsg}`);
      throw error;
    }
  }, []);

  /**
   * Clear cache and refresh
   */
  const refreshAll = useCallback(async () => {
    clearApiCache();
    await Promise.all([fetchAssets(true), fetchFolders(true)]);
  }, [fetchAssets, fetchFolders]);

  return {
    // State
    assets: state.assets,
    folders: state.folders,
    lastRefresh: state.lastRefresh,
    
    // Actions
    fetchAssets,
    fetchFolders,
    importAssets,
    deleteAsset,
    updateAssetTriage,
    addFolder,
    moveAssetsToFolder,
    rescanAsset,
    analyzeAsset,
    refreshAll,
    clearCache: clearApiCache,
  };
}

/**
 * Hook for bulk operations on assets
 */
export function useBulkAssetOperations() {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isOperating, setIsOperating] = useState(false);

  const selectAll = useCallback((ids: number[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelection = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const bulkDelete = useCallback(async (ids: number[]): Promise<void> => {
    setIsOperating(true);
    try {
      await Promise.all(ids.map(id => invoke('delete_asset', { id })));
      toast.success(`Deleted ${ids.length} assets`);
    } finally {
      setIsOperating(false);
    }
  }, []);

  const bulkMoveToFolder = useCallback(async (ids: number[], folderId: number): Promise<void> => {
    setIsOperating(true);
    try {
      await invoke('move_assets_to_folder', { assetIds: ids, folderId });
      toast.success(`Moved ${ids.length} assets`);
    } finally {
      setIsOperating(false);
    }
  }, []);

  return {
    selectedIds,
    isOperating,
    selectAll,
    clearSelection,
    toggleSelection,
    bulkDelete,
    bulkMoveToFolder,
    hasSelection: selectedIds.size > 0,
    selectionCount: selectedIds.size,
  };
}
