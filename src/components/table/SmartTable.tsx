import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FixedSizeList } from 'react-window';
import { 
  ChevronUp, 
  ChevronDown, 
  Search, 
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
  emptyMessage: _emptyMessage = 'No data available',
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
  const [visibleColumnIds, setVisibleColumnIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('smart-table-cols');
    return saved ? new Set(JSON.parse(saved)) : new Set(columns.map(c => c.id));
  });
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  
  const resizingRef = useRef<{ columnId: string; startX: number; startWidth: number } | null>(null);
  const selectionRef = useRef<{ startIdx: number; isDragging: boolean } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tableHeight, setTableHeight] = useState(0);

  // Constants
  const rowHeight = isCompact ? 32 : 48;
  const activeSort = externalSortConfig || internalSortConfig;
  const itemCount = data.length;
  // estimatedTotalHeight used indirectly via itemCount and rowHeight

  // Performance optimization: Only render visible rows
  const visibleRowCount = Math.ceil(tableHeight / rowHeight) + 2; // +2 for buffer
  const startIndex = Math.max(0, Math.floor(scrollRef.current?.scrollTop || 0) / rowHeight);
  const endIndex = Math.min(itemCount, startIndex + visibleRowCount);

  // Memoize filtered data with stable reference
  const stableFilteredData = useMemo(() => data.slice(startIndex, endIndex), [data, startIndex, endIndex]);

  // Performance monitoring
  useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      if (renderTime > 100) {
        console.warn('SmartTable render time:', renderTime.toFixed(2), 'ms');
      }
    };
  }, [data, columns, searchTerm, activeSort, onSort]);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('smart-table-cols', JSON.stringify(Array.from(visibleColumnIds)));
  }, [visibleColumnIds]);

  useEffect(() => {
    localStorage.setItem('smart-table-widths', JSON.stringify(columnWidths));
  }, [columnWidths]);

  useEffect(() => {
    const savedWidths = localStorage.getItem('smart-table-widths');
    if (savedWidths) {
      try {
        setColumnWidths(JSON.parse(savedWidths));
      } catch (e) {
        console.error('Failed to load column widths', e);
      }
    }
  }, []);

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

    const sampleSize = Math.min(data.length, 50);
    for (let i = 0; i < sampleSize; i++) {
        const item = data[i];
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

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = stableFilteredData[index];
    const isSelected = (selectedIds?.has((item as any)[idField]) || selectedId === (item as any)[idField]);

    const handleMouseDown = (e: React.MouseEvent) => {
      if (e.button !== 0) return; // Only left click
      
      if (onRowMouseDown) {
        onRowMouseDown(item, e);
      }
      
      // Start drag selection if not doing a specific modifier click already handled by parent
      const isModifier = e.shiftKey || e.ctrlKey || e.metaKey;
      if (!isModifier) {
        selectionRef.current = { startIdx: index, isDragging: true };
      }
    };

    const handleMouseEnter = () => {
      if (selectionRef.current?.isDragging && onRowMouseDown) {
        // Sweep selection from startIdx to current index
        // We simulate a Shift+Click on the current item to trigger range selection in the parent
        const fakeEvent = {
          button: 0,
          shiftKey: true,
          ctrlKey: false,
          metaKey: false,
          preventDefault: () => {},
          stopPropagation: () => {},
          target: {} 
        } as unknown as React.MouseEvent;

        onRowMouseDown(item, fakeEvent);
      }
    };

    return (
      <div 
        style={{ 
          ...style, 
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          cursor: (onRowClick || onRowMouseDown) ? 'pointer' : 'default',
          transition: 'background 0.1s ease',
          boxSizing: 'border-box',
          userSelect: 'none'
        }}
        className={`table-row-hover ${isSelected ? 'table-row-selected' : ''}`}
        onClick={() => {
          // If we weren't just dragging, handle normal click
          if (!selectionRef.current?.isDragging) {
            onRowClick?.(item);
          }
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
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
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }} >
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
        <div style={{ display: 'flex', gap: '4px' }} >
            <button 
                onClick={() => setIsCompact(!isCompact)}
                className="title-btn"
                title={isCompact ? "Switch to comfortable view" : "Switch to compact view"}
                style={{ 
                   padding: ' 8px', borderRadius: '6px', background: isCompact ? 'rgba(var(--accent-rgb), 0.1)' : 'transparent',
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
                   padding: ' 8px', borderRadius: '6px', background: !isSmartWrap ? 'rgba(var(--accent-rgb), 0.1)' : 'transparent',
                   border: `1px solid ${!isSmartWrap ? 'var(--accent-color)' : 'var(--border-color)'}`,
                   color: !isSmartWrap ? 'var(--accent-color)' : 'var(--text-secondary)'
                }}
            >
                {isSmartWrap ? <AlignLeft size={14} /> : <StretchHorizontal size={14} />}
            </button>
            <div style={{ position: 'relative' }} >
                <button 
                    className="title-btn"
                    title="Configure Columns"
                    style={{ padding: ' 8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', overflow: 'hidden' }} >
                {idx === 0 && onSelectAll && (
                  <input 
                    type="checkbox" 
                    checked={allSelected} 
                    onChange={(e) => onSelectAll(e.target.checked)}
                  />
                )}
                {col.label}
                {activeSort?.columnId === col.id ? (
                  activeSort.direction === 'asc' ? <ChevronUp size={14} strokeWidth={3} /> : <ChevronDown size={14} strokeWidth={3} />
                ) : null}
              </div>
              {/* Resize handle */}
              <div 
                onMouseDown={(e) => startResizing(col.id, e)}
                onDoubleClick={() => autoResizeColumn(col.id)}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: '4px',
                  cursor: 'col-resize',
                  background: 'transparent'
                }}
                title="Drag to resize, double-click to auto-fit"
              />
            </div>
          ))}
        </div>

        {/* Virtualized List */}
        <FixedSizeList
          height={tableHeight}
          itemCount={stableFilteredData.length}
          itemSize={rowHeight}
          width='100%'
          itemData={stableFilteredData}
        >
          {Row}
        </FixedSizeList>
      </div>
    </div>
  );
}

export default SmartTable;