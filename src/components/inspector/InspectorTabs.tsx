import React from 'react';
import { Info, Activity, Lock, Terminal } from 'lucide-react';
import { InspectorTab } from '../Inspector';

interface InspectorTabsProps {
    activeInspectorTab: InspectorTab;
    setActiveInspectorTab: (tab: InspectorTab) => void;
    hasSecrets: boolean;
    showSummary: boolean;
}

export const InspectorTabs: React.FC<InspectorTabsProps> = ({
    activeInspectorTab,
    setActiveInspectorTab,
    hasSecrets,
    showSummary
}) => {
    if (!showSummary) return null;

    return (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '16px', gap: '4px', padding: '0 12px' }}>
            {(['Summary', 'Exchange', 'Security', 'Details'] as InspectorTab[]).map(tab => {
                const Icon = ({
                    'Summary': Info,
                    'Exchange': Activity,
                    'Security': Lock,
                    'Details': Terminal
                } as any)[tab];

                const tabHasSecrets = tab === 'Security' && hasSecrets;

                return (
                    <div 
                        key={tab}
                        onClick={() => setActiveInspectorTab(tab)}
                        style={{
                            padding: '10px 14px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            position: 'relative',
                            color: activeInspectorTab === tab ? 'var(--accent-color)' : 'var(--text-secondary)',
                            borderBottom: activeInspectorTab === tab ? '2px solid var(--accent-color)' : '2px solid transparent',
                            transition: 'all 0.2s ease',
                            opacity: activeInspectorTab === tab ? 1 : 0.7
                        }}
                    >
                        <Icon size={14} strokeWidth={activeInspectorTab === tab ? 2.5 : 2} />
                        {tab}
                        {tabHasSecrets && (
                            <div style={{ 
                                position: 'absolute', top: '6px', right: '4px', 
                                width: '8px', height: '8px', borderRadius: '50%', 
                                background: 'var(--status-critical)', border: '2px solid var(--bg-primary)',
                                boxShadow: '0 0 8px var(--status-critical)'
                            }} />
                        )}
                    </div>
                );
            })}
        </div>
    );
};
