import React, { useState, useEffect } from 'react';
import { Asset } from '../../types';
import { Play, RotateCcw, Plus, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { JSONTree } from '../common/JSONTree';

interface RepeaterTabProps {
    inspectorAsset: Asset;
    activeView: string;
}

interface RepeaterResponse {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    durationMs: number;
}

export const RepeaterTab: React.FC<RepeaterTabProps> = ({ inspectorAsset }) => {
    // Request State
    const [method, setMethod] = useState(inspectorAsset.method);
    const [url, setUrl] = useState(inspectorAsset.url);
    const [headers, setHeaders] = useState<{key: string, value: string}[]>([]);
    const [body, setBody] = useState(inspectorAsset.request_body || '');
    
    // Response State
    const [response, setResponse] = useState<RepeaterResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize state from asset
    useEffect(() => {
        setMethod(inspectorAsset.method);
        setUrl(inspectorAsset.url);
        setBody(inspectorAsset.request_body || '');
        
        // Parse headers
        const parsedHeaders: {key: string, value: string}[] = [];
        if (inspectorAsset.request_headers) {
            inspectorAsset.request_headers.split('\n').forEach(line => {
                const parts = line.split(':');
                if (parts.length >= 2) {
                    parsedHeaders.push({
                        key: parts[0].trim(),
                        value: parts.slice(1).join(':').trim()
                    });
                }
            });
        }
        setHeaders(parsedHeaders);
        setResponse(null);
        setError(null);
    }, [inspectorAsset.id]); // Reset when asset changes

    const handleSend = async () => {
        setIsLoading(true);
        setError(null);
        setResponse(null);

        try {
            const startTime = Date.now();
            
            // Reconstruct headers object
            const headerObj: Record<string, string> = {};
            headers.forEach(h => {
                if (h.key.trim()) headerObj[h.key.trim()] = h.value.trim();
            });

            // We need a backend command for this. 
            // Since we implemented `scan_active` but not a generic `send_request` yet in this session,
            // we will use `scan_active`'s logic or a temporary placeholder if standard command missing.
            // Actually, we should have implemented `send_request` in backend or Proxy.
            // For now, let's assume we can use `execute_active_scan` logic or invoke a proxy request.
            // But wait, `execute_active_scan` runs specific probes.
            // Let's implement a simple fetch from frontend if possible (CORS issues) 
            // OR better, use the Rust proxy client. 
            // We'll invoke `rescan_asset` logic but modified? 
            // No, we need a dedicated `send_request` command. 
            // I'll create `send_request` in backend later. 
            // For now, I will write the frontend code assuming `send_request` exists.
            
            const res = await invoke<any>('send_request', {
                method,
                url,
                headers: headerObj,
                body
            });

            setResponse({
                status: res.status,
                statusText: res.statusText,
                headers: res.headers,
                body: res.body,
                durationMs: Date.now() - startTime
            });
        } catch (e: any) {
            setError(typeof e === 'string' ? e : e.message || 'Request failed');
        } finally {
            setIsLoading(false);
        }
    };

    const addHeader = () => {
        setHeaders([...headers, { key: '', value: '' }]);
    };

    const removeHeader = (index: number) => {
        const newHeaders = [...headers];
        newHeaders.splice(index, 1);
        setHeaders(newHeaders);
    };

    const updateHeader = (index: number, field: 'key' | 'value', val: string) => {
        const newHeaders = [...headers];
        newHeaders[index][field] = val;
        setHeaders(newHeaders);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px', padding: '0 16px 16px' }}>
            {/* Control Bar */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <select 
                    value={method} 
                    onChange={e => setMethod(e.target.value)}
                    style={{ 
                        background: 'var(--bg-secondary)', color: 'var(--text-primary)', 
                        border: '1px solid var(--border-color)', padding: '8px', borderRadius: '6px',
                        fontWeight: 'bold', fontSize: '11px'
                    }}
                >
                    <option>GET</option>
                    <option>POST</option>
                    <option>PUT</option>
                    <option>DELETE</option>
                    <option>PATCH</option>
                    <option>OPTIONS</option>
                    <option>HEAD</option>
                </select>
                
                <input 
                    type="text" 
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-primary)' }}
                />

                <button 
                    onClick={handleSend}
                    disabled={isLoading}
                    style={{ 
                        background: 'var(--accent-color)', color: 'white', border: 'none', 
                        padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px',
                        cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                        opacity: isLoading ? 0.7 : 1
                    }}
                >
                    {isLoading ? <RotateCcw size={14} className="spin" /> : <Play size={14} fill="currentColor" />}
                    Send
                </button>
            </div>

            {/* Split View */}
            <div style={{ display: 'flex', flex: 1, gap: '12px', overflow: 'hidden' }}>
                
                {/* Request Editor */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-primary)' }}>
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                        REQUEST
                        <span onClick={addHeader} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-color)' }}><Plus size={12}/> Header</span>
                    </div>
                    
                    <div style={{ flex: 1, overflow: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Headers Editor */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {headers.map((h, i) => (
                                <div key={i} style={{ display: 'flex', gap: '8px' }}>
                                    <input 
                                        placeholder="Key"
                                        value={h.key}
                                        onChange={e => updateHeader(i, 'key', e.target.value)}
                                        style={{ flex: 1, padding: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '11px', color: 'var(--text-primary)' }}
                                    />
                                    <input 
                                        placeholder="Value"
                                        value={h.value}
                                        onChange={e => updateHeader(i, 'value', e.target.value)}
                                        style={{ flex: 2, padding: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '11px', color: 'var(--text-primary)' }}
                                    />
                                    <button onClick={() => removeHeader(i)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Body Editor */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>BODY</label>
                            <textarea 
                                value={body}
                                onChange={e => setBody(e.target.value)}
                                style={{ flex: 1, width: '100%', padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-primary)', resize: 'none', outline: 'none' }}
                                placeholder="Request Body..."
                            />
                        </div>
                    </div>
                </div>

                {/* Response Viewer */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-primary)' }}>
                     <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        RESPONSE
                        {response && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ color: response.status >= 400 ? 'var(--status-critical)' : 'var(--status-safe)' }}>
                                    {response.status} {response.statusText}
                                </span>
                                <span style={{ color: 'var(--text-secondary)' }}>
                                    {response.durationMs}ms
                                </span>
                            </div>
                        )}
                    </div>
                    
                    <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
                        {isLoading ? (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexDirection: 'column', gap: '12px' }}>
                                <RotateCcw className="spin" size={24} />
                                <span style={{ fontSize: '12px' }}>Sending Request...</span>
                            </div>
                        ) : error ? (
                             <div style={{ padding: '16px', color: 'var(--status-critical)', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', fontSize: '12px' }}>
                                <strong>Error:</strong> {error}
                            </div>
                        ) : response ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                 {/* Headers */}
                                 <div>
                                     <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px' }}>HEADERS</div>
                                     <div style={{ background: 'var(--bg-secondary)', padding: '8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' }}>
                                         {Object.entries(response.headers).map(([k, v]) => (
                                             <div key={k} style={{ display: 'flex', gap: '8px' }}>
                                                 <span style={{ color: 'var(--accent-color)' }}>{k}:</span>
                                                 <span style={{ color: 'var(--text-primary)' }}>{v}</span>
                                             </div>
                                         ))}
                                     </div>
                                 </div>

                                 {/* Body */}
                                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                     <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px' }}>BODY</div>
                                     <div style={{ background: 'var(--bg-secondary)', padding: '8px', borderRadius: '4px', fontSize: '11px', overflow: 'auto', whiteSpace: 'pre-wrap', flex: 1 }}>
                                        {(() => {
                                            try {
                                                const json = JSON.parse(response.body);
                                                return <JSONTree data={json} isExpandedDefault={true} />;
                                            } catch {
                                                return <pre style={{ margin: 0 }}>{response.body}</pre>;
                                            }
                                        })()}
                                     </div>
                                 </div>
                            </div>
                        ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                                Send a request to see the response.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
