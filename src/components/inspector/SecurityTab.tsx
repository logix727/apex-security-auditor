import React from 'react';
import { Shield, Lock, ShieldAlert, Key, Copy } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Asset } from '../../types';

interface SecurityTabProps {
    inspectorAsset: Asset;
    secretsFound: { type: string, value: string }[];
    decodedJwt: any | null;
    setDecodedJwt: (claims: any | null) => void;
}

export const SecurityTab: React.FC<SecurityTabProps> = ({
    inspectorAsset,
    secretsFound,
    decodedJwt,
    setDecodedJwt
}) => {
    const headers = (inspectorAsset.response_headers || '') + '\n' + (inspectorAsset.request_headers || '');
    const authLine = headers.split('\n').find(h => h.toLowerCase().startsWith('authorization:'));
    const authHeader = authLine ? authLine.split(': ')[1] : '';

    return (
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: '0 16px 16px 16px', gap: '20px' }}>
            <section>
                <h4 style={{fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px'}}><Shield size={12}/> Authentication Status</h4>
                <div style={{padding: '16px', background: authHeader ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px'}}>
                    <div style={{ padding: '8px', borderRadius: '50%', background: authHeader ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
                        {authHeader ? <Lock size={18} color="#10b981" /> : <ShieldAlert size={18} color="#ef4444" />}
                    </div>
                    <div>
                        <div style={{fontSize: '13px', fontWeight: 'bold', color: authHeader ? '#10b981' : '#ef4444'}}>{authHeader ? 'Authorized Exchange' : 'No Auth Header Detected'}</div>
                        <div style={{fontSize: '10px', opacity: 0.6}}>{authHeader ? 'Protected by Authorization header system.' : 'This endpoint may be public or missing security controls.'}</div>
                    </div>
                </div>
                {authHeader && (
                    <div style={{marginTop: '12px'}}>
                        <div style={{fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold'}}>Active Token / Secret</div>
                        <div style={{fontSize: '10px', fontFamily: 'monospace', wordBreak: 'break-all', opacity: 0.8, background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', position: 'relative'}}>
                            {authHeader}
                            <button 
                                onClick={() => navigator.clipboard.writeText(authHeader)}
                                style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                            >
                                <Copy size={12} />
                            </button>
                        </div>
                    </div>
                )}
            </section>

            <section>
                <h4 style={{fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px'}}><Key size={12}/> Discovered Tokens (PII/Secrets)</h4>
                {secretsFound.length === 0 ? (
                    <div style={{background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderStyle: 'dashed', borderRadius: '8px', padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '11px'}}>
                        No additional tokens discovered in exchange bodies.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {secretsFound.map((token, i) => (
                            <div key={i} style={{ padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--status-critical)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--status-critical)' }}>{token.type}</span>
                                    <button 
                                        onClick={() => navigator.clipboard.writeText(token.value)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                    >
                                        <Copy size={12} />
                                    </button>
                                </div>
                                <div style={{ fontSize: '11px', wordBreak: 'break-all', opacity: 0.8, fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px' }}>
                                    {token.value}
                                </div>
                                {token.type === 'jwt' && !decodedJwt && (
                                    <button 
                                        onClick={async () => {
                                            try {
                                                const result = await invoke<any>('decode_jwt', { token: token.value });
                                                const payload = result.payload || {};
                                                const claimsArray = Object.entries(payload).map(([k, v]) => ({
                                                    key: k,
                                                    value: typeof v === 'object' ? JSON.stringify(v) : String(v),
                                                    is_sensitive: ["admin", "role", "su", "permissions", "scope", "email"].some(s => k.toLowerCase().includes(s))
                                                }));
                                                setDecodedJwt(claimsArray);
                                            } catch(e) { alert("Failed to decode JWT."); }
                                        }}
                                        style={{ marginTop: '10px', width: '100%', padding: '6px', background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', color: 'var(--accent-color)', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                                    >
                                        Inspect JWT Claims
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>
            
            {decodedJwt && (
                <section style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{fontSize: '11px', color: 'var(--accent-color)', textTransform: 'uppercase', fontWeight: '800'}}>Decoded JWT Claims</h4>
                        <button onClick={() => setDecodedJwt(null)} style={{ background: 'none', border: 'none', color: 'var(--status-critical)', fontSize: '10px', cursor: 'pointer' }}>Close</button>
                    </div>
                    <table style={{width: '100%', fontSize: '11px', borderCollapse: 'collapse'}}>
                        <tbody>
                            {decodedJwt.map((claim: any, idx: number) => (
                                <tr key={idx} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                                    <td style={{padding: '8px 0', color: claim.is_sensitive ? 'var(--status-critical)' : 'var(--text-secondary)', fontWeight: 'bold', fontSize: '10px'}}>{claim.key}</td>
                                    <td style={{padding: '8px 0', textAlign: 'right', fontFamily: 'monospace', opacity: 0.9, wordBreak: 'break-all'}}>{claim.value}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}
        </div>
    );
};
