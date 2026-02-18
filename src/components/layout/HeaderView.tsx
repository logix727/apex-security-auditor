import React, { useState } from 'react';
import { Copy, Check, Search } from 'lucide-react';

interface HeaderViewProps {
    headers: string;
}

export const HeaderView: React.FC<HeaderViewProps> = ({ headers }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const parsedHeaders = headers.split('\n').filter(h => h.includes(': ')).map(h => {
        const [name, ...valueParts] = h.split(': ');
        return { name, value: valueParts.join(': ') };
    });

    const filteredHeaders = parsedHeaders.filter(h => 
        h.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        h.value.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    if (!headers || headers === 'No headers.') {
        return <div className="empty-state">No headers available.</div>;
    }

    return (
        <div className="header-view">
            <div style={{ position: 'relative', marginBottom: '8px' }}>
                <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                <input 
                    type="text" 
                    placeholder="Filter headers..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px 6px 28px', fontSize: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', outline: 'none' }}
                />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {filteredHeaders.map((h, i) => (
                    <div key={i} className="header-row">
                        <span className="header-name">{h.name}</span>
                        <span className="header-value">{h.value}</span>
                        <button 
                            className="header-copy-btn"
                            onClick={() => handleCopy(`${h.name}: ${h.value}`, `${h.name}-${i}`)}
                            title="Copy header"
                        >
                            {copiedKey === `${h.name}-${i}` ? <Check size={10} color="var(--status-safe)" /> : <Copy size={10} />}
                        </button>
                    </div>
                ))}
                {filteredHeaders.length === 0 && (
                    <div style={{ padding: '8px', textAlign: 'center', fontSize: '10px', opacity: 0.5 }}>
                        No headers match your search.
                    </div>
                )}
            </div>
        </div>
    );
};
