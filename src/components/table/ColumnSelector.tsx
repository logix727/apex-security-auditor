import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface ColumnOption {
  key: string;
  label: string;
}

interface ColumnSelectorProps {
  columns: ColumnOption[];
  visibleColumns: Set<string>;
  onToggle: (key: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  className?: string;
}

/**
 * Column visibility toggle component for tables
 */
const ColumnSelector: React.FC<ColumnSelectorProps> = ({
  columns,
  visibleColumns,
  onToggle,
  onShowAll,
  onHideAll,
  className = ''
}) => {
  return (
    <div className={`column-selector ${className}`.trim()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '8px' }}>
        <Eye size={12} style={{ opacity: 0.6 }} />
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Columns:</span>
      </div>
      
      {columns.map(col => {
        const isVisible = visibleColumns.has(col.key);
        return (
          <button
            key={col.key}
            onClick={() => onToggle(col.key)}
            className={`column-toggle ${isVisible ? 'active' : ''}`}
            title={isVisible ? `Hide ${col.label}` : `Show ${col.label}`}
            aria-pressed={isVisible}
          >
            {isVisible ? <Eye size={10} /> : <EyeOff size={10} />}
            <span style={{ marginLeft: '2px' }}>{col.label}</span>
          </button>
        );
      })}
      
      <div style={{ display: 'flex', gap: '4px', marginLeft: '8px', paddingLeft: '8px', borderLeft: '1px solid var(--border-color)' }}>
        <button
          onClick={onShowAll}
          className="column-toggle"
          title="Show all columns"
        >
          All
        </button>
        <button
          onClick={onHideAll}
          className="column-toggle"
          title="Hide all columns"
        >
          None
        </button>
      </div>
    </div>
  );
};

export default ColumnSelector;
