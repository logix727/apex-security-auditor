import React from 'react';
import { ChevronRight, Home, Folder, Globe, Layers } from 'lucide-react';

export interface BreadcrumbItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  maxItems?: number;
  className?: string;
}

/**
 * Breadcrumb navigation component for displaying navigation context.
 * Shows hierarchical path with clickable items and proper ARIA labels.
 */
export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  maxItems = 4,
  className = ''
}) => {
  if (items.length === 0) {
    return null;
  }

  // If we have more items than maxItems, show first item, ellipsis, and last items
  const shouldTruncate = items.length > maxItems;
  const displayItems = shouldTruncate
    ? [
        items[0],
        { id: 'ellipsis', label: '...', icon: null },
        ...items.slice(-(maxItems - 2))
      ]
    : items;

  return (
    <nav
      className={`breadcrumbs ${className}`}
      aria-label="Breadcrumb navigation"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '8px 16px',
        fontSize: '12px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        overflow: 'hidden'
      }}
    >
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          margin: 0,
          padding: 0,
          listStyle: 'none',
          flexWrap: 'wrap'
        }}
      >
        {displayItems.map((item, index) => {
          const isLast = index === displayItems.length - 1;
          const isEllipsis = item.id === 'ellipsis';

          return (
            <li
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {index > 0 && (
                <ChevronRight
                  size={14}
                  style={{
                    color: 'var(--text-secondary)',
                    opacity: 0.5,
                    flexShrink: 0
                  }}
                  aria-hidden="true"
                />
              )}
              {isEllipsis ? (
                <span
                  style={{
                    padding: '2px 6px',
                    color: 'var(--text-secondary)',
                    opacity: 0.5,
                    cursor: 'default'
                  }}
                  aria-hidden="true"
                >
                  {item.label}
                </span>
              ) : (
                <button
                  onClick={item.onClick}
                  disabled={isLast}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    background: isLast ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                    border: isLast ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid transparent',
                    borderRadius: '6px',
                    color: isLast ? 'var(--accent-color)' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: isLast ? '600' : '400',
                    cursor: isLast ? 'default' : 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap'
                  }}
                  className="breadcrumb-item"
                  aria-current={isLast ? 'page' : undefined}
                  title={item.label}
                  onMouseEnter={(e) => {
                    if (!isLast) {
                      e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                      e.currentTarget.style.color = 'var(--accent-color)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isLast) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  {item.icon && (
                    <span style={{ display: 'flex', flexShrink: 0 }} aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.label}
                  </span>
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

/**
 * Hook to generate breadcrumbs based on current navigation state
 */
export const useBreadcrumbs = (
  activeView: string,
  activeFolderId: number | null,
  selectedTreePath: string | null,
  folders: { id: number; name: string; parent_id: number | null }[]
): BreadcrumbItem[] => {
  return React.useMemo(() => {
    const items: BreadcrumbItem[] = [];

    // Home item
    items.push({
      id: 'home',
      label: 'Assets',
      icon: <Home size={14} />,
      onClick: () => {}
    });

    // If viewing a folder
    if (activeFolderId !== null) {
      const folder = folders.find(f => f.id === activeFolderId);
      if (folder) {
        // Build folder path
        const folderPath: { id: number; name: string }[] = [];
        let currentFolder = folder;
        while (currentFolder) {
          folderPath.unshift({ id: currentFolder.id, name: currentFolder.name });
          currentFolder = folders.find(f => f.id === currentFolder.parent_id || null) as typeof currentFolder;
        }

        folderPath.forEach(f => {
          items.push({
            id: `folder-${f.id}`,
            label: f.name,
            icon: <Folder size={14} />,
            onClick: () => {}
          });
        });
      }
    }

    // If viewing a tree path
    if (selectedTreePath) {
      const pathParts = selectedTreePath.split('/').filter(Boolean);
      const fullPath = pathParts[0] || '';
      
      items.push({
        id: 'tree-root',
        label: fullPath || 'All Domains',
        icon: <Globe size={14} />,
        onClick: () => {}
      });

      if (pathParts.length > 1) {
        items.push({
          id: 'tree-path',
          label: `/${pathParts.slice(1).join('/')}`,
          icon: <Layers size={14} />,
          onClick: () => {}
        });
      }
    }

    return items;
  }, [activeView, activeFolderId, selectedTreePath, folders]);
};

export default Breadcrumbs;
