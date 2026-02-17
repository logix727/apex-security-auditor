import React from 'react';
import { X, Search, Filter } from 'lucide-react';
import { FilterValue, FilterOption } from '../../types/table';

interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'text' | 'range';
  value: FilterValue;
  options?: FilterOption[];
  placeholder?: string;
}

interface FilterBarProps {
  filters: FilterConfig[];
  onFilterChange: (key: string, value: FilterValue) => void;
  onReset: () => void;
  activeCount?: number;
  className?: string;
}

/**
 * Reusable filter bar component for tables
 */
const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  onReset,
  activeCount = 0,
  className = ''
}) => {
  const renderFilterControl = (filter: FilterConfig) => {
    switch (filter.type) {
      case 'text':
        return (
          <div key={filter.key} className="filter-group">
            <label className="filter-label">{filter.label}:</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={12} style={{ position: 'absolute', left: '6px', opacity: 0.5 }} />
              <input
                type="text"
                value={filter.value as string || ''}
                onChange={(e) => onFilterChange(filter.key, e.target.value)}
                placeholder={filter.placeholder || 'Search...'}
                className="filter-input"
                style={{ paddingLeft: '22px' }}
              />
            </div>
          </div>
        );

      case 'select':
        return (
          <div key={filter.key} className="filter-group">
            <label className="filter-label" htmlFor={`filter-${filter.key}`}>{filter.label}:</label>
            <select
              id={`filter-${filter.key}`}
              value={filter.value as string || 'All'}
              onChange={(e) => onFilterChange(filter.key, e.target.value)}
              className="filter-select"
              aria-label={filter.label}
            >
              <option value="All">All</option>
              {filter.options?.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'range':
        const rangeValue = filter.value as [number, number] || [0, 100];
        return (
          <div key={filter.key} className="filter-group">
            <label className="filter-label" htmlFor={`filter-${filter.key}`}>{filter.label}: {rangeValue[0]} - {rangeValue[1]}</label>
            <input
              id={`filter-${filter.key}`}
              type="range"
              min={0}
              max={100}
              value={rangeValue[0]}
              onChange={(e) => onFilterChange(filter.key, [parseInt(e.target.value), rangeValue[1]])}
              className="filter-range"
              aria-label={`${filter.label} range`}
              title={`${filter.label}: ${rangeValue[0]} - ${rangeValue[1]}`}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`filter-bar ${className}`.trim()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '8px' }}>
        <Filter size={12} style={{ opacity: 0.6 }} />
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Filters:</span>
      </div>
      
      {filters.map(renderFilterControl)}
      
      {activeCount > 0 && (
        <button
          onClick={onReset}
          className="reset-filters-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: 'auto'
          }}
        >
          <X size={12} />
          Reset ({activeCount})
        </button>
      )}
    </div>
  );
};

export default FilterBar;
