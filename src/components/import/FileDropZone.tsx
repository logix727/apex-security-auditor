import React, { useRef } from 'react';
import { Upload, FileCode, Terminal } from 'lucide-react';

interface FileDropZoneProps {
  onFilesSelected: (files: FileList | File[]) => void;
  onTextImport: (text: string) => void;
  isProcessing: boolean;
  dragActive: boolean;
  onDrag: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  importText: string;
  setImportText: (text: string) => void;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  onFilesSelected,
  onTextImport,
  isProcessing,
  dragActive,
  onDrag,
  onDrop,
  importText,
  setImportText
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div
        onDragEnter={onDrag}
        onDragLeave={onDrag}
        onDragOver={onDrag}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          flex: 1, border: `2px dashed ${dragActive ? 'var(--accent-color)' : 'var(--border-color)'}`,
          borderRadius: '12px', background: dragActive ? 'rgba(var(--accent-rgb), 0.05)' : 'var(--bg-primary)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '12px', cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          minHeight: '160px', position: 'relative', overflow: 'hidden'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => e.target.files && onFilesSelected(e.target.files)}
          style={{ display: 'none' }}
        />

        <div style={{
          width: '48px', height: '48px', borderRadius: '12px',
          background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'var(--accent-color)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          {isProcessing ? (
            <div className="animate-spin" style={{ width: '24px', height: '24px', border: '2px solid transparent', borderTopColor: 'currentColor', borderRadius: '50%' }} />
          ) : (
            <Upload size={24} />
          )}
        </div>

        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '14px' }}>
            {dragActive ? 'Drop files here' : 'Drop files or click to upload'}
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-tertiary)' }}>
            Supports JSON, CSV, YAML, XLSX or TXT
          </p>
        </div>

        {isProcessing && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: '3px', background: 'var(--border-dim)'
          }}>
            <div style={{ 
              height: '100%', width: '30%', background: 'linear-gradient(90deg, transparent, var(--accent-color), transparent)',
              animation: 'loading-slide 1.5s infinite linear'
            }} />
          </div>
        )}
      </div>

      <div style={{ 
        display: 'flex', flexDirection: 'column', gap: '8px', 
        padding: '16px', borderRadius: '12px', background: 'var(--bg-secondary)',
        border: '1px solid var(--border-dim)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Terminal size={14} className="text-accent" />
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>MANUAL INPUT</span>
        </div>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="Paste URLs, JSON arrays, or raw HTTP requests..."
          style={{
            width: '100%', height: '80px', background: 'var(--bg-primary)',
            color: 'var(--text-primary)', border: '1px solid var(--border-color)',
            borderRadius: '6px', padding: '10px', fontSize: '12px', resize: 'none',
            fontFamily: 'monospace'
          }}
        />
        <button
          onClick={() => onTextImport(importText)}
          disabled={!importText.trim() || isProcessing}
          style={{
            width: '100%', padding: '8px', borderRadius: '6px',
            background: 'var(--accent-color)', color: 'white', fontWeight: 700,
            fontSize: '11px', border: 'none', cursor: 'pointer',
            opacity: (!importText.trim() || isProcessing) ? 0.5 : 1
          }}
        >
          Process Staged Text
        </button>
      </div>
    </div>
  );
};
