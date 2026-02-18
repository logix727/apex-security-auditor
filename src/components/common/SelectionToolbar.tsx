import React from 'react';
import { Zap, Trash2, ArrowRight, X } from 'lucide-react';

interface SelectionToolbarProps {
    count: number;
    onClear: () => void;
    onAddToWorkbench?: () => void;
    onActiveScan?: () => void;
    onDelete?: () => void;
}

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
    count,
    onClear,
    onAddToWorkbench,
    onActiveScan,
    onDelete
}) => {
    if (count === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--accent-color)',
            borderRadius: '12px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            zIndex: 1000,
            backdropFilter: 'blur(8px)',
            animation: 'slideUp 0.3s ease-out'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '16px', borderRight: '1px solid var(--border-color)' }}>
                <div style={{ background: 'var(--accent-color)', color: 'white', borderRadius: '4px', padding: '2px 8px', fontSize: '12px', fontWeight: '900' }}>
                    {count}
                </div>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Selected</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {onAddToWorkbench && (
                    <button 
                        onClick={onAddToWorkbench}
                        className="toolbar-btn"
                        title="Add to Workbench"
                    >
                        <ArrowRight size={14} /> Workbench
                    </button>
                )}

                {onActiveScan && (
                    <button 
                        onClick={onActiveScan}
                        className="toolbar-btn danger-hover"
                        title="Run Active Scan"
                    >
                        <Zap size={14} /> Active Scan
                    </button>
                )}

                {onDelete && (
                    <button 
                        onClick={onDelete}
                        className="toolbar-btn danger-hover"
                        title="Delete Selected"
                    >
                        <Trash2 size={14} /> Delete
                    </button>
                )}
            </div>

            <button 
                onClick={onClear}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    marginLeft: '8px'
                }}
                title="Clear Selection"
            >
                <X size={16} />
            </button>

            <style>{`
                @keyframes slideUp {
                    from { transform: translate(-50%, 100%); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
                .toolbar-btn {
                    display: flex;
                    alignItems: center;
                    gap: 6px;
                    padding: 6px 12px;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    color: var(--text-primary);
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .toolbar-btn:hover {
                    background: var(--accent-color);
                    color: white;
                    border-color: var(--accent-color);
                }
                .toolbar-btn.danger-hover:hover {
                    background: var(--status-critical);
                    border-color: var(--status-critical);
                    color: white;
                }
            `}</style>
        </div>
    );
};
