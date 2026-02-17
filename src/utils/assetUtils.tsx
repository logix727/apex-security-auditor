
import { Badge } from '../types';

export const getDetectionBadges = (findings: Badge[]) => {
    if (!findings || findings.length === 0) return null;
    const severityColors = {
        Critical: '#ef4444',
        High: '#f59e0b',
        Medium: '#eab308',
        Low: '#3b82f6',
        Info: '#10b981'
    };

    const severities = ['Info', 'Low', 'Medium', 'High', 'Critical'];
    
    // Find highest severity and total count
    let totalCount = findings.length;
    let highestSeverityBadge = findings[0];
    
    findings.forEach(f => {
        if (severities.indexOf(f.severity) > severities.indexOf(highestSeverityBadge.severity)) {
            highestSeverityBadge = f;
        }
    });

    const color = severityColors[highestSeverityBadge.severity as keyof typeof severityColors] || '#3b82f6';
    
    // Group all descriptions for the tooltip
    const allDescriptions = findings.map(f => `${f.emoji} [${f.severity}] ${f.short}: ${f.description}`).join('\n• ');
    const title = `Findings (${totalCount}):\n\n• ${allDescriptions}`;

    return (
        <span title={title} style={{ 
            background: `${color}15`, 
            color: color, 
            border: `1px solid ${color}30`,
            padding: '2px 6px', 
            borderRadius: '6px', 
            fontSize: '11px',
            marginRight: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'help',
            minWidth: '24px',
            height: '22px',
            gap: '4px'
        }}>
            <span>{highestSeverityBadge.emoji}</span>
            {totalCount > 1 && (
                <span style={{ 
                    fontSize: '9px', 
                    fontWeight: 'bold', 
                    background: color, 
                    color: 'white', 
                    borderRadius: '4px', 
                    padding: '0 3px',
                    height: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    lineHeight: 1
                }}>
                    {totalCount}
                </span>
            )}
        </span>
    );
};

export const getSourceIcon = (source: string) => {
    switch (source) {
      case 'Import': return <span title="Imported from file" style={{ cursor: 'help' }}>📥</span>;
      case 'Recursive': return <span title="Recursively discovered" style={{ cursor: 'help' }}>🔄</span>;
      case 'Workbench': return <span title="Active Workbench Session" style={{ cursor: 'help' }}>🧪</span>;
      default: return <span title="User manually added" style={{ cursor: 'help' }}>👤</span>;
    }
};

export const getStatusColor = (code: number) => {
    if (code === 0) return 'var(--status-critical)';
    if (code >= 200 && code < 300) return 'var(--status-safe)';
    if (code >= 300 && code < 400) return '#3b82f6';
    if (code >= 400 && code < 500) return 'var(--status-warning)';
    if (code >= 500) return 'var(--status-critical)';
    return 'var(--text-secondary)';
};

export const getStatusBadge = (code: number, findings: Badge[]) => {
    let emoji = '🌍';
    if (code === 0) emoji = '💀';
    else if (code === 401) emoji = '🔒';
    else if (code === 403) emoji = '🚫';
    else if (code === 429) emoji = '⏱️';
    else if (code >= 500) emoji = '⚠️';
    // Keeping these checks for emoji selection as they are useful visual indicators
    else if (findings.some(f => f.short === 'Auth')) emoji = '🔒';
    else if (findings.some(f => f.short === '403')) emoji = '🚫';
    else if (findings.some(f => f.short === 'Rate')) emoji = '⏱️';

    return (
        <span style={{ 
            color: getStatusColor(code), 
            fontWeight: 'bold',
            fontFamily: 'monospace',
            background: `${getStatusColor(code)}20`,
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
        }}>
            <span>{emoji}</span>
            {code === 0 ? 'FAIL' : code}
        </span>
    );
};
