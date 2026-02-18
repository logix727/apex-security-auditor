import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useDebugLogger } from '../debug/DebugConsole';

interface DiffLine {
    content: String;
    tag: "Equal" | "Delete" | "Insert";
}

interface ResponseDiffProps {
    old: string;
    new: string;
}

export const ResponseDiff: React.FC<ResponseDiffProps> = (props) => {
    const [diffLines, setDiffLines] = useState<DiffLine[]>([]);
    const [loading, setLoading] = useState(false);
    const { error } = useDebugLogger();

    useEffect(() => {
        calculateDiff();
    }, [props.old, props.new]);

    const calculateDiff = async () => {
        setLoading(true);
        try {
            const lines = await invoke<DiffLine[]>('compare_responses', { 
                old: props.old, 
                new: props.new 
            });
            setDiffLines(lines);
        } catch (e) {
            error(`Failed to calculate diff: ${e}`, 'Diff');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div style={{ padding: '10px', fontSize: '12px' }}>Calculating Diff...</div>;

    return (
        <div style={{ fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap', background: 'var(--bg-secondary)', padding: '10px', borderRadius: '4px', overflowX: 'auto' }}>
            {diffLines.map((line, idx) => {
                let bg = 'transparent';
                let color = 'inherit';
                let prefix = '  ';

                if (line.tag === 'Insert') {
                    bg = 'rgba(16, 185, 129, 0.1)';
                    color = 'var(--status-safe)';
                    prefix = '+ ';
                } else if (line.tag === 'Delete') {
                    bg = 'rgba(239, 68, 68, 0.1)';
                    color = 'var(--status-critical)';
                    prefix = '- ';
                }

                return (
                    <div key={idx} style={{ backgroundColor: bg, color: color, display: 'block' }}>
                        <span style={{ userSelect: 'none', opacity: 0.5 }}>{prefix}</span>
                        {line.content}
                    </div>
                );
            })}
        </div>
    );
};
