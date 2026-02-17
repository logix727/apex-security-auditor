
import React from 'react';
import { Activity } from 'lucide-react';

interface SmartFilterCommandBarProps {
    isOpen: boolean;
    onClose: () => void;
    query: string;
    setQuery: (query: string) => void;
    onExecute: (query: string) => void;
}

export const SmartFilterCommandBar: React.FC<SmartFilterCommandBarProps> = ({ isOpen, onClose, query, setQuery, onExecute }) => {
    if (!isOpen) return null;

    return (
        <div 
          style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
            zIndex: 3000, display: 'flex', justifyContent: 'center', paddingTop: '15vh'
          }}
          onClick={onClose}
        >
          <div 
            style={{ 
              width: '600px', background: 'var(--bg-secondary)', border: '1px solid var(--accent-color)',
              borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              overflow: 'hidden', animation: 'modalEnter 0.2s ease-out'
            }}
            onClick={e => e.stopPropagation()}
          >
             <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)' }}>
                <Activity size={20} color="var(--accent-color)" />
                <input 
                    autoFocus
                    placeholder="Search assets, filters, or commands..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            onExecute(query);
                            onClose();
                        }
                    }}
                    style={{ 
                        flex: 1, background: 'transparent', border: 'none', 
                        fontSize: '18px', color: 'white', outline: 'none' 
                    }}
                />
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>ESC</div>
             </div>
             <div style={{ padding: '8px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', padding: '8px 12px', fontWeight: 'bold' }}>QUICK FILTERS</div>
                {[
                    { id: 'Critical', label: 'Show Critical Findings', icon: '🚨', action: () => onExecute('Critical') },
                    { id: 'PII', label: 'Show PII / Sensitive Data', icon: '👤', action: () => onExecute('PII') },
                    { id: 'Secrets', label: 'Show Secrets & Keys', icon: '🔑', action: () => onExecute('Secrets') },
                    { id: 'Shadow', label: 'Show Shadow APIs', icon: '🌑', action: () => onExecute('Shadow') },
                    { id: 'Reset', label: 'Reset All Filters', icon: '🔄', action: () => onExecute('Reset') }
                ].filter(c => c.label.toLowerCase().includes(query.toLowerCase())).map(cmd => (
                    <div 
                        key={cmd.id}
                        onClick={() => { cmd.action(); onClose(); }}
                        className="menu-item"
                        style={{ 
                            padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '12px', 
                            fontSize: '13px', borderRadius: '8px', cursor: 'pointer'
                        }}
                    >
                        <span>{cmd.icon}</span>
                        <span>{cmd.label}</span>
                    </div>
                ))}
             </div>
          </div>
        </div>
    );
};
