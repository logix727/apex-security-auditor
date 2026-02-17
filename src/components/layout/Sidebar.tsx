import React from 'react';
import { 
  LayoutDashboard, 
  Database as DbIcon, 
  Settings, 
  FileCode,
  Network,
  Search
} from 'lucide-react';
import { ActiveView } from '../../types';

interface SidebarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  workbenchCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  workbenchCount
}) => {
  return (
    <nav className="sidebar">
      <div className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveView('dashboard')}>
        <LayoutDashboard size={18} /> Dashboard
      </div>
      <div className={`nav-item ${activeView === 'workbench' ? 'active' : ''}`} onClick={() => setActiveView('workbench')}>
        <FileCode size={18} /> Workbench
        <span style={{ marginLeft: 'auto', fontSize: '10px', background: 'var(--border-color)', padding: '2px 6px', borderRadius: '10px' }}>{workbenchCount}</span>
      </div>
      <div className={`nav-item ${activeView === 'assets' ? 'active' : ''}`} onClick={() => setActiveView('assets')}>
        <DbIcon size={18} /> Assets
      </div>

      <div className={`nav-item ${activeView === 'surface' ? 'active' : ''}`} onClick={() => setActiveView('surface')}>
        <Network size={18} /> Surface
      </div>
      <div className={`nav-item ${activeView === 'discovery' ? 'active' : ''}`} onClick={() => setActiveView('discovery')}>
        <Search size={18} /> Discovery
      </div>

      <div className={`nav-item ${activeView === 'settings' ? 'active' : ''}`} onClick={() => setActiveView('settings')}>
        <Settings size={18} /> Settings
      </div>

    </nav>
  );
};
