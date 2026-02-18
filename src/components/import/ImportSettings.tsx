import React from 'react';
import { Database, Terminal, Globe, Shield } from 'lucide-react';
import { ImportOptions } from '../../types';

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

  const OptionButton = ({ 
    active, 
    onClick, 
    icon: Icon, 
    label, 
    tooltip 
  }: { 
    active: boolean, 
    onClick: () => void, 
    icon: any, 
    label: string,
    tooltip: string
  }) => (
    <button
      onClick={onClick}
      title={tooltip}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '8px',
        border: `1px solid ${active ? 'var(--accent-color)' : 'var(--border-color)'}`,
        background: active ? 'rgba(var(--accent-rgb), 0.1)' : 'transparent',
        color: active ? 'var(--accent-color)' : 'var(--text-secondary)',
        fontSize: '11px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  );

  const Toggle = ({ 
    checked, 
    onChange, 
    label, 
    icon: Icon,
    color = 'var(--accent-color)'
  }: { 
    checked: boolean, 
    onChange: (val: boolean) => void, 
    label: string,
    icon: any,
    color?: string
  }) => (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      cursor: 'pointer',
      fontSize: '11px',
      fontWeight: 600,
      color: checked ? 'var(--text-primary)' : 'var(--text-tertiary)',
      transition: 'color 0.2s',
      userSelect: 'none'
    }}>
      <div 
        onClick={() => onChange(!checked)}
        style={{
          width: '32px',
          height: '18px',
          borderRadius: '9px',
          background: checked ? color : 'var(--border-color)',
          position: 'relative',
          transition: 'background 0.2s'
        }}
      >
        <div style={{
          position: 'absolute',
          top: '2px',
          left: checked ? '16px' : '2px',
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          background: 'white',
          transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }} />
      </div>
      <Icon size={14} style={{ opacity: checked ? 1 : 0.5 }} />
      <span>{label}</span>
    </label>
  );

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '24px',
      padding: '8px 16px',
      background: 'rgba(255,255,255,0.02)',
      borderRadius: '12px',
      border: '1px solid var(--border-color)'
    }}>
      {/* Target Destination */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Destination</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <OptionButton 
            active={options.destination === 'asset_manager'}
            onClick={() => updateOption('destination', 'asset_manager')}
            icon={Database}
            label="Asset Manager"
            tooltip="Store in permanent database"
          />
          <OptionButton 
            active={options.destination === 'workbench'}
            onClick={() => updateOption('destination', 'workbench')}
            icon={Terminal}
            label="Workbench"
            tooltip="Active scratchpad session"
          />
        </div>
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Toggle 
          checked={options.recursive}
          onChange={(v) => updateOption('recursive', v)}
          label="Recursive"
          icon={Globe}
        />
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '6px', 
          padding: '6px 12px', borderRadius: '8px', background: 'rgba(var(--accent-rgb), 0.05)',
          border: '1px solid rgba(var(--accent-rgb), 0.1)'
        }}>
          <Shield size={14} style={{ color: 'var(--accent-color)' }} />
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-color)' }}>Smart Validation Active</span>
        </div>
      </div>
    </div>
  );
};
