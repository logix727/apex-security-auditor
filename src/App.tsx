import { useState, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useDebugLogger } from './components/DebugConsole';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { downloadDir } from '@tauri-apps/api/path';
import { 
  LayoutDashboard,
  Search,
  Database as DbIcon,
  Settings,
  Activity,
  Trash2,
  Play,
  X,
  Info,
  FolderIcon,
  ChevronRight,
  Upload,
  FileCode,
  ShieldAlert,
  Bot,
  CheckCircle,
  XCircle,
  Loader2,
  Terminal
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';
import './App.css';
import { Inspector, InspectorTab } from './components/Inspector';
import { DebugConsole } from './components/DebugConsole';

interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
}

export interface Badge {
  emoji: string;
  short: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
  description: string;
}

export interface Asset {
  id: number;
  url: string;
  method: string;
  status: string;
  status_code: number;
  risk_score: number;
  findings: Badge[];
  folder_id: number;
  response_headers: string;
  response_body: string;
  request_headers: string;
  request_body: string;
  created_at: string;
  updated_at: string;
  notes: string;
  triage_status: string;
}

interface ShadowApiAsset {
  id: number;
  url: string;
  method: string;
  risk_level: string;
}

interface ShadowApiReport {
  spec_title: string;
  spec_version: string;
  total_endpoints: number;
  total_assets_checked: number;
  documented_count: number;
  shadow_api_count: number;
  shadow_apis: ShadowApiAsset[];
}


interface TreeNode {
  name: string;
  path: string;
  children: { [key: string]: TreeNode };
  assetIds: number[];
}

const RenderTreeNode = ({ 
    node, 
    level = 0, 
    selectedTreePath, 
    onSelect 
}: { 
    node: TreeNode, 
    level?: number, 
    selectedTreePath: string | null,
    onSelect: (path: string) => void
}) => {
    const hasChildren = Object.keys(node.children).length > 0;
    const [isExpanded, setIsExpanded] = useState(false);
    
    return (
      <div style={{ marginLeft: level > 0 ? '8px' : '0', borderLeft: level > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
        <div 
            className={`nav-item ${selectedTreePath === node.path ? 'active' : ''}`}
            style={{ 
                padding: '4px 8px', 
                fontSize: '11px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px',
                cursor: 'pointer',
                borderRadius: '4px',
                margin: '1px 8px 1px 0',
                background: selectedTreePath === node.path ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
            }}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(node.path);
                if (hasChildren) setIsExpanded(!isExpanded);
            }}
        >
            {hasChildren ? (
                <ChevronRight size={10} style={{ opacity: 0.5, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            ) : <div style={{width: 10}} />}
            <span style={{ opacity: selectedTreePath === node.path ? 1 : 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {node.name}
            </span>
            <span style={{marginLeft: 'auto', fontSize: '9px', opacity: 0.4}}>{node.assetIds.length}</span>
        </div>
        {isExpanded && hasChildren && (
            <div style={{ paddingLeft: '4px' }}>
                {Object.values(node.children).map(child => (
                    <RenderTreeNode 
                        key={child.path} 
                        node={child} 
                        level={level + 1} 
                        selectedTreePath={selectedTreePath}
                        onSelect={onSelect}
                    />
                ))}
            </div>
        )}
      </div>
    );
};

const RenderFolder = ({ 
    folder, 
    folders, 
    activeFolderId, 
    onSelect, 
    onAddSubfolder, 
    onMoveAssets 
}: { 
    folder: Folder, 
    folders: Folder[], 
    activeFolderId: number | null, 
    onSelect: (id: number) => void,
    onAddSubfolder: (id: number) => void,
    onMoveAssets: (id: number) => void
}) => {
    const subfolders = folders.filter(f => f.parent_id === folder.id);
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div style={{ marginLeft: folder.parent_id ? '8px' : '0', borderLeft: folder.parent_id ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
            <div 
                className={`nav-item ${activeFolderId === folder.id ? 'active' : ''}`} 
                style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px', margin: '1px 8px 1px 0' }}
                onClick={() => { onSelect(folder.id); setIsExpanded(!isExpanded); }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); onMoveAssets(folder.id); }}
            >
                {subfolders.length > 0 ? (
                     <ChevronRight size={10} style={{ opacity: 0.5, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                ) : <div style={{width: 10}} />}
                <FolderIcon size={14} style={{ opacity: 0.7 }} /> {folder.name}
                <div 
                    title="Add Subfolder"
                    style={{ marginLeft: 'auto', opacity: 0.3, cursor: 'pointer', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                    onClick={(e) => { e.stopPropagation(); onAddSubfolder(folder.id); }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.3'}
                >+</div>
            </div>
            {isExpanded && subfolders.map(sf => (
                <RenderFolder 
                    key={sf.id} 
                    folder={sf} 
                    folders={folders} 
                    activeFolderId={activeFolderId} 
                    onSelect={onSelect}
                    onAddSubfolder={onAddSubfolder}
                    onMoveAssets={onMoveAssets}
                />
            ))}
        </div>
    );
};

function App() {
  const [activeView, setActiveView] = useState<'dashboard' | 'workbench' | 'assets' | 'settings'>('assets');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [folders, setFolders] = useState<Folder[]>([{ id: 1, name: 'Default', parent_id: null }]);
  const [activeFolderId, setActiveFolderId] = useState<number | null>(1);
  const [selectedTreePath, setSelectedTreePath] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [workbenchIds, setWorkbenchIds] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMethod, setFilterMethod] = useState<string>('All');
  const { info, error, success } = useDebugLogger();
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterRisk, setFilterRisk] = useState<number>(0);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(['url', 'detections', 'status', 'method', 'risk']));
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Asset, direction: 'asc' | 'desc' } | null>(null);
  const [lastClickedId, setLastClickedId] = useState<number | null>(null);
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>('Summary');
  const [bodySearchTerm, setBodySearchTerm] = useState('');
  const [decodedJwt, setDecodedJwt] = useState<any[] | null>(null);
  const [assetSidebarView, setAssetSidebarView] = useState<'folders' | 'tree'>('tree');
  const [inspectorWidth, setInspectorWidth] = useState(400);
  const [isDebugConsoleOpen, setIsDebugConsoleOpen] = useState(false);
  
  /* LLM State is now managed via individual form fields and handleLocalDiscovery */
  const [llmTestStatus, setLlmTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [llmTestMessage, setLlmTestMessage] = useState('');
  const [localModelReady, setLocalModelReady] = useState<boolean | null>(null);
  const [pullingModel, setPullingModel] = useState(false);
  
  // LLM Form State
  const [llmEngineType, setLlmEngineType] = useState<'builtin' | 'custom'>('builtin');
  const [llmFormProvider, setLlmFormProvider] = useState('local');
  const [llmFormEndpoint, setLlmFormEndpoint] = useState('');
  const [llmFormApiKey, setLlmFormApiKey] = useState('');
  const [llmFormModel, setLlmFormModel] = useState('');
  
  // Shadow API Detection State
  const [openApiSpecContent, setOpenApiSpecContent] = useState<string>('');
  const [shadowApiReport, setShadowApiReport] = useState<ShadowApiReport | null>(null);
  const [isImportingSpec, setIsImportingSpec] = useState(false);
  const [isShadowApiExpanded, setIsShadowApiExpanded] = useState(true);
  
  const isResizing = useRef(false);

  const startResizing = () => { isResizing.current = true; document.body.style.cursor = 'col-resize'; };
  const stopResizing = () => { isResizing.current = false; document.body.style.cursor = 'default'; };
  const resize = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 300 && newWidth <= 800) setInspectorWidth(newWidth);
  };

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, []);

  useEffect(() => {
    setDecodedJwt(null);
  }, [selectedIds]);


  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, id: number } | null>(null);

  const loadFolders = async () => {
    try {
        info('db', 'Loading folders from database');
        const data = await invoke<Folder[]>('get_folders');
        setFolders(data);
        success('db', `Loaded ${data.length} folders`);
    } catch (e) { 
      error('db', `Failed to load folders: ${e}`);
      console.error(e); 
    }
  };

  const loadAssets = async () => {
    try {
      info('db', 'Loading assets from database');
      const data = await invoke<Asset[]>('get_assets');
      setAssets(data);
      success('db', `Loaded ${data.length} assets`);
    } catch (e) {
      error('db', `Failed to load assets: ${e}`);
      console.error(e);
    }
  };

  useEffect(() => {
    loadAssets();
    loadFolders();
    loadLlmConfig();
    checkModelStatus();
    invoke('sanitize_database')
      .then(() => loadAssets())
      .catch(e => console.error("Sanitize failed:", e));
    let scanUpdateTimeout: any = null;
    const unlisten = listen('scan-update', () => {
        if (scanUpdateTimeout) clearTimeout(scanUpdateTimeout);
        scanUpdateTimeout = setTimeout(() => {
            loadAssets();
        }, 500); // 500ms debounce
    });
    
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);

    return () => {
        unlisten.then(f => f());
        window.removeEventListener('click', handleClick);
    };
  }, []);

  const domainTree = useMemo(() => {
    const root: { [key: string]: TreeNode } = {};
    assets.forEach(asset => {
      try {
        const url = new URL(asset.url);
        const host = url.hostname || asset.url.split('/')[2] || asset.url;
        const paths = url.pathname.split('/').filter(p => p);
        if (!root[host]) {
          root[host] = { name: host, path: host, children: {}, assetIds: [] };
        }
        let current = root[host];
        current.assetIds.push(asset.id);
        let currentPath = host;
        paths.forEach(p => {
          currentPath += '/' + p;
          if (!current.children[p]) {
            current.children[p] = { name: '/' + p, path: currentPath, children: {}, assetIds: [] };
          }
          current = current.children[p];
          current.assetIds.push(asset.id);
        });
      } catch (e) {
          const host = asset.url.split('/')[2] || asset.url;
          if (!root[host]) root[host] = { name: host, path: host, children: {}, assetIds: [] };
          root[host].assetIds.push(asset.id);
      }
    });
    return root;
  }, [assets]);

  // Filtered Assets based on Search, Folder, and Sort
  const processedAssets = useMemo(() => {
    let result = assets.filter(a => {
      const matchesSearch = a.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.findings.some(f => f.short.toLowerCase().includes(searchTerm.toLowerCase()) || f.description.toLowerCase().includes(searchTerm.toLowerCase()));
      
      if (!matchesSearch) return false;

      // New filters
      if (filterMethod !== 'All' && a.method !== filterMethod) return false;
      if (filterRisk > 0 && a.risk_score < filterRisk) return false;
      if (filterStatus !== 'All') {
          if (filterStatus === '2xx' && (a.status_code < 200 || a.status_code >= 300)) return false;
          if (filterStatus === '3xx' && (a.status_code < 300 || a.status_code >= 400)) return false;
          if (filterStatus === '4xx' && (a.status_code < 400 || a.status_code >= 500)) return false;
          if (filterStatus === '5xx' && (a.status_code < 500)) return false;
          if (filterStatus === '0' && a.status_code !== 0) return false;
      }

      if (activeView === 'assets') {
          if (selectedTreePath) {
              const pathParts = selectedTreePath.split('/');
              const host = pathParts[0];
              try {
                  const u = new URL(a.url);
                  const aHost = u.hostname || a.url.split('/')[2] || a.url;
                  if (aHost !== host) return false;
                  if (selectedTreePath === host) return true;
                  const filterPath = pathParts.slice(1).join('/');
                  const assetPath = u.pathname.split('/').filter(p => p).join('/');
                  return assetPath.startsWith(filterPath);
              } catch(e) { return a.url.includes(host); }
          }
          if (activeFolderId !== null) {
              return a.folder_id === activeFolderId;
          }
      }
      return true;
    });

    if (sortConfig) {
        result.sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return result;
  }, [assets, searchTerm, activeFolderId, selectedTreePath, sortConfig, activeView]);

  // Dashboard Stats
  const stats = useMemo(() => {
    const critical = assets.filter(a => a.status === 'Critical').length;
    const warning = assets.filter(a => a.status === 'Warning').length;
    const safe = assets.filter(a => a.status === 'Safe').length;
    
    return [
      { name: 'Critical', value: critical, color: '#ef4444' },
      { name: 'Warning', value: warning, color: '#f59e0b' },
      { name: 'Safe', value: safe, color: '#10b981' },
    ];
  }, [assets]);

  const inspectorAsset = useMemo(() => {
    if (selectedIds.size === 1) {
      const id = Array.from(selectedIds)[0];
      return assets.find(a => a.id === id) || null;
    }
    return null;
  }, [selectedIds, assets]);

  // Aggregate Workbench Stats
  const workbenchSummary = useMemo(() => {
    const workbenchAssets = assets.filter(a => workbenchIds.has(a.id));
    if (workbenchAssets.length === 0) return null;

    const totalRisk = workbenchAssets.reduce((sum, a) => sum + a.risk_score, 0);
    const avgRisk = Math.round(totalRisk / workbenchAssets.length);
    
    const criticalCount = workbenchAssets.filter(a => a.status === 'Critical').length;
    const warningCount = workbenchAssets.filter(a => a.status === 'Warning').length;
    const safeCount = workbenchAssets.filter(a => a.status === 'Safe').length;

    const allFindings = new Map<string, Badge>();
    workbenchAssets.forEach(a => {
        a.findings.forEach(f => allFindings.set(f.short, f));
    });

    return {
        count: workbenchAssets.length,
        avgRisk,
        criticalCount,
        warningCount,
        safeCount,
        findings: Array.from(allFindings.values())
    };
  }, [assets, workbenchIds]);
  
  // Automatic Auditor: Periodically scan pending/old assets
  useEffect(() => {
    const auditor = setInterval(async () => {
      // Logic for background scan: Picks an asset that needs re-evaluation
      // Status 'FAIL' (code 0) or random assets are priority at first.
      setAssets(currentAssets => {
        if (currentAssets.length > 0) {
          const target = currentAssets.find(a => a.status_code === 0) 
            || currentAssets[Math.floor(Math.random() * currentAssets.length)];
          if (target) {
            console.log("Automatic Auditor: Refreshing asset", target.url);
            invoke('rescan_asset', { id: target.id }).catch(console.error);
          }
        }
        return currentAssets;
      });
    }, 45000); // Audit every 45s
    return () => clearInterval(auditor);
  }, []);

  // Global Drag & Drop logic
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = async (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer?.files?.length) {
            setIsImportModalOpen(true);
            for (const file of Array.from(e.dataTransfer.files)) {
                await handleImport(await file.text());
            }
            setIsImportModalOpen(false);
        }
    };
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
        window.removeEventListener('dragover', handleDragOver);
        window.removeEventListener('drop', handleDrop);
    };
  }, []);

  const handleImport = async (content: string) => {
    try {
      info('scanner', "Starting import for content length:", content.length);
      const importedIds = await invoke<number[]>('import_assets', { content });
      success('scanner', `Successfully imported ${importedIds.length} assets`);
      
      // Automatically add to workbench
      setWorkbenchIds(prev => {
          const next = new Set(prev);
          importedIds.forEach(id => next.add(id));
          return next;
      });

      await loadAssets();
      setIsImportModalOpen(false);
      setImportText('');
    } catch (e) { 
        error('scanner', `Import failed: ${e}`);
        console.error("Import failed:", e); 
        alert("Import failed. Check console for details.");
    }
  };

  const handleDelete = async (ids?: number[]) => {
    const idsToDelete = ids || Array.from(selectedIds);
    if (idsToDelete.length === 0) return;
    
    if (confirm(`Delete ${idsToDelete.length} assets?`)) {
      for (const id of idsToDelete) await invoke('delete_asset', { id });
      const newSelected = new Set(selectedIds);
      idsToDelete.forEach(id => newSelected.delete(id));
      setSelectedIds(newSelected);
      loadAssets();
    }
  };

  const handleRescan = async (id?: number) => {
    const idsToRescan = id ? [id] : (selectedIds.size > 0 ? Array.from(selectedIds) : (lastClickedId ? [lastClickedId] : []));
    info('scanner', `Starting rescan of ${idsToRescan.length} assets`);
    for (const rescanId of idsToRescan) {
        try {
            await invoke('rescan_asset', { id: rescanId });
            success('scanner', `Successfully initiated rescan for asset ${rescanId}`);
        } catch (e) {
            error('scanner', `Failed to rescan asset ${rescanId}: ${e}`);
        }
    }
  };

  const handleClearDB = async () => {
    if (confirm("Permanently delete ALL assets? This cannot be undone.")) {
        await invoke('clear_database');
        loadAssets();
    }
  };

  const handleAddFolder = async (parentId: number | null = null) => {
    const name = prompt("New Folder Name:");
    if (name) {
        await invoke('add_folder', { name, parent_id: parentId });
        loadFolders();
    }
  };

  const moveToFolder = async (folderId: number, ids?: number[]) => {
    const idsToMove = ids || Array.from(selectedIds);
    if (idsToMove.length === 0) return;
    
    await invoke('move_assets_to_folder', { ids: idsToMove, folderId });
    loadAssets();
  };

  // LLM Config Functions
  const loadLlmConfig = async () => {
    try {
      const config = await invoke<{
        endpoint: string;
        api_key: string;
        model: string;
        provider_type: string;
        is_configured: boolean;
      }>('get_llm_config');
      // setLlmConfig no longer needed, using engineType instead
      const isBuiltin = config.provider_type === 'local' && config.endpoint.includes('localhost');
      setLlmEngineType(isBuiltin ? 'builtin' : 'custom');
      setLlmFormProvider(config.provider_type || 'local');
      setLlmFormEndpoint(config.endpoint || '');
      setLlmFormModel(config.model || '');
      setLlmFormApiKey(''); // Don't populate API key for security
    } catch (e) {
      console.error('Failed to load LLM config:', e);
    }
  };

  const saveLlmConfig = async (config: {
    endpoint: string;
    api_key: string;
    model: string;
    provider_type: string;
  }) => {
    try {
      await invoke<{
        endpoint: string;
        model: string;
        provider_type: string;
        is_configured: boolean;
      }>('update_llm_config', config);
      // setLlmConfig no longer needed
      setLlmTestMessage('Configuration saved successfully!');
      setLlmTestStatus('success');
      setTimeout(() => setLlmTestStatus('idle'), 3000);
    } catch (e) {
      console.error('Failed to save LLM config:', e);
      setLlmTestMessage(`Failed to save: ${e}`);
      setLlmTestStatus('error');
      setTimeout(() => setLlmTestStatus('idle'), 3000);
    }
  };

  const checkModelStatus = async () => {
    try {
      const isReady = await invoke<boolean>('check_local_model_status');
      setLocalModelReady(isReady);
    } catch (e) {
      setLocalModelReady(false);
    }
  };

  const handlePullModel = async () => {
    setPullingModel(true);
    setLlmTestStatus('testing');
    setLlmTestMessage('Pulling llama3.1 from Ollama... Please wait.');
    try {
      await invoke('pull_local_model');
      setLocalModelReady(true);
      setLlmTestStatus('success');
      setLlmTestMessage('Llama 3.1 is now ready for use!');
    } catch (e) {
      setLlmTestStatus('error');
      setLlmTestMessage(`Pull failed: ${e}`);
    } finally {
      setPullingModel(false);
    }
  };

  const testLlmConnection = async () => {
    setLlmTestStatus('testing');
    setLlmTestMessage('Testing connection...');
    info('ai', 'Testing LLM connection');
    try {
      // Use a simple test with a mock finding
      const result = await invoke<{ analysis: string; provider: string }>('analyze_finding', {
        asset_url: 'https://test.example.com',
        finding_type: 'TEST_CONNECTION',
        response_body_snippet: 'Test connection snippet',
        context: null
      });
      success('ai', `LLM connection successful! Provider: ${result.provider}`);
      setLlmTestMessage(`Connection successful! Provider: ${result.provider}`);
      setLlmTestStatus('success');
      setTimeout(() => setLlmTestStatus('idle'), 5000);
    } catch (e) {
      error('ai', `LLM connection test failed: ${e}`);
      console.error('LLM connection test failed:', e);
      setLlmTestMessage(`Connection failed: ${e}`);
      setLlmTestStatus('error');
      setTimeout(() => setLlmTestStatus('idle'), 5000);
    }
  };

  const handleProviderChange = (provider: string) => {
    setLlmFormProvider(provider);
    // Set defaults based on provider
    if (provider === 'local') {
      setLlmFormEndpoint('http://localhost:11434/api/chat');
      setLlmFormModel('llama3');
    } else if (provider === 'openai') {
      setLlmFormEndpoint('https://api.openai.com/v1/chat/completions');
      setLlmFormModel('gpt-4');
    } else if (provider === 'anthropic') {
      setLlmFormEndpoint('https://api.anthropic.com/v1/messages');
      setLlmFormModel('claude-3-5-sonnet-20240620');
    } else if (provider === 'openrouter') {
      setLlmFormEndpoint('https://openrouter.ai/api/v1/chat/completions');
      setLlmFormModel('meta-llama/llama-3-8b-instruct');
      setLlmFormProvider('openai'); // OpenRouter uses OpenAI schema
    } else if (provider === 'llama-cloud') {
        setLlmFormEndpoint('https://api.llamacloud.com/v1/chat/completions');
        setLlmFormModel('llama-3-70b');
        setLlmFormProvider('openai');
    }
  };

  const handleSaveLlmConfig = () => {
    saveLlmConfig({
      endpoint: llmFormEndpoint,
      api_key: llmFormApiKey,
      model: llmFormModel,
      provider_type: llmFormProvider
    });
  };

  const handleImportOpenApiSpec = async () => {
    if (!openApiSpecContent.trim()) return;
    setIsImportingSpec(true);
    try {
      info('openapi', 'Importing OpenAPI spec and detecting shadow APIs');
      const report = await invoke<ShadowApiReport>('import_openapi_spec_and_detect_shadow_apis', {
        content: openApiSpecContent
      });
      setShadowApiReport(report);
      success('openapi', `Detected ${report.shadow_api_count} shadow APIs from spec "${report.spec_title}"`);
      // Refresh assets to show updated is_documented status
      await loadAssets();
    } catch (err) {
      error('openapi', `Failed to import OpenAPI spec: ${err}`);
      console.error('Failed to import OpenAPI spec:', err);
    } finally {
      setIsImportingSpec(false);
    }
  };

    const handleExportMarkdown = async () => {
        try {
            const report = await invoke<string>('generate_audit_report');
            const blob = new Blob([report], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `APEX_Audit_Report_${new Date().toISOString().split('T')[0]}.md`;
            a.click();
            success('export', 'Markdown report generated successfully');
        } catch (e) {
            error('export', `Failed to generate markdown report: ${e}`);
        }
    };

    const handleExportCsv = async () => {
        try {
            const csv = await invoke<string>('export_to_csv_final_v5');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `APEX_Findings_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            success('export', 'CSV findings exported successfully');
        } catch (e) {
            error('export', `Failed to export CSV findings: ${e}`);
        }
    };

    const addToWorkbench = (id?: number) => {
        setWorkbenchIds(prev => {
            const next = new Set(prev);
            if (id) {
                next.add(id);
            } else {
                selectedIds.forEach(id => next.add(id));
            }
            return next;
        });
        setContextMenu(null);
    };
  // OS-Style Multi-Select Logic
  const onMouseDown = (id: number, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      
      let nextSelection = new Set(selectedIds);

      if (e.shiftKey && lastClickedId !== null) {
          // Range Selection
          const startIdx = processedAssets.findIndex(a => a.id === lastClickedId);
          const endIdx = processedAssets.findIndex(a => a.id === id);
          if (startIdx !== -1 && endIdx !== -1) {
              const start = Math.min(startIdx, endIdx);
              const end = Math.max(startIdx, endIdx);
              // In shift-click, we replace the entire selection or add to it? 
              // Standard behavior: replace if no Ctrl, add if Ctrl. Here we replace to keep it simple.
              if (!e.ctrlKey && !e.metaKey) nextSelection.clear();
              for (let i = start; i <= end; i++) nextSelection.add(processedAssets[i].id);
          }
      } else if (e.ctrlKey || e.metaKey) {
          // Toggle Selection
          if (nextSelection.has(id)) nextSelection.delete(id);
          else nextSelection.add(id);
      } else {
          // Single Selection
          nextSelection = new Set([id]);
      }

      setSelectedIds(nextSelection);
      setLastClickedId(id);
  };


  const handleBrowse = async () => {
    try {
        const selected = await open({
            multiple: true,
            directory: false,
            defaultPath: await downloadDir(),
            filters: [{
                name: 'Data Files',
                extensions: ['json', 'csv', 'txt']
            }]
        });

        if (selected && Array.isArray(selected)) {
            for (const path of selected) {
                const content = await readTextFile(path);
                await handleImport(content);
            }
        } else if (selected) {
            const content = await readTextFile(selected);
            await handleImport(content);
        }
    } catch (e) {
        console.error(e);
    }
  };

  const getDetectionBadges = (findings: Badge[]) => {
    if (!findings || findings.length === 0) return null;

    const severityColors = {
        Critical: '#ef4444',
        High: '#f59e0b',
        Medium: '#eab308',
        Low: '#3b82f6',
        Info: '#10b981'
    };

    // Filter out status-related markers which are now in the Status column
    const securityFindings = findings.filter(f => !['Auth', '403', 'Rate', 'Open'].includes(f.short));

    return securityFindings.map((f, i) => {
        const color = severityColors[f.severity];
        return (
            <span key={i} title={`${f.short}: ${f.description}`} style={{ 
                background: `${color}15`, 
                color: color, 
                border: `1px solid ${color}30`,
                padding: '2px 6px', 
                borderRadius: '6px', 
                fontSize: '12px',
                marginRight: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'help',
                minWidth: '24px',
                height: '24px'
            }}>
                <span>{f.emoji}</span>
            </span>
        );
    });
  };

  const getStatusBadge = (code: number, findings: Badge[]) => {
    let emoji = '🌍'; // Default 2xx
    if (code === 0) emoji = '💀';
    else if (code === 401) emoji = '🔒';
    else if (code === 403) emoji = '🚫';
    else if (code === 429) emoji = '⏱️';
    else if (code >= 500) emoji = '⚠️';
    else if (findings.some(f => f.short === 'Auth')) emoji = '🔒';
    else if (findings.some(f => f.short === '403')) emoji = '🚫';
    else if (findings.some(f => f.short === 'Rate')) emoji = '⏱️';

    return (
        <span style={{ 
            color: getStatusColor(code), 
            fontWeight: 'bold',
            fontFamily: 'monospace',
            background: `${getStatusColor(code)}20`,
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
        }}>
            <span>{emoji}</span>
            {code === 0 ? 'FAIL' : code}
        </span>
    );
  };

  const handleSort = (key: keyof Asset) => {
    setSortConfig(prev => {
        if (prev?.key === key) {
            return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
        }
        return { key, direction: 'asc' };
    });
  };

  const getStatusColor = (code: number) => {
    if (code === 0) return 'var(--status-critical)';
    if (code >= 200 && code < 300) return 'var(--status-safe)';
    if (code >= 300 && code < 400) return '#3b82f6';
    if (code >= 400 && code < 500) return 'var(--status-warning)';
    if (code >= 500) return 'var(--status-critical)';
    return 'var(--text-secondary)';
  };

  const showInspector = activeView === 'workbench' || (activeView === 'assets' && selectedIds.size === 1 && false); // Hidden in assets as requested

  return (
    <div 
        className="app-container" 
        style={{ gridTemplateColumns: showInspector ? `240px 1fr 4px ${inspectorWidth}px` : '240px 1fr 0px 0px' }}
    >
       {/* Header */}
      <header className="header" style={{justifyContent: 'space-between'}}>
        <div style={{display: 'flex', alignItems: 'center'}}>
            <ShieldAlert size={18} color="var(--accent-color)" style={{marginRight: '8px'}} />
            <div className="header-title">APEX Security Auditor</div>
            <div className="menu-bar">
                <div className="menu-item" onClick={() => setIsImportModalOpen(true)}>Import Assets</div>
                <div className="menu-item" onClick={() => setActiveView('settings')}>Settings</div>
                <div className="menu-item" onClick={() => invoke('exit')}>Exit</div>
            </div>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
            <div className="search-bar" style={{display: 'flex', alignItems: 'center', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 10px'}}>
                <Search size={14} color="var(--text-secondary)" />
                <input 
                    type="text" 
                    placeholder="Search assets..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{background: 'transparent', border: 'none', color: 'white', fontSize: '12px', padding: '4px 8px', outline: 'none', width: '200px'}}
                />
            </div>
            <button 
                className="menu-item"
                onClick={() => setIsDebugConsoleOpen(!isDebugConsoleOpen)}
                style={{
                    backgroundColor: isDebugConsoleOpen ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    border: isDebugConsoleOpen ? '1px solid var(--accent-color)' : 'none',
                    borderRadius: '4px',
                    padding: '4px 10px'
                }}
            >
                <Terminal size={14} style={{marginRight: '4px'}} />
                Debug Console
            </button>
        </div>
      </header>

      {/* Sidebar */}
      <nav className="sidebar">
        <div className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveView('dashboard')}>
          <LayoutDashboard size={18} /> Dashboard
        </div>
        <div className={`nav-item ${activeView === 'workbench' ? 'active' : ''}`} onClick={() => setActiveView('workbench')}>
          <FileCode size={18} /> Workbench
          <span style={{marginLeft: 'auto', fontSize: '10px', background: 'var(--border-color)', padding: '2px 6px', borderRadius: '10px'}}>{workbenchIds.size}</span>
        </div>
        <div className={`nav-item ${activeView === 'assets' ? 'active' : ''}`} onClick={() => setActiveView('assets')}>
          <DbIcon size={18} /> Assets
        </div>

        <div className={`nav-item ${activeView === 'settings' ? 'active' : ''}`} onClick={() => setActiveView('settings')}>
          <Settings size={18} /> Settings
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        {activeView === 'assets' && (
             <div style={{ display: 'flex', height: '100%', gap: '20px' }}>
                 {/* Internal Asset Sidebar */}
                 <div style={{ width: '220px', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)', paddingRight: '16px' }}>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                        <button 
                            onClick={() => { setAssetSidebarView('tree'); setActiveFolderId(null); setSelectedTreePath(null); }}
                            className="menu-item"
                            style={{ 
                                flex: 1, padding: '4px', fontSize: '9px', textTransform: 'uppercase',
                                background: assetSidebarView === 'tree' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                border: `1px solid ${assetSidebarView === 'tree' ? 'var(--accent-color)' : 'var(--border-color)'}`,
                                color: assetSidebarView === 'tree' ? 'white' : 'var(--text-secondary)',
                                borderRadius: '4px'
                            }}
                        >Tree</button>
                        <button 
                            onClick={() => { setAssetSidebarView('folders'); setSelectedTreePath(null); }}
                            className="menu-item"
                            style={{ 
                                flex: 1, padding: '4px', fontSize: '9px', textTransform: 'uppercase',
                                background: assetSidebarView === 'folders' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                border: `1px solid ${assetSidebarView === 'folders' ? 'var(--accent-color)' : 'var(--border-color)'}`,
                                color: assetSidebarView === 'folders' ? 'white' : 'var(--text-secondary)',
                                borderRadius: '4px'
                            }}
                        >Folders</button>
                    </div>

                    <div style={{ flex: 1, overflow: 'auto' }}>
                        {assetSidebarView === 'folders' ? (
                            <div style={{ paddingLeft: '4px' }}>
                                {folders.filter(f => !f.parent_id).map(f => (
                                    <RenderFolder 
                                        key={f.id} 
                                        folder={f} 
                                        folders={folders} 
                                        activeFolderId={activeFolderId} 
                                        onSelect={(id) => { setActiveFolderId(id); setSelectedTreePath(null); }}
                                        onAddSubfolder={(id) => handleAddFolder(id)}
                                        onMoveAssets={(id) => moveToFolder(id)}
                                    />
                                ))}
                                <div className="menu-item" style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '8px' }} onClick={() => handleAddFolder()}>
                                    + New Folder
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
                 </div>

                 <div className="table-container" style={{ flex: 1 }}>
                 {/* Filter Bar */}
                 <div style={{ padding: '8px 16px', display: 'flex', gap: '16px', alignItems: 'center', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-sidebar)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                         <span>Method:</span>
                         <select 
                            value={filterMethod} 
                            onChange={e => setFilterMethod(e.target.value)}
                            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px', padding: '2px 4px', fontSize: '11px' }}
                         >
                             <option value="All">All</option>
                             <option value="GET">GET</option>
                             <option value="POST">POST</option>
                             <option value="PUT">PUT</option>
                             <option value="DELETE">DELETE</option>
                             <option value="PATCH">PATCH</option>
                         </select>
                     </div>

                     <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                         <span>Status:</span>
                         <select 
                            value={filterStatus} 
                            onChange={e => setFilterStatus(e.target.value)}
                            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px', padding: '2px 4px', fontSize: '11px' }}
                         >
                             <option value="All">All</option>
                             <option value="2xx">Success (2xx)</option>
                             <option value="3xx">Redirect (3xx)</option>
                             <option value="4xx">Client Err (4xx)</option>
                             <option value="5xx">Server Err (5xx)</option>
                             <option value="0">Unreachable (0)</option>
                         </select>
                     </div>

                     <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                         <span>Min Risk:</span>
                         <input 
                            type="range" 
                            min="0" max="100" step="10"
                            value={filterRisk} 
                            onChange={e => setFilterRisk(parseInt(e.target.value))}
                            style={{ width: '80px', height: '4px' }}
                         />
                         <span style={{ minWidth: '20px' }}>{filterRisk}</span>
                     </div>

                     <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                         <div style={{ display: 'flex', gap: '4px', borderRight: '1px solid var(--border-color)', paddingRight: '12px', marginRight: '4px' }}>
                             {['method', 'status', 'risk', 'detections'].map(col => (
                                 <button 
                                    key={col}
                                    onClick={() => setVisibleColumns(prev => {
                                        const next = new Set(prev);
                                        if (next.has(col)) next.delete(col); else next.add(col);
                                        return next;
                                    })}
                                    style={{ 
                                        padding: '2px 6px', 
                                        fontSize: '9px', 
                                        textTransform: 'uppercase',
                                        background: visibleColumns.has(col) ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                        border: `1px solid ${visibleColumns.has(col) ? 'var(--accent-color)' : 'var(--border-color)'}`,
                                        color: visibleColumns.has(col) ? 'white' : 'var(--text-secondary)',
                                        borderRadius: '3px',
                                        cursor: 'pointer'
                                    }}
                                 >{col}</button>
                             ))}
                         </div>
                         <button 
                            className="menu-item" 
                            style={{ padding: '2px 8px', fontSize: '10px' }}
                            onClick={() => { setFilterMethod('All'); setFilterStatus('All'); setFilterRisk(0); setSearchTerm(''); }}
                         >Reset Filters</button>
                     </div>
                 </div>
                 <div style={{ flex: 1, overflow: 'auto', position: 'relative', minHeight: 0 }}>
                    <table className="asset-table">
                   <thead>
                     <tr>
                       {visibleColumns.has('url') && <th className="col-url" style={{cursor: 'pointer'}} onClick={() => handleSort('url')}>URL Path</th>}
                       {visibleColumns.has('method') && <th style={{ width: '80px', cursor: 'pointer' }} onClick={() => handleSort('method')}>Method</th>}
                       {visibleColumns.has('detections') && (
                           <th className="col-detections">
                               <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                   Detections
                                   <div title="Legend: 🔒 Auth, 👤 PII, 💳 PCI, 📜 Docs, 🧪 API" style={{ cursor: 'help', opacity: 0.5 }}>
                                       <Info size={12} />
                                   </div>
                               </div>
                           </th>
                       )}
                       {visibleColumns.has('status') && <th className="col-status-code" style={{cursor: 'pointer'}} onClick={() => handleSort('status_code')}>Status</th>}
                       {visibleColumns.has('risk') && <th style={{ width: '80px', cursor: 'pointer' }} onClick={() => handleSort('risk_score')}>Risk</th>}
                     </tr>
                   </thead>
                   <tbody>
                     {processedAssets.map(asset => (
                       <tr 
                        key={asset.id} 
                        className={`asset-row ${selectedIds.has(asset.id) ? 'selected' : ''}`}
                        onMouseDown={(e) => onMouseDown(asset.id, e)}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            if (!selectedIds.has(asset.id)) {
                                setSelectedIds(new Set([asset.id]));
                                setLastClickedId(asset.id);
                            }
                            setContextMenu({ x: e.clientX, y: e.clientY, id: asset.id });
                        }}
                       >
                         {visibleColumns.has('url') && <td title={asset.url}>{asset.url}</td>}
                         {visibleColumns.has('method') && (
                             <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--accent-color)', fontSize: '11px' }}>{asset.method}</td>
                         )}
                         {visibleColumns.has('detections') && <td>{getDetectionBadges(asset.findings)}</td>}
                          {visibleColumns.has('status') && (
                              <td>
                                 {getStatusBadge(asset.status_code, asset.findings)}
                              </td>
                          )}
                         {visibleColumns.has('risk') && (
                             <td style={{ textAlign: 'center' }}>
                                 <span style={{ 
                                     color: asset.risk_score > 70 ? 'var(--status-critical)' : asset.risk_score > 30 ? 'var(--status-warning)' : 'var(--status-safe)',
                                     fontWeight: 'bold'
                                 }}>{asset.risk_score}</span>
                             </td>
                         )}
                       </tr>
                     ))}
                   </tbody>
                  </table>
                 </div>

                  {/* Sticky Bulk Action Bar */}
                  {selectedIds.size > 1 && (
                      <div style={{ 
                          position: 'absolute', 
                          bottom: '32px', 
                          left: '50%', 
                          transform: 'translateX(-50%)',
                          background: 'var(--bg-sidebar)',
                          border: '1px solid var(--accent-color)',
                          borderRadius: '8px',
                          padding: '12px 24px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '20px',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                          zIndex: 100,
                          animation: 'slideUp 0.3s ease-out'
                      }}>
                          <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--accent-color)', borderRight: '1px solid var(--border-color)', paddingRight: '20px' }}>
                              {selectedIds.size} Assets Selected
                          </div>
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                               <FolderIcon size={14} color="var(--accent-color)" />
                               <select 
                                   onChange={(e) => moveToFolder(Number(e.target.value))}
                                   style={{ 
                                       background: 'transparent', 
                                       border: 'none', 
                                       color: 'white', 
                                       fontSize: '11px', 
                                       fontWeight: 'bold',
                                       cursor: 'pointer',
                                       outline: 'none',
                                       padding: '4px'
                                   }}
                                   value=""
                               >
                                   <option value="" disabled>Move to Folder...</option>
                                   {folders.map(f => (
                                       <option key={f.id} value={f.id} style={{background: 'var(--bg-sidebar)', color: 'white'}}>{f.name}</option>
                                   ))}
                               </select>
                           </div>
                          <button 
                             onClick={() => addToWorkbench()}
                             className="menu-item"
                             style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}
                          >
                              <FileCode size={14} /> Send to Workbench
                          </button>
                          <button 
                             onClick={() => handleDelete()}
                             className="menu-item delete"
                             style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--status-critical)' }}
                          >
                              <Trash2 size={14} /> Delete Selected
                          </button>
                          <button 
                             onClick={() => setSelectedIds(new Set())}
                             style={{ padding: '4px', opacity: 0.5, cursor: 'pointer', background: 'transparent', border: 'none', color: 'white' }}
                          >
                              <X size={16} />
                          </button>
                      </div>
                  )}
              </div>
            </div>
        )}
        
        {activeView === 'dashboard' && (
            <div style={{padding: '20px'}}>
                <div style={{display: 'flex', gap: '20px', marginBottom: '30px'}}>
                    <div className="risk-dashboard-mini" style={{flex: 1, padding: '24px'}}>
                        <div style={{color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '8px'}}>TOTAL ASSETS</div>
                        <div style={{fontSize: '32px', fontWeight: 'bold'}}>{assets.length}</div>
                        <div style={{color: 'var(--status-safe)', fontSize: '11px', marginTop: '8px', display: 'flex', alignItems: 'center'}}><Activity size={12} style={{marginRight: '4px'}}/> Active Scanning</div>
                    </div>
                    <div className="risk-dashboard-mini" style={{flex: 1, padding: '24px'}}>
                        <div style={{color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '8px'}}>CRITICAL RISKS</div>
                        <div style={{fontSize: '32px', fontWeight: 'bold', color: 'var(--status-critical)'}}>{assets.filter(a => a.status === 'Critical').length}</div>
                        <div style={{color: 'var(--text-secondary)', fontSize: '11px', marginTop: '8px'}}>Requires immediate attention</div>
                    </div>
                </div>

                <div style={{display: 'flex', gap: '20px', height: '300px'}}>
                    <div className="risk-dashboard-mini" style={{flex: 2, padding: '20px'}}>
                        <h4 style={{marginBottom: '20px', fontSize: '14px'}}>Risk Distribution</h4>
                        <ResponsiveContainer width="100%" height="85%">
                            <BarChart data={stats}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} />
                                <YAxis stroke="#a1a1aa" fontSize={12} />
                                <Tooltip contentStyle={{background: 'var(--bg-secondary)', border: '1px solid var(--border-color)'}} />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                    {stats.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="risk-dashboard-mini" style={{flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                         <h4 style={{width: '100%', fontSize: '14px', marginBottom: '10px'}}>Health Score</h4>
                         <ResponsiveContainer width="100%" height="100%">
                             <PieChart>
                                 <Pie data={stats} dataKey="value" innerRadius={60} outerRadius={80} paddingAngle={5}>
                                     {stats.map((entry, index) => <Cell key={`cell-pie-${index}`} fill={entry.color} />)}
                                 </Pie>
                             </PieChart>
                         </ResponsiveContainer>
                    </div>
                </div>
            </div>
        )}

        {activeView === 'workbench' && (
            <div style={{height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0}}>
                <div style={{padding: '10px 0', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0}}>
                    <h3 style={{margin: 0}}>Scanning Workbench ({workbenchIds.size})</h3>
                    <div style={{display: 'flex', gap: '8px'}}>
                        <button 
                            onClick={handleExportMarkdown} 
                            className="menu-item"
                            title="Generate a detailed Markdown report of suspect assets"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--accent-color)' }}
                        >
                            <FileCode size={14} color="var(--accent-color)" /> Generate Audit Report (MD)
                        </button>
                        <button 
                            onClick={handleExportCsv} 
                            className="menu-item"
                            title="Export suspect findings as CSV"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                        >
                            <DbIcon size={14} /> Export CSV
                        </button>
                        <button onClick={() => setWorkbenchIds(new Set())} className="menu-item" style={{ fontSize: '11px', color: 'var(--status-critical)' }}>Clear Session</button>
                    </div>
                </div>
                <div className="table-container" style={{flex: 1, marginTop: '20px'}}>
                    {workbenchIds.size === 0 ? (
                        <div style={{textAlign: 'center', marginTop: '100px', color: 'var(--text-secondary)'}}>
                             <FileCode size={48} style={{opacity: 0.2, marginBottom: '16px'}} />
                             <p>Your workbench is empty. <br/> Add assets from the Assets table to start a deep scan session.</p>
                        </div>
                    ) : (
                        <div style={{ flex: 1, overflow: 'auto', position: 'relative', minHeight: 0 }}>
                            <table className="asset-table">
                                <thead>
                                    <tr>
                                        <th className="col-url">URL Path</th>
                                        <th className="col-detections">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                Detections
                                                <div title="Legend: 🔒 Auth, 👤 PII, 💳 PCI, ⚖️ Legal, 🏥 Health, 🆔 IDOR, 🐚 Cmd" style={{ cursor: 'help', opacity: 0.5 }}>
                                                    <Info size={12} />
                                                </div>
                                            </div>
                                        </th>
                                        <th className="col-status-code">Status</th>
                                        <th className="col-method">Method</th>
                                        <th style={{width: '60px'}}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {assets.filter(a => workbenchIds.has(a.id)).map(asset => (
                                        <tr 
                                            key={asset.id} 
                                            className={`asset-row ${selectedIds.has(asset.id) ? 'selected' : ''}`}
                                            onMouseDown={(e) => onMouseDown(asset.id, e)}
                                        >
                                            <td title={asset.url}>{asset.url}</td>
                                            <td>{getDetectionBadges(asset.findings)}</td>
                                            <td>{getStatusBadge(asset.status_code, asset.findings)}</td>
                                            <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--accent-color)', fontSize: '11px' }}>{asset.method}</td>
                                            <td style={{textAlign: 'right'}}>
                                                <button 
                                                    onClick={() => setWorkbenchIds(prev => { const n = new Set(prev); n.delete(asset.id); return n; })} 
                                                    style={{background: 'transparent', border: 'none', color: 'var(--status-critical)', cursor: 'pointer', padding: '4px'}}
                                                    title="Remove from workbench"
                                                >
                                                    <Trash2 size={14}/>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                  </div>
                    )}
                </div>
            </div>
        )}

        {activeView === 'settings' && (
            <div style={{padding: '40px', maxWidth: '700px'}}>
                <h2>Application Settings</h2>
                
                {/* LLM Settings Section */}
                <div className="risk-dashboard-mini" style={{borderLeft: '4px solid var(--accent-color)', padding: '24px'}}>
                    <h3 style={{marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px'}}><Bot size={20}/> AI Intelligence Center</h3>
                    
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'var(--bg-primary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <button 
                            onClick={() => {
                                setLlmEngineType('builtin');
                                handleProviderChange('local');
                            }}
                            style={{ 
                                flex: 1, padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                                background: llmEngineType === 'builtin' ? 'var(--accent-color)' : 'transparent',
                                color: llmEngineType === 'builtin' ? 'white' : 'var(--text-secondary)',
                                border: 'none', transition: 'all 0.2s'
                            }}
                        >Built-in (Zero-Config)</button>
                        <button 
                            onClick={() => setLlmEngineType('custom')}
                            style={{ 
                                flex: 1, padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                                background: llmEngineType === 'custom' ? 'var(--accent-color)' : 'transparent',
                                color: llmEngineType === 'custom' ? 'white' : 'var(--text-secondary)',
                                border: 'none', transition: 'all 0.2s'
                            }}
                        >Custom API</button>
                    </div>

                    {llmEngineType === 'builtin' ? (
                        <div style={{ background: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '40px', height: '40px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Activity size={20} color="var(--status-safe)" />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>Local Engine (Ollama)</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            {localModelReady === null ? 'Checking model status...' : localModelReady ? 'Llama 3.1 Ready' : 'Model llama3.1 Missing'}
                                        </div>
                                    </div>
                                </div>
                                {localModelReady === false && (
                                    <button 
                                        onClick={handlePullModel}
                                        disabled={pullingModel}
                                        style={{
                                            padding: '6px 12px', background: 'var(--accent-color)', border: 'none', borderRadius: '4px', color: 'white', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer'
                                        }}
                                    >
                                        {pullingModel ? 'Downloading...' : 'Initialize AI (4.7GB)'}
                                    </button>
                                )}
                            </div>
                            <p style={{ fontSize: '12px', opacity: 0.7, lineHeight: '1.5' }}>
                                {localModelReady === false 
                                    ? "Llama 3.1 (8B) is required for local security audits. Click 'Initialize' to download it via Ollama."
                                    : "The Built-in engine uses your local Ollama instance. All data stays private on your machine."}
                            </p>
                            <button 
                                onClick={handleSaveLlmConfig}
                                style={{
                                    marginTop: '8px', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
                                }}
                            >Reset to Local Defaults</button>
                        </div>
                    ) : (
                        <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                            {/* Provider Preset Picker */}
                            <div>
                                <label style={{display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 'bold'}}>Preset Provider</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {[
                                        { id: 'openai', name: 'OpenAI' },
                                        { id: 'openrouter', name: 'OpenRouter' },
                                        { id: 'anthropic', name: 'Anthropic' },
                                        { id: 'llama-cloud', name: 'LlamaCloud' },
                                        { id: 'local', name: 'Other Local' }
                                    ].map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => handleProviderChange(p.id)}
                                            style={{
                                                padding: '6px 12px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer',
                                                background: llmFormProvider === p.id || (p.id === 'openrouter' && llmFormEndpoint.includes('openrouter')) ? 'var(--accent-color)' : 'var(--bg-primary)',
                                                border: '1px solid var(--border-color)',
                                                color: 'white'
                                            }}
                                        >{p.name}</button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 'bold'}}>Endpoint URL</label>
                                    <input 
                                        type="text"
                                        value={llmFormEndpoint}
                                        onChange={(e) => setLlmFormEndpoint(e.target.value)}
                                        style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', fontSize: '13px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 'bold'}}>Model ID</label>
                                    <input 
                                        type="text"
                                        value={llmFormModel}
                                        onChange={(e) => setLlmFormModel(e.target.value)}
                                        style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', fontSize: '13px' }}
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label style={{display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 'bold'}}>API Key</label>
                                <input 
                                    type="password"
                                    value={llmFormApiKey}
                                    onChange={(e) => setLlmFormApiKey(e.target.value)}
                                    placeholder="sk-..."
                                    style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', fontSize: '13px' }}
                                />
                            </div>

                            <div style={{display: 'flex', gap: '12px'}}>
                                <button onClick={handleSaveLlmConfig} style={{ flex: 1, padding: '12px', background: 'var(--accent-color)', border: 'none', borderRadius: '6px', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <CheckCircle size={16} /> Save custom API
                                </button>
                                <button onClick={testLlmConnection} style={{ flex: 1, padding: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <Bot size={16} /> Test Connection
                                </button>
                            </div>
                        </div>
                    )}

                    {llmTestStatus !== 'idle' && (
                        <div style={{
                            marginTop: '16px', padding: '10px', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px',
                            background: llmTestStatus === 'success' ? 'rgba(16, 185, 129, 0.1)' : llmTestStatus === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-primary)',
                            color: llmTestStatus === 'success' ? 'var(--status-safe)' : llmTestStatus === 'error' ? 'var(--status-critical)' : 'white'
                        }}>
                             {llmTestStatus === 'testing' ? <Loader2 size={14} className="spin"/> : llmTestStatus === 'success' ? <CheckCircle size={14}/> : <XCircle size={14}/>}
                             {llmTestMessage}
                        </div>
                    )}
                </div>
                
                {/* Shadow API Detection Section */}
                <div className="risk-dashboard-mini" style={{marginTop: '30px', borderLeft: '4px solid var(--status-warning)', padding: '24px'}}>
                    <div 
                        style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: isShadowApiExpanded ? '16px' : '0'}}
                        onClick={() => setIsShadowApiExpanded(!isShadowApiExpanded)}
                    >
                        <h3 style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <ShieldAlert size={20} color="var(--status-warning)"/> Shadow API Detection
                        </h3>
                        <ChevronRight 
                            size={18} 
                            style={{opacity: 0.5, transform: isShadowApiExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s'}} 
                        />
                    </div>
                    
                    {isShadowApiExpanded && (
                        <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                            <p style={{fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                                Import an OpenAPI specification (JSON or YAML) to compare against your discovered assets. 
                                Endpoints found in your assets but not in the spec will be flagged as Shadow APIs.
                            </p>
                            
                            <div>
                                <label style={{display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 'bold'}}>
                                    OpenAPI Spec Content (JSON or YAML)
                                </label>
                                <textarea 
                                    value={openApiSpecContent}
                                    onChange={(e) => setOpenApiSpecContent(e.target.value)}
                                    placeholder="Paste your OpenAPI/Swagger spec here (JSON or YAML format)..."
                                    style={{
                                        width: '100%',
                                        height: '150px',
                                        padding: '12px',
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '6px',
                                        color: 'white',
                                        fontSize: '12px',
                                        fontFamily: 'monospace',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>
                            
                            <div style={{display: 'flex', gap: '12px'}}>
                                <button 
                                    onClick={handleImportOpenApiSpec}
                                    disabled={isImportingSpec || !openApiSpecContent.trim()}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        background: isImportingSpec || !openApiSpecContent.trim() ? 'var(--bg-secondary)' : 'var(--status-warning)',
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        cursor: isImportingSpec || !openApiSpecContent.trim() ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        opacity: isImportingSpec || !openApiSpecContent.trim() ? 0.6 : 1
                                    }}
                                >
                                    {isImportingSpec ? <Loader2 size={16} className="spin"/> : <FileCode size={16} />}
                                    {isImportingSpec ? 'Analyzing...' : 'Detect Shadow APIs'}
                                </button>
                            </div>
                            
                            {/* Shadow API Report Results */}
                            {shadowApiReport && (
                                <div style={{
                                    marginTop: '16px',
                                    padding: '16px',
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px'
                                }}>
                                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px'}}>
                                        <Info size={16} color="var(--accent-color)" />
                                        <span style={{fontWeight: 'bold', fontSize: '14px'}}>
                                            Report: {shadowApiReport.spec_title} (v{shadowApiReport.spec_version})
                                        </span>
                                    </div>
                                    
                                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px'}}>
                                        <div style={{padding: '12px', background: 'var(--bg-secondary)', borderRadius: '6px'}}>
                                            <div style={{fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase'}}>Total Endpoints in Spec</div>
                                            <div style={{fontSize: '24px', fontWeight: 'bold'}}>{shadowApiReport.total_endpoints}</div>
                                        </div>
                                        <div style={{padding: '12px', background: 'var(--bg-secondary)', borderRadius: '6px'}}>
                                            <div style={{fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase'}}>Assets Checked</div>
                                            <div style={{fontSize: '24px', fontWeight: 'bold'}}>{shadowApiReport.total_assets_checked}</div>
                                        </div>
                                        <div style={{padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)'}}>
                                            <div style={{fontSize: '11px', color: 'var(--status-safe)', textTransform: 'uppercase'}}>Documented APIs</div>
                                            <div style={{fontSize: '24px', fontWeight: 'bold', color: 'var(--status-safe)'}}>{shadowApiReport.documented_count}</div>
                                        </div>
                                        <div style={{padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.3)'}}>
                                            <div style={{fontSize: '11px', color: 'var(--status-critical)', textTransform: 'uppercase'}}>Shadow APIs</div>
                                            <div style={{fontSize: '24px', fontWeight: 'bold', color: 'var(--status-critical)'}}>{shadowApiReport.shadow_api_count}</div>
                                        </div>
                                    </div>
                                    
                                    {/* Shadow API List */}
                                    {shadowApiReport.shadow_apis.length > 0 && (
                                        <div>
                                            <h4 style={{fontSize: '12px', color: 'var(--status-critical)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                                                <ShieldAlert size={14} /> Detected Shadow APIs
                                            </h4>
                                            <div style={{maxHeight: '200px', overflowY: 'auto'}}>
                                                {shadowApiReport.shadow_apis.map((api, index) => (
                                                    <div 
                                                        key={api.id || index}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            padding: '8px 12px',
                                                            background: 'var(--bg-secondary)',
                                                            borderRadius: '4px',
                                                            marginBottom: '4px',
                                                            fontSize: '12px'
                                                        }}
                                                    >
                                                        <span style={{
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            fontSize: '10px',
                                                            fontWeight: 'bold',
                                                            background: api.method === 'GET' ? 'rgba(16, 185, 129, 0.2)' : 
                                                                       api.method === 'POST' ? 'rgba(59, 130, 246, 0.2)' :
                                                                       api.method === 'PUT' ? 'rgba(245, 158, 11, 0.2)' :
                                                                       api.method === 'DELETE' ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-primary)',
                                                            color: api.method === 'GET' ? 'var(--status-safe)' :
                                                                   api.method === 'POST' ? 'var(--accent-color)' :
                                                                   api.method === 'PUT' ? 'var(--status-warning)' :
                                                                   api.method === 'DELETE' ? 'var(--status-critical)' : 'white'
                                                        }}>
                                                            {api.method}
                                                        </span>
                                                        <span style={{flex: 1, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                                                            {api.url}
                                                        </span>
                                                        <span style={{
                                                            padding: '2px 8px',
                                                            borderRadius: '4px',
                                                            fontSize: '10px',
                                                            fontWeight: 'bold',
                                                            background: 'rgba(239, 68, 68, 0.2)',
                                                            color: 'var(--status-critical)'
                                                        }}>
                                                            SHADOW API
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {shadowApiReport.shadow_apis.length === 0 && (
                                        <div style={{
                                            padding: '16px',
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            borderRadius: '6px',
                                            textAlign: 'center',
                                            color: 'var(--status-safe)'
                                        }}>
                                            <CheckCircle size={24} style={{marginBottom: '8px'}} />
                                            <div style={{fontWeight: 'bold'}}>No Shadow APIs Detected</div>
                                            <div style={{fontSize: '12px', opacity: 0.8}}>All discovered endpoints are documented in the spec.</div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Danger Zone */}
                <div className="risk-dashboard-mini" style={{marginTop: '30px', border: '1px solid var(--status-critical)'}}>
                    <h4 style={{color: 'var(--status-critical)'}}>Danger Zone</h4>
                    <p style={{fontSize: '12px', color: 'var(--text-secondary)', margin: '10px 0'}}>These actions are permanent and cannot be undone.</p>
                    <button 
                        onClick={handleClearDB} 
                        style={{background: 'var(--status-critical)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'}}
                    >
                        Clear Database
                    </button>
                </div>
            </div>
        )}

      </main>

      {/* Resize Handle */}
      {showInspector && (
        <div 
          onMouseDown={startResizing}
          style={{
            gridArea: 'inspector-handle',
            width: '4px',
            cursor: 'col-resize',
            background: 'transparent',
            zIndex: 100,
            transition: 'background 0.2s',
            position: 'relative'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-color)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        />
      )}

      <Inspector 
        inspectorAsset={inspectorAsset}
        workbenchSummary={workbenchSummary}
        activeInspectorTab={activeInspectorTab}
        setActiveInspectorTab={setActiveInspectorTab}
        bodySearchTerm={bodySearchTerm}
        setBodySearchTerm={setBodySearchTerm}
        handleRescan={handleRescan}
        showInspector={showInspector}
        inspectorWidth={inspectorWidth}
        selectedIdsCount={selectedIds.size}
        activeView={activeView}
        decodedJwt={decodedJwt}
        setDecodedJwt={setDecodedJwt}
        onRefresh={loadAssets}
      />

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="modal-overlay" onClick={() => setIsImportModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                <h3>Import Assets</h3>
                <X size={20} style={{cursor: 'pointer'}} onClick={() => setIsImportModalOpen(false)} />
            </div>
            
            <textarea 
                placeholder="Paste URLs or CSV content here..." 
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                style={{height: '150px'}}
            />
            
            <div className="drop-zone" onClick={handleBrowse}>
                <Upload size={24} style={{marginBottom: '10px'}} />
                <div>Click or Drop files to Import</div>
            </div>

            <div style={{marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
                <button onClick={() => setIsImportModalOpen(false)} style={{background: 'transparent', color: 'white', border: 'none', cursor: 'pointer'}}>Cancel</button>
                <button onClick={() => handleImport(importText)} style={{background: 'var(--accent-color)', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer'}}>Import</button>
            </div>
          </div>
        </div>
      )}
      {contextMenu && (
        <div 
            className="context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
        >
             <div className="context-item" onClick={async () => {
                 const idsToRescan = selectedIds.has(contextMenu.id) ? Array.from(selectedIds) : [contextMenu.id];
                 for (const id of idsToRescan) await handleRescan(id);
                 setContextMenu(null);
             }}><Play size={14}/> {selectedIds.size > 1 && selectedIds.has(contextMenu.id) ? `Rescan ${selectedIds.size} Selected` : 'Rescan Asset'}</div>
             
             <div className="context-item" onClick={() => {
                 const idsToAdd = selectedIds.has(contextMenu.id) ? Array.from(selectedIds) : [contextMenu.id];
                 idsToAdd.forEach(id => addToWorkbench(id));
                 setContextMenu(null);
             }}><FileCode size={14}/> {selectedIds.size > 1 && selectedIds.has(contextMenu.id) ? `Send ${selectedIds.size} Selected to Workbench` : 'Send to Workbench'}</div>
             
            <div style={{ padding: '4px 8px', fontSize: '9px', textTransform: 'uppercase', opacity: 0.4, borderTop: '1px solid var(--border-color)', marginTop: '4px' }}>Move to Folder</div>
            {folders.map(f => (
                <div key={f.id} className="context-item" onClick={() => {
                    const idsToMove = selectedIds.has(contextMenu.id) ? Array.from(selectedIds) : [contextMenu.id];
                    moveToFolder(f.id, idsToMove);
                    setContextMenu(null);
                }}>
                    <FolderIcon size={14}/> {f.name}
                </div>
            ))}
            
            <div className="context-item delete" onClick={() => {
                const idsToDelete = selectedIds.has(contextMenu.id) ? Array.from(selectedIds) : [contextMenu.id];
                handleDelete(idsToDelete);
                setContextMenu(null);
            }} style={{ borderTop: '1px solid var(--border-color)', marginTop: '4px' }}>
                <Trash2 size={14}/> {selectedIds.size > 1 && selectedIds.has(contextMenu.id) ? `Delete ${selectedIds.size} Selected` : 'Delete Asset'}
            </div>
        </div>
      )}

      {/* Debug Console */}
      <DebugConsole 
        isOpen={isDebugConsoleOpen}
        onToggle={() => setIsDebugConsoleOpen(!isDebugConsoleOpen)}
      />

    </div>
  );
}

export default App;
