import React from 'react';
import { ShieldAlert, AlertTriangle, AlertCircle, Bot, Loader2, Copy, BarChart3, Activity, Info } from 'lucide-react';
import { Asset, Badge } from '../../types';
import { 
  KPICard, 
  SeverityChart, 
  FindingsGroup 
} from '../summary';

interface SummaryTabProps {
    inspectorAsset: Asset | null;
    workbenchSummary: any;
    assetSummary: { summary: string; provider: string } | null;
    assetSummaryLoading: boolean;
    handleFindingClick: (f: Badge) => void;
    handleAnalyzeFinding: (f: Badge) => void;
    handleToggleFP: (finding: Badge, is_fp: boolean) => void;
}

export const SummaryTab: React.FC<SummaryTabProps> = ({
    inspectorAsset,
    workbenchSummary,
    assetSummary,
    assetSummaryLoading,
    handleFindingClick,
    handleAnalyzeFinding,
    handleToggleFP
}) => {
    return (
        <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px 16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {inspectorAsset ? (
                    <>
                        {/* KPI Cards Row */}
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', 
                            gap: '10px' 
                        }}>
                            <KPICard
                                label="Risk Score"
                                value={inspectorAsset.risk_score}
                                icon={<ShieldAlert size={24} />}
                                color={inspectorAsset.risk_score > 70 ? 'critical' : inspectorAsset.risk_score > 30 ? 'warning' : 'safe'}
                            />
                            <KPICard
                                label="Critical"
                                value={inspectorAsset.findings.filter(f => f.severity === 'Critical').length}
                                icon={<AlertTriangle size={24} />}
                                color="critical"
                            />
                            <KPICard
                                label="High"
                                value={inspectorAsset.findings.filter(f => f.severity === 'High').length}
                                icon={<AlertCircle size={24} />}
                                color="warning"
                            />
                        </div>

                        {/* Severity Chart */}
                        <SeverityChart 
                            findings={inspectorAsset.findings}
                            type="bar"
                            size="small"
                            interactive={true}
                        />

                        {/* AI Asset Summary Section */}
                        <section>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
                                <h4 style={{fontSize: '11px', color: 'var(--accent-color)', fontWeight: '800', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px'}}><Bot size={13}/> AI AUDIT INSIGHT</h4>
                            </div>
                            
                            {assetSummaryLoading && (
                                <div style={{background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderStyle: 'dashed', borderRadius: '8px', padding: '16px', textAlign: 'center'}}>
                                    <Loader2 size={16} className="spin" style={{margin: '0 auto 8px', display: 'block', color: 'var(--accent-color)'}} />
                                    <div style={{fontSize: '10px', color: 'var(--text-secondary)'}}>Generating AI Insights...</div>
                                </div>
                            )}
                            
                            {assetSummary && (
                                <div style={{background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', fontSize: '11px', lineHeight: '1.5', position: 'relative'}}>
                                     <div style={{marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '9px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                        <span>Analyzed by {assetSummary.provider}</span>
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(assetSummary.summary);
                                                alert("Summary copied!");
                                            }} 
                                            title="Copy Summary"
                                            style={{background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px'}}
                                        >
                                            <Copy size={12} />
                                        </button>
                                     </div>
                                     <div style={{whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto', paddingRight: '4px'}} className="custom-scrollbar">
                                         {assetSummary.summary.split('\n').map((line, i) => {
                                            if (line.startsWith('# ')) return <div key={i} style={{fontWeight: '900', fontSize: '12px', color: 'var(--accent-color)', marginTop: '10px', marginBottom: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px'}}>{line.replace('# ', '')}</div>;
                                            if (line.trim().startsWith('- ')) return <div key={i} style={{marginLeft: '4px', marginBottom: '4px', paddingLeft: '8px', borderLeft: '2px solid var(--border-color)'}}>{line.trim().substring(2)}</div>;
                                            return <div key={i} style={{marginBottom: '4px'}}>{line}</div>;
                                         })}
                                     </div>
                                </div>
                            )}
                        </section>

                         {/* Findings Grouped by Severity */}
                         <FindingsGroup
                             title="Critical Findings"
                             icon={<AlertTriangle size={14} style={{ color: 'var(--status-critical)' }} />}
                             findings={inspectorAsset.findings.filter(f => f.severity === 'Critical')}
                             defaultExpanded={true}
                             onFindingClick={handleFindingClick}
                             onAIReview={handleAnalyzeFinding}
                             onToggleFP={handleToggleFP}
                         />

                         <FindingsGroup
                             title="High Priority Findings"
                             icon={<AlertCircle size={14} style={{ color: 'var(--status-warning)' }} />}
                             findings={inspectorAsset.findings.filter(f => f.severity === 'High')}
                             defaultExpanded={true}
                             onFindingClick={handleFindingClick}
                             onAIReview={handleAnalyzeFinding}
                             onToggleFP={handleToggleFP}
                         />

                         <FindingsGroup
                             title="Medium Priority Findings"
                             icon={<Activity size={14} style={{ color: '#eab308' }} />}
                             findings={inspectorAsset.findings.filter(f => f.severity === 'Medium')}
                             defaultExpanded={false}
                             onFindingClick={handleFindingClick}
                             onAIReview={handleAnalyzeFinding}
                             onToggleFP={handleToggleFP}
                         />

                         <FindingsGroup
                             title="Low Priority Findings"
                             icon={<Info size={14} style={{ color: '#3b82f6' }} />}
                             findings={inspectorAsset.findings.filter(f => f.severity === 'Low' || f.severity === 'Info')}
                             defaultExpanded={false}
                             onFindingClick={handleFindingClick}
                             onAIReview={handleAnalyzeFinding}
                             onToggleFP={handleToggleFP}
                         />
                    </>
                ) : workbenchSummary ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Workbench KPI Cards */}
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', 
                            gap: '10px' 
                        }}>
                            <KPICard
                                label="Assets"
                                value={workbenchSummary.count}
                                icon={<BarChart3 size={24} />}
                                color="default"
                            />
                            <KPICard
                                label="Avg Risk"
                                value={Math.round(workbenchSummary.avgRisk)}
                                icon={<ShieldAlert size={24} />}
                                color={workbenchSummary.avgRisk > 50 ? 'critical' : 'warning'}
                            />
                            <KPICard
                                label="Critical"
                                value={workbenchSummary.criticalCount || 0}
                                icon={<AlertTriangle size={24} />}
                                color="critical"
                            />
                        </div>

                        {/* Workbench Severity Chart */}
                        {workbenchSummary.findings && workbenchSummary.findings.length > 0 && (
                            <SeverityChart 
                                findings={workbenchSummary.findings}
                                type="bar"
                                size="small"
                            />
                        )}

                        {/* Workbench Summary Info */}
                        <div style={{ 
                            background: 'var(--bg-primary)', 
                            border: '1px solid var(--border-color)', 
                            borderRadius: '10px', 
                            padding: '16px' 
                        }}>
                            <h4 style={{fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800'}}>
                                <Activity size={14}/> Workbench Overview
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Safe Assets</span>
                                    <span style={{ color: 'var(--status-safe)', fontWeight: 'bold' }}>{workbenchSummary.safeCount || 0}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Warning Assets</span>
                                    <span style={{ color: 'var(--status-warning)', fontWeight: 'bold' }}>{workbenchSummary.warningCount || 0}</span>
                                </div>
                            </div>
                         </div>
                      </div>
                ) : (
                    <div style={{textAlign: 'center', marginTop: '60px', opacity: 0.3}}>
                        <Activity size={40} />
                        <p style={{fontSize: '12px', marginTop: '12px'}}>Select an asset for analysis.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
