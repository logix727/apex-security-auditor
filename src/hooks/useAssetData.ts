import { useState, useCallback, useEffect, useRef } from 'react';
import { Asset, Folder } from '../types';
import { invoke } from '@tauri-apps/api/core';
import { useDebugLogger } from '../components/debug/DebugConsole';

// Memory pool for asset objects to reduce GC pressure
const assetPool = new Map<number, Asset>();

// Cleanup function for memory management
const cleanupAssetPool = () => {
    assetPool.clear();
};

// Web Worker for heavy computations
const assetWorker = new Worker(new URL('../workers/assetWorker.ts', import.meta.url));

export function useAssetData() {
    const { error } = useDebugLogger();

    const [assets, setAssets] = useState<Asset[]>([]);
    const [folders, setFolders] = useState<Folder[]>([{ id: 1, name: 'Default', parent_id: null }]);
    
    const [activeFolderId, setActiveFolderId] = useState<number | null>(1);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [lastClickedId, setLastClickedId] = useState<number | null>(null);
    const [selectedTreePath, setSelectedTreePath] = useState<string | null>(null);
    const [workbenchIds, setWorkbenchIds] = useState<Set<number>>(new Set());
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, id: number } | null>(null);

    // Track asset loading state
    const isLoading = useRef<boolean>(false);

    const loadFolders = useCallback(async () => {
        try {
            const data = await invoke<Folder[]>('get_folders');
            setFolders(data);
        } catch (e) {
            error('db', `Failed to load folders: ${e}`);
        }
    }, [error]);

    const loadAssets = useCallback(async () => {
        if (isLoading.current) return [];
        
        isLoading.current = true;
        try {
            const data = await invoke<Asset[]>('get_assets');
            
            // Use memory pool for asset objects
            const pooledAssets = data.map(asset => {
                if (assetPool.has(asset.id)) {
                    return assetPool.get(asset.id)!;
                }
                assetPool.set(asset.id, asset);
                return asset;
            });
            
            // Offload heavy computations to Web Worker
            assetWorker.postMessage({ type: 'PROCESS_ASSETS', data: pooledAssets });
            
            assetWorker.onmessage = (event) => {
                if (event.data.type === 'PROCESS_ASSETS_COMPLETE') {
                    const processedAssets = event.data.data;
                    setAssets(processedAssets);
                    
                    // Sync workbench state with DB source
                    const wbIds = new Set<number>();
                    processedAssets.forEach((a: Asset) => {
                        if (a.is_workbench) {
                            wbIds.add(a.id);
                        }
                    });
                    setWorkbenchIds(wbIds);
                }
            };
            
            return pooledAssets;
        } catch (e) {
            error('db', `Failed to load assets: ${e}`);
            return [];
        } finally {
            isLoading.current = false;
        }
    }, [error]);

    const refreshData = useCallback(async () => {
        await Promise.all([loadFolders(), loadAssets()]);
    }, [loadFolders, loadAssets]);

    const handleAssetMouseDown = useCallback((id: number, e: React.MouseEvent, sortedAssetsOverride?: Asset[]) => {
        if (e.button !== 0) return;
        
        // Use the current sorted view if provided, otherwise the base list
        const listToUse = sortedAssetsOverride || assets;
        
        let nextSelection = new Set(selectedIds);
        if (e.shiftKey && lastClickedId !== null) {
            const startIdx = listToUse.findIndex(a => a.id === lastClickedId);
            const endIdx = listToUse.findIndex(a => a.id === id);
            
            if (startIdx !== -1 && endIdx !== -1) {
                const start = Math.min(startIdx, endIdx);
                const end = Math.max(startIdx, endIdx);
                
                // If not ctrl/cmd, clear previous range
                if (!e.ctrlKey && !e.metaKey) nextSelection.clear();
                
                for (let i = start; i <= end; i++) {
                    nextSelection.add(listToUse[i].id);
                }
            }
        } else if (e.ctrlKey || e.metaKey) {
            if (nextSelection.has(id)) nextSelection.delete(id);
            else nextSelection.add(id);
        } else {
            nextSelection = new Set([id]);
        }
        
        setSelectedIds(nextSelection);
        setLastClickedId(id);
        setContextMenu(null);
    }, [selectedIds, lastClickedId, assets]);

    const handleContextMenu = useCallback((id: number, e: React.MouseEvent) => {
        e.preventDefault();
        if (!selectedIds.has(id)) {
            setSelectedIds(new Set([id]));
            setLastClickedId(id);
        }
        setContextMenu({ x: e.clientX, y: e.clientY, id });
    }, [selectedIds]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanupAssetPool();
        };
    }, []);

    return {
        assets, setAssets,
        folders, setFolders,
        activeFolderId, setActiveFolderId,
        selectedIds, setSelectedIds,
        lastClickedId, setLastClickedId,
        selectedTreePath, setSelectedTreePath,
        workbenchIds, setWorkbenchIds,
        contextMenu, setContextMenu,
        loadFolders, loadAssets, refreshData,
        handleAssetMouseDown, handleContextMenu
    };
}
