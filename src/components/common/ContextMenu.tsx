import React, { useEffect, useRef } from 'react';
import { LucideIcon } from 'lucide-react';

export interface ContextMenuAction {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
    variant?: 'default' | 'danger';
    shortcut?: string;
}

interface ContextMenuProps {
    x: number;
    y: number;
    actions: ContextMenuAction[];
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, actions, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleScroll = () => {
            onClose();
        };

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true);
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [onClose]);

    // Adjust position to prevent overflow
    const adjustedX = Math.min(x, window.innerWidth - 220);
    const adjustedY = Math.min(y, window.innerHeight - (actions.length * 36 + 20));

    return (
        <div 
            ref={menuRef}
            style={{
                position: 'fixed',
                top: adjustedY,
                left: adjustedX,
                width: '200px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                padding: '4px',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
            }}
            onContextMenu={(e) => e.preventDefault()}
        >
            {actions.map((action, index) => (
                <button
                    key={index}
                    onClick={() => {
                        action.onClick();
                        onClose();
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        border: 'none',
                        background: 'transparent',
                        color: action.variant === 'danger' ? '#ef4444' : 'var(--text-primary)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        borderRadius: '4px',
                        fontSize: '13px',
                        transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    {action.icon && <action.icon size={14} />}
                    <span style={{ flex: 1 }}>{action.label}</span>
                    {action.shortcut && <span style={{ opacity: 0.5, fontSize: '11px' }}>{action.shortcut}</span>}
                </button>
            ))}
        </div>
    );
};
