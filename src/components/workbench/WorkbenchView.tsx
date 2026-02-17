import React from 'react';
import { Asset } from '../../types';
import { SmartTable, Column } from '../table/SmartTable';
import { FileCode, X, Target, Shield, Search, Filter } from 'lucide-react';
import { getDetectionBadges, getSourceIcon } from '../../utils/assetUtils';
import { EmptyState } from '../common/EmptyState';

interface WorkbenchViewProps {
    assets: Asset[];
    workbenchIds: Set<number>;
    setWorkbenchIds: React.Dispatch<React.SetStateAction<Set<number>>>;
    selectedIds: Set<number>;
    handleAssetMouseDown: (id: number, e: React.MouseEvent) => void;
    handleContextMenu: (id: number, e: React.MouseEvent) => void;
    workbenchSort: any;
    workbenchFilter: any;
    onPromoteToAssetManager: () => void;
    onExportMarkdown: () => void;
    onExportCsv: () => void;
    onSelectionChange: (ids: Set<number>) => void;
    smartFilter: 'All' | 'Critical' | 'PII' | 'Secrets' | 'Shadow';
    setSmartFilter: (filter: 'All' | 'Critical' | 'PII' | 'Secrets' | 'Shadow') => void;
    proxyRunning: boolean;
    onToggleProxy: () => void;
}

export const WorkbenchView: React.FC<WorkbenchViewProps> = ({
    assets,
    workbenchIds,
    setWorkbenchIds,
    selectedIds,
    handleAssetMouseDown,
    handleContextMenu,
    workbenchSort,
    workbenchFilter,
    onPromoteToAssetManager,
    onSelectionChange,
    smartFilter,
    setSmartFilter,
    proxyRunning,
    onToggleProxy
}) => {
    
    const filteredAssets = React.useMemo(() => {
        return assets
            .filter(a => workbenchIds.has(a.id))
            .filter(workbenchFilter.filterFn);
    }, [assets, workbenchIds, workbenchFilter.filterFn]);

    const handleSelectAll = (selected: boolean) => {
        if (selected) {
            onSelectionChange(new Set(filteredAssets.map(a => a.id)));
        } else {
            onSelectionChange(new Set());
        }
    };

    const columns: Column<Asset>[] = [
        { 
            id: 'url', 
            label: 'Endpoint', 
            sortable: true,
            render: (a) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {getSourceIcon(a.source)}
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.url}</span>
                </div>
            )
        },
        { 
            id: 'method', 
            label: 'Method',
            width: '100px',
            sortable: true,
            render: (a) => (
                <span style={{ 
                    padding: '2px 8px', 
                    background: 'rgba(255,255,255,0.05)', 
                    borderRadius: '4px', 
                    fontSize: '11px', 
                    fontWeight: 'bold',
                    color: a.method === 'POST' ? '#3b82f6' : a.method === 'GET' ? '#10b981' : '#eab308'
                }}>{a.method}</span>
            )
        },
        { 
            id: 'status_code', 
            label: 'Status',
            width: '80px',
            sortable: true,
            render: (a) => (
                <span style={{ color: a.status_code >= 400 ? 'var(--status-critical)' : a.status_code >= 200 ? 'var(--status-safe)' : 'var(--text-secondary)', fontWeight: 600 }}>
                    {a.status_code || '---'}
                </span>
            )
        },
        { 
            id: 'findings', 
            label: 'Security Insights',
            render: (a) => (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {getDetectionBadges(a.findings)}
                </div>
            )
        }
    ];

    if (workbenchIds.size === 0) {
        return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '0 24px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <FileCode size={20} color="var(--accent-color)" />
                        <h2 style={{ fontSize: '16px', margin: 0, fontWeight: 600 }}>Staging Workbench</h2>
                    </div>
                    <button 
                        onClick={onToggleProxy}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
                            background: proxyRunning ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-secondary)',
                            border: `1px solid ${proxyRunning ? 'var(--status-critical)' : 'var(--border-color)'}`,
                            borderRadius: '8px', color: proxyRunning ? 'var(--status-critical)' : 'var(--text-primary)',
                            fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
                        }}
                    >
                        <Shield size={14} /> {proxyRunning ? 'Proxy Active' : 'Start Proxy'}
                    </button>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <EmptyState 
                        icon={FileCode}
                        title="Workbench Empty"
                        description="Captures from Proxy, imports, or API scans appear here for triage."
                        action={{
                            label: "Go to Dashboard",
                            onClick: () => {}
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '0 24px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)', position: 'sticky', top: 0, zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FileCode size={20} color="var(--accent-color)" />
                    <div>
                        <h2 style={{ fontSize: '16px', margin: 0, fontWeight: 600 }}>Staging Workbench</h2>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Triaging {workbenchIds.size} potential endpoints</span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                        onClick={onToggleProxy}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px',
                            background: proxyRunning ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-secondary)',
                            border: `1px solid ${proxyRunning ? 'var(--status-critical)' : 'var(--border-color)'}`,
                            borderRadius: '8px', color: proxyRunning ? 'var(--status-critical)' : 'var(--text-primary)',
                            fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
                        }}
                    >
                        <Shield size={14} color={proxyRunning ? 'var(--status-critical)' : 'var(--accent-color)'} />
                        {proxyRunning ? 'Capture Active' : 'Start Capture'}
                    </button>

                    <button 
                        onClick={onPromoteToAssetManager}
                        disabled={selectedIds.size === 0}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px',
                            background: 'var(--accent-color)', border: 'none', borderRadius: '8px',
                            color: 'white', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                            opacity: selectedIds.size === 0 ? 0.5 : 1
                        }}
                    >
                        <Target size={14} /> Promote to Manager
                    </button>
                    
                    <button 
                        onClick={() => setWorkbenchIds(new Set())}
                        style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}
                    >
                        <X size={14} /> Clear
                    </button>
                </div>
            </div>

            {/* Inlined Filter Bar for richer experience */}
            <div style={{ padding: '12px 24px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '400px', background: 'var(--bg-primary)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <Search size={14} style={{ opacity: 0.5 }} />
                    <input 
                        type="text" 
                        placeholder="Search workbench..." 
                        value={workbenchFilter.searchTerm}
                        onChange={(e) => workbenchFilter.setSearchTerm(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '13px', width: '100%', outline: 'none' }}
                    />
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Filter size={14} style={{ opacity: 0.5 }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginRight: '4px' }}>Smart Views:</span>
                    {(['All', 'Critical', 'PII', 'Secrets', 'Shadow'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setSmartFilter(f)}
                            style={{
                                padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                                background: smartFilter === f ? 'var(--accent-color)' : 'rgba(255,255,255,0.03)',
                                color: smartFilter === f ? 'white' : 'var(--text-secondary)',
                                border: '1px solid var(--border-color)',
                                transition: 'all 0.2s'
                            }}
                        >{f}</button>
                    ))}
                </div>
            </div>

            <div style={{ flex: 1, padding: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <SmartTable<Asset>
                    data={filteredAssets}
                    columns={columns}
                    selectedIds={selectedIds}
                    onSelectAll={handleSelectAll}
                    allSelected={filteredAssets.length > 0 && selectedIds.size === filteredAssets.length}
                    onRowMouseDown={(a, e) => handleAssetMouseDown(a.id, e)}
                    onRowContextMenu={(a, e) => handleContextMenu(a.id, e)}
                    sortConfig={workbenchSort.sortConfig}
                    onSort={workbenchSort.handleSort}
                    idField="id"
                    emptyMessage="No matching endpoints in workbench"
                />
            </div>
        </div>
    );
};
