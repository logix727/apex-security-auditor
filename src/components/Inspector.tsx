import React, { useState, useMemo, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Info, 
  FileJson, 
  Lock, 
  Terminal, 
  ShieldAlert, 
  Activity, 
  Search, 
  FileCode,
  ShieldCheck,
  Eye,
  EyeOff,
  Edit3,
  AlertCircle,
  Copy,
  ChevronDown,
  ChevronRight,
  Bot,
  Loader2,
  Scale
} from 'lucide-react';
import { Asset } from '../App';
import { maskPII } from './PIIMasker';

export type InspectorTab = 'Summary' | 'Response' | 'Auth' | 'Request' | 'AIAnalysis' | 'History';

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
    decodedJwt: any[] | null;
    setDecodedJwt: (claims: any[] | null) => void;
    onRefresh: () => void;
}

const SECRET_REGEXES = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    jwt: /ey[a-zA-Z0-9_-]+\.ey[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    aws_key: /AKIA[0-9A-Z]{16}/g,
    api_key: /api[_-]?key[:=]\s?['"]?([a-zA-Z0-9]{20,})['"]?/gi,
    auth_bearer: /bearer\s+[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/gi
};

const highlightText = (text: string, query: string) => {
    if (!query || !text) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() 
            ? <mark key={i} style={{background: 'var(--accent-color)', color: 'white', borderRadius: '2px', padding: '0 2px'}}>{part}</mark> 
            : part
        )}
      </>
    );
};

const JSONTree: React.FC<{ 
    data: any, 
    level?: number, 
    name?: string | number, 
    path?: string,
    isExpandedDefault?: boolean,
    searchTerm?: string
}> = ({ data, level = 0, name, path = '', isExpandedDefault = false, searchTerm = '' }) => {
    const [isExpanded, setIsExpanded] = useState(level < 1 || isExpandedDefault);
    const isObject = data !== null && typeof data === 'object';
    
    // Auto-expand if search term matches keys or values below
    useEffect(() => {
        if (searchTerm && isObject) {
            const strData = JSON.stringify(data).toLowerCase();
            if (strData.includes(searchTerm.toLowerCase())) {
                setIsExpanded(true);
            }
        }
    }, [searchTerm, data, isObject]);

    const handleCopyPath = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(path);
    };

    const highlightMatch = (text: string) => {
        if (!searchTerm) return text;
        const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
        return (
            <>
                {parts.map((p, i) => 
                    p.toLowerCase() === searchTerm.toLowerCase() 
                        ? <mark key={i} style={{ background: 'var(--accent-color)', color: 'white', borderRadius: '2px', padding: '0 2px' }}>{p}</mark>
                        : p
                )}
            </>
        );
    };

    if (!isObject) {
        const valStr = typeof data === 'string' ? `"${data}"` : String(data);
        return (
            <div className="json-row" style={{ marginLeft: '16px', fontSize: '11px', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}>
                {name !== undefined && <span style={{ color: 'var(--accent-color)', fontWeight: '500' }}>{highlightMatch(String(name))}:</span>}
                <span style={{ color: typeof data === 'string' ? '#10b981' : '#f59e0b', wordBreak: 'break-all' }}>
                    {highlightMatch(valStr)}
                </span>
                <button 
                    onClick={handleCopyPath}
                    title="Copy JSON Path"
                    className="copy-path-btn"
                    style={{ opacity: 0, padding: '2px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                    <Copy size={10} />
                </button>
            </div>
        );
    }

    const keys = Object.keys(data);
    const isEmpty = keys.length === 0;

    return (
        <div style={{ marginLeft: level > 0 ? '16px' : '0' }}>
            <div 
                onClick={() => !isEmpty && setIsExpanded(!isExpanded)}
                className="json-folder-row"
                style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    cursor: isEmpty ? 'default' : 'pointer', 
                    padding: '2px 4px',
                    fontSize: '11px',
                    borderRadius: '4px'
                }}
            >
                {!isEmpty && (
                    isExpanded ? <ChevronDown size={12} style={{ opacity: 0.5, marginRight: '4px' }} /> : <ChevronRight size={12} style={{ opacity: 0.5, marginRight: '4px' }} />
                )}
                {name !== undefined && <span style={{ color: 'var(--accent-color)', marginRight: '4px', fontWeight: '600' }}>{highlightMatch(String(name))}:</span>}
                <span style={{ opacity: 0.5, fontSize: '10px' }}>
                    {Array.isArray(data) ? `Array[${keys.length}]` : `Object{${keys.length}}`}
                </span>
                {path && (
                    <button 
                        onClick={handleCopyPath}
                        title="Copy JSON Path"
                        className="copy-path-btn"
                        style={{ opacity: 0, marginLeft: '8px', padding: '2px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                    >
                        <Copy size={10} />
                    </button>
                )}
            </div>
            {isExpanded && !isEmpty && (
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', marginLeft: '8px', paddingLeft: '4px' }}>
                    {keys.map(key => {
                        const nextPath = path ? (Array.isArray(data) ? `${path}[${key}]` : `${path}.${key}`) : key;
                        return (
                            <JSONTree 
                                key={key} 
                                data={data[key]} 
                                level={level + 1} 
                                name={key} 
                                path={nextPath}
                                searchTerm={searchTerm}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
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
    const [triageNotes, setTriageNotes] = useState('');
    const [isAllExpanded, setIsAllExpanded] = useState(false);
    const [maskSensitive, setMaskSensitive] = useState(false);
    
    // AI Analysis State
    const [aiAnalysis, setAiAnalysis] = useState<{ analysis: string; provider: string } | null>(null);
    const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
    const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);

    // AI Asset Summary State
    const [assetSummary, setAssetSummary] = useState<{ summary: string; provider: string } | null>(null);
    const [assetSummaryLoading, setAssetSummaryLoading] = useState(false);

    const [history, setHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [jwtSecret, setJwtSecret] = useState('');
    const [isForging, setIsForging] = useState(false);
    const [forgedToken, setForgedToken] = useState<string | null>(null);

    useEffect(() => {
        setAssetSummary(null);
        setAiAnalysis(null);
        setHistory([]);
        setTriageNotes(inspectorAsset?.notes || '');
        // Automatically trigger summary if we're on the summary tab
        if (inspectorAsset && activeInspectorTab === 'Summary') {
            handleAnalyzeAssetSummary();
        }
        if (inspectorAsset && activeInspectorTab === 'History') {
            handleFetchHistory();
        }
    }, [inspectorAsset?.id, activeInspectorTab]);

    const handleFetchHistory = async () => {
        if (!inspectorAsset) return;
        setHistoryLoading(true);
        try {
            const result = await invoke<any[]>('get_asset_history', { assetId: inspectorAsset.id });
            setHistory(result);
        } catch (e) {
            console.error('Failed to fetch asset history:', e);
            setHistory([]);
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
                matches.forEach(m => {
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

    const handleTriage = async (status: string) => {
        if (!inspectorAsset) return;
        try {
            await invoke('update_asset_triage', { 
                id: inspectorAsset.id, 
                triage_status: status, 
                notes: triageNotes 
            });
            onRefresh();
        } catch (e) {
            alert("Failed to update triage status.");
        }
    };

    const handleAnalyzeFinding = async (findingType: string) => {
        if (!inspectorAsset) return;
        
        setAiAnalysisLoading(true);
        setAiAnalysisError(null);
        setAiAnalysis(null);
        
        try {
            // Get a snippet of the response body (first 2000 chars for context)
            const snippet = inspectorAsset.response_body?.slice(0, 2000) || '';
            
            const result = await invoke<{ analysis: string; provider: string }>('analyze_finding', {
                assetUrl: inspectorAsset.url,
                findingType: findingType,
                responseBodySnippet: snippet,
                context: `${inspectorAsset.method} ${inspectorAsset.status_code}`
            });
            
            setAiAnalysis(result);
            setActiveInspectorTab('AIAnalysis');
        } catch (e) {
            console.error('AI analysis failed:', e);
            setAiAnalysisError(`Failed to analyze: ${e}`);
        } finally {
            setAiAnalysisLoading(false);
        }
    };

    const handleAnalyzeAssetSummary = async () => {
        if (!inspectorAsset) return;

        setAssetSummaryLoading(true);
        // Clean up previous errors if any (reuse aiAnalysisError for now or add new one?)
        
        try {
            const findingsList = inspectorAsset.findings.map(f => `${f.emoji} ${f.short} (${f.severity}) - ${f.description}`).slice(0, 20); // Limit to top 20
            
            const result = await invoke<{ summary: string; provider: string }>('analyze_asset_summary', {
                assetUrl: inspectorAsset.url,
                findings: findingsList,
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
    
    return (
      <aside className="inspector" style={{ gridArea: 'inspector', width: showInspector ? `${inspectorWidth}px` : '0px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Tab Bar */}
        {(selectedIdsCount > 0 || (activeView === 'workbench' && workbenchSummary)) && (
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '16px', gap: '4px' }}>
                {(['Summary', 'Response', 'Auth', 'Request', 'AIAnalysis', 'History'] as InspectorTab[]).map(tab => {
                    const Icon = ({
                        'Summary': Info,
                        'Response': FileJson,
                        'Auth': Lock,
                        'Request': Terminal,
                        'AIAnalysis': Bot,
                        'History': Activity
                    } as any)[tab];

                    const hasSecrets = (tab === 'Response' || tab === 'Auth') && secretsFound.length > 0;

                    return (
                        <div 
                            key={tab}
                            onClick={() => setActiveInspectorTab(tab)}
                            style={{
                                padding: '8px 12px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                position: 'relative',
                                color: activeInspectorTab === tab ? 'var(--accent-color)' : 'var(--text-secondary)',
                                borderBottom: activeInspectorTab === tab ? '2px solid var(--accent-color)' : '2px solid transparent',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Icon size={12} />
                            {tab}
                            {hasSecrets && (
                                <div style={{ 
                                    position: 'absolute', top: '4px', right: '4px', 
                                    width: '6px', height: '6px', borderRadius: '50%', 
                                    background: 'var(--status-critical)', border: '1px solid var(--bg-primary)' 
                                }} />
                            )}
                        </div>
                    );
                })}
            </div>
        )}

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px 16px', minHeight: 0 }}>
            {activeInspectorTab === 'Summary' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {inspectorAsset ? (
                        <>
                            <div className="risk-dashboard-mini" style={{borderLeft: `6px solid ${inspectorAsset.risk_score > 70 ? 'var(--status-critical)' : inspectorAsset.risk_score > 30 ? 'var(--status-warning)' : 'var(--status-safe)'}`}}>
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                    <div>
                                        <div style={{color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px'}}>Risk Score</div>
                                        <div style={{fontSize: '28px', fontWeight: '900', color: inspectorAsset.risk_score > 70 ? 'var(--status-critical)' : inspectorAsset.risk_score > 30 ? 'var(--status-warning)' : 'var(--status-safe)'}}>{inspectorAsset.risk_score}</div>
                                    </div>
                                    <ShieldAlert size={32} opacity={0.2} />
                                </div>
                                <div style={{ marginTop: '8px', fontSize: '10px', opacity: 0.6 }}>
                                    Triage: <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>{inspectorAsset.triage_status}</span>
                                </div>
                            </div>

                            {/* AI Asset Summary Section */}
                            <section>
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
                                    <h4 style={{fontSize: '11px', color: 'var(--accent-color)', fontWeight: '800', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px'}}><Bot size={13}/> AI AUDIT INSIGHT</h4>
                                    <button 
                                        onClick={async () => {
                                            setAssetSummaryLoading(true);
                                            try {
                                                const res = await invoke<any>('analyze_logic_flaws', { 
                                                    input: {
                                                        asset_url: inspectorAsset.url,
                                                        request_headers: inspectorAsset.request_headers || '',
                                                        response_headers: inspectorAsset.response_headers || '',
                                                        response_body: inspectorAsset.response_body || ''
                                                    }
                                                });
                                                setAssetSummary(res);
                                            } catch (e) { alert("Logic audit failed: " + e); }
                                            finally { setAssetSummaryLoading(false); }
                                        }}
                                        style={{fontSize: '9px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'}}
                                    >
                                        <Scale size={10}/> Run Logic Audit
                                    </button>
                                </div>
                                
                                {assetSummaryLoading && (
                                    <div style={{background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderStyle: 'dashed', borderRadius: '8px', padding: '16px', textAlign: 'center'}}>
                                        <Loader2 size={16} className="spin" style={{margin: '0 auto 8px', display: 'block', color: 'var(--accent-color)'}} />
                                        <div style={{fontSize: '10px', color: 'var(--text-secondary)'}}>Generating AI Insights...</div>
                                    </div>
                                )}
                                
                                {assetSummary && (
                                    <div style={{background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', fontSize: '11px', lineHeight: '1.5'}}>
                                        <div style={{marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '9px', display: 'flex', justifyContent: 'space-between'}}>
                                            <span>Analyzed by {assetSummary.provider}</span>
                                            <Copy size={10} style={{cursor: 'pointer'}} onClick={() => navigator.clipboard.writeText(assetSummary.summary)} />
                                        </div>
                                         <div style={{whiteSpace: 'pre-wrap'}}>
                                             {assetSummary.summary.split('\n').map((line, i) => {
                                                if (line.startsWith('# ')) return <div key={i} style={{fontWeight: '900', fontSize: '12px', color: 'var(--accent-color)', marginTop: '10px', marginBottom: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px'}}>{line.replace('# ', '')}</div>;
                                                if (line.trim().startsWith('- ')) return <div key={i} style={{marginLeft: '4px', marginBottom: '4px', paddingLeft: '8px', borderLeft: '2px solid var(--border-color)'}}>{line.trim().substring(2)}</div>;
                                                return <div key={i} style={{marginBottom: '4px'}}>{line}</div>;
                                             })}
                                         </div>
                                    </div>
                                )}
                            </section>

                            {/* Triage Actions */}
                            <section>
                                <h4 style={{fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px'}}><ShieldCheck size={12}/> Triage & Notes</h4>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                    <button 
                                        onClick={() => handleTriage('Safe')}
                                        style={{ flex: 1, padding: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b98140', borderRadius: '6px', color: '#10b981', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                    >
                                        <ShieldCheck size={14}/> Safe
                                    </button>
                                    <button 
                                        onClick={() => handleTriage('Suspect')}
                                        style={{ flex: 1, padding: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef444440', borderRadius: '6px', color: '#ef4444', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                    >
                                        <AlertCircle size={14}/> Suspect
                                    </button>
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <Edit3 size={12} style={{ position: 'absolute', top: '10px', left: '10px', opacity: 0.3 }} />
                                    <textarea 
                                        placeholder="Add analyst notes..."
                                        value={triageNotes}
                                        onChange={(e) => setTriageNotes(e.target.value)}
                                        onBlur={() => handleTriage(inspectorAsset.triage_status)}
                                        style={{ width: '100%', height: '80px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px 8px 28px', fontSize: '11px', color: 'white', outline: 'none', resize: 'none' }}
                                    />
                                </div>
                            </section>

                            {/* Findings */}
                            <div style={{ flex: 1 }}>
                                <h4 style={{fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px'}}><Activity size={12}/> Analysis Findings</h4>
                                <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                    {inspectorAsset.findings.length > 0 ? inspectorAsset.findings.map((f, i) => {
                                        const severityColor = {
                                            Critical: 'var(--status-critical)',
                                            High: 'var(--status-warning)',
                                            Medium: '#eab308',
                                            Low: '#3b82f6',
                                            Info: 'var(--status-safe)'
                                        }[f.severity] || 'var(--accent-color)';

                                        return (
                                            <div 
                                                key={i} 
                                                onClick={() => {
                                                    setActiveInspectorTab('Response');
                                                    setBodySearchTerm(f.short);
                                                    // Scroll to the finding in the response body
                                                    setTimeout(() => {
                                                        const bodyContainer = document.querySelector('.response-body-scroll');
                                                        if (bodyContainer) {
                                                            const highlight = bodyContainer.querySelector('mark');
                                                            if (highlight) {
                                                                highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                            }
                                                        }
                                                    }, 100);
                                                }}
                                                style={{ 
                                                    background: 'var(--bg-primary)', 
                                                    border: '1px solid var(--border-color)', 
                                                    borderLeft: `3px solid ${severityColor}`,
                                                    padding: '10px 12px', 
                                                    borderRadius: '6px', 
                                                    cursor: 'pointer',
                                                    transition: 'transform 0.1s, background-color 0.1s'
                                                }}
                                                className="finding-card"
                                            >
                                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                                                    <div style={{fontSize: '12px', fontWeight: '700', color: severityColor}}>{f.emoji} {f.short}</div>
                                                    <span style={{ fontSize: '9px', opacity: 0.5, fontWeight: 'bold', textTransform: 'uppercase' }}>{f.severity}</span>
                                                </div>
                                                <div style={{fontSize: '11px', opacity: 0.8, marginTop: '4px', lineHeight: '1.4'}}>{f.description}</div>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAnalyzeFinding(f.short);
                                                    }}
                                                    disabled={aiAnalysisLoading}
                                                    style={{ 
                                                        marginTop: '8px',
                                                        padding: '6px 10px',
                                                        background: aiAnalysisLoading ? 'var(--border-color)' : 'rgba(59, 130, 246, 0.1)',
                                                        border: '1px solid rgba(59, 130, 246, 0.3)',
                                                        borderRadius: '4px',
                                                        color: aiAnalysisLoading ? 'var(--text-secondary)' : 'var(--accent-color)',
                                                        fontSize: '10px',
                                                        fontWeight: 'bold',
                                                        cursor: aiAnalysisLoading ? 'not-allowed' : 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    {aiAnalysisLoading ? <Loader2 size={12} className="spin" /> : <Bot size={12} />}
                                                    🤖 AI Analysis
                                                </button>
                                            </div>
                                        );
                                    }) : <div style={{opacity: 0.5, fontSize: '11px', textAlign: 'center', padding: '20px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px dashed var(--border-color)'}}>No vulnerabilities or interesting patterns detected.</div>}
                                </div>
                            </div>

                            <div style={{marginTop: 'auto', paddingTop: '20px'}}>
                                <button 
                                    onClick={async () => {
                                        const summaryText = assetSummary ? `\n\n## AI Executive Summary\n${assetSummary.summary}` : '';
                                        const evidence = `# Security Audit Evidence\n**Asset:** ${inspectorAsset.url}\n**Triage Status:** ${inspectorAsset.triage_status}\n\n## Findings\n${inspectorAsset.findings.map(f => `- ${f.emoji} ${f.short}: ${f.description}`).join('\n')}\n\n## Analyst Notes\n${triageNotes || 'None'}${summaryText}`;
                                        await navigator.clipboard.writeText(evidence);
                                        alert('Security evidence copied to clipboard!');
                                    }}
                                    style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <FileCode size={14}/> Export Evidence (Markdown)
                                </button>
                            </div>
                        </>
                    ) : workbenchSummary ? (
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="risk-dashboard-mini" style={{borderLeft: '4px solid var(--accent-color)'}}>
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                    <span style={{color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 'bold'}}>SESSION NODES</span>
                                    <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--accent-color)' }}>{workbenchSummary.count}</span>
                                </div>
                            </div>
                            <div className="risk-dashboard-mini" style={{borderLeft: `4px solid ${workbenchSummary.avgRisk > 50 ? 'var(--status-critical)' : 'var(--status-warning)'}`}}>
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                    <span style={{color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 'bold'}}>AVG RISK SCORE</span>
                                    <span style={{ fontSize: '18px', fontWeight: '800', color: workbenchSummary.avgRisk > 50 ? 'var(--status-critical)' : 'var(--status-warning)' }}>{workbenchSummary.avgRisk}</span>
                                </div>
                            </div>
                         </div>
                    ) : (
                        <div style={{textAlign: 'center', marginTop: '60px', opacity: 0.3}}>
                            <Activity size={40} />
                            <p style={{fontSize: '12px', marginTop: '12px'}}>Select an asset for analysis.</p>
                        </div>
                    )}
                </div>
            )}

            {activeInspectorTab === 'Response' && inspectorAsset && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Intelligence: Found Secrets */}
                    {secretsFound.length > 0 && (
                        <section style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '12px' }}>
                            <h5 style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--status-critical)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={10}/> Potential Intelligence Detected</h5>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {secretsFound.map((s, i) => (
                                    <span key={i} title={s.value} style={{ fontSize: '9px', background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--accent-color)' }}>{s.type}</span>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Control Bar for JSON */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                            <input 
                                type="text" 
                                placeholder="Filter keys or values..." 
                                value={bodySearchTerm}
                                onChange={(e) => setBodySearchTerm(e.target.value)}
                                style={{ width: '100%', padding: '8px 12px 8px 32px', fontSize: '11px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                            />
                        </div>
                        <button 
                            onClick={() => setIsAllExpanded(!isAllExpanded)}
                            style={{ padding: '6px 10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '10px', cursor: 'pointer' }}
                        >
                            {isAllExpanded ? 'Collapse All' : 'Expand All'}
                        </button>
                        <button 
                            onClick={() => setMaskSensitive(!maskSensitive)}
                            title={maskSensitive ? 'Show Sensitive Data' : 'Mask Sensitive Data'}
                            style={{ 
                                padding: '6px 10px', 
                                background: maskSensitive ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-primary)', 
                                border: '1px solid var(--border-color)', 
                                borderRadius: '6px', 
                                color: maskSensitive ? 'var(--status-critical)' : 'var(--text-secondary)', 
                                fontSize: '10px', 
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            {maskSensitive ? <EyeOff size={12} /> : <Eye size={12} />}
                            {maskSensitive ? 'Unmask' : 'Mask'}
                        </button>
                    </div>
                    
                    <section>
                        <h4 style={{fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', justifyContent: 'space-between'}}>
                            Headers 
                            <Copy size={10} style={{cursor:'pointer'}} onClick={() => navigator.clipboard.writeText(inspectorAsset.response_headers)}/>
                        </h4>
                        <div style={{fontSize: '10px', fontFamily: 'monospace', opacity: 0.8, background: 'var(--bg-primary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', overflowX: 'auto'}}>
                            {inspectorAsset.response_headers || 'No headers.'}
                        </div>
                    </section>
                    
                    <section style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <h4 style={{fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', justifyContent: 'space-between'}}>
                            Body {parsedBody && <span style={{ color: 'var(--accent-color)', fontSize: '8px' }}>JSON Detected</span>}
                        </h4>
                        <div className="response-body-scroll" style={{ fontSize: '11px', fontFamily: 'monospace', background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'auto', maxHeight: '500px' }}>
                            {parsedBody ? (
                                <JSONTree 
                                    key={String(isAllExpanded)} // Force re-render on expand/collapse toggle
                                    data={maskSensitive ? maskPII(JSON.stringify(parsedBody)) : parsedBody} 
                                    isExpandedDefault={isAllExpanded}
                                    searchTerm={bodySearchTerm}
                                />
                            ) : highlightText(maskSensitive ? maskPII(inspectorAsset.response_body || '') : inspectorAsset.response_body || '', bodySearchTerm)}
                        </div>
                    </section>
                </div>
            )}

            {activeInspectorTab === 'Request' && inspectorAsset && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
                        <div style={{fontSize: '12px', fontWeight: 'bold', color: 'var(--accent-color)', marginBottom: '8px', wordBreak: 'break-all'}}>{inspectorAsset.method} {inspectorAsset.url}</div>
                        <div style={{display: 'flex', gap: '8px'}}>
                            <button 
                                onClick={async () => {
                                    const curl = await invoke<string>('generate_curl', { 
                                        method: inspectorAsset.method, 
                                        url: inspectorAsset.url, 
                                        headers: inspectorAsset.request_headers, 
                                        body: inspectorAsset.request_body 
                                    });
                                    navigator.clipboard.writeText(curl);
                                    alert('cURL copied!');
                                }}
                                style={{ flex: 1, padding: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            >
                                <Copy size={10}/> Copy cURL
                            </button>
                            <button onClick={() => handleRescan(inspectorAsset.id)} style={{ flex: 1, padding: '6px', background: 'var(--accent-color)', border: 'none', borderRadius: '4px', color: 'white', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <Activity size={10}/> Re-Scan
                            </button>
                        </div>
                    </div>
                    <section>
                        <h4 style={{fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px'}}>Headers</h4>
                        <div style={{fontSize: '10px', fontFamily: 'monospace', opacity: 0.8, background: 'var(--bg-primary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)'}}>
                            {inspectorAsset.request_headers || 'No headers.'}
                        </div>
                    </section>
                </div>
            )}

            {activeInspectorTab === 'Auth' && inspectorAsset && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {(() => {
                        const headers = (inspectorAsset.response_headers || '') + '\n' + (inspectorAsset.request_headers || '');
                        const authLine = headers.split('\n').find(h => h.toLowerCase().startsWith('authorization:'));
                        const authHeader = authLine ? authLine.split(': ')[1] : '';
                        
                        return (
                            <>
                                <div style={{padding: '12px', background: authHeader ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px'}}>
                                    {authHeader ? <Lock size={16} color="#10b981" /> : <ShieldAlert size={16} color="#ef4444" />}
                                    <span style={{fontSize: '12px', fontWeight: 'bold'}}>{authHeader ? 'Auth Token Detected' : 'No Auth Detected'}</span>
                                </div>
                                {authHeader && (
                                    <div style={{marginTop: '10px'}}>
                                        <div style={{fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px'}}>Authorization Header</div>
                                        <div style={{fontSize: '10px', fontFamily: 'monospace', wordBreak: 'break-all', opacity: 0.8, background: 'var(--bg-primary)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)'}}>{authHeader}</div>
                                        {authHeader.toLowerCase().startsWith('bearer ') && (
                                            <div style={{marginTop: '10px'}}>
                                                <button 
                                                    onClick={async () => {
                                                        const token = authHeader.split(' ')[1];
                                                        try {
                                                            const claims = await invoke<any[]>('decode_jwt', { token });
                                                            setDecodedJwt(claims);
                                                        } catch(e) { alert("Failed to decode JWT."); }
                                                    }}
                                                    style={{width: '100%', padding: '10px', background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', color: 'var(--accent-color)', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}
                                                >
                                                    <Eye size={14}/> Decode JWT Payload
                                                </button>
                                                
                                                {decodedJwt && (
                                                    <div style={{marginTop: '16px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
                                                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                                                            <h5 style={{fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-secondary)'}}>Decoded Claims</h5>
                                                            <button 
                                                                onClick={() => setDecodedJwt([...decodedJwt, { key: "new_claim", value: "value", is_sensitive: false }])}
                                                                style={{fontSize: '9px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer'}}
                                                            >+ Add Claim</button>
                                                        </div>
                                                        <table style={{width: '100%', fontSize: '10px', borderCollapse: 'collapse'}}>
                                                            <tbody>
                                                                {decodedJwt.map((claim, idx) => (
                                                                    <tr key={idx} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                                                                        <td style={{padding: '6px 0'}}>
                                                                            <input 
                                                                                value={claim.key} 
                                                                                onChange={(e) => {
                                                                                    const next = [...decodedJwt];
                                                                                    next[idx].key = e.target.value;
                                                                                    setDecodedJwt(next);
                                                                                }}
                                                                                style={{background: 'transparent', border: 'none', color: claim.is_sensitive ? 'var(--status-critical)' : 'var(--accent-color)', fontWeight: 'bold', width: '80%'}}
                                                                            />
                                                                        </td>
                                                                        <td style={{padding: '6px 0', textAlign: 'right'}}>
                                                                            <input 
                                                                                value={claim.value} 
                                                                                onChange={(e) => {
                                                                                    const next = [...decodedJwt];
                                                                                    next[idx].value = e.target.value;
                                                                                    setDecodedJwt(next);
                                                                                }}
                                                                                style={{background: 'transparent', border: 'none', color: 'white', opacity: 0.8, textAlign: 'right', width: '100%'}}
                                                                            />
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                        
                                                        <div style={{marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px'}}>
                                                            <div style={{fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px'}}>Forge & Re-Sign (HS256)</div>
                                                            <input 
                                                                type="text" 
                                                                placeholder="Enter Secret Key..." 
                                                                value={jwtSecret}
                                                                onChange={(e) => setJwtSecret(e.target.value)}
                                                                style={{width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11px', color: 'white', marginBottom: '8px'}}
                                                            />
                                                            <button 
                                                                disabled={isForging || !jwtSecret}
                                                                onClick={async () => {
                                                                    setIsForging(true);
                                                                    try {
                                                                        const claimsObj: Record<string, string> = {};
                                                                        decodedJwt.forEach(c => claimsObj[c.key] = c.value);
                                                                        const token = await invoke<string>('sign_jwt', { claims: claimsObj, secret: jwtSecret });
                                                                        setForgedToken(token);
                                                                    } catch(e) { alert("Signing failed: " + e); }
                                                                    finally { setIsForging(false); }
                                                                }}
                                                                style={{width: '100%', padding: '10px', background: 'var(--status-critical)', border: 'none', color: 'white', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: jwtSecret ? 'pointer' : 'not-allowed', opacity: jwtSecret ? 1 : 0.5}}
                                                            >
                                                                {isForging ? <Loader2 size={14} className="spin" /> : <Lock size={14} />} Forge & Sign Token
                                                            </button>
                                                            
                                                            {forgedToken && (
                                                                <div style={{marginTop: '12px'}}>
                                                                    <div style={{fontSize: '9px', color: 'var(--status-safe)', marginBottom: '4px'}}>Forged Token:</div>
                                                                    <div style={{fontSize: '9px', fontFamily: 'monospace', wordBreak: 'break-all', opacity: 0.8, background: 'rgba(16, 185, 129, 0.1)', padding: '8px', borderRadius: '4px', border: '1px solid var(--status-safe)', cursor: 'pointer'}} onClick={() => navigator.clipboard.writeText(forgedToken)}>
                                                                        {forgedToken}
                                                                    </div>
                                                                    <div style={{fontSize: '8px', opacity: 0.5, marginTop: '4px'}}>Click to copy</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}

            {/* AI Analysis Tab */}
            {activeInspectorTab === 'AIAnalysis' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0 }}>
                    <div style={{ 
                        background: 'rgba(59, 130, 246, 0.1)', 
                        border: '1px solid rgba(59, 130, 246, 0.2)', 
                        borderRadius: '8px', 
                        padding: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <Bot size={16} style={{ color: 'var(--accent-color)' }} />
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            AI-powered security analysis powered by {aiAnalysis?.provider || 'LLM'}
                        </span>
                    </div>
                    
                    {aiAnalysisLoading && (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <Loader2 size={32} className="spin" style={{ margin: '0 auto 12px', display: 'block', color: 'var(--accent-color)' }} />
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Analyzing security finding...</div>
                        </div>
                    )}
                    
                    {aiAnalysisError && (
                        <div style={{ 
                            background: 'rgba(239, 68, 68, 0.1)', 
                            border: '1px solid rgba(239, 68, 68, 0.2)', 
                            borderRadius: '8px', 
                            padding: '16px',
                            color: 'var(--status-critical)',
                            fontSize: '12px'
                        }}>
                            {aiAnalysisError}
                        </div>
                    )}
                    
                    {aiAnalysis && !aiAnalysisLoading && (
                        <div style={{ 
                            flex: 1, 
                            overflow: 'auto', 
                            background: 'var(--bg-primary)', 
                            border: '1px solid var(--border-color)', 
                            borderRadius: '8px', 
                            padding: '16px' 
                        }}>
                            <div style={{ 
                                fontSize: '12px', 
                                lineHeight: '1.6', 
                                whiteSpace: 'pre-wrap',
                                color: 'var(--text-primary)'
                            }}>
                                {aiAnalysis.analysis.split('\n').map((line, i) => {
                                    if (line.startsWith('## ') || line.startsWith('### ')) {
                                        return <div key={i} style={{ fontWeight: 'bold', marginTop: '12px', marginBottom: '4px', color: 'var(--accent-color)' }}>{line.replace(/^#+/, '').trim()}</div>;
                                    }
                                    if (line.includes('**')) {
                                        const parts = line.split(/(\*\*[^*]+\*\*)/g);
                                        return (
                                            <div key={i} style={{ marginBottom: '4px' }}>
                                                {parts.map((part, j) => {
                                                    if (part.startsWith('**') && part.endsWith('**')) {
                                                        return <span key={j} style={{ fontWeight: 'bold', color: 'var(--status-warning)' }}>{part.replace(/\*\*/g, '')}</span>;
                                                    }
                                                    return part;
                                                })}
                                            </div>
                                        );
                                    }
                                    if (line.trim().startsWith('- ') || line.trim().match(/^\d+\. /)) {
                                        return <div key={i} style={{ marginLeft: '16px', marginBottom: '4px' }}>• {line.trim().replace(/^[-\d.]+\s*/, '')}</div>;
                                    }
                                    return line ? <div key={i} style={{ marginBottom: '4px' }}>{line}</div> : <div key={i} style={{ height: '8px' }} />;
                                })}
                            </div>
                            
                            <button 
                                onClick={() => navigator.clipboard.writeText(aiAnalysis.analysis)}
                                style={{
                                    marginTop: '16px',
                                    padding: '8px 16px',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    color: 'var(--text-primary)',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Copy size={12} /> Copy Analysis
                            </button>
                        </div>
                    )}
                    
                    {!aiAnalysis && !aiAnalysisLoading && !aiAnalysisError && inspectorAsset && inspectorAsset.findings.length > 0 && (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                            <Bot size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                            <p style={{ fontSize: '12px' }}>Click "🤖 AI Analysis" on a finding in the Summary tab to get AI-powered security analysis.</p>
                        </div>
                    )}
                    
                    {!inspectorAsset && (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                            <Bot size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                            <p style={{ fontSize: '12px' }}>Select an asset to analyze with AI.</p>
                        </div>
                    )}
                </div>
            )}
            {/* History Tab */}
            {activeInspectorTab === 'History' && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '16px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', borderLeft: '3px solid var(--accent-color)', paddingLeft: '8px' }}>
                        Endpoint Audit History: Tracked changes in risk score and findings over time.
                    </div>
                    
                    {historyLoading && (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <Loader2 size={32} className="spin" style={{ margin: '0 auto 12px', display: 'block', color: 'var(--accent-color)' }} />
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Retrieving history...</div>
                        </div>
                    )}
                    
                    {!historyLoading && history.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                            <Activity size={32} style={{ opacity: 0.2, marginBottom: '12px' }} />
                            <p style={{ fontSize: '12px' }}>No historical data found for this asset.</p>
                        </div>
                    )}
                    
                    {!historyLoading && history.length > 0 && (
                        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {[...history].reverse().map((entry, idx) => (
                                <div key={idx} style={{ 
                                    background: 'var(--bg-secondary)', 
                                    border: '1px solid var(--border-color)', 
                                    borderRadius: '8px', 
                                    padding: '12px',
                                    fontSize: '11px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: entry.risk_score > 5 ? 'var(--status-critical)' : 'var(--status-normal)' }}></div>
                                            <span style={{ fontWeight: 'bold' }}>{new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                        <span style={{ 
                                            padding: '2px 8px', 
                                            borderRadius: '10px', 
                                            background: entry.status.includes('OK') ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                            color: entry.status.includes('OK') ? 'var(--status-normal)' : 'var(--status-critical)',
                                            fontSize: '10px'
                                        }}>
                                            {entry.status}
                                        </span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px' }}>
                                        <div>
                                            <div style={{ opacity: 0.5, marginBottom: '4px' }}>Risk Score</div>
                                            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{entry.risk_score}</div>
                                        </div>
                                        <div>
                                            <div style={{ opacity: 0.5, marginBottom: '4px' }}>Findings Summary</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {(() => {
                                                    try {
                                                        const findings = JSON.parse(entry.findings || '[]');
                                                        return findings.length > 0 ? findings.map((f: any, i: number) => (
                                                            <span key={i} title={f.name} style={{ background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', border: '1px solid var(--border-color)' }}>
                                                                {f.code}
                                                            </span>
                                                        )) : <span>None</span>;
                                                    } catch(e) { return <span>Error parsing findings</span>; }
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
      </aside>
    );
};
