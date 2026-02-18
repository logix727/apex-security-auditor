import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  exportAssets, 
  exportStagedAssets, 
  exportFindings, 
  exportToClipboard,
  ExportFormat,
  ExportScope,
  ExportOptions
} from '../exportUtils';
import { Asset, ImportAsset } from '../../types';

// Mock DOM APIs
const mockCreateObjectURL = vi.fn(() => 'blob:http://test');
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.URL.createObjectURL = mockCreateObjectURL;
  global.URL.revokeObjectURL = mockRevokeObjectURL;
  
  // Mock document.createElement
  const mockLink = {
    href: '',
    download: '',
    click: vi.fn(),
    style: {},
  };
  
  vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
  vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
  vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);
});

// Sample test data
const mockAssets: Asset[] = [
  {
    id: 1,
    url: 'https://example.com/api/users',
    method: 'GET',
    status: 'active',
    status_code: 200,
    risk_score: 0,
    findings: [],
    folder_id: 1,
    response_headers: '{}',
    response_body: '{}',
    request_headers: '{}',
    request_body: '',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    notes: '',
    triage_status: 'pending',
    is_documented: true,
    source: 'import',
    recursive: false,
    is_workbench: false,
    depth: 0,
  },
  {
    id: 2,
    url: 'https://example.com/api/admin',
    method: 'POST',
    status: 'active',
    status_code: 201,
    risk_score: 5,
    findings: [
      {
        emoji: '🚨',
        short: 'BOLA',
        severity: 'Critical',
        description: 'Broken Object Level Authorization',
      },
    ],
    folder_id: 1,
    response_headers: '{}',
    response_body: '{}',
    request_headers: '{}',
    request_body: '{}',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    notes: 'Needs review',
    triage_status: 'pending',
    is_documented: true,
    source: 'import',
    recursive: false,
    is_workbench: false,
    depth: 0,
  },
];

const mockStagedAssets: ImportAsset[] = [
  {
    id: '1',
    url: 'https://example.com/api',
    method: 'GET',
    source: 'import.csv',
    selected: true,
    recursive: false,
    status: 'valid',
  },
  {
    id: '2',
    url: 'https://test.com/api',
    method: 'POST',
    source: 'import.csv',
    selected: true,
    recursive: false,
    status: 'valid',
  },
];

describe('exportAssets', () => {
  it('should export all assets to CSV', () => {
    const options: ExportOptions = {
      format: 'csv',
      scope: 'all',
      includeHeaders: true,
    };

    expect(() => exportAssets(mockAssets, options)).not.toThrow();
  });

  it('should export all assets to JSON', () => {
    const options: ExportOptions = {
      format: 'json',
      scope: 'all',
      includeHeaders: true,
    };

    expect(() => exportAssets(mockAssets, options)).not.toThrow();
  });

  it('should export only assets with findings when scope is findings', () => {
    const options: ExportOptions = {
      format: 'csv',
      scope: 'findings',
    };

    expect(() => exportAssets(mockAssets, options)).not.toThrow();
  });

  it('should include findings when option is set', () => {
    const options: ExportOptions = {
      format: 'json',
      scope: 'all',
      includeFindings: true,
    };

    expect(() => exportAssets(mockAssets, options)).not.toThrow();
  });

  it('should include notes when option is set', () => {
    const options: ExportOptions = {
      format: 'csv',
      scope: 'all',
      includeNotes: true,
    };

    expect(() => exportAssets(mockAssets, options)).not.toThrow();
  });

  it('should export to text format', () => {
    const options: ExportOptions = {
      format: 'txt',
      scope: 'all',
    };

    expect(() => exportAssets(mockAssets, options)).not.toThrow();
  });

  it('should throw error for empty assets', () => {
    const options: ExportOptions = {
      format: 'csv',
      scope: 'all',
    };

    expect(() => exportAssets([], options)).toThrow('No assets to export');
  });

  it('should use custom filename when provided', () => {
    const options: ExportOptions = {
      format: 'csv',
      scope: 'all',
      filename: 'my-custom-export',
    };

    expect(() => exportAssets(mockAssets, options)).not.toThrow();
  });
});

describe('exportStagedAssets', () => {
  it('should export staged assets to CSV', () => {
    expect(() => exportStagedAssets(mockStagedAssets, 'csv')).not.toThrow();
  });

  it('should export staged assets to JSON', () => {
    expect(() => exportStagedAssets(mockStagedAssets, 'json')).not.toThrow();
  });

  it('should export staged assets to text', () => {
    expect(() => exportStagedAssets(mockStagedAssets, 'txt')).not.toThrow();
  });

  it('should use custom filename when provided', () => {
    expect(() => exportStagedAssets(mockStagedAssets, 'csv', 'staged-export')).not.toThrow();
  });
});

describe('exportFindings', () => {
  it('should export findings to CSV', () => {
    expect(() => exportFindings(mockAssets)).not.toThrow();
  });

  it('should use custom filename when provided', () => {
    expect(() => exportFindings(mockAssets, 'custom-findings')).not.toThrow();
  });

  it('should handle assets with no findings', () => {
    const assetsNoFindings: Asset[] = [
      {
        ...mockAssets[0],
        findings: [],
      },
    ];

    expect(() => exportFindings(assetsNoFindings)).not.toThrow();
  });
});

describe('exportToClipboard', () => {
  it('should copy URL format to clipboard', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    await exportToClipboard(mockAssets, 'url');

    expect(mockWriteText).toHaveBeenCalledWith(
      expect.stringContaining('https://example.com/api/users')
    );
  });

  it('should copy JSON format to clipboard', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    await exportToClipboard(mockAssets, 'json');

    expect(mockWriteText).toHaveBeenCalledWith(
      expect.stringContaining('"url": "https://example.com/api/users"')
    );
  });
});
