import React from 'react';
import { History, ShieldAlert, AlertCircle, Scale } from 'lucide-react';
import { Asset } from '../../types';
import { AssetMetadata } from '../summary';

interface DetailsTabProps {
    inspectorAsset: Asset;
    history: any[];
    historyLoading: boolean;
    diffBaseId: number | null;
    setDiffBaseId: (id: number) => void;
    computeDiff: (base: string, current: string) => any[];
}

export const DetailsTab: React.FC<DetailsTabProps> = ({
    inspectorAsset,
    history,
    historyLoading,
    diffBaseId,
    setDiffBaseId,
    computeDiff
}) => {
    return (
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: '0 16px 16px 16px', gap: '16px' }}>
            
            {/* Asset Metadata */}
            <div style={{ marginBottom: '16px' }}>
                <h4 style={{fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px', fontWeight: '800'}}>Asset Details</h4>
                <AssetMetadata
                    method={inspectorAsset.method}
                    statusCode={inspectorAsset.status_code}
                    url={inspectorAsset.url}
                    lastScanned={inspectorAsset.updated_at || inspectorAsset.created_at}
                    source={inspectorAsset.source}
                    isDocumented={inspectorAsset.is_documented}
                />
            </div>

            <h4 style={{fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0px', fontWeight: '800'}}>Scan History</h4>
            {historyLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '40px', opacity: 0.6 }}>
                    <div className="animate-spin" style={{ width: '20px', height: '20px', border: '2px solid var(--accent-color)', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
                    <span style={{ fontSize: '11px' }}>Loading scan history...</span>
                </div>
            ) : history.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '20px', opacity: 0.4 }}>
                    <History size={32} />
                    <span style={{ fontSize: '11px' }}>No history available for this asset.</span>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {history.map((entry, i) => (
                        <div key={i} style={{ 
                            background: 'var(--bg-primary)', 
                            borderRadius: '8px', 
                            border: '1px solid var(--border-color)',
                            padding: '12px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
                                    {new Date(entry.scanned_at || entry.timestamp).toLocaleString()}
                                </div>
                                <div style={{ 
                                    padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold',
                                    background: entry.status_code >= 500 ? 'rgba(239, 68, 68, 0.1)' : entry.status_code >= 400 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                    color: entry.status_code >= 500 ? 'var(--status-critical)' : entry.status_code >= 400 ? 'var(--status-warning)' : 'var(--status-safe)'
                                }}>
                                    {entry.status_code}
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <ShieldAlert size={12} /> Risk Score: <span style={{ color: 'white' }}>{entry.risk_score}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertCircle size={12} /> Findings: <span style={{ color: 'white' }}>{entry.findings ? (typeof entry.findings === 'string' ? JSON.parse(entry.findings).length : entry.findings.length) : 0}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {/* Scan Diff Section */}
            <div style={{ marginTop: '24px' }}>
                <h4 style={{fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px'}}>
                    <Scale size={12}/> Scan Diff
                </h4>
                <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Compare Scans</div>
                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--accent-color)' }}>Current vs. Historical</div>
                        </div>
                        <select 
                            value={diffBaseId || ''}
                            onChange={(e) => setDiffBaseId(Number(e.target.value))}
                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', fontSize: '11px', padding: '4px 8px' }}
                        >
                            {history.map(h => (
                                <option key={h.id} value={h.id}>{new Date(h.scanned_at || h.timestamp).toLocaleString()}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', maxHeight: '400px', overflow: 'auto' }}>
                    {(() => {
                        const baseScan = history.find(h => h.id === diffBaseId);
                        if (!baseScan) return <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>Select a historical scan to compare against.</div>;
                        
                        const diffs = computeDiff(baseScan.response_body || '', inspectorAsset.response_body || '');
                        
                        return diffs.map((part, i) => (
                            <div key={i} style={{ 
                                background: part.added ? 'rgba(16, 185, 129, 0.1)' : part.removed ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                                color: part.added ? '#10b981' : part.removed ? '#ef4444' : 'inherit',
                                whiteSpace: 'pre-wrap',
                                borderLeft: part.added ? '3px solid #10b981' : part.removed ? '3px solid #ef4444' : '3px solid transparent',
                                paddingLeft: '8px',
                                marginBottom: '2px'
                            }}>
                                {part.value}
                            </div>
                        ));
                    })()}
                </div>
            </div>
        </div>
    );
};
