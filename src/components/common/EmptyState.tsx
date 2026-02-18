import React from 'react';
import { LucideIcon, Search, FolderOpen, FileX, AlertTriangle, Inbox, Plus, Upload } from 'lucide-react';

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
        icon?: LucideIcon;
    };
    /** ARIA role for the component */
    role?: string;
    /** Test ID for testing */
    testId?: string;
}

/**
 * Predefined empty state variants for common use cases
 */
export const EmptyStateVariants = {
    NoAssets: {
        icon: Inbox,
        title: 'No Assets Found',
        description: 'Get started by importing your first assets or adjusting your filters.'
    },
    NoSearchResults: {
        icon: Search,
        title: 'No Results Found',
        description: 'Try adjusting your search terms or filters to find what you\'re looking for.'
    },
    NoFolder: {
        icon: FolderOpen,
        title: 'Empty Folder',
        description: 'This folder doesn\'t contain any assets yet.'
    },
    NoSelection: {
        icon: FileX,
        title: 'Nothing Selected',
        description: 'Select one or more assets to perform actions on them.'
    },
    Error: {
        icon: AlertTriangle,
        title: 'Something Went Wrong',
        description: 'An error occurred while loading this content. Please try again.'
    },
    Import: {
        icon: Upload,
        title: 'Drop Files to Import',
        description: 'Drag and drop files here or click to browse.'
    },
    CreateFirst: {
        icon: Plus,
        title: 'Get Started',
        description: 'Create your first item to see it here.'
    }
} as const;

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action, role = 'status', testId }) => {
    return (
        <div 
            role={role}
            aria-live="polite"
            aria-label={title}
            data-testid={testId}
            style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px',
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.01)',
            borderRadius: '16px',
            margin: '20px'
        }}>
            <div 
                role="img" 
                aria-hidden="true"
                style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '16px',
                    background: 'rgba(99, 102, 241, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '20px',
                    color: 'var(--accent-color)',
                    border: '1px solid rgba(99, 102, 241, 0.2)'
                }}
            >
                {Icon && <Icon size={32} />}
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>{title}</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '300px', lineHeight: '1.6', marginBottom: '24px' }}>
                {description}
            </p>
            {action && (
                <button
                    onClick={action.onClick}
                    aria-label={action.label}
                    style={{
                        padding: '10px 24px',
                        background: 'var(--accent-color)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
                    }}
                >
                    {action.icon && <action.icon size={16} />}
                    {action.label}
                </button>
            )}
        </div>
    );
};
