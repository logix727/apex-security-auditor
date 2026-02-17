import { useState, useCallback } from 'react';
import { Asset, Folder } from '../types';
import { invoke } from '@tauri-apps/api/core';
import { useDebugLogger } from '../components/DebugConsole';

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

    const loadFolders = useCallback(async () => {
        try {
            const data = await invoke<Folder[]>('get_folders');
            setFolders(data);
        } catch (e) {
            error('db', `Failed to load folders: ${e}`);
        }
    }, [error]);

    const loadAssets = useCallback(async () => {
        try {
            const data = await invoke<Asset[]>('get_assets');
            setAssets(data);
        } catch (e) {
            error('db', `Failed to load assets: ${e}`);
        }
    }, [error]);

    const refreshData = useCallback(async () => {
        await Promise.all([loadFolders(), loadAssets()]);
    }, [loadFolders, loadAssets]);

    const handleAssetMouseDown = useCallback((id: number, e: React.MouseEvent, sortedAssets: Asset[]) => {
        if (e.button !== 0) return;
        let nextSelection = new Set(selectedIds);
        if (e.shiftKey && lastClickedId !== null) {
            const startIdx = sortedAssets.findIndex(a => a.id === lastClickedId);
            const endIdx = sortedAssets.findIndex(a => a.id === id);
            if (startIdx !== -1 && endIdx !== -1) {
                const start = Math.min(startIdx, endIdx);
                const end = Math.max(startIdx, endIdx);
                if (!e.ctrlKey && !e.metaKey) nextSelection.clear();
                for (let i = start; i <= end; i++) nextSelection.add(sortedAssets[i].id);
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
    }, [selectedIds, lastClickedId]);

    const handleContextMenu = useCallback((id: number, e: React.MouseEvent) => {
        e.preventDefault();
        if (!selectedIds.has(id)) {
            setSelectedIds(new Set([id]));
            setLastClickedId(id);
        }
        setContextMenu({ x: e.clientX, y: e.clientY, id });
    }, [selectedIds]);

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
