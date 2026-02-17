import React, { useState, useRef, useEffect } from 'react';
import { Filter } from 'lucide-react';

interface AssetsFilterMenuProps {
  filterSource: string;
  setFilterSource: (src: string) => void;
  filterMethod: string;
  setFilterMethod: (method: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  filterRisk: number;
  setFilterRisk: (risk: number) => void;
  onResetFilters: () => void;
}

export const AssetsFilterMenu: React.FC<AssetsFilterMenuProps> = ({
  filterSource,
  setFilterSource,
  filterMethod,
  setFilterMethod,
  filterStatus,
  setFilterStatus,
  filterRisk,
  setFilterRisk,
  onResetFilters
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeFiltersCount = [
    filterSource !== 'All',
    filterMethod !== 'All',
    filterStatus !== 'All',
    filterRisk > 0
  ].filter(Boolean).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          isOpen || activeFiltersCount > 0
            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/50'
            : 'bg-transparent text-gray-400 border border-gray-700 hover:text-white hover:border-gray-600'
        }`}
        style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', fontSize: '12px', borderRadius: '6px',
            background: (isOpen || activeFiltersCount > 0) ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            border: `1px solid ${(isOpen || activeFiltersCount > 0) ? 'var(--accent-color)' : 'var(--border-color)'}`,
            color: (isOpen || activeFiltersCount > 0) ? 'var(--accent-color)' : 'var(--text-secondary)',
            cursor: 'pointer'
        }}
        title="Filter Assets"
      >
        <Filter size={14} />
        <span>Filters</span>
        {activeFiltersCount > 0 && (
          <span style={{
              background: 'var(--accent-color)', color: 'white', 
              borderRadius: '99px', fontSize: '10px', padding: '0 5px', minWidth: '16px', textAlign: 'center'
          }}>
            {activeFiltersCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div 
            style={{
                position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                width: '280px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                zIndex: 50,
                padding: '16px',
                display: 'flex', flexDirection: 'column', gap: '16px'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'white' }}>Filter Assets</span>
                {activeFiltersCount > 0 && (
                    <button 
                        onClick={() => {
                            onResetFilters();
                            // Keep open? Or close? Let's keep open for adjust.
                        }}
                        style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                        Reset All
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Method</label>
                <select 
                   value={filterMethod} 
                   onChange={e => setFilterMethod(e.target.value)}
                   style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px', padding: '6px', fontSize: '12px' }}
                >
                   <option value="All">All Methods</option>
                   <option value="GET">GET</option>
                   <option value="POST">POST</option>
                   <option value="PUT">PUT</option>
                   <option value="DELETE">DELETE</option>
                   <option value="PATCH">PATCH</option>
                </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Source</label>
                <select 
                   value={filterSource} 
                   onChange={e => setFilterSource(e.target.value)}
                   style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px', padding: '6px', fontSize: '12px' }}
                >
                    <option value="All">All Sources</option>
                    <option value="User">👤 User Added</option>
                    <option value="Import">📥 Imported</option>
                    <option value="Recursive">🔄 Recursive Scan</option>
                </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Status Code</label>
                <select 
                   value={filterStatus} 
                   onChange={e => setFilterStatus(e.target.value)}
                   style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px', padding: '6px', fontSize: '12px' }}
                >
                   <option value="All">All Statuses</option>
                   <option value="2xx">Success (2xx)</option>
                   <option value="3xx">Redirect (3xx)</option>
                   <option value="4xx">Client Error (4xx)</option>
                   <option value="5xx">Server Error (5xx)</option>
                   <option value="0">Unreachable / Pending</option>
                </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Min Risk Score</label>
                    <span style={{ fontSize: '11px', color: filterRisk > 0 ? 'var(--status-warning)' : 'var(--text-secondary)' }}>
                        {filterRisk}
                    </span>
                </div>
                <input 
                   type="range" 
                   min="0" max="100" step="10"
                   value={filterRisk} 
                   onChange={e => setFilterRisk(parseInt(e.target.value))}
                   style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-secondary)', marginTop: '-4px' }}>
                    <span>0</span>
                    <span>100</span>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
