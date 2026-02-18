import { describe, it, expect } from 'vitest';
import { determineGlobalSource, prepareAssetsForImport, calculateBatchConfig } from '../utils/importLogic';

describe('Import Logic Utilities', () => {
  it('should determine global source correctly', () => {
    // Both destinations should default to 'Import' as the source reflects origin, not target view
    expect(determineGlobalSource('workbench')).toBe('Import');
    expect(determineGlobalSource('asset_manager')).toBe('Import');
  });

  it('should prepare assets with correct source', () => {
    const assets = [{ url: 'http://test.com', source: 'Old' }, { url: 'http://test2.com' }];
    const processed = prepareAssetsForImport(assets, 'workbench');
    
    // Should preserve 'Old' and default the other to 'Import'
    expect(processed[0].source).toBe('Old');
    expect(processed[1].source).toBe('Import');
  });

  it('should calculate batch config correctly', () => {
    const options = { batchMode: true, batchSize: 10, rateLimit: 50 } as any;
    const config = calculateBatchConfig(options, 100);
    expect(config.batchSize).toBe(10);
    expect(config.rateLimit).toBe(50);
  });
});
