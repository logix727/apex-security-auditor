import { createContext, useContext, ReactNode, useMemo } from 'react';
import { Asset, Folder, SortConfig } from '../types';
import { useTableSort } from '../hooks/useTableSort';
import { useAssetData } from '../hooks/useAssetData';
import { useAssetFilter } from '../hooks/useAssetFilter';

interface AppContextType {
    // Core Data
    assets: Asset[];
    setAssets: (assets: Asset[]) => void;
    folders: Folder[];
    setFolders: (folders: Folder[]) => void;
    
    // Selection & Navigation
    activeFolderId: number | null;
    setActiveFolderId: (id: number | null) => void;
    selectedIds: Set<number>;
    setSelectedIds: (ids: Set<number>) => void;
    lastClickedId: number | null;
    setLastClickedId: (id: number | null) => void;
    selectedTreePath: string | null;
    setSelectedTreePath: (path: string | null) => void;
    workbenchIds: Set<number>;
    setWorkbenchIds: (ids: Set<number>) => void;
    
    // UI State
    contextMenu: { x: number, y: number, id: number } | null;
    setContextMenu: (menu: { x: number, y: number, id: number } | null) => void;

    // Filters & Sorting
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    filterSource: string;
    setFilterSource: (source: string) => void;
    filterMethod: string;
    setFilterMethod: (method: string) => void;
    filterStatus: string;
    setFilterStatus: (status: string) => void;
    filterRisk: number;
    setFilterRisk: (risk: number) => void;
    visibleColumns: Set<string>;
    setVisibleColumns: (cols: Set<string>) => void;
    
    bodySearchTerm: string;
    setBodySearchTerm: (term: string) => void;
    
    // Derived State (Hooks)
    sortConfig: SortConfig | null;
    handleSort: (key: keyof Asset) => void;
    filteredAssets: Asset[]; 
    sortedAssets: Asset[];   
    
    workbenchFilterAdapter: any; 

    // Actions
    loadFolders: () => Promise<void>;
    loadAssets: () => Promise<void>;
    refreshData: () => Promise<void>;
    handleAssetMouseDown: (id: number, e: React.MouseEvent) => void;
    handleContextMenu: (id: number, e: React.MouseEvent) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
    const assetData = useAssetData();
    const assetFilter = useAssetFilter(
        assetData.assets, 
        assetData.activeFolderId, 
        assetData.selectedTreePath
    );

    const { sortConfig, handleSort, sortData } = useTableSort<Asset>();
    const sortedAssets = useMemo(() => sortData(assetFilter.filteredAssets), [assetFilter.filteredAssets, sortData]);

    const handleAssetMouseDown = (id: number, e: React.MouseEvent) => {
        assetData.handleAssetMouseDown(id, e, sortedAssets);
    };

    const workbenchFilterAdapter = {
        filters: {}, 
        setFilter: () => {}, 
        getFilter: () => undefined,
        resetFilters: () => {},
        resetFilter: () => {},
        filterData: (data: Asset[]) => data, 
        activeFilterCount: 0,
        hasActiveFilters: false,
        searchTerm: assetFilter.searchTerm,
        setSearchTerm: assetFilter.setSearchTerm,
        filterFn: (a: Asset) => {
            if (!assetFilter.searchTerm) return true;
            return a.url.toLowerCase().includes(assetFilter.searchTerm.toLowerCase());
        }
    };

    return (
        <AppContext.Provider value={{
            ...assetData,
            ...assetFilter,
            sortConfig,
            handleSort,
            sortedAssets,
            handleAssetMouseDown,
            workbenchFilterAdapter
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
}
