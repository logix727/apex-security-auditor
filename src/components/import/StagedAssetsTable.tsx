import React from 'react';
import { X, AlertCircle } from 'lucide-react';
import { SmartTable, Column } from '../table/SmartTable';
import { ImportAsset, ImportOptions } from '../../types';

interface StagedAssetsTableProps {
  assets: ImportAsset[];
  options: ImportOptions;
  onToggleSelection: (id: string) => void;
  onToggleRecursive: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleAll: (selected: boolean) => void;
}

export const StagedAssetsTable: React.FC<StagedAssetsTableProps> = ({
  assets,
  options,
  onToggleSelection,
  onToggleRecursive,
  onRemove,
  onToggleAll
}) => {
  const getStatusColor = (status?: string): string => {
    switch (status) {
      case 'valid': return 'var(--status-safe)';
      case 'invalid': return 'var(--status-critical)';
      case 'duplicate': return 'var(--status-warning)';
      default: return 'var(--text-secondary)';
    }
  };

  const stripContent = (content: string, maxLength: number = 60): string => {
    if (!content) return '';
    const stripped = content.replace(/\s+/g, ' ').trim();
    if (stripped.length <= maxLength) return stripped;
    return stripped.substring(0, maxLength) + '...';
  };

  const columns: Column<ImportAsset>[] = [
    {
      id: 'selected',
      label: (
        <input 
          type="checkbox" 
          onChange={(e) => onToggleAll(e.target.checked)}
          checked={assets.length > 0 && assets.every(a => a.selected)}
          style={{ cursor: 'pointer' }}
        />
      ),
      width: '40px',
      render: (item: ImportAsset) => (
        <input
          type="checkbox"
          checked={item.selected}
          onChange={() => onToggleSelection(item.id)}
          style={{ cursor: 'pointer' }}
        />
      )
    },
    {
      id: 'recursive',
      label: 'Rec',
      width: '40px',
      render: (item: ImportAsset) => (
        <input
          type="checkbox"
          checked={options.destination === 'asset_manager' ? true : item.recursive}
          onChange={() => onToggleRecursive(item.id)}
          disabled={options.destination === 'asset_manager'}
          title={options.destination === 'asset_manager' ? "Mandatory for Asset Manager" : "Recursive Discovery"}
          style={{ 
            cursor: options.destination === 'asset_manager' ? 'not-allowed' : 'pointer', 
            opacity: options.destination === 'asset_manager' ? 0.7 : 1 
          }}
        />
      )
    },
    {
      id: 'method',
      label: 'Method',
      sortable: true,
      width: '90px',
      render: (item: ImportAsset) => (
        <span style={{
          padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
          background: item.method === 'GET' ? 'rgba(16, 185, 129, 0.1)' :
            item.method === 'POST' ? 'rgba(59, 130, 246, 0.1)' :
              item.method === 'PUT' ? 'rgba(245, 158, 11, 0.1)' :
                item.method === 'DELETE' ? 'rgba(239, 68, 68, 0.1)' :
                  'rgba(107, 114, 128, 0.1)',
          color: item.method === 'GET' ? 'var(--status-safe)' :
            item.method === 'POST' ? 'var(--accent-color)' :
              item.method === 'PUT' ? 'var(--status-warning)' :
                item.method === 'DELETE' ? 'var(--status-critical)' :
                  'var(--text-secondary)'
        }}>
          {item.method}
        </span>
      )
    },
    {
      id: 'url',
      label: 'URL / Path',
      sortable: true,
      render: (item: ImportAsset) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span title={item.url} style={{
            color: item.status === 'duplicate' ? 'var(--text-secondary)' : 'var(--text-primary)',
            opacity: item.status === 'duplicate' ? 0.6 : 1,
            textDecoration: item.status === 'duplicate' ? 'line-through' : 'none',
            fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all'
          }}>
            {stripContent(item.url)}
          </span>
          {item.error && (
            <div style={{ fontSize: '9px', color: 'var(--status-critical)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertCircle size={10} /> {item.error}
            </div>
          )}
        </div>
      )
    },
    {
      id: 'status',
      label: 'Status',
      sortable: true,
      width: '80px',
      render: (item: ImportAsset) => (
        <span style={{
          fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
          background: `${getStatusColor(item.status)}15`,
          color: getStatusColor(item.status), fontWeight: 600
        }}>
          {item.status || 'pending'}
        </span>
      )
    },
    {
      id: 'actions',
      label: '',
      width: '40px',
      render: (item: ImportAsset) => (
        <button
          onClick={() => onRemove(item.id)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', opacity: 0.5 }}
        >
          <X size={14} />
        </button>
      )
    }
  ];

  if (assets.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', color: 'var(--text-tertiary)',
        border: '1px dashed var(--border-color)', borderRadius: '12px', background: 'var(--bg-secondary)'
      }}>
        <p style={{ margin: 0, fontSize: '13px' }}>No assets staged for import.</p>
        <p style={{ margin: '4px 0 0 0', fontSize: '11px', opacity: 0.6 }}>Add files or paste text on the left.</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Mobile-friendly overlay logic could go here, but for now, we use SmartTable */}
      <div style={{ flex: 1, borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        <SmartTable
          data={assets}
          columns={columns}
          headerStyle={{ background: 'var(--bg-sidebar)', padding: '12px' }}
        />
      </div>
    </div>
  );
};
