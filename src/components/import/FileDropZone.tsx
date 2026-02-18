import React from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { downloadDir } from '@tauri-apps/api/path';
import { Upload, FileCode } from 'lucide-react';
import { toast } from 'sonner';

interface FileDropZoneProps {
  onFilesSelected: (files: FileList | File[] | string[]) => void;
  isProcessing: boolean;
  dragActive: boolean;
  onDrag: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  onFilesSelected,
  isProcessing,
  dragActive,
  onDrag,
  onDrop,
}) => {
  const handleZoneClick = async () => {
    try {
      const defaultPath = await downloadDir();
      const selected = await open({
        multiple: true,
        defaultPath,
        filters: [
          {
            name: 'Data Files',
            extensions: ['csv', 'xlsx', 'xls']
          },
          {
            name: 'All Supported',
            extensions: ['json', 'txt', 'yaml', 'yml', 'csv', 'xlsx', 'xls']
          }
        ]
      });

      if (selected) {
        const files = Array.isArray(selected) ? selected : [selected];
        onFilesSelected(files);
      }
    } catch (err) {
      console.error('Failed to open native dialog:', err);
      toast.error('Failed to open file selector');
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        onDragEnter={onDrag}
        onDragLeave={onDrag}
        onDragOver={onDrag}
        onDrop={onDrop}
        onClick={handleZoneClick}

        style={{
          flex: 1, border: `2px dashed ${dragActive ? 'var(--accent-color)' : 'var(--border-color)'}`,
          borderRadius: '16px', background: dragActive ? 'rgba(var(--accent-rgb), 0.05)' : 'var(--bg-primary)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '20px', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative', overflow: 'hidden'
        }}
      >
        <div style={{
          width: '64px', height: '64px', borderRadius: '18px',
          background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'var(--accent-color)',
          boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
          transform: dragActive ? 'scale(1.1)' : 'scale(1)'
        }}>
          {isProcessing ? (
            <div className="animate-spin" style={{ width: '28px', height: '28px', border: '3px solid transparent', borderTopColor: 'currentColor', borderRadius: '50%' }} />
          ) : (
            <Upload size={32} />
          )}
        </div>

        <div style={{ textAlign: 'center', padding: '0 24px' }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: '16px', color: 'var(--text-primary)' }}>
            {dragActive ? 'Drop files now' : 'Select or drop files'}
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: 'var(--text-tertiary)', maxWidth: '200px', lineHeight: '1.4' }}>
            Supports JSON, CSV, YAML, XLSX or TXT logs
          </p>
        </div>

        {isProcessing && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: '4px', background: 'var(--border-dim)'
          }}>
            <div style={{ 
              height: '100%', width: '40%', background: 'var(--accent-color)',
              boxShadow: '0 0 10px var(--accent-color)',
              animation: 'loading-slide 2s infinite linear'
            }} />
          </div>
        )}
      </div>

      <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', background: 'rgba(var(--accent-rgb), 0.05)', display: 'flex', alignItems: 'start', gap: '8px' }}>
        <FileCode size={16} className="text-accent" style={{ marginTop: '2px' }} />
        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          <strong>Pro Tip:</strong> You can drop Burp Suite proxy logs or OpenAPI specifications 
          directly to automatically stage all endpoints for scanning.
        </p>
      </div>
    </div>
  );
};

