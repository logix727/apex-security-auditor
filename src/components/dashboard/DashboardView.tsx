import React, { useMemo } from 'react';
import { Asset, Folder } from '../../types';
import KPICard from '../summary/KPICard';
import SeverityChart from '../summary/SeverityChart';
import { Package, ShieldAlert, FileText, CheckCircle } from 'lucide-react';

interface DashboardViewProps {
  assets: Asset[];
  folders: Folder[];
  setActiveView: (view: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ assets, folders, setActiveView }) => {
  const stats = useMemo(() => {
    const critical = assets.filter(a => a.status === 'Critical').length;
    const warning = assets.filter(a => a.status === 'Warning').length;
    const suspicious = assets.filter(a => a.status === 'Suspicious').length;
    const safe = assets.filter(a => a.status === 'Safe').length;
    
    return {
      total: assets.length,
      critical,
      warning,
      suspicious,
      safe,
      folders: folders.length
    };
  }, [assets, folders]);

  return (
    <div style={{ padding: '24px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Security Dashboard</h1>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          {new Date().toLocaleDateString()}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <KPICard 
          label="Total Assets" 
          value={stats.total} 
          icon={<Package size={20} />} 
          trend="up"
          trendValue="+5%" 
          onClick={() => setActiveView('assets')}
        />
        <KPICard 
          label="Critical Issues" 
          value={stats.critical} 
          icon={<ShieldAlert size={20} color="#ef4444" />} 
          trend="stable"
          trendValue="0"
          color="critical"
        />
        <KPICard 
          label="Documents" 
          value={assets.filter(a => a.is_documented).length} 
          icon={<FileText size={20} />} 
        />
        <KPICard 
          label="Safe Assets" 
          value={stats.safe} 
          icon={<CheckCircle size={20} color="#10b981" />} 
          color="safe"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flex: 1 }}>
        <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginBottom: '16px', fontWeight: 'bold' }}>Finding Distribution</h3>
          <div style={{ height: '300px' }}>
            <SeverityChart findings={assets.flatMap(a => a.findings)} />
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '16px', fontWeight: 'bold' }}>Recent Folders</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {folders.slice(0, 5).map(f => (
              <div key={f.id} style={{ padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500 }}>{f.name}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{assets.filter(a => a.folder_id === f.id).length} assets</span>
              </div>
            ))}
          </div>
          <button 
            onClick={() => setActiveView('assets')}
            style={{ marginTop: 'auto', padding: '10px', background: 'transparent', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', borderRadius: '6px', cursor: 'pointer' }}
          >
            Manage Folders
          </button>
        </div>
      </div>
    </div>
  );
};
