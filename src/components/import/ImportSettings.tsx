import React from 'react';
import { Database, Terminal, Settings } from 'lucide-react';
import { ImportOptions, ImportDestination } from '../../types';

interface ImportSettingsProps {
  options: ImportOptions;
  setOptions: (options: ImportOptions) => void;
}

export const ImportSettings: React.FC<ImportSettingsProps> = ({
  options,
  setOptions
}) => {
  const updateOption = <K extends keyof ImportOptions>(key: K, value: ImportOptions[K]) => {
    setOptions({ ...options, [key]: value });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <Settings size={16} className="text-accent" />
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Import Configuration</h3>
      </div>

      {/* Destination Selection */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
          Target Location
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            onClick={() => updateOption('destination', 'asset_manager')}
            style={{
              padding: '12px', borderRadius: '8px',
              border: `2px solid ${options.destination === 'asset_manager' ? 'var(--accent-color)' : 'var(--border-color)'}`,
              background: options.destination === 'asset_manager' ? 'rgba(var(--accent-rgb), 0.1)' : 'var(--bg-primary)',
              display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            <Database size={20} color={options.destination === 'asset_manager' ? 'var(--accent-color)' : 'var(--text-secondary)'} />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>Asset Manager</span>
            <span style={{ fontSize: '9px', opacity: 0.6 }}>Permanent Storage</span>
          </button>
          <button
            onClick={() => updateOption('destination', 'workbench')}
            style={{
              padding: '12px', borderRadius: '8px',
              border: `2px solid ${options.destination === 'workbench' ? 'var(--accent-color)' : 'var(--border-color)'}`,
              background: options.destination === 'workbench' ? 'rgba(var(--accent-rgb), 0.1)' : 'var(--bg-primary)',
              display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            <Terminal size={20} color={options.destination === 'workbench' ? 'var(--accent-color)' : 'var(--text-secondary)'} />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>Workbench</span>
            <span style={{ fontSize: '9px', opacity: 0.6 }}>Active Session</span>
          </button>
        </div>
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '8px' }}>
        <label style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          cursor: 'pointer', fontSize: '12px', userSelect: 'none'
        }}>
          <input
            type="checkbox"
            checked={options.skipDuplicates}
            onChange={(e) => updateOption('skipDuplicates', e.target.checked)}
          />
          <span>Automatically skip duplicates</span>
        </label>

        <label style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          cursor: 'pointer', fontSize: '12px', userSelect: 'none'
        }}>
          <input
            type="checkbox"
            checked={options.validateUrls}
            onChange={(e) => updateOption('validateUrls', e.target.checked)}
          />
          <span>Validate URLs before import</span>
        </label>

        <label style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          cursor: 'pointer', fontSize: '12px', userSelect: 'none',
          opacity: options.destination === 'asset_manager' ? 0.6 : 1
        }}>
          <input
            type="checkbox"
            checked={options.destination === 'asset_manager' || options.recursive}
            disabled={options.destination === 'asset_manager'}
            onChange={(e) => updateOption('recursive', e.target.checked)}
          />
          <span>Enable recursive discovery</span>
        </label>
      </div>

      {/* Advanced Settings */}
      <div style={{ 
        marginTop: '8px', padding: '12px', background: 'var(--bg-secondary)', 
        borderRadius: '8px', border: '1px solid var(--border-color)' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-tertiary)' }}>RATE LIMITING</span>
          <span style={{ fontSize: '10px', color: 'var(--accent-color)' }}>{options.rateLimitMs}ms delay</span>
        </div>
        <input
          type="range"
          min="0"
          max="1000"
          step="50"
          value={options.rateLimitMs}
          onChange={(e) => updateOption('rateLimitMs', parseInt(e.target.value))}
          style={{ width: '100%', cursor: 'pointer' }}
        />
      </div>
    </div>
  );
};
