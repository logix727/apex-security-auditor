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

    const [tamperMode, setTamperMode] = React.useState(false);
    const [tamperPayload, setTamperPayload] = React.useState('');
    const [tamperSecret, setTamperSecret] = React.useState('');
    const [resignedToken, setResignedToken] = React.useState('');

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
            </section>

            <section>
                <h4 style={{fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px'}}><Key size={12}/> Discovered Tokens</h4>
                {secretsFound.length === 0 ? (
                    <div style={{background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderStyle: 'dashed', borderRadius: '8px', padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '11px'}}>
                        No additional tokens discovered.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {secretsFound.map((token, i) => (
                            <div key={i} style={{ padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--status-critical)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--status-critical)' }}>{token.type}</span>
                                    <button onClick={() => navigator.clipboard.writeText(token.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><Copy size={12} /></button>
                                </div>
                                <div style={{ fontSize: '11px', wordBreak: 'break-all', opacity: 0.8, fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px' }}>{token.value}</div>
                                
                                {token.type === 'jwt' && !decodedJwt && (
                                    <button 
                                        onClick={async () => {
                                            try {
                                                const result = await invoke<any>('decode_jwt', { token: token.value });
                                                setDecodedJwt(result); 
                                                setTamperPayload(JSON.stringify(result.payload, null, 2));
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
                        <h4 style={{fontSize: '11px', color: 'var(--accent-color)', textTransform: 'uppercase', fontWeight: '800'}}>Decoded JWT</h4>
                        <div style={{ display: 'flex', gap: '8px' }}>
                             <button onClick={() => setTamperMode(!tamperMode)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'white', fontSize: '10px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                                {tamperMode ? 'View Claims' : 'Tamper / Re-sign'}
                             </button>
                             <button onClick={() => setDecodedJwt(null)} style={{ background: 'none', border: 'none', color: 'var(--status-critical)', fontSize: '10px', cursor: 'pointer' }}>Close</button>
                        </div>
                    </div>

                    {!tamperMode ? (
                        <table style={{width: '100%', fontSize: '11px', borderCollapse: 'collapse'}}>
                            <tbody>
                                {Object.entries(decodedJwt.payload || {}).map(([k, v], idx) => (
                                    <tr key={idx} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                                        <td style={{padding: '8px 0', color: ["admin", "role"].some(s => k.includes(s)) ? 'var(--status-critical)' : 'var(--text-secondary)', fontWeight: 'bold', fontSize: '10px'}}>{k}</td>
                                        <td style={{padding: '8px 0', textAlign: 'right', fontFamily: 'monospace', opacity: 0.9, wordBreak: 'break-all'}}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div>
                                <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Payload (JSON)</label>
                                <textarea 
                                    value={tamperPayload}
                                    onChange={(e) => setTamperPayload(e.target.value)}
                                    style={{ width: '100%', height: '120px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'white', fontFamily: 'monospace', fontSize: '11px', padding: '8px', borderRadius: '4px' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Signing Secret (HMAC)</label>
                                <input 
                                    type="text"
                                    placeholder="Enter secret key to sign..."
                                    value={tamperSecret}
                                    onChange={(e) => setTamperSecret(e.target.value)}
                                    style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'white', fontSize: '11px', padding: '8px', borderRadius: '4px' }}
                                />
                            </div>
                            <button 
                                onClick={async () => {
                                    try {
                                        const claims = JSON.parse(tamperPayload);
                                        const token = await invoke<string>('sign_jwt', { 
                                            header: decodedJwt.header || {}, 
                                            claims, 
                                            secret: tamperSecret 
                                        });
                                        setResignedToken(token);
                                    } catch (e) {
                                        alert("Failed to sign: " + e);
                                    }
                                }}
                                disabled={!tamperSecret}
                                className="btn btn-primary"
                                style={{ justifyContent: 'center', opacity: !tamperSecret ? 0.5 : 1 }}
                            >
                                <Key size={12} /> Sign & Generate Token
                            </button>

                            {resignedToken && (
                                <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                    <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 'bold', marginBottom: '4px' }}>Resigned Token</div>
                                    <div style={{ fontSize: '10px', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: '8px' }}>{resignedToken}</div>
                                    <button onClick={() => navigator.clipboard.writeText(resignedToken)} style={{ background: 'var(--bg-secondary)', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', color: 'white' }}>Copy to Clipboard</button>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};
