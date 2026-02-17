import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { Badge } from '../types';

interface JSONTreeProps {
    data: any;
    level?: number;
    name?: string | number;
    path?: string;
    isExpandedDefault?: boolean;
    searchTerm?: string;
    findings?: Badge[];
}

export const JSONTree: React.FC<JSONTreeProps> = ({ 
    data, 
    level = 0, 
    name, 
    path = '', 
    isExpandedDefault = false, 
    searchTerm = '',
    findings = []
}) => {
    const [isExpanded, setIsExpanded] = useState(level < 1 || isExpandedDefault);
    const isObject = data !== null && typeof data === 'object';
    
    // Auto-expand if search term OR finding matches below
    useEffect(() => {
        if (isObject) {
            const lowerData = JSON.stringify(data).toLowerCase();
            const hasSearchMatch = searchTerm && lowerData.includes(searchTerm.toLowerCase());
            const hasFindingMatch = findings.some(f => f.evidence && lowerData.includes(f.evidence.toLowerCase()));
            
            if (hasSearchMatch || hasFindingMatch) {
                setIsExpanded(true);
            }
        }
    }, [searchTerm, findings, data, isObject]);

    const handleCopyPath = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(path);
    };

    const highlightMatch = (text: string) => {
        if (!text) return text;
        const termsMap = new Map<string, string>();
        if (searchTerm) termsMap.set(searchTerm.toLowerCase(), searchTerm);
        findings.forEach(f => {
             if (f.evidence) termsMap.set(f.evidence.toLowerCase(), f.evidence);
        });

        if (termsMap.size === 0) return text;

        const sortedTerms = Array.from(termsMap.keys()).sort((a,b) => b.length - a.length);
        const regex = new RegExp(`(${sortedTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
        
        const parts = text.split(regex);
        let firstMatchUsed = false;
        return (
            <>
                {parts.map((p, i) => {
                    if (!p) return null;
                    const lowerP = p.toLowerCase();
                    const isSearch = searchTerm && lowerP === searchTerm.toLowerCase();
                    const isFinding = termsMap.has(lowerP);
                    
                    if (isSearch || isFinding) {
                        const isFirstSearchMatch = isSearch && !firstMatchUsed;
                        if (isFirstSearchMatch) firstMatchUsed = true;

                        return (
                            <mark 
                                key={i} 
                                id={isFirstSearchMatch ? "highlight-match" : undefined}
                                style={{ 
                                    background: isSearch ? 'var(--accent-color)' : 'rgba(239, 68, 68, 0.2)', 
                                    color: isSearch ? 'white' : 'inherit', 
                                    borderRadius: '2px', 
                                    padding: '0 2px',
                                    border: isSearch ? 'none' : '1px solid rgba(239, 68, 68, 0.4)'
                                }}
                            >
                                {p}
                            </mark>
                        );
                    }
                    return p;
                })}
            </>
        );
    };

    if (!isObject) {
        const valStr = typeof data === 'string' ? `"${data}"` : String(data);
        return (
            <div className="json-row" style={{ marginLeft: '16px', fontSize: '11px', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}>
                {name !== undefined && <span style={{ color: 'var(--accent-color)', fontWeight: '500' }}>{highlightMatch(String(name))}:</span>}
                <span style={{ color: typeof data === 'string' ? '#10b981' : '#f59e0b', wordBreak: 'break-all' }}>
                    {highlightMatch(valStr)}
                </span>
                <button 
                    onClick={handleCopyPath}
                    title="Copy JSON Path"
                    className="copy-path-btn"
                    style={{ opacity: 0, padding: '2px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                    <Copy size={10} />
                </button>
            </div>
        );
    }

    const keys = Object.keys(data);
    const isEmpty = keys.length === 0;

    return (
        <div style={{ marginLeft: level > 0 ? '16px' : '0' }}>
            <div 
                onClick={() => !isEmpty && setIsExpanded(!isExpanded)}
                className="json-folder-row"
                style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    cursor: isEmpty ? 'default' : 'pointer', 
                    padding: '2px 4px',
                    fontSize: '11px',
                    borderRadius: '4px'
                }}
            >
                {!isEmpty && (
                    isExpanded ? <ChevronDown size={12} style={{ opacity: 0.5, marginRight: '4px' }} /> : <ChevronRight size={12} style={{ opacity: 0.5, marginRight: '4px' }} />
                )}
                {name !== undefined && <span style={{ color: 'var(--accent-color)', marginRight: '4px', fontWeight: '600' }}>{highlightMatch(String(name))}:</span>}
                <span style={{ opacity: 0.5, fontSize: '10px' }}>
                    {Array.isArray(data) ? `Array[${keys.length}]` : `Object{${keys.length}}`}
                </span>
                {path && (
                    <button 
                        onClick={handleCopyPath}
                        title="Copy JSON Path"
                        className="copy-path-btn"
                        style={{ opacity: 0, marginLeft: '8px', padding: '2px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                    >
                        <Copy size={10} />
                    </button>
                )}
            </div>
            {isExpanded && !isEmpty && (
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', marginLeft: '8px', paddingLeft: '4px' }}>
                    {keys.map(key => {
                        const nextPath = path ? (Array.isArray(data) ? `${path}[${key}]` : `${path}.${key}`) : key;
                        return (
                            <JSONTree 
                                key={key} 
                                data={data[key]} 
                                level={level + 1} 
                                name={key} 
                                path={nextPath}
                                searchTerm={searchTerm}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};
