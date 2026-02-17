import React, { useState, useMemo, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Asset, Badge } from '../types';
import { computeDiff } from '../utils/diffUtils';

import { InspectorTabs } from './inspector/InspectorTabs';
import { SummaryTab } from './inspector/SummaryTab';
import { ExchangeTab } from './inspector/ExchangeTab';
import { SecurityTab } from './inspector/SecurityTab';
import { DetailsTab } from './inspector/DetailsTab';
import { AiAnalysisModal } from './inspector/AiAnalysisModal';

import { ResponseDiff } from './inspector/ResponseDiff';

export type InspectorTab = 'Summary' | 'Exchange' | 'Security' | 'Details' | 'Diff';

interface InspectorProps {
    inspectorAsset: Asset | null;
    workbenchSummary: any;
    activeInspectorTab: InspectorTab;
    setActiveInspectorTab: (tab: InspectorTab) => void;
    bodySearchTerm: string;
    setBodySearchTerm: (term: string) => void;
    handleRescan: (id?: number) => void;
    showInspector: boolean;
    inspectorWidth: number;
    selectedIdsCount: number;
    activeView: string;
    decodedJwt: any | null;
    setDecodedJwt: (claims: any | null) => void;
    onRefresh: () => void;
}

const SECRET_REGEXES = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    jwt: /ey[a-zA-Z0-9_-]+\.ey[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    aws_key: /AKIA[0-9A-Z]{16}/g,
    api_key: /api[_-]?key[:=]\s?['"]?([a-zA-Z0-9]{20,})['"]?/gi,
    auth_bearer: /bearer\s+[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/gi
};

const highlightFindings = (text: string, findings: Badge[], query: string) => {
    if (!text) return text;
    
    // Collect terms
    const termsMap = new Map<string, string>(); // lowercase -> original
    if (query) termsMap.set(query.toLowerCase(), query);
    
    findings.forEach(f => {
        if (f.evidence) termsMap.set(f.evidence.toLowerCase(), f.evidence);
    });

    if (termsMap.size === 0) return text;

    const sortedTerms = Array.from(termsMap.keys()).sort((a, b) => b.length - a.length);
    const regex = new RegExp(`(${sortedTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    
    const parts = text.split(regex);
    let searchMatchFound = false;

    return (
      <>
        {parts.map((part, i) => {
          if (!part) return null;
          const lowerPart = part.toLowerCase();
          const isQueryMatch = query && lowerPart === query.toLowerCase();
          const isFindingMatch = termsMap.has(lowerPart);
          
          if (isQueryMatch || isFindingMatch) {
              const isFirstSearchMatch = isQueryMatch && !searchMatchFound;
              if (isFirstSearchMatch) searchMatchFound = true;

              return (
                <mark 
                    id={isFirstSearchMatch ? "highlight-match" : undefined}
                    key={i} 
                    style={{
                        background: isQueryMatch ? 'var(--accent-color)' : 'rgba(239, 68, 68, 0.2)', 
                        color: isQueryMatch ? 'white' : 'inherit', 
                        borderRadius: '2px', 
                        padding: '0 2px',
                        border: isQueryMatch ? 'none' : '1px solid rgba(239, 68, 68, 0.4)',
                        cursor: isFindingMatch ? 'help' : 'text'
                    }}
                    title={isFindingMatch ? "Detected Finding" : undefined}
                >
                    {part}
                </mark>
              );
          }
          return part;
        })}
      </>
    );
};

const formatContent = (content: string) => {
    if (!content) return '';
    const trimmed = content.trim();
    try {
        // JSON
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                return JSON.stringify(JSON.parse(trimmed), null, 2);
            } catch (e) {}
        }

        // HTML/XML
        if (trimmed.startsWith('<')) {
            let formatted = '';
            let indent = 0;
            const nodes = trimmed.split(/>\s*</);
            nodes.forEach((node, i) => {
                let current = node;
                if (i === 0 && current.startsWith('<')) current = current.substring(1);
                if (i === nodes.length - 1 && current.endsWith('>')) current = current.substring(0, current.length - 1);
                
                if (current.startsWith('/')) indent--;
                formatted += '  '.repeat(Math.max(0, indent)) + '<' + current + '>\n';
                if (!current.startsWith('/') && !current.endsWith('/') && !current.startsWith('!') && !current.startsWith('?')) {
                     indent++;
                }
            });
            return formatted.trim();
        }

        // CSS-like (braces and semicolons)
        if (trimmed.includes('{') && trimmed.includes(';') && trimmed.includes('}')) {
             return trimmed
                .replace(/\{/g, ' {\n  ')
                .replace(/\}/g, '\n}\n')
                .replace(/;/g, ';\n  ')
                .replace(/\n\s*\n/g, '\n')
                .trim();
        }

        // YAML/KV (lines with ': ')
        if (trimmed.split('\n').every(line => line.includes(': ') || line.trim() === '')) {
             return trimmed; // Already KV-like
        }
        
        return trimmed;
    } catch (e) {
        return trimmed;
    }
};



export const Inspector: React.FC<InspectorProps> = ({
    inspectorAsset,
    workbenchSummary,
    activeInspectorTab,
    setActiveInspectorTab,
    bodySearchTerm,
    setBodySearchTerm,
    handleRescan,
    showInspector,
    inspectorWidth,
    selectedIdsCount,
    activeView,
    decodedJwt,
    setDecodedJwt,
    onRefresh
}) => {
    const [maskSensitive, setMaskSensitive] = useState(false);
    
    // AI Asset Summary State
    const [assetSummary, setAssetSummary] = useState<{ summary: string; provider: string } | null>(null);
    const [assetSummaryLoading, setAssetSummaryLoading] = useState(false);

    // History State
    const [history, setHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [isFormatted, setIsFormatted] = useState(false);
    const [diffBaseId, setDiffBaseId] = useState<number | null>(null);

    // AI Finding Analysis State
    const [aiAnalysis, setAiAnalysis] = useState<{ analysis: string; provider: string } | null>(null);
    const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
    const [aiAnalysisFinding, setAiAnalysisFinding] = useState<string | null>(null);

    // Scroll to highlight
    useEffect(() => {
        if (bodySearchTerm) {
            // Short timeout to allow rendering to complete
            setTimeout(() => {
                const element = document.getElementById('highlight-match');
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    }, [bodySearchTerm, activeInspectorTab]);

    useEffect(() => {
        setAssetSummary(null);
        setAiAnalysis(null);
        
        // Auto-toggle formatting for certain content types
        if (inspectorAsset?.response_body) {
            const body = inspectorAsset.response_body.trim();
            const shouldFormat = body.startsWith('<') || (body.includes('{') && body.includes(';'));
            setIsFormatted(shouldFormat);
        }

        // Automatically trigger summary if we're on the summary tab
        if (inspectorAsset && activeInspectorTab === 'Summary') {
            handleAnalyzeAssetSummary();
        }
        if (inspectorAsset && (activeInspectorTab === 'Details' || activeInspectorTab === 'Diff')) {
            handleFetchHistory();
        }
    }, [inspectorAsset?.id, activeInspectorTab]);

    const handleFetchHistory = async () => {
        if (!inspectorAsset) return;
        setHistoryLoading(true);
        try {
            const res = await invoke<any[]>('get_asset_history', { assetId: inspectorAsset.id });
            setHistory(res || []);
            // Default diff base to the most recent historical scan if not set
            if (res && res.length > 0 && diffBaseId === null) {
                setDiffBaseId(res[0].id);
            }
        } catch (e) {
            console.error('Failed to fetch asset history:', e);
        } finally {
            setHistoryLoading(false);
        }
    };

    const secretsFound = useMemo(() => {
        if (!inspectorAsset?.response_body && !inspectorAsset?.response_headers) return [];
        const text = (inspectorAsset.response_body || '') + (inspectorAsset.response_headers || '');
        const found: { type: string, value: string }[] = [];
        
        Object.entries(SECRET_REGEXES).forEach(([type, regex]) => {
            const matches = text.match(regex);
            if (matches) {
                matches.forEach((m: string) => {
                    if (!found.find(f => f.value === m)) {
                        found.push({ type, value: m });
                    }
                });
            }
        });
        return found;
    }, [inspectorAsset?.response_body, inspectorAsset?.response_headers]);

    const parsedBody = useMemo(() => {
        if (!inspectorAsset?.response_body) return null;
        try {
            return JSON.parse(inspectorAsset.response_body);
        } catch (e) {
            return null;
        }
    }, [inspectorAsset?.response_body]);

    const handleAnalyzeFinding = async (f: Badge) => {
        if (!inspectorAsset) return;
        
        setAiAnalysisLoading(true);
        setAiAnalysisFinding(f.short);
        setAiAnalysis(null);

        try {
            const result = await invoke<{ analysis: string; provider: string }>('analyze_finding', { 
                assetUrl: inspectorAsset.url,
                findingType: `${f.short} (${f.severity})`, 
                responseBodySnippet: (inspectorAsset.response_body || '').substring(0, 1000),
                context: `OWASP: ${f.owasp_category}, Description: ${f.description}`
            });
            setAiAnalysis(result);
        } catch (e) {
            console.error('AI analysis failed:', e);
            setAiAnalysis({ analysis: `⚠️ AI analysis failed: ${e}`, provider: 'Error' });
        } finally {
            setAiAnalysisLoading(false);
        }
    };

    const handleAnalyzeAssetSummary = async () => {
        if (!inspectorAsset) return;

        setAssetSummaryLoading(true);
        
        try {
            const findingsList = inspectorAsset.findings.map((f: Badge) => `${f.emoji} ${f.short} (${f.severity}) [${f.owasp_category || 'General'}] - ${f.description}`).slice(0, 20); // Limit to top 20
            
            const result = await invoke<{ summary: string; provider: string }>('analyze_asset_summary', {
                assetUrl: inspectorAsset.url,
                findings: findingsList,
                requestHeaders: inspectorAsset.request_headers || '',
                responseBodySnippet: (inspectorAsset.response_body || '').substring(0, 1000),
                headersSnippet: (inspectorAsset.response_headers || '').substring(0, 1000),
                context: `Method: ${inspectorAsset.method}, Status: ${inspectorAsset.status_code}, Risk: ${inspectorAsset.risk_score}`
            });
            
            setAssetSummary(result);
        } catch (e) {
            console.error('AI Asset Summary failed:', e);
            setAssetSummary({ summary: `⚠️ AI Summary failed to generate: ${e}`, provider: 'Error' });
        } finally {
            setAssetSummaryLoading(false);
        }
    };

    const handleToggleFP = async (finding: Badge, is_fp: boolean) => {
        if (!inspectorAsset) return;
        try {
            await invoke('toggle_finding_fp', {
                assetId: inspectorAsset.id,
                findingShort: finding.short,
                findingEvidence: finding.evidence || null,
                isFp: is_fp,
                reason: is_fp ? "Marked as False Positive by auditor" : null
            });
            onRefresh(); // Refresh global assets state to show updated risk score and findings
        } catch (e) {
            alert("Failed to update finding status: " + e);
        }
    };
    
    const getTermForFinding = (f: Badge, body: string): string => {
        // Use exact evidence if available
        if (f.evidence) return f.evidence;
        
        // Try to extract evidence from description if quoted
        const quoted = f.description.match(/'([^']+)'/);
        if (quoted && body.includes(quoted[1])) return quoted[1];
        
        // Map common types to regex searches (first match)
        if (f.short.toLowerCase().includes('email')) {
             const match = body.match(SECRET_REGEXES.email);
             if (match) return match[0];
        }
        if (f.short.toLowerCase().includes('jwt')) {
             const match = body.match(SECRET_REGEXES.jwt);
             if (match) return match[0];
        }
        // Fallback: If description is short, search that. If short code is specific, use that.
        if (f.short.length >= 3 && body.toLowerCase().includes(f.short.toLowerCase())) return f.short;
        
        return '';
    };

    const handleFindingClick = (f: Badge) => {
        setActiveInspectorTab('Exchange');
        const term = getTermForFinding(f, inspectorAsset?.response_body || '');
        if (term) setBodySearchTerm(term);
    };

    return (
      <aside className="inspector" style={{ gridArea: 'inspector', width: showInspector ? `${inspectorWidth}px` : '0px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <InspectorTabs 
            activeInspectorTab={activeInspectorTab}
            setActiveInspectorTab={setActiveInspectorTab}
            hasSecrets={secretsFound.length > 0}
            showSummary={selectedIdsCount > 0 || (activeView === 'workbench' && !!workbenchSummary)}
        />

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {activeInspectorTab === 'Summary' && (
                <SummaryTab 
                    inspectorAsset={inspectorAsset}
                    workbenchSummary={workbenchSummary}
                    assetSummary={assetSummary}
                    assetSummaryLoading={assetSummaryLoading}
                    handleFindingClick={handleFindingClick}
                    handleAnalyzeFinding={handleAnalyzeFinding}
                    handleToggleFP={handleToggleFP}
                />
            )}

            {activeInspectorTab === 'Exchange' && inspectorAsset && (
                <ExchangeTab 
                    inspectorAsset={inspectorAsset}
                    bodySearchTerm={bodySearchTerm}
                    setBodySearchTerm={setBodySearchTerm}
                    handleRescan={handleRescan}
                    maskSensitive={maskSensitive}
                    setMaskSensitive={setMaskSensitive}
                    isFormatted={isFormatted}
                    setIsFormatted={setIsFormatted}
                    parsedBody={parsedBody}
                    highlightFindings={highlightFindings}
                    formatContent={formatContent}
                />
            )}

            {activeInspectorTab === 'Security' && inspectorAsset && (
                <SecurityTab 
                    inspectorAsset={inspectorAsset}
                    secretsFound={secretsFound}
                    decodedJwt={decodedJwt}
                    setDecodedJwt={setDecodedJwt}
                />
            )}
            
            {activeInspectorTab === 'Details' && inspectorAsset && (
                <DetailsTab 
                    inspectorAsset={inspectorAsset}
                    history={history}
                    historyLoading={historyLoading}
                    diffBaseId={diffBaseId}
                    setDiffBaseId={setDiffBaseId}
                    computeDiff={computeDiff}
                />
            )}

            {activeInspectorTab === 'Diff' && inspectorAsset && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 16px 16px 16px', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div>
                            <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Compare With</div>
                            <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Historical Scan</div>
                        </div>
                        <select 
                            value={diffBaseId || ''}
                            onChange={(e) => setDiffBaseId(Number(e.target.value))}
                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', fontSize: '11px', padding: '6px 12px' }}
                            disabled={historyLoading || history.length === 0}
                        >
                            {historyLoading ? <option>Loading...</option> : 
                             history.length === 0 ? <option>No history</option> :
                             history.map(h => (
                                <option key={h.id} value={h.id}>{new Date(h.scanned_at || h.timestamp).toLocaleString()} (Status: {h.status_code})</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ flex: 1, minHeight: 0 }}>
                        {(() => {
                            const baseScan = history.find(h => h.id === diffBaseId);
                            if (!baseScan && history.length > 0) return <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>Select a scan to compare.</div>;
                            if (history.length === 0 && !historyLoading) return <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>No historical scans found to compare against.</div>;
                            
                            return (
                                <ResponseDiff
                                    original={baseScan?.response_body || ''}
                                    modified={inspectorAsset.response_body || ''}
                                    language="json" // TODO: Detect language
                                />
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>

        <AiAnalysisModal 
            aiAnalysis={aiAnalysis}
            aiAnalysisLoading={aiAnalysisLoading}
            aiAnalysisFinding={aiAnalysisFinding}
            setAiAnalysisFinding={setAiAnalysisFinding}
        />
      </aside>
    );
};
