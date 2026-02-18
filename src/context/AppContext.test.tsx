
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppProvider, useApp } from './AppContext';
import React from 'react';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn()
}));

describe('AppContext', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider>{children}</AppProvider>
    );

    it('should initialize with default values', () => {
        const { result } = renderHook(() => useApp(), { wrapper });
        
        expect(result.current.assets).toEqual([]);
        expect(result.current.searchTerm).toBe('');
        expect(result.current.activeFolderId).toBe(1);
    });

    it('should update searchTerm', () => {
        const { result } = renderHook(() => useApp(), { wrapper });
        
        act(() => {
            result.current.setSearchTerm('test');
        });
        
        expect(result.current.searchTerm).toBe('test');
    });

    it('should filter assets based on searchTerm', () => {
        const { result } = renderHook(() => useApp(), { wrapper });
        
        const mockAssets = [
            { id: 1, url: 'https://example.com/api', method: 'GET', source: 'Import', risk_score: 0, status_code: 200, folder_id: 1 },
            { id: 2, url: 'https://test.com/v1', method: 'POST', source: 'Import', risk_score: 10, status_code: 200, folder_id: 1 }
        ];

        act(() => {
            // @ts-ignore - simplified mock
            result.current.setAssets(mockAssets);
        });

        act(() => {
            result.current.setSearchTerm('test');
        });

        expect(result.current.filteredAssets).toHaveLength(1);
        expect(result.current.filteredAssets[0].url).toContain('test.com');
    });
});
