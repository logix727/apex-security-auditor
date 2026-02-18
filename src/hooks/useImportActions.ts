import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { ImportDestination, ImportOptions } from '../types';
import { determineGlobalSource, prepareAssetsForImport, calculateBatchConfig } from '../utils/importLogic';
import { useDebugLogger } from '../components/debug/DebugConsole';

interface ImportResult {
  ids: number[];
  errors: string[];
}

export const useImportActions = (onSuccess?: (ids: number[], destination: ImportDestination) => void) => {
  const [isImporting, setIsImporting] = useState(false);
  const logger = useDebugLogger();

  const executeImport = useCallback(async (assetsToImport: any[], destination: ImportDestination, options: ImportOptions) => {
    if (assetsToImport.length === 0) return;
    
    setIsImporting(true);
    const globalSource = determineGlobalSource(destination);
    const processedAssets = prepareAssetsForImport(assetsToImport, destination);
    
    let allNewIds: number[] = [];
    let errorCount = 0;
    const startTime = Date.now();

    logger.info('ui:import', `Starting import sequence for ${processedAssets.length} assets`, {
      destination,
      globalSource,
      batchMode: options.batchMode,
      skipDuplicates: options.skipDuplicates
    });

    try {
      const { batchSize, rateLimit } = calculateBatchConfig(options, processedAssets.length);
      
      for (let i = 0; i < processedAssets.length; i += batchSize) {
        const batch = processedAssets.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(processedAssets.length / batchSize);
        
        logger.info('ui:import', `Sending batch ${batchNum}/${totalBatches} (${batch.length} assets)`, { batchNum, totalBatches, count: batch.length });
        
        try {
            const result = await invoke<ImportResult>('import_staged_assets', {
                assets: batch,
                source: globalSource,
                options
              });
      
              allNewIds = [...allNewIds, ...result.ids];
              if (result.errors && result.errors.length > 0) {
                  result.errors.forEach(e => logger.error('ui:import', `Batch error: ${e}`));
                  errorCount += result.errors.length;
              }
        } catch (invokeErr) {
            logger.error('ui:import', `Batch invoke failed`, { error: invokeErr });
            errorCount++;
        }
        
        if (i + batchSize < processedAssets.length && rateLimit > 0) {
            await new Promise(resolve => setTimeout(resolve, rateLimit));
        }
      }

      const duration = Date.now() - startTime;
      if (errorCount > 0) {
          logger.warn('ui:import', `Import completed in ${duration}ms with ${errorCount} errors`);
          toast.warning(`Import completed with ${errorCount} errors.`);
      } else {
          logger.success('ui:import', `Successfully imported ${allNewIds.length} assets in ${duration}ms`);
      }

      if (onSuccess) {
          await onSuccess(allNewIds, destination);
      }
      
    } catch (e) {
      logger.error('ui:import', `Critical import failure`, { error: e });
      toast.error(`Import failed: ${e}`);
    } finally {
      setIsImporting(false);
    }
  }, [onSuccess, logger]);

  return { executeImport, isImporting };
};
