import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { ShieldAlert, Play, Trash2 } from 'lucide-react';
import { useDebugLogger } from '../DebugConsole';

interface InterceptedRequest {
    id: string;
    method: string;
    url: string;
    headers: [string, string][];
    body: string;
}

export const InterceptView: React.FC = () => {
    const [interceptEnabled, setInterceptEnabled] = useState(false);
    const [currentRequest, setCurrentRequest] = useState<InterceptedRequest | null>(null);
    const [editedHeaders, setEditedHeaders] = useState<string>('');
    const [editedBody, setEditedBody] = useState<string>('');
    const { info, success, error } = useDebugLogger();

    useEffect(() => {
        const unlisten = listen<InterceptedRequest>('proxy-intercept-request', (event) => {
            setCurrentRequest(event.payload);
            setEditedHeaders(event.payload.headers.map(([k, v]) => `${k}: ${v}`).join('\n'));
            setEditedBody(event.payload.body);
            info(`Intercepted request: ${event.payload.method} ${event.payload.url}`, 'Proxy');
        });

        return () => {
            unlisten.then(f => f());
        };
    }, []);

    const toggleIntercept = async () => {
        const newState = !interceptEnabled;
        setInterceptEnabled(newState);
        await invoke('set_proxy_intercept', { enabled: newState });
        success(`Interception ${newState ? 'Enabled' : 'Disabled'}`, 'Proxy');
    };

    const forwardRequest = async () => {
        if (!currentRequest) return;

        try {
            const headerLines = editedHeaders.split('\n').filter(l => l.includes(':'));
            const headers: [string, string][] = headerLines.map(line => {
                const [k, ...v] = line.split(':');
                return [k.trim(), v.join(':').trim()];
            });

            await invoke('forward_intercepted_request', {
                requestId: currentRequest.id,
                headers,
                body: editedBody
            });
            
            success('Request Forwarded', 'Proxy');
            setCurrentRequest(null);
        } catch (e) {
            error(`Failed to forward: ${e}`, 'Proxy');
        }
    };

    const dropRequest = async () => {
        if (!currentRequest) return;

        try {
            await invoke('drop_intercepted_request', { requestId: currentRequest.id });
            success('Request Dropped', 'Proxy');
            setCurrentRequest(null);
        } catch (e) {
            error(`Failed to drop: ${e}`, 'Proxy');
        }
    };

    return (
        <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '15px' }}>
                <ShieldAlert size={24} className={interceptEnabled ? 'text-danger' : 'text-muted'} />
                <h2 style={{ margin: 0 }}>Proxy Interceptor</h2>
                <button 
                    className={`btn ${interceptEnabled ? 'btn-danger' : 'btn-outline'}`}
                    onClick={toggleIntercept}
                    style={{ marginLeft: 'auto' }}
                >
                    {interceptEnabled ? 'Interception ON' : 'Interception OFF'}
                </button>
            </div>

            {currentRequest ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px', background: 'var(--bg-secondary)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="badge badge-info">{currentRequest.method}</span>
                        <code style={{ fontSize: '14px', wordBreak: 'break-all' }}>{currentRequest.url}</code>
                    </div>

                    <div style={{ flex: 1, display: 'flex', gap: '20px' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <label style={{ fontSize: '12px', marginBottom: '5px', opacity: 0.7 }}>Headers</label>
                            <textarea 
                                value={editedHeaders}
                                onChange={(e) => setEditedHeaders(e.target.value)}
                                style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px', fontFamily: 'monospace' }}
                            />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <label style={{ fontSize: '12px', marginBottom: '5px', opacity: 0.7 }}>Body</label>
                            <textarea 
                                value={editedBody}
                                onChange={(e) => setEditedBody(e.target.value)}
                                style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px', fontFamily: 'monospace' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                        <button className="btn btn-outline" onClick={dropRequest} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Trash2 size={16} /> Drop
                        </button>
                        <button className="btn btn-primary" onClick={forwardRequest} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Play size={16} /> Forward
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, border: '2px dashed var(--border-color)', borderRadius: '8px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <ShieldAlert size={48} style={{ marginBottom: '10px' }} />
                        <p>{interceptEnabled ? 'Waiting for requests...' : 'Interception is disabled'}</p>
                    </div>
                </div>
            )}
        </div>
    );
};
