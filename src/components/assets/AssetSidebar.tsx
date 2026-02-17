import React from 'react';
import { FolderIcon, File, Globe, ChevronRight, Database as DbIcon, Plus, X } from 'lucide-react';
import { Folder, TreeNode, AssetSidebarView } from '../../types';

interface RenderFolderProps {
  folder: Folder;
  folders: Folder[];
  activeFolderId: number | null;
  onSelect: (id: number) => void;
  onAddSubfolder: (parentId: number) => void;
  onMoveAssets: (folderId: number) => void;
  depth?: number;
}

const RenderFolder: React.FC<RenderFolderProps> = ({ 
  folder, folders, activeFolderId, onSelect, onAddSubfolder, onMoveAssets, depth = 0 
}) => {
  const isActive = activeFolderId === folder.id;
  const subfolders = folders.filter(f => f.parent_id === folder.id);
  
  return (
    <div style={{ position: 'relative' }}>
      {depth > 0 && (
        <div style={{ 
          position: 'absolute', left: '-10px', top: '-10px', bottom: '12px', 
          width: '1px', background: 'var(--border-color)', opacity: 0.5 
        }} />
      )}
      <div 
        onClick={() => onSelect(folder.id)}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; }}
        onDragLeave={(e) => { e.currentTarget.style.background = isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent'; }}
        onDrop={(e) => { e.preventDefault(); onMoveAssets(folder.id); e.currentTarget.style.background = isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent'; }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 12px',
          borderRadius: '8px',
          cursor: 'pointer',
          background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
          color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
          border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
          marginBottom: '2px',
          fontSize: '12px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative'
        }}
        className="nav-item-compact"
      >
        <FolderIcon size={14} color={isActive ? "var(--accent-color)" : "currentColor"} />
        <span style={{ flex: 1, fontWeight: isActive ? '600' : '500', fontFamily: 'var(--font-main)' }}>{folder.name}</span>
        <button 
          onClick={(e) => { e.stopPropagation(); onAddSubfolder(folder.id); }}
          style={{ 
            background: 'transparent', border: 'none', color: 'var(--text-secondary)', 
            padding: '2px', cursor: 'pointer', display: 'flex' 
          }}
          title="Add subfolder"
        >
          <Plus size={12} />
        </button>
      </div>

      <div style={{ marginLeft: '20px' }}>
        {subfolders.map(sf => (
          <RenderFolder 
            key={sf.id} 
            folder={sf} 
            folders={folders} 
            activeFolderId={activeFolderId} 
            onSelect={onSelect}
            onAddSubfolder={onAddSubfolder}
            onMoveAssets={onMoveAssets}
            depth={depth + 1}
          />
        ))}
      </div>
    </div>
  );
};

interface RenderTreeNodeProps {
  node: TreeNode;
  selectedTreePath: string | null;
  onSelect: (path: string) => void;
  depth?: number;
}

const RenderTreeNode: React.FC<RenderTreeNodeProps> = ({ 
  node, selectedTreePath, onSelect, depth = 0 
}) => {
  const isSelected = selectedTreePath === node.path;
  const childrenAr = Object.values(node.children);
  const isHost = depth === 0;

  return (
    <div style={{ position: 'relative' }}>
      {depth > 0 && (
        <div style={{ 
          position: 'absolute', left: '-10px', top: '-10px', bottom: '12px', 
          width: '1px', background: 'var(--border-color)', opacity: 0.5 
        }} />
      )}
      <div 
        onClick={() => onSelect(node.path)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 12px',
          borderRadius: '8px',
          cursor: 'pointer',
          background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
          color: isSelected ? 'var(--accent-color)' : 'var(--text-secondary)',
          border: isSelected ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
          marginBottom: '2px',
          fontSize: '12px',
          transition: 'all 0.2s ease',
          position: 'relative'
        }}
        className="nav-item-compact"
      >
        <span style={{ display: 'flex', alignItems: 'center', opacity: 0.7 }}>
          {isHost ? (<Globe size={14} />) : childrenAr.length > 0 ? (<ChevronRight size={14} />) : (<File size={14} />)}
        </span>
        <span style={{ 
          flex: 1, 
          fontWeight: isSelected ? '600' : '500', 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          fontFamily: isHost ? 'var(--font-mono)' : 'var(--font-main)',
          fontSize: isHost ? '11px' : '12px'
        }}>
          {node.name}
        </span>
        {(node.assetCount ?? 0) > 0 && (
          <span style={{ 
            fontSize: '9px', opacity: 0.5, padding: '1px 5px', 
            borderRadius: '10px', background: 'var(--border-color)',
            fontWeight: 'bold'
          }}>
            {node.assetCount ?? 0}
          </span>
        )}
      </div>

      <div style={{ marginLeft: '20px' }}>
        {childrenAr.map(child => (
          <RenderTreeNode 
            key={child.path} 
            node={child} 
            selectedTreePath={selectedTreePath} 
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
      </div>
    </div>
  );
};

interface AssetSidebarProps {
  view: AssetSidebarView;
  setView: (view: AssetSidebarView) => void;
  folders: Folder[];
  activeFolderId: number | null;
  setActiveFolderId: (id: number | null) => void;
  selectedTreePath: string | null;
  setSelectedTreePath: (path: string | null) => void;
  domainTree: Record<string, TreeNode>;
  onAddFolder: (parentId?: number) => void;
  onMoveToFolder: (folderId: number) => void;
}

export const AssetSidebar: React.FC<AssetSidebarProps> = ({
  view,
  setView,
  folders,
  activeFolderId,
  setActiveFolderId,
  selectedTreePath,
  setSelectedTreePath,
  domainTree,
  onAddFolder,
  onMoveToFolder
}) => {
  return (
    <div style={{ width: '260px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 12px' }}>
      <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '3px', borderRadius: '8px', marginBottom: '16px' }}>
        <button 
          onClick={() => setView('tree')}
          style={{ 
            flex: 1, padding: '6px', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold',
            background: view === 'tree' ? 'var(--bg-primary)' : 'transparent',
            color: view === 'tree' ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: view === 'tree' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none',
            cursor: 'pointer', transition: 'all 0.2s'
          }}
        >Assets</button>
        <button 
          onClick={() => setView('folders')}
          style={{ 
            flex: 1, padding: '6px', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold',
            background: view === 'folders' ? 'var(--bg-primary)' : 'transparent',
            color: view === 'folders' ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: view === 'folders' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none',
            cursor: 'pointer', transition: 'all 0.2s'
          }}
        >Folders</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', marginBottom: '12px' }}>
        {view === 'folders' ? (
          <div style={{ paddingLeft: '4px' }}>
            {folders.filter(f => !f.parent_id).map(f => (
              <RenderFolder 
                key={f.id} 
                folder={f} 
                folders={folders} 
                activeFolderId={activeFolderId} 
                onSelect={(id) => { setActiveFolderId(id); setSelectedTreePath(null); }}
                onAddSubfolder={(id) => onAddFolder(id)}
                onMoveAssets={(id) => onMoveToFolder(id)}
              />
            ))}
            <div 
              className="menu-item" 
              style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} 
              onClick={() => onAddFolder()}
            >
              <Plus size={12} /> New Folder
            </div>
          </div>
        ) : (
          <div>
            {Object.values(domainTree).map(node => (
              <RenderTreeNode 
                key={node.path} 
                node={node} 
                selectedTreePath={selectedTreePath}
                onSelect={(path) => { setSelectedTreePath(path); setActiveFolderId(null); }}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button 
            className="menu-item" 
            style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', border: 'none', background: 'transparent', textAlign: 'left', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' }}
            onClick={() => {
                const config = {
                    view,
                    activeFolderId,
                    selectedTreePath,
                    // More states could be added here
                };
                localStorage.setItem('apex_saved_view', JSON.stringify(config));
                alert('View configuration saved locally.');
            }}
          >
              <DbIcon size={12} /> Save Current View
          </button>
          <button 
            className="menu-item" 
            style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', border: 'none', background: 'transparent', textAlign: 'left', padding: '6px 8px', color: 'var(--status-critical)', opacity: 0.8, borderRadius: '6px', cursor: 'pointer' }}
            onClick={() => {
                setActiveFolderId(null);
                setSelectedTreePath(null);
            }}
          >
              <X size={12} /> Reset Sidebar Selects
          </button>
      </div>
    </div>
  );
};
