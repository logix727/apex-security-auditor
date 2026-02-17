import React from 'react';
import { Bot, Loader2, Copy } from 'lucide-react';

interface AiAnalysisModalProps {
    aiAnalysis: { analysis: string; provider: string } | null;
    aiAnalysisLoading: boolean;
    aiAnalysisFinding: string | null;
    setAiAnalysisFinding: (finding: string | null) => void;
}

export const AiAnalysisModal: React.FC<AiAnalysisModalProps> = ({
    aiAnalysis,
    aiAnalysisLoading,
    aiAnalysisFinding,
    setAiAnalysisFinding
}) => {
    if (!aiAnalysisFinding && !aiAnalysisLoading) return null;

    return (
        <div className="modal-overlay" onClick={() => { if(!aiAnalysisLoading) setAiAnalysisFinding(null); }}>
            <div className="modal-content" style={{ width: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Bot size={20} color="var(--accent-color)" />
                        <div>
                            <h3 style={{ margin: 0, fontSize: '15px' }}>Security AI Expert: {aiAnalysisFinding}</h3>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Deep analysis of the discovered finding</div>
                        </div>
                    </div>
                    <button onClick={() => setAiAnalysisFinding(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>Close</button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }} className="custom-scrollbar">
                    {aiAnalysisLoading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>
                            <Loader2 size={32} className="spin" style={{ margin: '0 auto 16px', color: 'var(--accent-color)' }} />
                            <div style={{ fontSize: '12px' }}>Consulting our Senior Security engine...</div>
                        </div>
                    ) : (
                        <div style={{ fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                            {aiAnalysis?.analysis.split('\n').map((line, i) => {
                                if (line.startsWith('### ')) return <h4 key={i} style={{ color: 'var(--accent-color)', marginTop: '16px', marginBottom: '8px' }}>{line.replace('### ', '')}</h4>;
                                if (line.startsWith('**')) return <strong key={i} style={{ color: 'var(--text-primary)' }}>{line}</strong>;
                                return <p key={i} style={{ marginBottom: '8px' }}>{line}</p>;
                            })}
                        </div>
                    )}
                </div>

                {!aiAnalysisLoading && (
                    <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Analysis by {aiAnalysis?.provider}</span>
                        <button onClick={() => {
                            if (aiAnalysis) {
                                navigator.clipboard.writeText(aiAnalysis.analysis);
                                alert('Analysis copied!');
                            }
                        }} style={{ padding: '6px 12px', background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Copy size={12} /> Copy Analysis
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
