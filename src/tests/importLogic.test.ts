import { describe, it, expect } from 'vitest';
import { determineGlobalSource, prepareAssetsForImport, calculateBatchConfig } from '../utils/importLogic';

describe('Import Logic Utilities', () => {
  it('should determine global source correctly', () => {
    expect(determineGlobalSource('workbench')).toBe('Workbench');
    expect(determineGlobalSource('asset_manager')).toBe('Import');
  });

  it('should prepare assets with correct source for Workbench', () => {
    const assets = [{ url: 'http://test.com', source: 'Old' }, { url: 'http://test2.com' }];
    const processed = prepareAssetsForImport(assets, 'workbench');
    
    expect(processed[0].source).toBe('Workbench');
    expect(processed[1].source).toBe('Workbench');
  });

  it('should preserve source for Asset Manager unless missing', () => {
    const assets = [{ url: 'http://test.com', source: 'Scanner' }, { url: 'http://test2.com' }];
    const processed = prepareAssetsForImport(assets, 'asset_manager');
    
    expect(processed[0].source).toBe('Scanner');
    expect(processed[1].source).toBe('Import'); // Default
  });

  it('should calculate batch config correctly', () => {
    const options = { batchMode: true, batchSize: 10, rateLimit: 50 } as any;
    const config = calculateBatchConfig(options, 100);
    expect(config.batchSize).toBe(10);
    expect(config.rateLimit).toBe(50);
  });
});
