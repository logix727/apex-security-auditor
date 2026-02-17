import React from 'react';
import { DiffEditor } from '@monaco-editor/react';

interface ResponseDiffProps {
    original: string;
    modified: string;
    language?: string;
    height?: string;
}

export const ResponseDiff: React.FC<ResponseDiffProps> = ({
    original,
    modified,
    language = 'json',
    height = '100%'
}) => {
    return (
        <div style={{ height, border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
            <DiffEditor
                height="100%"
                language={language}
                original={original}
                modified={modified}
                options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 12,
                    fontFamily: '"JetBrains Mono", monospace',
                    renderSideBySide: true,
                    theme: 'vs-dark' // We might need to define a custom theme to match app vars, but vs-dark is safe
                }}
                theme="vs-dark"
            />
        </div>
    );
};
