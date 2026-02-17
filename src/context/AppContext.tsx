import { createContext, useContext, ReactNode, useMemo } from 'react';
import { Asset, Folder, SortConfig } from '../types';
import { useTableSort } from '../hooks/useTableSort';
import { useAssetData } from '../hooks/useAssetData';
import { useAssetFilter } from '../hooks/useAssetFilter';

interface AppContextType {
    // Core Data
    assets: Asset[];
    setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
    folders: Folder[];
    setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
    
    // Selection & Navigation
    activeFolderId: number | null;
    setActiveFolderId: React.Dispatch<React.SetStateAction<number | null>>;
    selectedIds: Set<number>;
    setSelectedIds: React.Dispatch<React.SetStateAction<Set<number>>>;
    lastClickedId: number | null;
    setLastClickedId: React.Dispatch<React.SetStateAction<number | null>>;
    selectedTreePath: string | null;
    setSelectedTreePath: React.Dispatch<React.SetStateAction<string | null>>;
    workbenchIds: Set<number>;
    setWorkbenchIds: React.Dispatch<React.SetStateAction<Set<number>>>;
    
    // UI State
    contextMenu: { x: number, y: number, id: number } | null;
    setContextMenu: React.Dispatch<React.SetStateAction<{ x: number, y: number, id: number } | null>>;

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
