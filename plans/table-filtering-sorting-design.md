# Table Filtering & Sorting Solution Design

## Executive Summary

This document outlines the analysis of existing table implementations in the APEX Security Auditor application and provides a detailed design for implementing consistent filtering and sorting capabilities across all tables.

---

## 1. Current State Analysis

### 1.1 Dependencies (from [`package.json`](package.json))

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^19.1.0 | UI framework |
| lucide-react | ^0.563.0 | Icons |
| recharts | ^3.7.0 | Charts |
| @tauri-apps/api | ^2.10.1 | Tauri integration |

**Note**: No table library is currently installed (no TanStack Table, AG Grid, etc.)

### 1.2 Tables Identified

#### Table 1: Main Assets Table
**Location**: [`src/App.tsx`](src/App.tsx:1151) (lines 1151-1212)

**Data Displayed**:
- URL Path
- Source (User/Import/Recursive)
- HTTP Method
- Detections (security findings)
- Status Code
- Risk Score

**Current Filtering Capabilities**:
| Filter | Type | State Variable |
|--------|------|----------------|
| Method | Dropdown | `filterMethod` |
| Source | Dropdown | `filterSource` |
| Status | Dropdown | `filterStatus` |
| Min Risk | Range Slider | `filterRisk` |
| Search | Text Input | `searchTerm` |
| Columns | Toggle Buttons | `visibleColumns` |

**Current Sorting Capabilities**:
- Sort by clicking column headers
- State: `sortConfig: { key: keyof Asset, direction: 'asc' | 'desc' } | null`
- Handler: [`handleSort()`](src/App.tsx:912) function
- Sortable columns: url, source, method, status_code, risk_score

**State Management**:
```typescript
const [filterSource, setFilterSource] = useState<string>('All');
const [filterMethod, setFilterMethod] = useState<string>('All');
const [filterStatus, setFilterStatus] = useState<string>('All');
const [filterRisk, setFilterRisk] = useState<number>(0);
const [sortConfig, setSortConfig] = useState<{ key: keyof Asset, direction: 'asc' | 'desc' } | null>(null);
const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(['url', 'source', 'detections', 'status', 'method', 'risk']));
```

**Data Processing**:
```typescript
const processedAssets = useMemo(() => {
    let result = assets.filter(a => {
        // Multiple filter conditions
        if (filterSource !== 'All' && a.source !== filterSource) return false;
        if (filterMethod !== 'All' && a.method !== filterMethod) return false;
        // ... more filters
    });
    
    if (sortConfig) {
        result.sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
    return result;
}, [assets, searchTerm, activeFolderId, selectedTreePath, sortConfig, activeView]);
```

---

#### Table 2: Workbench Table
**Location**: [`src/App.tsx`](src/App.tsx:1360) (lines 1360-1400)

**Data Displayed**:
- URL Path
- Detections
- Status Code
- Method
- Remove Action

**Current Filtering Capabilities**: None

**Current Sorting Capabilities**: None

**State Management**:
- Uses `workbenchIds` Set to filter assets
- No dedicated filter/sort state

---

#### Table 3: JWT Claims Table
**Location**: [`src/components/Inspector.tsx`](src/components/Inspector.tsx:770) (lines 770-799)

**Data Displayed**:
- Claim Key (editable)
- Claim Value (editable)

**Current Filtering Capabilities**: None

**Current Sorting Capabilities**: None

**State Management**:
```typescript
const [decodedJwt, setDecodedJwt] = useState<any[] | null>(null);
```

**Special Considerations**:
- Inline editing capability
- Small dataset (typically < 20 rows)
- Part of JWT decoding feature

---

#### Table 4: Debug Console Log List
**Location**: [`src/components/DebugConsole.tsx`](src/components/DebugConsole.tsx:263)

**Data Displayed**:
- Timestamp
- Log Level
- Source
- Message

**Current Filtering Capabilities**:
- Filter by log level (all/info/warn/error/success)

**Current Sorting Capabilities**: None (chronological order)

**State Management**:
```typescript
const [filter, setFilter] = useState<LogLevelFilter>('all');
const filteredLogs = filter === 'all' ? logs : logs.filter((log) => log.level === filter);
```

**Note**: This is not a traditional table but a div-based list. Filtering is already implemented.

---

## 2. Gap Analysis

### 2.1 Feature Matrix

| Table | Filtering | Sorting | Column Visibility | Gaps |
|-------|-----------|---------|-------------------|------|
| Main Assets | ✅ Full | ✅ Basic | ✅ Yes | Sort indicators missing |
| Workbench | ❌ None | ❌ None | ❌ None | All features missing |
| JWT Claims | ❌ None | ❌ None | N/A | Search/sort would help |
| Debug Console | ✅ Basic | ❌ None | N/A | Sort by timestamp needed |

### 2.2 Code Quality Issues

1. **Inconsistent Patterns**: Each table uses different approaches
2. **No Reusability**: Filter/sort logic is duplicated, not abstracted
3. **Missing Visual Feedback**: No sort direction indicators on headers
4. **No Multi-column Sort**: Only single column sorting supported
5. **Hardcoded Filter Options**: Filter dropdowns are not data-driven

---

## 3. Solution Design

### 3.1 Recommended Approach: Custom Hook-Based Solution

**Rationale**:
- Existing codebase already uses custom patterns
- No need for heavy table library dependency
- Maintains consistency with current architecture
- TanStack Table would be overkill for current table complexity
- Smaller bundle size impact

**Alternative Considered**: TanStack Table
- Pros: Feature-rich, well-tested, accessible
- Cons: Learning curve, bundle size (~45KB), would require significant refactoring

### 3.2 Architecture Overview

```
src/
├── hooks/
│   ├── useTableFilter.ts      # Filter state management
│   ├── useTableSort.ts        # Sort state management
│   └── useTableData.ts        # Combined filter + sort processing
├── components/
│   ├── table/
│   │   ├── FilterBar.tsx      # Reusable filter bar component
│   │   ├── SortHeader.tsx     # Sortable column header with indicators
│   │   ├── TableContainer.tsx # Wrapper with consistent styling
│   │   └── ColumnSelector.tsx # Column visibility toggle
│   └── ...
└── types/
    └── table.ts               # Shared table types
```

### 3.3 Component Design

#### 3.3.1 useTableSort Hook

```typescript
// src/hooks/useTableSort.ts
interface SortConfig<T> {
  key: keyof T;
  direction: 'asc' | 'desc';
}

interface UseTableSortReturn<T> {
  sortConfig: SortConfig<T> | null;
  handleSort: (key: keyof T) => void;
  sortData: (data: T[]) => T[];
  SortIndicator: React.FC<{ columnKey: keyof T }>;
}

function useTableSort<T>(defaultSort?: SortConfig<T>): UseTableSortReturn<T>;
```

#### 3.3.2 useTableFilter Hook

```typescript
// src/hooks/useTableFilter.ts
type FilterValue = string | number | [number, number] | Set<string>;

interface FilterConfig {
  [key: string]: {
    type: 'select' | 'multiselect' | 'range' | 'text';
    value: FilterValue;
    options?: { label: string; value: string | number }[];
  };
}

interface UseTableFilterReturn<T> {
  filters: FilterConfig;
  setFilter: (key: string, value: FilterValue) => void;
  resetFilters: () => void;
  filterData: (data: T[]) => T[];
  activeFilterCount: number;
}

function useTableFilter<T>(config: FilterConfig): UseTableFilterReturn<T>;
```

#### 3.3.3 SortHeader Component

```typescript
// src/components/table/SortHeader.tsx
interface SortHeaderProps {
  columnKey: string;
  label: string;
  sortable?: boolean;
  currentSort: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (key: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

const SortHeader: React.FC<SortHeaderProps> = ({
  columnKey,
  label,
  sortable = true,
  currentSort,
  onSort,
  className,
  style
}) => (
  <th
    className={className}
    style={{ cursor: sortable ? 'pointer' : 'default', ...style }}
    onClick={() => sortable && onSort(columnKey)}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {label}
      {sortable && (
        <span style={{ opacity: currentSort?.key === columnKey ? 1 : 0.3 }}>
          {currentSort?.key === columnKey && currentSort.direction === 'desc' ? '▼' : '▲'}
        </span>
      )}
    </div>
  </th>
);
```

#### 3.3.4 FilterBar Component

```typescript
// src/components/table/FilterBar.tsx
interface FilterBarProps {
  filters: FilterConfig[];
  onFilterChange: (key: string, value: FilterValue) => void;
  onReset: () => void;
  activeCount?: number;
}

const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  onReset,
  activeCount
}) => (
  <div className="filter-bar">
    {filters.map(filter => (
      <FilterControl key={filter.key} config={filter} onChange={onFilterChange} />
    ))}
    {activeCount > 0 && (
      <button onClick={onReset} className="reset-btn">
        Reset Filters ({activeCount})
      </button>
    )}
  </div>
);
```

### 3.4 Implementation Plan

#### Phase 1: Core Infrastructure
1. Create `src/types/table.ts` with shared interfaces
2. Create `src/hooks/useTableSort.ts` hook
3. Create `src/hooks/useTableFilter.ts` hook
4. Create `src/hooks/useTableData.ts` combining both

#### Phase 2: Reusable Components
1. Create `src/components/table/SortHeader.tsx`
2. Create `src/components/table/FilterBar.tsx`
3. Create `src/components/table/ColumnSelector.tsx`
4. Create `src/components/table/TableContainer.tsx`

#### Phase 3: Refactor Existing Tables
1. Refactor Main Assets Table to use new hooks/components
2. Add filtering/sorting to Workbench Table
3. Add search/sort to JWT Claims Table
4. Add timestamp sort to Debug Console

#### Phase 4: Enhancements
1. Add multi-column sort support (Shift+Click)
2. Add filter persistence (localStorage)
3. Add keyboard navigation
4. Add accessibility improvements (ARIA labels)

### 3.5 CSS Additions

```css
/* src/App.css additions */

/* Sort Indicators */
.sort-indicator {
  margin-left: 4px;
  font-size: 10px;
  opacity: 0.3;
  transition: opacity 0.2s;
}

.sort-indicator.active {
  opacity: 1;
  color: var(--accent-color);
}

/* Filter Bar Enhancements */
.filter-bar {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-sidebar);
  font-size: 11px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-label {
  color: var(--text-secondary);
}

/* Column Selector */
.column-selector {
  display: flex;
  gap: 4px;
  padding-right: 12px;
  border-right: 1px solid var(--border-color);
  margin-right: 4px;
}

.column-toggle {
  padding: 2px 6px;
  font-size: 9px;
  text-transform: uppercase;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
}

.column-toggle.active {
  background: rgba(59, 130, 246, 0.1);
  border-color: var(--accent-color);
  color: white;
}
```

---

## 4. Detailed Implementation Tasks

### Task 1: Create Type Definitions
**File**: `src/types/table.ts`

```typescript
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
```

### Task 2: Create useTableSort Hook
**File**: `src/hooks/useTableSort.ts`

Key features:
- Single and multi-column sort support
- Sort direction cycling (none → asc → desc → none)
- Visual indicator state
- Comparator function generation

### Task 3: Create useTableFilter Hook
**File**: `src/hooks/useTableFilter.ts`

Key features:
- Multiple filter types support
- Active filter counting
- Filter reset functionality
- Debounced text search

### Task 4: Create useTableData Hook
**File**: `src/hooks/useTableData.ts`

Key features:
- Combines filter and sort hooks
- Memoized data processing
- Pagination support (future)

### Task 5: Create SortHeader Component
**File**: `src/components/table/SortHeader.tsx`

Key features:
- Click to sort
- Visual sort indicators
- Multi-sort indicator (when Shift is held)
- Accessible keyboard support

### Task 6: Create FilterBar Component
**File**: `src/components/table/FilterBar.tsx`

Key features:
- Dynamic filter controls based on config
- Consistent styling
- Active filter badge
- Reset all button

### Task 7: Refactor Main Assets Table
**File**: `src/App.tsx`

Changes:
- Replace inline filter state with `useTableFilter`
- Replace inline sort state with `useTableSort`
- Replace static `<th>` with `<SortHeader>`
- Extract filter bar to `<FilterBar>` component

### Task 8: Add Features to Workbench Table
**File**: `src/App.tsx`

Changes:
- Add sort capability to all columns
- Add filter bar (method, status, risk)
- Add column visibility toggle

### Task 9: Add Features to JWT Claims Table
**File**: `src/components/Inspector.tsx`

Changes:
- Add search filter for claims
- Add sort by key name
- Keep inline editing functionality

### Task 10: Add Sort to Debug Console
**File**: `src/components/DebugConsole.tsx`

Changes:
- Add sort toggle (newest/oldest first)
- Keep existing level filter

---

## 5. Testing Considerations

### Unit Tests
- Test sort comparator functions
- Test filter predicate functions
- Test hook state management

### Integration Tests
- Test filter + sort combination
- Test column visibility toggle
- Test filter reset

### E2E Tests
- Test user interactions with sort headers
- Test filter dropdown selections
- Test keyboard navigation

---

## 6. Migration Strategy

### Backward Compatibility
- Keep existing CSS classes
- Maintain current table structure
- No breaking changes to data interfaces

### Gradual Rollout
1. Implement hooks and components
2. Refactor one table at a time
3. Test each table after refactoring
4. Remove duplicate code after all tables migrated

---

## 7. Future Enhancements

1. **Virtualization**: For tables with 1000+ rows, consider react-window
2. **Export**: Add filtered/sorted data export
3. **Persistence**: Save filter/sort preferences to localStorage
4. **URL State**: Sync filters to URL query params for shareable links
5. **Accessibility**: Full ARIA support and keyboard navigation

---

## 8. Summary

This design proposes a custom hook-based solution that:
- Maintains consistency with the existing codebase
- Provides reusable filtering and sorting capabilities
- Requires minimal new dependencies
- Can be implemented incrementally
- Preserves existing functionality while adding new features

The implementation should be done in phases, starting with the core hooks and components, then refactoring each table to use the new system.
