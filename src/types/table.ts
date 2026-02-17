// Shared table types for filtering and sorting

export type SortDirection = 'asc' | 'desc';

export interface SortConfig<T> {
  key: keyof T;
  direction: SortDirection;
}

export type FilterType = 'select' | 'multiselect' | 'range' | 'text' | 'date';

export interface FilterOption {
  label: string;
  value: string | number;
}

export interface ColumnDef<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: FilterType;
  filterOptions?: FilterOption[];
  width?: string;
  visible?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

export type FilterValue = string | number | [number, number] | Set<string>;

export interface FilterConfig {
  [key: string]: {
    type: 'select' | 'multiselect' | 'range' | 'text';
    value: FilterValue;
    options?: { label: string; value: string | number }[];
  };
}
