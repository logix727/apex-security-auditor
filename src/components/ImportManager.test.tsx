import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ImportManager } from './ImportManager';
import { AssetInputSchema } from '../hooks/useImportProcessor';

// Mock Tauri
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(() => Promise.resolve([]))
}));

vi.mock('@tauri-apps/api/event', () => ({
    listen: vi.fn(() => Promise.resolve(() => {}))
}));

// Mock sonner
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    }
}));

describe('ImportManager', () => {
    describe('AssetInputSchema', () => {
        it('should validate a correct asset input', () => {
            const validData = {
                url: 'https://api.example.com/v1',
                method: 'GET',
                source: 'Test',
                recursive: true
            };
            const result = AssetInputSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should fail if URL is too short', () => {
            const invalidData = {
                url: 'ab',
                method: 'GET'
            };
            const result = AssetInputSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.format().url?._errors).toContain('URL/Path is too short');
            }
        });

        it('should fail for invalid HTTP methods', () => {
            const invalidData = {
                url: 'https://example.com',
                method: 'INVALID'
            };
            const result = AssetInputSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should use default values for method and source', () => {
            const minimalData = {
                url: 'https://example.com'
            };
            const result = AssetInputSchema.safeParse(minimalData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.method).toBe('GET');
                expect(result.data.source).toBe('Import');
            }
        });
    });

    const mockProps = {
        isOpen: true,
        onClose: vi.fn(),
        onImport: vi.fn(),
        existingUrls: new Set<string>(['https://existing.com'])
    };

    it('should not render when closed', () => {
        const { container } = render(<ImportManager {...mockProps} isOpen={false} />);
        expect(container.firstChild).toBeNull();
    });

    it('should render title and subtitle when open', () => {
        render(<ImportManager {...mockProps} />);
        expect(screen.getByText('Asset Import Manager')).toBeInTheDocument();
        expect(screen.getByText(/Multi-source parallel processing/)).toBeInTheDocument();
    });

    it('should handle text input changes', () => {
        render(<ImportManager {...mockProps} />);
        const textarea = screen.getByPlaceholderText(/Paste URLs, JSON arrays/);
        fireEvent.change(textarea, { target: { value: 'GET https://test.com' } });
        expect((textarea as HTMLTextAreaElement).value).toBe('GET https://test.com');
    });

    it('should show duplicate status for existing URLs', async () => {
        render(<ImportManager {...mockProps} />);
        const textarea = screen.getByPlaceholderText(/Paste URLs, JSON arrays/);
        
        await act(async () => {
            fireEvent.change(textarea, { target: { value: 'GET https://existing.com' } });
        });
        
        const parseButton = screen.getByText('Process Staged Text');
        await act(async () => {
            fireEvent.click(parseButton);
        });

        await waitFor(() => {
            expect(screen.getByText('duplicate')).toBeInTheDocument();
        });
    });

    it('should clear duplicates when CLEAR DUPES is clicked', async () => {
        render(<ImportManager {...mockProps} />);
        const textarea = screen.getByPlaceholderText(/Paste URLs, JSON arrays/);
        
        await act(async () => {
            fireEvent.change(textarea, { target: { value: 'https://existing.com' } });
        });
        
        fireEvent.click(screen.getByText('Process Staged Text'));

        await waitFor(() => {
            expect(screen.getByText('duplicate')).toBeInTheDocument();
        });

        const clearBtn = screen.getByText('CLEAR DUPES');
        fireEvent.click(clearBtn);

        await waitFor(() => {
            expect(screen.queryByText('duplicate')).not.toBeInTheDocument();
        });
    });

    it('should parse JSON OpenAPI specs from dropped files', async () => {
        render(<ImportManager {...mockProps} />);
        const dropZone = screen.getByText(/Drop files or click to upload/);
        
        const openApiSpec = JSON.stringify({
            openapi: '3.0.0',
            paths: {
                '/users': {
                    get: { summary: 'Get users' }
                }
            }
        });

        const file = new File([openApiSpec], 'openapi.json', { type: 'application/json' });
        
        // Mock dataTransfer.files
        Object.defineProperty(file, 'text', {
            value: () => Promise.resolve(openApiSpec)
        });

        await act(async () => {
            fireEvent.drop(dropZone, {
                dataTransfer: {
                    files: [file],
                    items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
                    types: ['Files']
                },
            });
        });

        await waitFor(() => {
            expect(screen.getByText('/users')).toBeInTheDocument();
            expect(screen.getByText('GET')).toBeInTheDocument();
            expect(screen.getByText('Analyze Shadow APIs')).toBeInTheDocument();
        }, { timeout: 3000 });
    });
});
