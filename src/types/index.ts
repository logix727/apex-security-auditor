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
  cvss_score?: number;
  cvss_vector?: string;
  secret_type?: string;
  request_header_name?: string;
  parameter?: string;
  key?: string;
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
  recursive: boolean;
  is_workbench: boolean;
  depth: number;
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

export type ActiveView = 'dashboard' | 'workbench' | 'assets' | 'surface' | 'discovery' | 'settings' | 'intercept' | 'sequences';
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
  is_workbench?: boolean;
  status?: 'valid' | 'invalid' | 'duplicate' | 'pending';
  error?: string;
  assetId?: number;
}

export interface ImportOptions {
  destination: ImportDestination;
  recursive: boolean;
  batchMode: boolean;
  batchSize: number;
  rateLimit: number;
  skipDuplicates: boolean;
  validateUrls: boolean;
  autoTriage: boolean;
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
  id: number;
  import_id: string;
  source: string;
  total_assets: number;
  successful_assets: number;
  failed_assets: number;
  duplicate_assets: number;
  status: string;
  destination?: string; // Mapped from options.destination
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

// Sequence Analysis Types
export interface VariableCapture {
  name: string;
  source: string; // e.g. "json:body.id" or "header:Authorization"
  regex?: string;
}

export interface SequenceStep {
  id: number;
  sequence_id: string;
  asset_id: number;
  method: string;
  url: string;
  status_code: number;
  request_body: string | null;
  response_body: string | null;
  request_headers: string | null;
  response_headers: string | null;
  timestamp: string;
  captures: VariableCapture[];
}

export interface RequestSequence {
  id: string;
  flow_name: string | null;
  steps: SequenceStep[];
  created_at: string;
  context_summary: string | null;
}
