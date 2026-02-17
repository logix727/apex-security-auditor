export interface Badge {
  emoji: string;
  short: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
  description: string;
  owasp_category?: string;
  evidence?: string;
  start?: number;
  end?: number;
  is_fp?: boolean;
  fp_reason?: string;
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
  is_documented: boolean;
  source: string;
}

export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  created_at?: string;
}

export interface ShadowApiAsset {
  id: number;
  url: string;
  method: string;
  risk_level: string;
}

export interface ShadowApiReport {
  spec_title: string;
  spec_version: string;
  total_endpoints: number;
  total_assets_checked: number;
  documented_count: number;
  shadow_api_count: number;
  shadow_apis: ShadowApiAsset[];
}

export interface TreeNode {
  name: string;
  path: string;
  children: { [key: string]: TreeNode };
  assetIds: number[];
  assetCount?: number;
}

export type ActiveView = 'dashboard' | 'workbench' | 'assets' | 'surface' | 'discovery' | 'settings';
export type AssetSidebarView = 'folders' | 'tree';

export interface SortConfig {
  key: keyof Asset;
  direction: 'asc' | 'desc';
}

export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export interface DebugLogEntry {
  id: string;
  timestamp: string; // ISO string from backend, converted to Date in UI if needed
  level: LogLevel;
  source: string;
  message: string;
  details?: any;
}

// Import System Types

export type ImportDestination = 'asset_manager' | 'workbench';

export type ImportStatusState = 'pending' | 'validating' | 'importing' | 'completed' | 'failed' | 'cancelled';

export interface ImportAsset {
  id: string;
  url: string;
  method: string;
  source: string;
  selected: boolean;
  recursive: boolean;
  status?: 'valid' | 'invalid' | 'duplicate' | 'pending';
  error?: string;
  assetId?: number;
}

export interface ImportOptions {
  destination: ImportDestination;
  recursive: boolean;
  batchMode: boolean;
  batchSize: number;
  rateLimitMs: number;
  skipDuplicates: boolean;
  validateUrls: boolean;
  source?: string;
}

export interface ImportProgress {
  importId: string;
  current: number;
  total: number;
  percentage: number;
  currentUrl?: string;
  status: ImportStatusState;
  startTime: string;
  errors: ImportError[];
}

export interface ImportError {
  url: string;
  method: string;
  error: string;
  timestamp: string;
}

export interface ImportResult {
  importId: string;
  successful: number;
  failed: number;
  duplicates: number;
  total: number;
  duration: number;
  errors: ImportError[];
  assetIds: number[];
}

export interface ImportOperation {
  id: string;
  source: string;
  content: string;
  options: ImportOptions;
  status: ImportStatusState;
  progress: ImportProgress;
  result?: ImportResult;
  createdAt: string;
  completedAt?: string;
}

export interface ImportHistoryEntry {
  id: string;
  source: string;
  total_assets: number;
  successful: number;
  failed: number;
  duplicates: number;
  created_at: string;
  completed_at?: string;
  duration_ms: number;
}

export interface UrlValidationResult {
  url: string;
  method: string;
  valid: boolean;
  error?: string;
  isDuplicate?: boolean;
}

export interface ImportQueueItem {
  id: string;
  operation: ImportOperation;
  priority: number;
  addedAt: string;
}
