import { ImportDestination, ImportOptions } from '../types';

export const determineGlobalSource = (_destination: ImportDestination): string => {
  // Use 'Import' as the fallback even if going to workbench.
  // The 'is_workbench' flag handles the destination logic, the source should reflect origin.
  return 'Import';
};

export const prepareAssetsForImport = (assets: any[], _destination: ImportDestination) => {
  return assets.map(a => ({
    ...a,
    // Preserve existing source, fallback to 'Import' (not 'Workbench')
    source: (a.source || 'Import')
  }));
};

export const calculateBatchConfig = (options: ImportOptions, totalAssets: number) => {
  const batchSize = options.batchMode ? (options.batchSize || 5) : totalAssets;
  const rateLimit = options.batchMode ? (options.rateLimit || 100) : 0;
  return { batchSize, rateLimit };
};
