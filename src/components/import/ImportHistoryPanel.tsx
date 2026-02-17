import React from 'react';
import { History, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { ImportHistoryEntry } from '../../types';

interface ImportHistoryPanelProps {
  history: ImportHistoryEntry[];
  isLoading: boolean;
  onClear: () => void;
  onClose: () => void;
}

export const ImportHistoryPanel: React.FC<ImportHistoryPanelProps> = ({
  history,
  isLoading,
  onClear,
}) => {
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', gap: '16px',
      padding: '0 4px', overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <History size={18} className="text-accent" />
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Import History</h3>
        </div>
        <button
          onClick={onClear}
          disabled={history.length === 0}
          style={{
            background: 'transparent', border: 'none', color: 'var(--status-critical)',
            fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px',
            cursor: 'pointer', opacity: history.length === 0 ? 0.3 : 1
          }}
        >
          <Trash2 size={12} /> Clear History
        </button>
      </div>

      <div style={{ 
        flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px',
        paddingRight: '4px'
      }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
            Loading history...
          </div>
        ) : history.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)',
            border: '1px dashed var(--border-color)', borderRadius: '8px'
          }}>
            <History size={32} style={{ opacity: 0.2, marginBottom: '12px' }} />
            <p style={{ margin: 0, fontSize: '12px' }}>No previous imports found.</p>
          </div>
        ) : (
          history.map((entry) => (
            <div key={entry.import_id} style={{
              padding: '12px', background: 'var(--bg-primary)',
              borderRadius: '8px', border: '1px solid var(--border-color)',
              display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>{entry.source}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{formatDate(entry.created_at)}</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                  <CheckCircle2 size={12} style={{ color: 'var(--status-safe)' }} />
                  <span>{entry.successful_assets} Success</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                  <AlertCircle size={12} style={{ color: 'var(--status-critical)' }} />
                  <span>{entry.failed_assets} Failed</span>
                </div>
              </div>
              {entry.destination && (
                <div style={{ 
                  fontSize: '10px', color: 'var(--text-secondary)',
                  paddingTop: '4px', borderTop: '1px solid var(--border-dim)'
                }}>
                  To: {entry.destination}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
