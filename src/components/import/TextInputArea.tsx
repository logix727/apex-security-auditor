import React from 'react';
import { Terminal } from 'lucide-react';

interface TextInputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onProcess: () => void;
  isProcessing: boolean;
}

export const TextInputArea: React.FC<TextInputAreaProps> = ({
  value,
  onChange,
  onProcess,
  isProcessing
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <div style={{ 
        flex: 1, position: 'relative', 
        border: '1px solid var(--border-color)', borderRadius: '12px',
        background: 'var(--bg-primary)', overflow: 'hidden'
      }}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste URLs, JSON arrays, or raw HTTP requests..."
          style={{
            width: '100%', height: '100%', background: 'transparent',
            color: 'var(--text-primary)', border: 'none',
            padding: '16px', fontSize: '13px', resize: 'none',
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            outline: 'none', lineHeight: '1.6'
          }}
        />
      </div>

      <button
        onClick={onProcess}
        disabled={!value.trim() || isProcessing}
        style={{
          width: '100%', padding: '12px', borderRadius: '8px',
          background: 'var(--accent-color)', color: 'white', 
          fontWeight: 700, fontSize: '13px', border: 'none', 
          cursor: 'pointer', display: 'flex', alignItems: 'center', 
          justifyContent: 'center', gap: '8px',
          boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.3)',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: (!value.trim() || isProcessing) ? 0.5 : 1
        }}
      >
        <Terminal size={18} />
        {isProcessing ? 'Processing...' : 'Process Staged Text'}
      </button>

      <div style={{ padding: '0 4px' }}>
        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: '1.4' }}>
          Supports comma-separated URLs, JSON lists of assets, or raw HTTP request bodies.
        </p>
      </div>
    </div>
  );
};
