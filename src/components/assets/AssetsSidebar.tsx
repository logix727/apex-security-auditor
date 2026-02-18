import React from 'react';
import { Folder, TreeNode, AssetSidebarView } from '../../types';
import { AssetSidebar } from './AssetSidebar';

interface AssetsSidebarProps {
  folders: Folder[];
  activeFolderId: number | null;
  setActiveFolderId: (id: number | null) => void;
  selectedTreePath: string | null;
  setSelectedTreePath: (path: string | null) => void;
  domainTree: Record<string, TreeNode>;
  view: AssetSidebarView;
  setView: (view: AssetSidebarView) => void;
  onAddFolder: (parentId?: number) => void;
  onMoveToFolder: (folderId: number) => void;
}

export const AssetsSidebar: React.FC<AssetsSidebarProps> = ({
  folders,
  activeFolderId,
  setActiveFolderId,
  selectedTreePath,
  setSelectedTreePath,
  domainTree,
  view,
  setView,
  onAddFolder,
  onMoveToFolder
}) => {
  return (
    <AssetSidebar 
      folders={folders}
      activeFolderId={activeFolderId}
      setActiveFolderId={setActiveFolderId}
      selectedTreePath={selectedTreePath}
      setSelectedTreePath={setSelectedTreePath}
      domainTree={domainTree}
      view={view}
      setView={setView}
      onAddFolder={onAddFolder}
      onMoveToFolder={onMoveToFolder}
    />
  );
};