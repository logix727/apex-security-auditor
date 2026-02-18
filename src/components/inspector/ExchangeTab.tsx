import React from 'react';
import { Copy, Activity, Search, EyeOff, Eye, Terminal, Shield, Info } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Asset, Badge } from '../../types';
import { JSONTree } from '../common/JSONTree';
import { HeaderView } from '../layout/HeaderView';
import { maskPII } from '../common/PIIMasker';

interface ExchangeTabProps {
    inspectorAsset: Asset;
    bodySearchTerm: string;
    setBodySearchTerm: (term: string) => void;
    handleRescan: (id?: number) => void;
    maskSensitive: boolean;
    setMaskSensitive: (mask: boolean) => void;
    isFormatted: boolean;
    setIsFormatted: (formatted: boolean) => void;
    parsedBody: any;
    highlightFindings: (text: string, findings: Badge[], query: string) => React.ReactNode;
    formatContent: (content: string) => string;
}

export const ExchangeTab: React.FC<ExchangeTabProps> = ({
    inspectorAsset,
    bodySearchTerm,
    setBodySearchTerm,
    handleRescan,
    maskSensitive,
    setMaskSensitive,
    isFormatted,
    setIsFormatted,
    parsedBody,
    highlightFindings,
    formatContent
}) => {
    return (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '0 16px 16px 16px', gap: '16px' }}>
            <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Request Target</div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--accent-color)', marginBottom: '12px', wordBreak: 'break-all' }}>{inspectorAsset.method} {inspectorAsset.url}</div>
                <div style={{ display: 'flex', gap: '8px' }}>
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
                        style={{ flex: 1, padding: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                        <Copy size={12}/> Copy cURL
                    </button>
                    <button onClick={() => handleRescan(inspectorAsset.id)} style={{ flex: 1, padding: '8px', background: 'var(--accent-color)', border: 'none', borderRadius: '6px', color: 'white', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <Activity size={12}/> Re-Scan
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                    <input 
                        type="text" 
                        placeholder="Search exchange body..." 
                        value={bodySearchTerm}
                        onChange={(e) => setBodySearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px 8px 32px', fontSize: '11px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none' }}
                    />
                </div>
                <button 
                    onClick={() => setMaskSensitive(!maskSensitive)}
                    title={maskSensitive ? 'Show Sensitive Data' : 'Mask Sensitive Data'}
                    style={{ padding: '8px', background: maskSensitive ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: maskSensitive ? 'var(--status-critical)' : 'var(--text-secondary)', cursor: 'pointer' }}
                >
                    {maskSensitive ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }} className="exchange-scroll">
                <section>
                    <h4 style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '800', letterSpacing: '0.05em' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Terminal size={12} />
                            RESPONSE BODY {parsedBody && <span style={{ color: 'var(--accent-color)', fontSize: '9px', background: 'rgba(99, 102, 241, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>JSON</span>}
                        </div>
                        {inspectorAsset.response_body && !parsedBody && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button 
                                    onClick={() => setIsFormatted(!isFormatted)}
                                    style={{ fontSize: '9px', background: isFormatted ? 'var(--accent-color)' : 'transparent', color: isFormatted ? 'white' : 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontWeight: '600' }}
                                >
                                    {isFormatted ? 'RAW' : 'PRETTY'}
                                </button>
                                <button 
                                    onClick={() => {
                                        navigator.clipboard.writeText(inspectorAsset.response_body || '');
                                        alert('Body copied!');
                                    }}
                                    style={{ fontSize: '9px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}
                                >
                                    <Copy size={10} /> COPY
                                </button>
                            </div>
                        )}
                    </h4>
                    <div className="code-block-wrapper" style={{ minHeight: '120px' }}>
                        {!inspectorAsset.response_body ? (
                            <div className="empty-state">
                                <EyeOff size={24} style={{ opacity: 0.3 }} />
                                <span>No response body captured.</span>
                            </div>
                        ) : parsedBody ? (
                            <div className="code-block-content">
                                <JSONTree 
                                    data={maskSensitive ? maskPII(JSON.stringify(parsedBody)) : parsedBody} 
                                    isExpandedDefault={false}
                                    searchTerm={bodySearchTerm}
                                    findings={inspectorAsset.findings}
                                />
                            </div>
                        ) : (
                            <pre className="code-block-content" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {highlightFindings(
                                    isFormatted 
                                        ? formatContent(maskSensitive ? maskPII(inspectorAsset.response_body || '') : inspectorAsset.response_body || '')
                                        : (maskSensitive ? maskPII(inspectorAsset.response_body || '') : inspectorAsset.response_body || ''), 
                                    inspectorAsset.findings,
                                    bodySearchTerm
                                )}
                            </pre>
                        )}
                    </div>
                </section>

                <section>
                    <h4 style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '10px', fontWeight: '800', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={12} /> RESPONSE HEADERS
                    </h4>
                    <div className="code-block-wrapper" style={{ padding: '4px' }}>
                        <HeaderView headers={inspectorAsset.response_headers} />
                    </div>
                </section>

                <section>
                    <h4 style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '10px', fontWeight: '800', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Info size={12} /> REQUEST HEADERS
                    </h4>
                    <div className="code-block-wrapper" style={{ padding: '4px' }}>
                        <HeaderView headers={inspectorAsset.request_headers} />
                    </div>
                </section>
            </div>
        </div>
    );
};
