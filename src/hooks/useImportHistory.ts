import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ImportHistoryEntry } from '../types';
import { toast } from 'sonner';

export const useImportHistory = () => {
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadImportHistory = useCallback(async (limit = 20, offset = 0) => {
    setIsLoading(true);
    try {
      const history = await invoke<any[]>('get_import_history', {
        limit,
        offset
      });
      
      const mappedHistory: ImportHistoryEntry[] = history.map(item => ({
        ...item,
        destination: item.options?.destination,
        duration_ms: item.duration_ms || 0
      }));
      
      setImportHistory(mappedHistory || []);
    } catch (e) {
      console.warn('Failed to load import history', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearHistory = useCallback(async () => {
    try {
      await invoke('clear_import_history');
      setImportHistory([]);
      toast.success('Import history cleared');
    } catch (e) {
      toast.error(`Failed to clear history: ${e}`);
    }
  }, []);

  return {
    importHistory,
    isLoading,
    loadImportHistory,
    clearHistory
  };
};
