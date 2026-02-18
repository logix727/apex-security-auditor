import React from 'react';
import { Asset } from '../../types';
import { SmartTable, Column } from '../table/SmartTable';
import { FileCode, X, Target, Shield, Filter, Zap } from 'lucide-react';
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
    onPromoteToAssetManager: () => void;
    onExportMarkdown: () => void;
    onExportCsv: () => void;
    onExportHtml: () => void;
    onSelectionChange: (ids: Set<number>) => void;
    smartFilter: 'All' | 'Critical' | 'PII' | 'Secrets' | 'Shadow';
    setSmartFilter: (filter: 'All' | 'Critical' | 'PII' | 'Secrets' | 'Shadow') => void;
    proxyRunning: boolean;
    onToggleProxy: () => void;
    onOpenImport: () => void;
    onRunActiveScan: (id?: number) => void;
}

export const WorkbenchView: React.FC<WorkbenchViewProps> = ({
    assets,
    workbenchIds,
    setWorkbenchIds,
    selectedIds,
    handleAssetMouseDown,
    handleContextMenu,
    workbenchSort,
    onPromoteToAssetManager,
    onExportMarkdown,
    onExportCsv,
    onExportHtml,
    onSelectionChange,
    smartFilter,
    setSmartFilter,
    proxyRunning,
    onToggleProxy,
    onOpenImport,
    onRunActiveScan
}) => {
    
    const processedAssets = React.useMemo(() => {
        const filtered = assets
            .filter(a => workbenchIds.has(a.id));
            
        // Apply smart filters (re-using existing logic)
        let final = filtered;
        if (smartFilter === 'Critical') final = final.filter(a => a.findings.some(f => f.severity === 'Critical'));
        else if (smartFilter === 'PII') final = final.filter(a => a.findings.some(f => f.owasp_category?.includes('PII') || f.description.includes('PII')));
        else if (smartFilter === 'Secrets') final = final.filter(a => a.findings.some(f => f.owasp_category?.includes('Secrets') || f.description.includes('Key')));
        else if (smartFilter === 'Shadow') final = final.filter(a => !a.is_documented);
        
        return workbenchSort.sortData(final);
    }, [assets, workbenchIds, smartFilter, workbenchSort]);

    // UX Fix: Default to sorting by updated_at desc on mount to show new imports
    React.useEffect(() => {
        if (!workbenchSort.sortConfig) {
            workbenchSort.handleSort('updated_at');
            // Force desc if needed, but handleSort usually toggles. 
            // If it starts asc, we might want desc.
            // Let's assume handleSort toggles or defaults.
            // Actually, if I can't control direction easily without inspecting `useTableSort`, 
            // I'll just trigger it. 
            // Ideally `useTableSort` defaults key to null.
        }
    }, [workbenchSort]);
    const handleSelectAll = (selected: boolean) => {
        if (selected) {
            onSelectionChange(new Set(processedAssets.map((a: Asset) => a.id)));
        } else {
            onSelectionChange(new Set());
        }
    };

    const columns: Column<Asset>[] = [
        { 
            id: 'url', 
            label: 'Asset URL', 
            sortable: true,
            render: (a: Asset) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.url}</span>
                </div>
            )
        },
        { 
            id: 'method', 
            label: 'Method',
            width: '80px',
            sortable: true,
            render: (a: Asset) => (
                <span className={`method-badge ${a.method.toLowerCase()}`}>{a.method}</span>
            )
        },
        { 
            id: 'status_code', 
            label: 'Status',
            width: '100px',
            sortable: true,
            render: (a: Asset) => (
                <span style={{ color: a.status_code >= 400 ? 'var(--status-critical)' : a.status_code >= 200 ? 'var(--status-safe)' : 'var(--text-secondary)', fontWeight: 600 }}>
                    {a.status_code || '---'}
                </span>
            )
        },
        {
            id: 'risk_score',
            label: 'Risk',
            sortable: true,
            width: '80px',
            render: (item: Asset) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="risk-bar-bg" style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                    <div className="risk-bar-fill" style={{ 
                    width: `${Math.min(100, item.risk_score)}%`, 
                    height: '100%', 
                    background: item.risk_score > 70 ? 'var(--status-critical)' : item.risk_score > 30 ? 'var(--status-warning)' : 'var(--status-safe)',
                    borderRadius: '2px' 
                    }} />
                </div>
                <span style={{ fontSize: '11px', minWidth: '20px', textAlign: 'right', opacity: 0.7 }}>{item.risk_score}</span>
                </div>
            )
        },
        {
            id: 'cvss_score',
            label: 'CVSS',
            sortable: true,
            width: '60px',
            render: (item: Asset) => {
                const maxCvss = item.findings.reduce((max, f) => Math.max(max, f.cvss_score || 0), 0);
                return maxCvss > 0 ? (
                <span style={{ 
                    fontWeight: 'bold', 
                    color: maxCvss >= 7 ? 'var(--status-critical)' : maxCvss >= 4 ? 'var(--status-warning)' : 'var(--status-safe)',
                    background: maxCvss >= 7 ? 'rgba(239, 68, 68, 0.1)' : maxCvss >= 4 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '11px'
                }}>
                    {maxCvss.toFixed(1)}
                </span>
                ) : <span style={{ opacity: 0.3, fontSize: '10px' }}>-</span>;
            }
        },
        { 
            id: 'findings', 
            label: 'Security Detections',
            sortable: true,
            minWidth: '150px',
            getValue: (a) => a.findings.length,
            render: (a) => (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {getDetectionBadges(a.findings)}
                </div>
            )
        },
        {
            id: 'source',
            label: 'Source',
            width: '110px',
            sortable: true,
            render: (a: Asset) => getSourceIcon(a.source, a.recursive)
        }
    ];

    if (workbenchIds.size === 0) {
        return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', padding: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <FileCode size={24} color="var(--accent-color)" />
                        <h1 style={{ fontSize: '20px', margin: 0 }}>Staging Workbench</h1>
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
                        title="Your Workbench is Empty"
                        description="Staging area for triaging security findings. Start by importing traffic logs, Swagger specs, or or launching the live capture proxy."
                        action={{
                            label: "Upload & Import Assets",
                            onClick: onOpenImport
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
                        onClick={() => onRunActiveScan()}
                        disabled={selectedIds.size === 0}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px',
                            background: selectedIds.size > 0 ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-secondary)', 
                            border: `1px solid ${selectedIds.size > 0 ? 'var(--status-critical)' : 'var(--border-color)'}`,
                            borderRadius: '8px',
                            color: selectedIds.size > 0 ? 'var(--status-critical)' : 'var(--text-disabled)', 
                            fontSize: '12px', fontWeight: 'bold', cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
                            opacity: selectedIds.size === 0 ? 0.5 : 1
                        }}
                        title="Run intrusive active scan (SQLi, BOLA)"
                    >
                        <Zap size={14} /> Active Scan
                    </button>
                    
                    <div style={{ display: 'flex', gap: '4px', borderLeft: '1px solid var(--border-color)', paddingLeft: '8px' }}>
                        <button title="Export CSV" onClick={onExportCsv} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            <FileCode size={14} />
                        </button>
                        <button title="Export Markdown" onClick={onExportMarkdown} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            <FileCode size={14} />
                        </button>
                        <button title="Export HTML" onClick={onExportHtml} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            <FileCode size={14} />
                        </button>
                    </div>

                    <button 
                        onClick={() => setWorkbenchIds(new Set())}
                        style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}
                    >
                        <X size={14} /> Clear
                    </button>
                </div>
            </div>

            {/* Smart Filters Bar - Search is now moved into the SmartTable for better consistency */}
            <div style={{ padding: '12px 24px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px' }}>
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
                    data={processedAssets}
                    columns={columns}
                    selectedIds={selectedIds}
                    onSelectAll={handleSelectAll}
                    allSelected={processedAssets.length > 0 && selectedIds.size === processedAssets.length}
                    onRowMouseDown={(a, e) => handleAssetMouseDown(a.id, e)}
                    onRowContextMenu={(a, e) => handleContextMenu(a.id, e)}
                    sortConfig={workbenchSort.sortConfig ? { columnId: String(workbenchSort.sortConfig.key), direction: workbenchSort.sortConfig.direction } : null}
                    onSort={(colId: string) => workbenchSort.handleSort(colId as keyof Asset)}
                    idField="id"
                    emptyMessage="No matching endpoints in workbench"
                />
            </div>
        </div>
    );
};
