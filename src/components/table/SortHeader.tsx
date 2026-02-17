import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { SortConfig } from '../../types/table';

interface SortHeaderProps {
  columnKey: string;
  label: string;
  sortable?: boolean;
  currentSort: SortConfig<any> | null;
  onSort: (key: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Sortable table header component with visual indicators
 */
const SortHeader: React.FC<SortHeaderProps> = ({
  columnKey,
  label,
  sortable = true,
  currentSort,
  onSort,
  className = '',
  style = {}
}) => {
  const isActive = currentSort?.key === columnKey;
  const direction = isActive ? currentSort.direction : null;

  const handleClick = () => {
    if (sortable) {
      onSort(columnKey);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (sortable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onSort(columnKey);
    }
  };

  const renderSortIndicator = () => {
    if (!sortable) return null;

    if (!isActive) {
      return (
        <ChevronsUpDown 
          size={12} 
          className="sort-indicator"
          style={{ opacity: 0.3 }}
        />
      );
    }

    return direction === 'asc' 
      ? <ChevronUp size={12} className="sort-indicator active" />
      : <ChevronDown size={12} className="sort-indicator active" />;
  };

  const getAriaSort = (): 'ascending' | 'descending' | 'none' | undefined => {
    if (!isActive) return 'none';
    return direction === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <th
      className={`sort-header ${sortable ? 'sortable' : ''} ${className}`.trim()}
      style={{
        cursor: sortable ? 'pointer' : 'default',
        userSelect: 'none',
        ...style
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={sortable ? 0 : -1}
      role="columnheader"
      aria-sort={getAriaSort()}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span>{label}</span>
        {renderSortIndicator()}
      </div>
    </th>
  );
};

export default SortHeader;
