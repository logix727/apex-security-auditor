import React from 'react';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { ImportProgress } from '../../types';

interface ImportProgressOverlayProps {
  progress: ImportProgress;
  onClose: () => void;
}

export const ImportProgressOverlay: React.FC<ImportProgressOverlayProps> = ({
  progress,
  onClose
}) => {
  const isCompleted = progress.status === 'completed';
  const isFailed = progress.status === 'failed';

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(var(--bg-primary-rgb), 0.9)',
      backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 100, borderRadius: '12px'
    }}>
      <div style={{
        width: '400px', padding: '32px', background: 'var(--bg-secondary)',
        borderRadius: '16px', border: '1px solid var(--border-color)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)', textAlign: 'center',
        display: 'flex', flexDirection: 'column', gap: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {progress.status === 'importing' && (
            <div style={{ position: 'relative', width: '80px', height: '80px' }}>
              <Loader2 size={80} className="animate-spin" style={{ color: 'var(--accent-color)', opacity: 0.2 }} />
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)'
              }}>
                {Math.round(progress.percentage)}%
              </div>
            </div>
          )}
          {isCompleted && <CheckCircle2 size={80} style={{ color: 'var(--status-safe)' }} />}
          {isFailed && <XCircle size={80} style={{ color: 'var(--status-critical)' }} />}
        </div>

        <div>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>
            {progress.status === 'importing' ? 'Importing Assets...' : 
             isCompleted ? 'Import Complete!' : 'Import Failed'}
          </h3>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
            {progress.status === 'importing' ? `Processing ${progress.current} of ${progress.total} items` :
             isCompleted ? `Successfully added ${progress.current} assets to ${progress.status}` : 
             'An error occurred during the import process.'}
          </p>
        </div>

        {progress.errors.length > 0 && (
          <div style={{
            textAlign: 'left', padding: '12px', background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)',
            maxHeight: '120px', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--status-critical)', fontSize: '12px', fontWeight: 700 }}>
              <AlertCircle size={14} /> ERRORS DETECTED
            </div>
            {progress.errors.map((err, i) => (
              <div key={i} style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                • {err.error}
              </div>
            ))}
          </div>
        )}

        {(isCompleted || isFailed) && (
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '12px', borderRadius: '8px',
              background: 'var(--accent-color)', color: 'white', fontWeight: 700,
              border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.3)'
            }}
          >
            Close Manager
          </button>
        )}

        {progress.status === 'importing' && (
          <div style={{ width: '100%', height: '6px', background: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', width: `${progress.percentage}%`, 
              background: 'var(--accent-color)', transition: 'width 0.3s ease' 
            }} />
          </div>
        )}
      </div>
    </div>
  );
};
