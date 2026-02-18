import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAssetData } from '../hooks/useAssetData';

// Mocking tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('Multi-Selection Logic', () => {
  const mockAssets = [
    { id: 1, url: 'http://test1.com', method: 'GET', source: 'Asset Manager' },
    { id: 2, url: 'http://test2.com', method: 'POST', source: 'Asset Manager' },
    { id: 3, url: 'http://test3.com', method: 'PUT', source: 'Asset Manager' },
    { id: 4, url: 'http://test4.com', method: 'DELETE', source: 'Asset Manager' },
    { id: 5, url: 'http://test5.com', method: 'GET', source: 'Asset Manager' },
  ] as any[];

  it('should select a single item on normal mousedown', () => {
    const { result } = renderHook(() => useAssetData());
    
    act(() => {
      result.current.handleAssetMouseDown(1, { button: 0 } as any, mockAssets);
    });
    
    expect(result.current.selectedIds.has(1)).toBe(true);
    expect(result.current.selectedIds.size).toBe(1);
  });

  it('should select a range with Shift+MouseDown', () => {
    const { result } = renderHook(() => useAssetData());
    
    // Select first item
    act(() => {
      result.current.handleAssetMouseDown(1, { button: 0 } as any, mockAssets);
    });
    
    // Shift+Click fifth item
    act(() => {
      result.current.handleAssetMouseDown(5, { button: 0, shiftKey: true } as any, mockAssets);
    });
    
    expect(result.current.selectedIds.size).toBe(5);
    expect(result.current.selectedIds.has(1)).toBe(true);
    expect(result.current.selectedIds.has(3)).toBe(true);
    expect(result.current.selectedIds.has(5)).toBe(true);
  });

  it('should toggle items with Ctrl+MouseDown', () => {
    const { result } = renderHook(() => useAssetData());
    
    // Select first item
    act(() => {
      result.current.handleAssetMouseDown(1, { button: 0 } as any, mockAssets);
    });
    
    // Ctrl+Click third item
    act(() => {
      result.current.handleAssetMouseDown(3, { button: 0, ctrlKey: true } as any, mockAssets);
    });
    
    expect(result.current.selectedIds.size).toBe(2);
    expect(result.current.selectedIds.has(1)).toBe(true);
    expect(result.current.selectedIds.has(3)).toBe(true);
    
    // Ctrl+Click first item again (to deselect)
    act(() => {
      result.current.handleAssetMouseDown(1, { button: 0, ctrlKey: true } as any, mockAssets);
    });
    
    expect(result.current.selectedIds.size).toBe(1);
    expect(result.current.selectedIds.has(1)).toBe(false);
    expect(result.current.selectedIds.has(3)).toBe(true);
  });

  it('should support drag-selection simulation via mouseEnter', () => {
    const { result } = renderHook(() => useAssetData());
    
    // Start drag at item 1
    act(() => {
      result.current.handleAssetMouseDown(1, { button: 0 } as any, mockAssets);
    });

    // Mouse enter item 3 while "dragging" (simulated by shiftKey added by SmartTable)
    act(() => {
      // SmartTable simulates a shift-click behavior onMouseEnter when dragging
      result.current.handleAssetMouseDown(3, { button: 0, shiftKey: true } as any, mockAssets);
    });

    expect(result.current.selectedIds.size).toBe(3);
    expect(result.current.selectedIds.has(1)).toBe(true);
    expect(result.current.selectedIds.has(2)).toBe(true);
    expect(result.current.selectedIds.has(3)).toBe(true);
  });

  it('should support Select All logic (external state)', () => {
    const { result } = renderHook(() => useAssetData());
    
    act(() => {
      // In AssetsView, select all is actually triggered via the hook's setter
      result.current.setSelectedIds(new Set(mockAssets.map(a => a.id)));
    });

    expect(result.current.selectedIds.size).toBe(mockAssets.length);
  });
});
