import React from 'react';
import { 
  X, 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  ChevronRight, 
  Layers,
  Search
} from 'lucide-react';
import { ShadowApiReport as ShadowApiReportType } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface ShadowApiReportProps {
  report: ShadowApiReportType;
  onClose: () => void;
  onViewAsset?: (id: number) => void;
  onImportMissing?: () => void;
  onClearStatus?: () => void;
}

export const ShadowApiReport: React.FC<ShadowApiReportProps> = ({ 
  report, 
  onClose, 
  onViewAsset,
  onImportMissing,
  onClearStatus
}) => {
  const chartData = [
    { name: 'Documented', value: report.documented_count, color: 'var(--status-safe)' },
    { name: 'Shadow APIs', value: report.shadow_api_count, color: 'var(--status-critical)' },
  ];

  const coveragePercent = report.total_assets_checked > 0 
    ? Math.round((report.documented_count / report.total_assets_checked) * 100) 
    : 0;

  return (
    <div className="inspector-panel" style={{ 
      position: 'fixed', top: '60px', right: '20px', bottom: '20px', 
      width: '500px', display: 'flex', flexDirection: 'column',
      zIndex: 100, boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
      background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
      borderRadius: '12px', overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '20px', borderBottom: '1px solid var(--border-color)', 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, transparent 100%)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldAlert size={20} color="var(--accent-color)" />
          <div>
            <h3 style={{ margin: 0, fontSize: '16px' }}>Shadow API Analysis</h3>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
              {report.spec_title} v{report.spec_version}
            </p>
          </div>
        </div>
        <button 
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }} className="custom-scrollbar">
        {/* Summary Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <div className="stats-card" style={{ padding: '15px' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Live Assets Checked</span>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '4px' }}>{report.total_assets_checked}</div>
          </div>
          <div className="stats-card" style={{ padding: '15px' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Spec Endpoints</span>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '4px' }}>{report.total_endpoints}</div>
          </div>
        </div>

        {/* Visualization */}
        <div style={{ 
          height: '240px', background: 'rgba(255,255,255,0.03)', 
          borderRadius: '8px', marginBottom: '24px', position: 'relative',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                itemStyle={{ fontSize: '12px' }}
              />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ 
            position: 'absolute', top: '45%', left: '50%', 
            transform: 'translate(-50%, -50%)', textAlign: 'center' 
          }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{coveragePercent}%</div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Coverage</div>
          </div>
        </div>

        {/* Detailed Insights */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '13px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={14} color="var(--accent-color)" /> Risk Assessment
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
             <div style={{ 
               padding: '12px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', 
               borderLeft: '4px solid var(--status-critical)', display: 'flex', gap: '12px' 
             }}>
                <AlertTriangle size={18} color="var(--status-critical)" style={{ flexShrink: 0 }} />
                <div>
                   <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--status-critical)' }}>{report.shadow_api_count} Undocumented Endpoints</div>
                   <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                     These assets were found in live traffic but are completely missing from the provided OpenAPI specification.
                   </p>
                </div>
             </div>

             <div style={{ 
               padding: '12px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.1)', 
               borderLeft: '4px solid var(--status-safe)', display: 'flex', gap: '12px' 
             }}>
                <CheckCircle size={18} color="var(--status-safe)" style={{ flexShrink: 0 }} />
                <div>
                   <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--status-safe)' }}>{report.documented_count} Documented Endpoints</div>
                   <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                     Successfully matched against the spec. These paths are verified and expected.
                   </p>
                </div>
             </div>
          </div>
        </div>

        {/* Shadow API List */}
        {report.shadow_apis.length > 0 && (
          <div>
            <h4 style={{ fontSize: '13px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={14} color="var(--accent-color)" /> Exposed Assets
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {report.shadow_apis.slice(0, 10).map((asset) => (
                <div 
                  key={asset.id} 
                  className="list-item"
                  onClick={() => onViewAsset?.(asset.id)}
                  style={{ 
                    padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', background: 'var(--bg-primary)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{ 
                      fontSize: '9px', fontWeight: 'bold', padding: '2px 6px', 
                      borderRadius: '3px', background: 'rgba(255,255,255,0.1)', minWidth: '45px', textAlign: 'center' 
                    }}>
                      {asset.method}
                    </span>
                    <span style={{ 
                      fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', 
                      textOverflow: 'ellipsis', fontFamily: 'monospace' 
                    }}>
                      {asset.url}
                    </span>
                  </div>
                  <ChevronRight size={14} style={{ opacity: 0.3 }} />
                </div>
              ))}
              {report.shadow_apis.length > 10 && (
                <div style={{ textAlign: 'center', padding: '10px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  + {report.shadow_apis.length - 10} more shadow APIs detected.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
            <button 
                className="btn-secondary" 
                style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={onClearStatus}
            >
                Clear Doc Tags
            </button>
            <button 
                className="btn-primary" 
                style={{ flex: 2, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={onImportMissing}
            >
                Import {report.total_endpoints - report.documented_count} Missing
            </button>
        </div>
        <button 
          style={{ 
              width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
              borderRadius: '6px', cursor: 'pointer'
          }}
          onClick={onClose}
        >
          <CheckCircle size={16} /> Mark as Reviewed
        </button>
      </div>
    </div>
  );
};
