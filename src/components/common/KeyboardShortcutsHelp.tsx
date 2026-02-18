import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { KEYBOARD_SHORTCUTS } from '../../hooks/useKeyboardShortcuts';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal component that displays all available keyboard shortcuts
 */
export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  // Handle escape key to close modal
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const formatKey = (key: string): string => {
    const keyMap: Record<string, string> = {
      'ArrowUp': '↑',
      'ArrowDown': '↓',
      'ArrowLeft': '←',
      'ArrowRight': '→',
      'Escape': 'Esc',
      'Delete': 'Del',
      ' ': 'Space',
    };
    return keyMap[key] || key.toUpperCase();
  };

  const renderKeyCombo = (shortcut: typeof KEYBOARD_SHORTCUTS[0]['shortcuts'][0]) => {
    const keys: string[] = [];
    
    if (shortcut.ctrl) keys.push('Ctrl');
    if (shortcut.meta) keys.push('⌘');
    if (shortcut.alt) keys.push('Alt');
    if (shortcut.shift) keys.push('Shift');
    keys.push(formatKey(shortcut.key));

    return (
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {keys.map((key, idx) => (
          <React.Fragment key={idx}>
            <kbd
              style={{
                padding: '3px 6px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}
            >
              {key}
            </kbd>
            {idx < keys.length - 1 && (
              <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>+</span>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div
        style={{
          background: 'var(--bg-primary)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Keyboard size={20} color="var(--accent-color)" />
            <h2
              id="shortcuts-title"
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--text-primary)'
              }}
            >
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              transition: 'all 0.15s ease'
            }}
            aria-label="Close keyboard shortcuts help"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-primary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: '16px 20px',
            overflow: 'auto',
            flex: 1
          }}
        >
          {KEYBOARD_SHORTCUTS.map((category) => (
            <div
              key={category.name}
              style={{
                marginBottom: '20px'
              }}
            >
              <h3
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--accent-color)',
                  marginBottom: '12px',
                  letterSpacing: '0.05em'
                }}
              >
                {category.name}
              </h3>
              <div
                style={{
                  display: 'grid',
                  gap: '8px'
                }}
              >
                {category.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      {shortcut.description}
                    </span>
                    {renderKeyCombo(shortcut)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            textAlign: 'center'
          }}
        >
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)'
            }}
          >
            Press <kbd style={styles.kbd}>Esc</kbd> or <kbd style={styles.kbd}>?</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
};

const styles = {
  kbd: {
    padding: '2px 5px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '3px',
    fontSize: '10px',
    fontFamily: 'var(--font-mono)',
    fontWeight: 600
  } as React.CSSProperties
};

export default KeyboardShortcutsHelp;
