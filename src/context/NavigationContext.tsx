
import { createContext, useContext, useState, ReactNode } from 'react';
import { ActiveView, AssetSidebarView } from '../types';
import { InspectorTab } from '../components/inspector/Inspector';

interface NavigationContextType {
    activeView: ActiveView;
    setActiveView: (view: ActiveView) => void;
    assetSidebarView: AssetSidebarView;
    setAssetSidebarView: (view: AssetSidebarView) => void;
    
    // UI state
    inspectorWidth: number;
    setInspectorWidth: (width: number) => void;
    activeInspectorTab: InspectorTab;
    setActiveInspectorTab: (tab: InspectorTab) => void;
    
    isDebugConsoleOpen: boolean;
    setIsDebugConsoleOpen: (isOpen: boolean) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
    const [activeView, setActiveView] = useState<ActiveView>('assets');
    const [assetSidebarView, setAssetSidebarView] = useState<AssetSidebarView>('tree');
    const [inspectorWidth, setInspectorWidth] = useState(400);
    const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>('Summary');
    const [isDebugConsoleOpen, setIsDebugConsoleOpen] = useState(false);

    return (
        <NavigationContext.Provider value={{
            activeView,
            setActiveView,
            assetSidebarView,
            setAssetSidebarView,
            inspectorWidth,
            setInspectorWidth,
            activeInspectorTab,
            setActiveInspectorTab,
            isDebugConsoleOpen,
            setIsDebugConsoleOpen
        }}>
            {children}
        </NavigationContext.Provider>
    );
}

export function useNavigation() {
    const context = useContext(NavigationContext);
    if (context === undefined) {
        throw new Error('useNavigation must be used within a NavigationProvider');
    }
    return context;
}
