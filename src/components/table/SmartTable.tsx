import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FixedSizeList } from 'react-window';
import { 
  ChevronUp, 
  ChevronDown, 
  Search, 
  ArrowUpDown,
  AlignLeft, 
  StretchHorizontal,
  Rows,
  Filter
} from 'lucide-react';

export interface Column<T extends object> {
  id: string;
  label: React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  minWidth?: string;
  render?: (item: T) => React.ReactNode;
  getValue?: (item: T) => any;
}

interface SmartTableProps<T extends object> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void; 
  onRowMouseDown?: (item: T, e: React.MouseEvent) => void;
  onRowContextMenu?: (item: T, e: React.MouseEvent) => void;
  selectedId?: number | string | null;
  selectedIds?: Set<number | string>;
  idField?: keyof T;
  searchPlaceholder?: string;
  emptyMessage?: string;
  initialSort?: { columnId: string; direction: 'asc' | 'desc' };
  onSelectAll?: (selected: boolean) => void;
  allSelected?: boolean;
  onSort?: (columnId: string) => void;
  sortConfig?: { columnId: string; direction: 'asc' | 'desc' } | null;
  headerStyle?: React.CSSProperties;
}

export function SmartTable<T extends object>({
  data,
  columns,
  onRowClick,
  onRowMouseDown,
  onRowContextMenu,
  selectedId,
  selectedIds,
  idField = 'id' as keyof T,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No data available',
  initialSort,
  onSelectAll,
  allSelected,
  onSort,
  sortConfig: externalSortConfig,
  headerStyle
}: SmartTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [internalSortConfig, setInternalSortConfig] = useState<{ columnId: string; direction: 'asc' | 'desc' } | null>(initialSort || null);
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: string }>(
    Object.fromEntries(columns.map(c => [c.id, c.width || 'auto']))
  );
  const [isSmartWrap, setIsSmartWrap] = useState(true);
  const [isCompact, setIsCompact] = useState(false);
  const [visibleColumnIds, setVisibleColumnIds] = useState<Set<string>>(new Set(columns.map(c => c.id)));
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  
  const resizingRef = useRef<{ columnId: string; startX: number; startWidth: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tableHeight, setTableHeight] = useState(0);

  // Constants
  const rowHeight = isCompact ? 32 : 48;
  const activeSort = externalSortConfig || internalSortConfig;

  useEffect(() => {
    const handleResize = () => setTableHeight(scrollRef.current?.clientHeight || 0);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSort = (columnId: string) => {
    const col = columns.find(c => c.id === columnId);
    if (col && col.sortable === false) return;

    if (onSort) {
      onSort(columnId);
    } else {
      setInternalSortConfig(prev => {
        if (prev?.columnId === columnId) {
          return { columnId, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
        }
        return { columnId, direction: 'asc' };
      });
    }
  };

  const startResizing = (columnId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Find the header element to get current width
    const headerEl = (e.target as HTMLElement).parentElement;
    if (!headerEl) return;

    resizingRef.current = {
      columnId,
      startX: e.pageX,
      startWidth: headerEl.offsetWidth
    };

    document.addEventListener('mousemove', handleResizing);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
  };

  const handleResizing = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const delta = e.pageX - resizingRef.current.startX;
    const newWidth = Math.max(50, resizingRef.current.startWidth + delta);
    setColumnWidths(prev => ({
      ...prev,
      [resizingRef.current!.columnId]: `${newWidth}px`
    }));
  };

  const stopResizing = () => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleResizing);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
  };

  const autoResizeColumn = (columnId: string) => {
    const col = columns.find(c => c.id === columnId);
    if (!col) return;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    context.font = '12px Inter, sans-serif';

    let maxWidth = context.measureText(String(col.label || '')).width + 32;

    const sampleSize = Math.min(filteredData.length, 50);
    for (let i = 0; i < sampleSize; i++) {
        const item = filteredData[i];
        let text = '';
        if (col.getValue) {
            text = String(col.getValue(item) || '');
        } else {
            text = String((item as any)[col.id] || '');
        }
        
        if (text) {
            const width = context.measureText(text).width + 32;
            if (width > maxWidth) maxWidth = width;
        }
    }
    
    const finalWidth = Math.min(Math.max(maxWidth, 50), 500);
    
    setColumnWidths(prev => ({
      ...prev,
      [columnId]: `${finalWidth}px`
    }));
  };

  const [orderedColumns, setOrderedColumns] = useState(columns);
  
  useEffect(() => {
      setOrderedColumns(columns);
  }, [columns]);

  const handleColumnDragStart = (id: string) => {
      setDraggedColumn(id);
  };

  const handleColumnDrop = (targetId: string) => {
      if (!draggedColumn || draggedColumn === targetId) return;
      const newCols = [...orderedColumns];
      const dragIdx = newCols.findIndex(c => c.id === draggedColumn);
      const dropIdx = newCols.findIndex(c => c.id === targetId);
      const [removed] = newCols.splice(dragIdx, 1);
      newCols.splice(dropIdx, 0, removed);
      setOrderedColumns(newCols);
      setDraggedColumn(null);
  };

  const filteredData = useMemo(() => {
    let result = [...data];

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(item => {
        return orderedColumns.some(col => {
          const val = col.getValue ? col.getValue(item) : (item as any)[col.id];
          return String(val || '').toLowerCase().includes(lowerSearch);
        });
      });
    }

    if (activeSort && !onSort) {
      result.sort((a, b) => {
        const col = orderedColumns.find(c => c.id === activeSort.columnId);
        const aVal = col?.getValue ? col.getValue(a) : (a as any)[activeSort.columnId];
        const bVal = col?.getValue ? col.getValue(b) : (b as any)[activeSort.columnId];

        if (aVal === bVal) return 0;
        const multiplier = activeSort.direction === 'asc' ? 1 : -1;
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return (aVal - bVal) * multiplier;
        }
        return String(aVal || '').localeCompare(String(bVal || '')) * multiplier;
      });
    }

    return result;
  }, [data, searchTerm, activeSort, orderedColumns, onSort]);

  // Sync scroll for header and body
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<any>(null);

  const onScroll = ({ scrollOffset }: { scrollOffset: number }) => {
    if (headerRef.current) {
      headerRef.current.scrollLeft = scrollOffset;
    }
  };

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = filteredData[index];
    const isSelected = (selectedIds?.has((item as any)[idField]) || selectedId === (item as any)[idField]);

    return (
      <div 
        style={{ 
          ...style, 
          display: 'flex',
          background: isSelected ? 'rgba(var(--accent-rgb), 0.1)' : 'transparent',
          borderBottom: '1px solid var(--border-color)',
          cursor: (onRowClick || onRowMouseDown) ? 'pointer' : 'default',
          transition: 'background 0.1s ease',
          boxSizing: 'border-box'
        }}
        className="table-row-hover"
        onClick={() => onRowClick?.(item)}
        onMouseDown={onRowMouseDown ? (e) => onRowMouseDown(item, e) : undefined}
        onContextMenu={(e) => onRowContextMenu?.(item, e)}
      >
        {orderedColumns.filter(c => visibleColumnIds.has(c.id)).map(col => (
          <div 
            key={col.id}
            style={{ 
              width: columnWidths[col.id] === 'auto' ? '0px' : columnWidths[col.id],
              flex: columnWidths[col.id] === 'auto' ? 1 : 'none',
              padding: isCompact ? '0 8px' : '0 16px', 
              fontSize: '12px',
              color: 'var(--text-primary)',
              whiteSpace: isSmartWrap ? 'normal' : 'nowrap',
              overflow: 'hidden',
              textOverflow: isSmartWrap ? 'clip' : 'ellipsis',
              display: 'flex',
              alignItems: 'center',
              boxSizing: 'border-box'
            }}
          >
            {col.render ? col.render(item) : String((item as any)[col.id] || '')}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="smart-table-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="smart-table-toolbar" style={{ 
        padding: '12px 16px', borderBottom: '1px solid var(--border-color)', 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--bg-secondary)', gap: '16px'
      }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
          <input 
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ 
              width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
              borderRadius: '6px', padding: '8px 12px 8px 34px', fontSize: '12px', color: 'var(--text-primary)'
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
            <button 
                onClick={() => setIsCompact(!isCompact)}
                className="title-btn"
                title={isCompact ? "Switch to comfortable view" : "Switch to compact view"}
                style={{ 
                   padding: '8px', borderRadius: '6px', background: isCompact ? 'rgba(var(--accent-rgb), 0.1)' : 'transparent',
                   border: `1px solid ${isCompact ? 'var(--accent-color)' : 'var(--border-color)'}`,
                   color: isCompact ? 'var(--accent-color)' : 'var(--text-secondary)'
                }}
            >
                <Rows size={14} />
            </button>
            <button 
                onClick={() => setIsSmartWrap(!isSmartWrap)}
                className="title-btn"
                title={isSmartWrap ? "Single line view" : "Smart wrap view"}
                style={{ 
                   padding: '8px', borderRadius: '6px', background: !isSmartWrap ? 'rgba(var(--accent-rgb), 0.1)' : 'transparent',
                   border: `1px solid ${!isSmartWrap ? 'var(--accent-color)' : 'var(--border-color)'}`,
                   color: !isSmartWrap ? 'var(--accent-color)' : 'var(--text-secondary)'
                }}
            >
                {isSmartWrap ? <AlignLeft size={14} /> : <StretchHorizontal size={14} />}
            </button>
            <div style={{ position: 'relative' }}>
                <button 
                    className="title-btn"
                    title="Configure Columns"
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}
                    onClick={(e) => {
                        const el = e.currentTarget.nextElementSibling as HTMLElement;
                        if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
                    }}
                >
                    <Filter size={14} />
                </button>
                <div style={{
                    display: 'none',
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '12px',
                    zIndex: 100,
                    width: '180px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    marginTop: '8px'
                }}>
                        <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Visible Columns</div>
                        {orderedColumns.map(col => (
                        <label key={col.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', cursor: 'pointer', fontSize: '12px' }}>
                            <input 
                                type="checkbox" 
                                checked={visibleColumnIds.has(col.id)}
                                onChange={() => {
                                    const next = new Set(visibleColumnIds);
                                    if (next.has(col.id)) {
                                        if (next.size > 1) next.delete(col.id);
                                    } else {
                                        next.add(col.id);
                                    }
                                    setVisibleColumnIds(next);
                                }}
                            />
                            {col.label}
                        </label>
                        ))}
                </div>
            </div>
        </div>
      </div>

      {/* Virtualized List Container */}
      <div 
        ref={scrollRef}
        className="smart-table" 
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
      >
        {/* Sticky Header */}
        <div 
          ref={headerRef}
          style={{ 
            overflow: 'hidden', 
            background: 'var(--bg-sidebar)', 
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            ...headerStyle
          }}
        >
          {orderedColumns.filter(c => visibleColumnIds.has(c.id)).map((col, idx) => (
            <div 
              key={col.id}
              draggable
              onDragStart={() => handleColumnDragStart(col.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleColumnDrop(col.id)}
              style={{ 
                width: columnWidths[col.id] === 'auto' ? '0px' : columnWidths[col.id],
                flex: columnWidths[col.id] === 'auto' ? 1 : 'none',
                minWidth: col.minWidth || '50px',
                padding: '10px 16px', 
                textAlign: 'left',
                fontSize: '11px',
                fontWeight: 'bold',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                position: 'relative',
                cursor: col.sortable !== false ? 'pointer' : 'default',
                userSelect: 'none',
                opacity: draggedColumn === col.id ? 0.4 : 1,
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                boxSizing: 'border-box'
              }}
              onClick={() => col.sortable !== false && handleSort(col.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', overflow: 'hidden' }}>
                {idx === 0 && onSelectAll && (
                  <input 
                    type="checkbox" 
                    checked={allSelected} 
                    onChange={(e) => onSelectAll(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ cursor: 'pointer', marginRight: '4px' }}
                  />
                )}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.label}</span>
                {col.sortable !== false && (
                  <span style={{ 
                      opacity: activeSort?.columnId === col.id ? 1 : 0.4,
                      color: activeSort?.columnId === col.id ? 'var(--accent-color)' : 'inherit',
                      display: 'flex',
                      flexShrink: 0
                  }}>
                    {activeSort?.columnId === col.id ? (
                      activeSort.direction === 'asc' ? <ChevronUp size={14} strokeWidth={3} /> : <ChevronDown size={14} strokeWidth={3} />
                    ) : <ArrowUpDown size={12} />}
                  </span>
                )}
              </div>
              <div 
                onMouseDown={e => {
                  e.stopPropagation();
                  startResizing(col.id, e);
                }}
                onDoubleClick={() => autoResizeColumn(col.id)}
                style={{ 
                  position: 'absolute', right: 0, top: 0, bottom: 0, width: '4px', 
                  cursor: 'col-resize', background: 'transparent', zIndex: 40
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-color)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              />
            </div>
          ))}
        </div>

        {/* Body (Virtualized) */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {filteredData.length > 0 ? (
            <FixedSizeList
              ref={bodyRef}
              height={tableHeight - (isCompact ? 32 : 36)} // Approximate header height adjustment
              itemCount={filteredData.length}
              itemSize={rowHeight}
              width="100%"
              onScroll={onScroll}
              className="virtualized-list"
            >
              {Row}
            </FixedSizeList>
          ) : (
            <div style={{ padding: '60px', textAlign: 'center', opacity: 0.3, color: 'var(--text-tertiary)' }}>
              {emptyMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
