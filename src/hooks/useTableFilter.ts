import { useState, useCallback, useMemo } from 'react';
import { FilterValue } from '../types/table';

interface FilterState {
  [key: string]: FilterValue;
}

interface UseTableFilterReturn<T> {
  filters: FilterState;
  setFilter: (key: string, value: FilterValue) => void;
  getFilter: (key: string) => FilterValue | undefined;
  resetFilters: () => void;
  resetFilter: (key: string) => void;
  filterData: (data: T[], filterFn?: (item: T, filters: FilterState) => boolean) => T[];
  activeFilterCount: number;
  hasActiveFilters: boolean;
}

/**
 * Custom hook for managing table filter state
 * @param initialFilters - Optional initial filter values
 * @returns Filter state and handlers
 */
export function useTableFilter<T>(
  initialFilters?: FilterState
): UseTableFilterReturn<T> {
  const [filters, setFilters] = useState<FilterState>(initialFilters || {});

  const setFilter = useCallback((key: string, value: FilterValue) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const getFilter = useCallback((key: string): FilterValue | undefined => {
    return filters[key];
  }, [filters]);

  const resetFilter = useCallback((key: string) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({});
  }, []);

  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === 'string' && value === '' || value === 'All') return false;
      if (typeof value === 'number' && value === 0) return false;
      if (value instanceof Set && value.size === 0) return false;
      if (Array.isArray(value) && value.length === 2 && value[0] === 0 && value[1] === 0) return false;
      return true;
    }).length;
  }, [filters]);

  const hasActiveFilters = activeFilterCount > 0;

  /**
   * Filter data based on current filters
   * @param data - Array of items to filter
   * @param filterFn - Optional custom filter function
   */
  const filterData = useCallback(
    (data: T[], filterFn?: (item: T, filters: FilterState) => boolean): T[] => {
      if (!hasActiveFilters && !filterFn) return data;

      return data.filter(item => {
        // Use custom filter function if provided
        if (filterFn) {
          return filterFn(item, filters);
        }

        // Default filtering logic
        for (const [key, value] of Object.entries(filters)) {
          // Skip inactive filters
          if (value === undefined || value === null) continue;
          if (typeof value === 'string' && (value === '' || value === 'All')) continue;
          if (typeof value === 'number' && value === 0) continue;
          if (value instanceof Set && value.size === 0) continue;

          const itemValue = (item as any)[key];

          // String filter (case-insensitive contains)
          if (typeof value === 'string') {
            const strValue = String(itemValue ?? '').toLowerCase();
            if (!strValue.includes(value.toLowerCase())) {
              return false;
            }
          }

          // Number filter (exact match or range)
          if (typeof value === 'number') {
            const numValue = Number(itemValue);
            if (numValue < value) {
              return false;
            }
          }

          // Range filter [min, max]
          if (Array.isArray(value) && value.length === 2) {
            const numValue = Number(itemValue);
            const [min, max] = value;
            if (min !== 0 && numValue < min) return false;
            if (max !== 0 && numValue > max) return false;
          }

          // Set filter (multi-select)
          if (value instanceof Set) {
            if (!value.has(String(itemValue))) {
              return false;
            }
          }
        }

        return true;
      });
    },
    [filters, hasActiveFilters]
  );

  return {
    filters,
    setFilter,
    getFilter,
    resetFilters,
    resetFilter,
    filterData,
    activeFilterCount,
    hasActiveFilters
  };
}

export default useTableFilter;
