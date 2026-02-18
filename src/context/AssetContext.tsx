import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { Asset, Folder } from '../types';
import { invoke } from '@tauri-apps/api/core';
import { useDebugLogger } from '../components/debug/DebugConsole';

interface AssetState {
  assets: Asset[];
  folders: Folder[];
  activeFolderId: number | null;
  selectedIds: Set<number>;
  lastClickedId: number | null;
  selectedTreePath: string | null;
  workbenchIds: Set<number>;
  contextMenu: { x: number, y: number, id: number } | null;
  isLoading: boolean;
}

interface AssetAction {
  type: string;
  payload?: any;
}

const initialState: AssetState = {
  assets: [],
  folders: [{ id: 1, name: 'Default', parent_id: null }],
  activeFolderId: 1,
  selectedIds: new Set(),
  lastClickedId: null,
  selectedTreePath: null,
  workbenchIds: new Set(),
  contextMenu: null,
  isLoading: false,
};

const assetReducer = (state: AssetState, action: AssetAction): AssetState => {
  switch (action.type) {
    case 'SET_ASSETS':
      return { ...state, assets: action.payload };
    case 'SET_FOLDERS':
      return { ...state, folders: action.payload };
    case 'SET_ACTIVE_FOLDER':
      return { ...state, activeFolderId: action.payload };
    case 'SET_SELECTED_IDS':
      return { ...state, selectedIds: action.payload };
    case 'SET_LAST_CLICKED_ID':
      return { ...state, lastClickedId: action.payload };
    case 'SET_SELECTED_TREE_PATH':
      return { ...state, selectedTreePath: action.payload };
    case 'SET_WORKBENCH_IDS':
      return { ...state, workbenchIds: action.payload };
    case 'SET_CONTEXT_MENU':
      return { ...state, contextMenu: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'ADD_ASSET':
      return { ...state, assets: [...state.assets, action.payload] };
    case 'REMOVE_ASSET':
      return { ...state, assets: state.assets.filter(a => a.id !== action.payload) };
    case 'UPDATE_ASSET':
      return {
        ...state,
        assets: state.assets.map(a => a.id === action.payload.id ? { ...a, ...action.payload } : a)
      };
    case 'ADD_FOLDER':
      return { ...state, folders: [...state.folders, action.payload] };
    case 'REMOVE_FOLDER':
      return { ...state, folders: state.folders.filter(f => f.id !== action.payload) };
    case 'UPDATE_FOLDER':
      return {
        ...state,
        folders: state.folders.map(f => f.id === action.payload.id ? { ...f, ...action.payload } : f)
      };
    default:
      return state;
  }
};

interface AssetContextType {
  state: AssetState;
  dispatch: React.Dispatch<AssetAction>;
  loadAssets: () => Promise<void>;
  loadFolders: () => Promise<void>;
  refreshData: () => Promise<void>;
  handleAssetMouseDown: (id: number, e: React.MouseEvent) => void;
  handleContextMenu: (id: number, e: React.MouseEvent) => void;
}

const AssetContext = createContext<AssetContextType | undefined>(undefined);

export function AssetProvider({ children }: { children: ReactNode }) {
  const { error } = useDebugLogger();
  const [state, dispatch] = useReducer(assetReducer, initialState);

  const loadAssets = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const data = await invoke<Asset[]>('get_assets');
      dispatch({ type: 'SET_ASSETS', payload: data });
      
      // Sync workbench state with DB source
      const wbIds = new Set<number>();
      data.forEach(a => {
        if (a.is_workbench) {
          wbIds.add(a.id);
        }
      });
      dispatch({ type: 'SET_WORKBENCH_IDS', payload: wbIds });
    } catch (e) {
      error('db', `Failed to load assets: ${e}`);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [error]);

  const loadFolders = useCallback(async () => {
    try {
      const data = await invoke<Folder[]>('get_folders');
      dispatch({ type: 'SET_FOLDERS', payload: data });
    } catch (e) {
      error('db', `Failed to load folders: ${e}`);
    }
  }, [error]);

  const refreshData = useCallback(async () => {
    await Promise.all([loadFolders(), loadAssets()]);
  }, [loadFolders, loadAssets]);

  const handleAssetMouseDown = useCallback((id: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    
    let nextSelection = new Set(state.selectedIds);
    if (e.shiftKey && state.lastClickedId !== null) {
      const startIdx = state.assets.findIndex(a => a.id === state.lastClickedId);
      const endIdx = state.assets.findIndex(a => a.id === id);
      
      if (startIdx !== -1 && endIdx !== -1) {
        const start = Math.min(startIdx, endIdx);
        const end = Math.max(startIdx, endIdx);
        
        // If not ctrl/cmd, clear previous range
        if (!e.ctrlKey && !e.metaKey) nextSelection.clear();
        
        for (let i = start; i <= end; i++) {
          nextSelection.add(state.assets[i].id);
        }
      }
    } else if (e.ctrlKey || e.metaKey) {
      if (nextSelection.has(id)) nextSelection.delete(id);
      else nextSelection.add(id);
    } else {
      nextSelection = new Set([id]);
    }
    
    dispatch({ type: 'SET_SELECTED_IDS', payload: nextSelection });
    dispatch({ type: 'SET_LAST_CLICKED_ID', payload: id });
    dispatch({ type: 'SET_CONTEXT_MENU', payload: null });
  }, [state]);

  const handleContextMenu = useCallback((id: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (!state.selectedIds.has(id)) {
      dispatch({ type: 'SET_SELECTED_IDS', payload: new Set([id]) });
      dispatch({ type: 'SET_LAST_CLICKED_ID', payload: id });
    }
    dispatch({ type: 'SET_CONTEXT_MENU', payload: { x: e.clientX, y: e.clientY, id } });
  }, [state]);

  const value = {
    state,
    dispatch,
    loadAssets,
    loadFolders,
    refreshData,
    handleAssetMouseDown,
    handleContextMenu,
  };

  return (
    <AssetContext.Provider value={value}>
      {children}
    </AssetContext.Provider>
  );
}

export function useAsset() {
  const context = useContext(AssetContext);
  if (context === undefined) {
    throw new Error('useAsset must be used within an AssetProvider');
  }
  return context;
}