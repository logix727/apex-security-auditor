import { useState, useCallback } from 'react';
import { SortConfig, SortDirection } from '../types/table';

interface UseTableSortReturn<T> {
  sortConfig: SortConfig<T> | null;
  handleSort: (key: keyof T) => void;
  setSortConfig: (config: SortConfig<T> | null) => void;
  sortData: (data: T[]) => T[];
  getSortDirection: (key: keyof T) => SortDirection | null;
}

/**
 * Custom hook for managing table sort state
 * @param defaultSort - Optional default sort configuration
 * @returns Sort state and handlers
 */
export function useTableSort<T>(defaultSort?: SortConfig<T>): UseTableSortReturn<T> {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(defaultSort || null);

  const handleSort = useCallback((key: keyof T) => {
    setSortConfig(prevConfig => {
      if (!prevConfig || prevConfig.key !== key) {
        // Start with ascending if no sort or different column
        return { key, direction: 'asc' };
      }
      if (prevConfig.direction === 'asc') {
        // Toggle to descending
        return { key, direction: 'desc' };
      }
      // Toggle off (no sort)
      return null;
    });
  }, []);

  const getSortDirection = useCallback((key: keyof T): SortDirection | null => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction;
  }, [sortConfig]);

  const sortData = useCallback((data: T[]): T[] => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];

      // Handle null/undefined
      if (valA == null && valB == null) return 0;
      if (valA == null) return sortConfig.direction === 'asc' ? 1 : -1;
      if (valB == null) return sortConfig.direction === 'asc' ? -1 : 1;

      // Handle strings (case-insensitive)
      if (typeof valA === 'string' && typeof valB === 'string') {
        const comparison = valA.toLowerCase().localeCompare(valB.toLowerCase());
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      // Handle numbers
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
      }

      // Handle dates
      if (valA instanceof Date && valB instanceof Date) {
        return sortConfig.direction === 'asc' 
          ? valA.getTime() - valB.getTime() 
          : valB.getTime() - valA.getTime();
      }

      // Default string comparison
      const strA = String(valA);
      const strB = String(valB);
      const comparison = strA.localeCompare(strB);
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [sortConfig]);

  return {
    sortConfig,
    handleSort,
    setSortConfig,
    sortData,
    getSortDirection
  };
}

export default useTableSort;
