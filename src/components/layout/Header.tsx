import React, { useState, useEffect } from 'react';
import { ShieldAlert, Search, Terminal, Sun, Moon } from 'lucide-react';
import { ActiveView } from '../../types';

interface HeaderProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  setIsImportModalOpen: (open: boolean) => void;
  setActiveView: (view: ActiveView) => void;
  isDebugConsoleOpen: boolean;
  setIsDebugConsoleOpen: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchTerm,
  setSearchTerm,
  setIsImportModalOpen,
  setActiveView,
  isDebugConsoleOpen,
  setIsDebugConsoleOpen
}) => {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Check initial preference or stored value
    const isLight = document.documentElement.classList.contains('light-theme');
    setIsDark(!isLight);
  }, []);

  const toggleTheme = () => {
    document.documentElement.classList.toggle('light-theme');
    setIsDark(!document.documentElement.classList.contains('light-theme'));
  };

  return (
    <header className="header" style={{ justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <ShieldAlert size={18} color="var(--accent-color)" style={{ marginRight: '8px' }} />
        <div className="header-title" style={{ fontSize: '13px', fontWeight: '800', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>APEX SECURITY AUDITOR</div>
        <div className="menu-bar">
          <div className="menu-item" onClick={() => setIsImportModalOpen(true)}>Import Assets</div>
          <div className="menu-item" onClick={() => setActiveView('settings')}>Settings</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="search-bar" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '4px 12px', width: '300px', transition: 'all 0.2s ease' }}>
          <Search size={14} color="var(--text-secondary)" />
          <input
            type="text"
            placeholder="Search assets, findings..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '12px', padding: '4px 8px', outline: 'none', width: '100%' }}
          />
        </div>

        <button 
          onClick={toggleTheme}
          className="menu-item"
          style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <button
          className="menu-item"
          onClick={() => setIsDebugConsoleOpen(!isDebugConsoleOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: isDebugConsoleOpen ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-primary)',
            border: `1px solid ${isDebugConsoleOpen ? 'var(--accent-color)' : 'var(--border-color)'}`,
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: '600'
          }}
        >
          <Terminal size={14} color={isDebugConsoleOpen ? 'var(--accent-color)' : 'currentColor'} />
          Console
        </button>
      </div>
    </header>
  );
};
