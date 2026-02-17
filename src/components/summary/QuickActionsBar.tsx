import React, { memo, useCallback, useEffect } from 'react';
import { 
  AlertCircle, 
  FileCode, 
  RefreshCw, 
  Loader2,
  Copy
} from 'lucide-react';

export interface QuickActionsBarProps {
  onTriage: (status: 'Safe' | 'Suspect') => void;
  onExport: () => void;
  onRescan?: () => void;
  onCopy?: () => void;
  currentTriage: string;
  isLoading?: boolean;
  showRescan?: boolean;
  showCopy?: boolean;
}

/**
 * QuickActionsBar - Consolidated action buttons with keyboard shortcuts
 * Provides quick access to common triage and export operations
 */
const QuickActionsBar: React.FC<QuickActionsBarProps> = memo(({
  onTriage,
  onExport,
  onRescan,
  onCopy,
  currentTriage,
  isLoading = false,
  showRescan = true,
  showCopy = true
}) => {


  const handleSuspectClick = useCallback(() => {
    if (!isLoading) {
      onTriage('Suspect');
    }
  }, [onTriage, isLoading]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  }, []);

  // Register global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Check for Alt key combination
      if (!e.altKey || isLoading) return;

      switch (e.key.toLowerCase()) {

        case 'x':
          e.preventDefault();
          onTriage('Suspect');
          break;
        case 'e':
          e.preventDefault();
          onExport();
          break;
        case 'r':
          if (onRescan) {
            e.preventDefault();
            onRescan();
          }
          break;
        case 'c':
          if (onCopy) {
            e.preventDefault();
            onCopy();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isLoading, onTriage, onExport, onRescan, onCopy]);

  return (
    <div 
      className="quick-actions-bar"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '12px'
      }}
    >
      <div 
        style={{
          fontSize: '10px',
          fontWeight: 'bold',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          marginBottom: '10px',
          letterSpacing: '0.5px'
        }}
      >
        Quick Actions
      </div>

      <div 
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}
      >
        {/* Safe Button */}


        {/* Suspect Button */}
        <button
          onClick={handleSuspectClick}
          onKeyDown={(e) => handleKeyDown(e, handleSuspectClick)}
          disabled={isLoading}
          style={{
            flex: '1 1 auto',
            minWidth: '80px',
            padding: '10px 14px',
            background: currentTriage === 'Suspect' ? '#ef4444' : 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef444440',
            borderRadius: '8px',
            color: currentTriage === 'Suspect' ? 'white' : '#ef4444',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: isLoading ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
            opacity: isLoading ? 0.7 : 1
          }}
          title="Mark as Suspect (Alt+X)"
        >
          <AlertCircle size={14} />
          Suspect
        </button>

        {/* Export Button */}
        <button
          onClick={onExport}
          onKeyDown={(e) => handleKeyDown(e, onExport)}
          disabled={isLoading}
          style={{
            flex: '1 1 auto',
            minWidth: '80px',
            padding: '10px 14px',
            background: 'linear-gradient(135deg, var(--accent-color), #4f46e5)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: isLoading ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
            opacity: isLoading ? 0.7 : 1
          }}
          title="Export Security Evidence (Alt+E)"
        >
          {isLoading ? <Loader2 size={14} className="spin" /> : <FileCode size={14} />}
          Export
        </button>

        {/* Copy Button */}
        {showCopy && onCopy && (
          <button
            onClick={onCopy}
            onKeyDown={(e) => handleKeyDown(e, onCopy)}
            disabled={isLoading}
            style={{
              padding: '10px 14px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: isLoading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              opacity: isLoading ? 0.7 : 1
            }}
            title="Copy to Clipboard (Alt+C)"
          >
            <Copy size={14} />
          </button>
        )}

        {/* Rescan Button */}
        {showRescan && onRescan && (
          <button
            onClick={onRescan}
            onKeyDown={(e) => handleKeyDown(e, onRescan)}
            disabled={isLoading}
            style={{
              padding: '10px 14px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: isLoading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              opacity: isLoading ? 0.7 : 1
            }}
            title="Rescan Asset (Alt+R)"
          >
            {isLoading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
          </button>
        )}
      </div>

      {/* Keyboard shortcuts hint */}
      <div 
        style={{
          marginTop: '10px',
          fontSize: '9px',
          color: 'var(--text-secondary)',
          opacity: 0.6,
          textAlign: 'center'
        }}
      >
        Keyboard: Alt+X (Suspect) • Alt+E (Export) • Alt+R (Rescan)
      </div>
    </div>
  );
});

QuickActionsBar.displayName = 'QuickActionsBar';

export default QuickActionsBar;
