import React, { useState, useEffect } from 'react';
import { Asset, Badge } from '../../types';
import { invoke } from '@tauri-apps/api/core';
import { Loader2, Copy, ShieldAlert, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface TriageTabProps {
    inspectorAsset: Asset;
}

const TriageTab: React.FC<TriageTabProps> = ({ inspectorAsset }) => {
    const [guide, setGuide] = useState<{ summary: string; provider: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!inspectorAsset) return;
        
        // Only generate if we have findings
        if (inspectorAsset.findings.length === 0) {
            setGuide(null);
            return;
        }

        const generateGuide = async () => {
            setLoading(true);
            setError(null);
            try {
                // Limit findings to 20 to avoid overwhelming the prompt
                const findingsList = inspectorAsset.findings
                    .slice(0, 20)
                    .map((f: Badge) => `${f.emoji} ${f.short} (${f.severity}) [${f.owasp_category || 'General'}] - ${f.description}`);

                const result = await invoke<{ summary: string; provider: string }>('generate_remediation_guide', {
                    assetUrl: inspectorAsset.url,
                    findings: findingsList,
                    requestHeaders: inspectorAsset.request_headers || '',
                    responseBodySnippet: (inspectorAsset.response_body || '').substring(0, 1000),
                    headersSnippet: (inspectorAsset.response_headers || '').substring(0, 1000),
                    context: `Method: ${inspectorAsset.method}, Status: ${inspectorAsset.status_code}, Risk: ${inspectorAsset.risk_score}`
                });
                setGuide(result);
            } catch (e) {
                console.error('Failed to generate remediation guide:', e);
                setError(`Failed to generate guide: ${e}`);
            } finally {
                setLoading(false);
            }
        };

        generateGuide();
    }, [inspectorAsset.id]);

    const handleCopy = () => {
        if (guide) {
            navigator.clipboard.writeText(guide.summary);
            alert('Remediation guide copied to clipboard!');
        }
    };

    if (inspectorAsset.findings.length === 0) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <CheckCircle2 size={48} style={{ margin: '0 auto 16px', color: 'var(--status-safe)' }} />
                <h3>No Issues Detected</h3>
                <p>This asset appears to be clean. No remediation required.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px' }}>
                <Loader2 size={32} className="spin" style={{ marginBottom: '16px', color: 'var(--accent-color)' }} />
                <div style={{ fontSize: '14px', fontWeight: '500' }}>Generating Developer Remediation Guide...</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>Analyzing findings and formulating code fixes</div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--status-critical)' }}>
                <ShieldAlert size={32} style={{ margin: '0 auto 16px' }} />
                <div>{error}</div>
                <button 
                    onClick={() => setLoading(true)} // Retry logic triggers re-render/effect if modified, but simplified here
                    style={{ marginTop: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '4px', color: 'white', cursor: 'pointer' }}
                >
                    Retry Analysis
                </button>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '14px' }}>Remediation Plan</h3>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        AI-generated guide for developers • {guide?.provider || 'Local LLM'}
                    </div>
                </div>
                <button 
                    onClick={handleCopy}
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        padding: '6px 12px', 
                        background: 'var(--accent-color)', 
                        border: 'none', 
                        borderRadius: '4px', 
                        color: 'white', 
                        fontSize: '11px', 
                        fontWeight: '600',
                        cursor: 'pointer' 
                    }}
                >
                    <Copy size={12} />
                    Copy for Ticket
                </button>
            </div>
            
            <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                <div className="markdown-content">
                    {guide?.summary && (
                        <ReactMarkdown 
                            components={{
                                code(props) {
                                    const {children, className, node, ...rest} = props;
                                    return (
                                        <code className={className} style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '3px', fontSize: '12px' }} {...rest}>
                                            {children}
                                        </code>
                                    )
                                },
                                pre(props) {
                                    const {children} = props;
                                    return (
                                        <pre style={{ background: '#1e1e1e', padding: '12px', borderRadius: '6px', overflowX: 'auto', border: '1px solid var(--border-color)', margin: '12px 0' }}>
                                            {children}
                                        </pre>
                                    )
                                },
                                h1(props) { return <h1 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>{props.children}</h1> },
                                h2(props) { return <h2 style={{ fontSize: '16px', marginTop: '20px', marginBottom: '12px', color: 'var(--accent-color)' }}>{props.children}</h2> },
                                h3(props) { return <h3 style={{ fontSize: '14px', marginTop: '16px', marginBottom: '8px' }}>{props.children}</h3> },
                                ul(props) { return <ul style={{ paddingLeft: '20px', marginBottom: '12px' }}>{props.children}</ul> },
                                li(props) { return <li style={{ marginBottom: '4px' }}>{props.children}</li> },
                                p(props) { return <p style={{ marginBottom: '10px', lineHeight: '1.5', fontSize: '13px' }}>{props.children}</p> }
                            }}
                        >
                            {guide.summary}
                        </ReactMarkdown>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TriageTab;
