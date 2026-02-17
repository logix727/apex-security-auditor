import { useMemo } from 'react';
import { SortConfig, FilterValue } from '../types/table';
import { useTableSort } from './useTableSort';
import { useTableFilter } from './useTableFilter';

interface UseTableDataReturn<T> {
  // Sort state and handlers
  sortConfig: SortConfig<T> | null;
  handleSort: (key: keyof T) => void;
  setSortConfig: (config: SortConfig<T> | null) => void;
  
  // Filter state and handlers
  filters: Record<string, FilterValue>;
  setFilter: (key: string, value: FilterValue) => void;
  getFilter: (key: string) => FilterValue | undefined;
  resetFilters: () => void;
  resetFilter: (key: string) => void;
  activeFilterCount: number;
  hasActiveFilters: boolean;
  
  // Processed data
  processedData: T[];
}

interface UseTableDataOptions<T> {
  defaultSort?: SortConfig<T>;
  initialFilters?: Record<string, FilterValue>;
  filterFn?: (item: T, filters: Record<string, FilterValue>) => boolean;
}

/**
 * Combined hook for managing table data with filtering and sorting
 * @param data - Source data array
 * @param options - Configuration options
 * @returns Combined filter/sort state and processed data
 */
export function useTableData<T>(
  data: T[],
  options: UseTableDataOptions<T> = {}
): UseTableDataReturn<T> {
  const { defaultSort, initialFilters, filterFn } = options;

  const {
    sortConfig,
    handleSort,
    setSortConfig,
    sortData
  } = useTableSort<T>(defaultSort);

  const {
    filters,
    setFilter,
    getFilter,
    resetFilters,
    resetFilter,
    filterData,
    activeFilterCount,
    hasActiveFilters
  } = useTableFilter<T>(initialFilters);

  // Combine filtering and sorting in a memoized way
  const processedData = useMemo(() => {
    // First filter, then sort
    const filtered = filterData(data, filterFn);
    const sorted = sortData(filtered);
    return sorted;
  }, [data, filters, sortConfig, filterData, sortData, filterFn]);

  return {
    // Sort
    sortConfig,
    handleSort,
    setSortConfig,
    
    // Filter
    filters,
    setFilter,
    getFilter,
    resetFilters,
    resetFilter,
    activeFilterCount,
    hasActiveFilters,
    
    // Data
    processedData
  };
}

export default useTableData;
