import { createContext, useContext, ReactNode, useEffect } from 'react';
// Wait, I should import the hooks directly.
import { useLlmEngine } from '../hooks/useLlmEngine';
import { useProxyManager } from '../hooks/useProxyManager';
import { useSequenceAnalyzer } from '../hooks/useSequenceAnalyzer';
import { useApp } from './AppContext';
import { ShadowApiReport as ShadowApiReportType } from '../types';
import { useState } from 'react';

interface AnalysisContextType {
    // LLM State
    llmEngineType: 'builtin' | 'custom';
    setLlmEngineType: (type: 'builtin' | 'custom') => void;
    llmFormProvider: string;
    setLlmFormProvider: (provider: string) => void;
    llmFormEndpoint: string;
    setLlmFormEndpoint: (endpoint: string) => void;
    llmFormApiKey: string;
    setLlmFormApiKey: (key: string) => void;
    llmFormModel: string;
    setLlmFormModel: (model: string) => void;
    localModelReady: boolean | null;
    pullingModel: boolean;
    
    // Sequence Analysis State
    smartFilter: 'All' | 'Critical' | 'PII' | 'Secrets' | 'Shadow';
    setSmartFilter: (filter: 'All' | 'Critical' | 'PII' | 'Secrets' | 'Shadow') => void;
    showCommandBar: boolean;
    setShowCommandBar: (show: boolean) => void;
    commandQuery: string;
    setCommandQuery: (query: string) => void;
    isSequenceModalOpen: boolean;
    setIsSequenceModalOpen: (open: boolean) => void;
    sequenceAnalysis: string | null;
    setSequenceAnalysis: (analysis: string | null) => void;
    isAnalyzingSequence: boolean;
    setIsAnalyzingSequence: (analyzing: boolean) => void;
    sequenceFlowName: string;
    setSequenceFlowName: (name: string) => void;
    
    // Proxy State
    proxyRunning: boolean;
    setProxyRunning: (running: boolean) => void;
    proxyPort: number;
    setProxyPort: (port: number) => void;
    
    // Shadow API
    activeShadowApiReport: ShadowApiReportType | null;
    setActiveShadowApiReport: (report: ShadowApiReportType | null) => void;
    lastSpecContent: string | null;
    setLastSpecContent: (content: string | null) => void;
    
    // Actions
    loadLlmConfig: () => Promise<void>;
    handleSaveLlmConfig: () => Promise<void>;
    handlePullModel: () => Promise<void>;
    handleProviderChange: (provider: string) => void;
    checkModelStatus: () => Promise<void>;
    handleAnalyzeFlow: () => Promise<void>;
    handleToggleProxy: () => Promise<void>;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export function AnalysisProvider({ children }: { children: ReactNode }) {
    const { assets, selectedIds } = useApp();
    
    const llmEngine = useLlmEngine();
    const proxyManager = useProxyManager();
    const sequenceAnalyzer = useSequenceAnalyzer(assets, selectedIds);

    // Shadow API (Left in context for now as it's simple state)
    const [activeShadowApiReport, setActiveShadowApiReport] = useState<ShadowApiReportType | null>(null);
    const [lastSpecContent, setLastSpecContent] = useState<string | null>(null);

    useEffect(() => {
        llmEngine.loadLlmConfig();
    }, []);

    return (
        <AnalysisContext.Provider value={{
            ...llmEngine,
            ...proxyManager,
            ...sequenceAnalyzer,
            activeShadowApiReport,
            setActiveShadowApiReport,
            lastSpecContent,
            setLastSpecContent
        }}>
            {children}
        </AnalysisContext.Provider>
    );
}

export function useAnalysis() {
    const context = useContext(AnalysisContext);
    if (context === undefined) {
        throw new Error('useAnalysis must be used within an AnalysisProvider');
    }
    return context;
}
