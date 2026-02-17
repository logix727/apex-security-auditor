import React from 'react';
import { X, BrainCircuit } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface SequenceAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: string | null;
  isLoading: boolean;
  flowName: string;
}

export const SequenceAnalysisModal: React.FC<SequenceAnalysisModalProps> = ({
  isOpen,
  onClose,
  analysis,
  isLoading,
  flowName
}) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '12px',
        width: '800px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border-color)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
      }}>
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--bg-primary)',
          borderRadius: '12px 12px 0 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ 
                background: 'rgba(139, 92, 246, 0.1)', 
                color: '#a78bfa', 
                padding: '8px', 
                borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <BrainCircuit size={20} />
            </div>
            <div>
                <div style={{ fontWeight: '600', fontSize: '16px' }}>Sequence Analysis</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Flow: {flowName}
                </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer'
          }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '0', overflowY: 'auto', flex: 1, backgroundColor: 'var(--bg-sidebar)' }}>
            {isLoading ? (
                <div style={{ 
                    padding: '60px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'var(--text-secondary)',
                    gap: '16px'
                }}>
                    <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTop: '3px solid var(--accent-color)', borderRadius: '50%' }}></div>
                    <div style={{ fontSize: '14px' }}>Analyzing sequence logic and state transitions...</div>
                </div>
            ) : (
                <div className="markdown-content" style={{ padding: '24px', fontSize: '14px', lineHeight: '1.6' }}>
                    <ReactMarkdown>{analysis || "No analysis available."}</ReactMarkdown>
                </div>
            )}
        </div>

        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'flex-end', gap: '12px',
          background: 'var(--bg-primary)',
          borderRadius: '0 0 12px 12px'
        }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: '6px',
            border: '1px solid var(--border-color)',
            background: 'transparent', color: 'var(--text-primary)',
            cursor: 'pointer'
          }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
