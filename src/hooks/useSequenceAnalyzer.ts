import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Asset } from '../types';

export function useSequenceAnalyzer(assets: Asset[], selectedIds: Set<number>) {
    const [smartFilter, setSmartFilter] = useState<'All' | 'Critical' | 'PII' | 'Secrets' | 'Shadow'>('All');
    const [showCommandBar, setShowCommandBar] = useState(false);
    const [commandQuery, setCommandQuery] = useState('');
    const [isSequenceModalOpen, setIsSequenceModalOpen] = useState(false);
    const [sequenceAnalysis, setSequenceAnalysis] = useState<string | null>(null);
    const [isAnalyzingSequence, setIsAnalyzingSequence] = useState(false);
    const [sequenceFlowName, setSequenceFlowName] = useState('');

    const handleAnalyzeFlow = useCallback(async () => {
        const selectedAssets = assets.filter(a => selectedIds.has(a.id));
        if (selectedAssets.length === 0) return;
    
        selectedAssets.sort((a, b) => a.id - b.id);
    
        const flowName = `Ad-hoc Analysis ${new Date().toLocaleTimeString()}`;
        setSequenceFlowName(flowName);
        setIsSequenceModalOpen(true);
        setSequenceAnalysis(null);
        setIsAnalyzingSequence(true);
    
        try {
            const sequenceId = await invoke<string>('start_sequence', { 
                name: flowName, 
                contextSummary: "User selected assets for manual flow analysis." 
            });
    
            for (const asset of selectedAssets) {
                await invoke('add_to_sequence', {
                    db: null,
                    sequenceId,
                    assetId: asset.id,
                    method: asset.method,
                    url: asset.url,
                    statusCode: asset.status_code,
                    requestBody: asset.request_body || null,
                    responseBody: asset.response_body || null,
                    requestHeaders: asset.request_headers || null,
                    responseHeaders: asset.response_headers || null
                });
            }
    
            const fullSequence = await invoke<any>('get_sequence', { id: sequenceId });
            const result = await invoke<{ analysis: string, provider: string }>('analyze_sequence', {
                sequence: fullSequence,
                context: null
            });
    
            setSequenceAnalysis(result.analysis);
        } catch (e) {
            setSequenceAnalysis(`Error analyzing sequence: ${e}`);
        } finally {
            setIsAnalyzingSequence(false);
        }
    }, [assets, selectedIds]);

    return {
        smartFilter, setSmartFilter,
        showCommandBar, setShowCommandBar,
        commandQuery, setCommandQuery,
        isSequenceModalOpen, setIsSequenceModalOpen,
        sequenceAnalysis, setSequenceAnalysis,
        isAnalyzingSequence, setIsAnalyzingSequence,
        sequenceFlowName, setSequenceFlowName,
        handleAnalyzeFlow
    };
}
