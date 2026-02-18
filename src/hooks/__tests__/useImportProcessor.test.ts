import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImportProcessor } from '../useImportProcessor';

// Mock dependencies
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  readFile: vi.fn(),
}));

// Inline mock for papaparse to avoid hoisting issues
vi.mock('papaparse', () => ({
    default: {
        parse: vi.fn((content: string, config: any) => {
            if (config.header) {
                // Simple mock implementation for testing
                const lines = content.split('\n').filter((l: string) => l.trim().length > 0);
                const headers = lines[0].split(',').map((h: string) => h.trim());
                const data = lines.slice(1).map((line: string) => {
                    const values = line.split(',').map((v: string) => v.trim());
                    const row: any = {};
                    headers.forEach((h: string, i: number) => {
                        row[h] = values[i];
                    });
                    return row;
                });
                return { data };
            } else {
                 const data = content.split('\n')
                    .filter((l: string) => l.trim().length > 0)
                    .map((line: string) => line.split(',').map((v: string) => v.trim()));
                 return { data };
            }
        })
    }
}));


describe('useImportProcessor', () => {
    const defaultOptions: any = {
        destination: 'asset_manager',
        recursive: false,
        batchMode: true,
        batchSize: 5,
        rateLimit: 100,
        skipDuplicates: true,
        validateUrls: true,
        autoTriage: false,
    };

    const existingUrls = new Set<string>();

    beforeEach(() => {
        vi.clearAllMocks();
        existingUrls.clear();
    });

    it('should initialize with empty assets', () => {
        const { result } = renderHook(() => useImportProcessor(defaultOptions, existingUrls));
        expect(result.current.stagedAssets).toEqual([]);
        expect(result.current.isProcessing).toBe(false);
        expect(result.current.errorMsg).toBe(null);
    });

    it('should parse simple text list of URLs', async () => {
        const { result } = renderHook(() => useImportProcessor(defaultOptions, existingUrls));
        const content = `
            https://example.com
            http://test.com/api/v1
            https://api.example.org
        `;

        await act(async () => {
            const assets = await result.current.parseContent(content, 'text', 'test.txt');
            result.current.setStagedAssets(assets);
        });

        expect(result.current.stagedAssets).toHaveLength(3);
        expect(result.current.stagedAssets[0].url).toBe('https://example.com');
        expect(result.current.stagedAssets[0].method).toBe('GET');
        expect(result.current.stagedAssets[1].url).toBe('http://test.com/api/v1');
    });

    it('should parse text with methods prefixes', async () => {
        const { result } = renderHook(() => useImportProcessor(defaultOptions, existingUrls));
        const content = `
            GET https://example.com
            POST http://test.com/api/users
            DELETE https://api.example.org/resource/1
        `;

        await act(async () => {
            const assets = await result.current.parseContent(content, 'text', 'test.txt');
            result.current.setStagedAssets(assets);
        });

        expect(result.current.stagedAssets).toHaveLength(3);
        expect(result.current.stagedAssets[1].method).toBe('POST');
        expect(result.current.stagedAssets[2].method).toBe('DELETE');
    });
    
    it('should extract URLs from unstructured text', async () => {
        const { result } = renderHook(() => useImportProcessor(defaultOptions, existingUrls));
        const content = `
            Here is a url: https://hidden.com/secret inside some text.
            And another one (http://unsafe.org) in brackets.
        `;

        await act(async () => {
             const assets = await result.current.parseContent(content, 'text', 'test.txt');
             result.current.setStagedAssets(assets);
        });

        expect(result.current.stagedAssets).toHaveLength(2);
        expect(result.current.stagedAssets.find(a => a.url === 'https://hidden.com/secret')).toBeDefined();
        expect(result.current.stagedAssets.find(a => a.url === 'http://unsafe.org')).toBeDefined();
    });

    it('should parse CSV content', async () => {
        const { result } = renderHook(() => useImportProcessor(defaultOptions, existingUrls));
        const content = `url,method\nhttp://csv.com,POST\nhttp://csv2.com,PUT`;

        await act(async () => {
            const assets = await result.current.parseContent(content, 'csv', 'import.csv');
            result.current.setStagedAssets(assets);
        });
        
        expect(result.current.stagedAssets).toHaveLength(2);
        expect(result.current.stagedAssets[0].url).toBe('http://csv.com');
        expect(result.current.stagedAssets[0].method).toBe('POST');
        expect(result.current.stagedAssets[1].method).toBe('PUT');
    });
    
    it('should parse CSV with loose header names', async () => {
        const { result } = renderHook(() => useImportProcessor(defaultOptions, existingUrls));
        // 'Endpoint' instead of 'url', 'Verb' instead of 'method'
        const content = `Endpoint,Verb\nhttp://loose.com,PATCH`;

         await act(async () => {
            const assets = await result.current.parseContent(content, 'csv', 'import.csv');
            result.current.setStagedAssets(assets);
        });

        expect(result.current.stagedAssets).toHaveLength(1);
        expect(result.current.stagedAssets[0].url).toBe('http://loose.com');
        expect(result.current.stagedAssets[0].method).toBe('PATCH');
    });

     it('should parse JSON list of strings', async () => {
        const { result } = renderHook(() => useImportProcessor(defaultOptions, existingUrls));
        const content = JSON.stringify([
            "https://json-list.com/1",
            "https://json-list.com/2"
        ]);

        await act(async () => {
            const assets = await result.current.parseContent(content, 'json', 'list.json');
            result.current.setStagedAssets(assets);
        });

        expect(result.current.stagedAssets).toHaveLength(2);
        expect(result.current.stagedAssets[0].url).toBe('https://json-list.com/1');
    });

    it('should parse JSON list of objects', async () => {
        const { result } = renderHook(() => useImportProcessor(defaultOptions, existingUrls));
        const content = JSON.stringify([
            { url: "https://obj.com/1", method: "GET" },
            { url: "https://obj.com/2", method: "POST" }
        ]);

        await act(async () => {
            const assets = await result.current.parseContent(content, 'json', 'obj.json');
            result.current.setStagedAssets(assets);
        });

        expect(result.current.stagedAssets).toHaveLength(2);
        expect(result.current.stagedAssets[1].method).toBe('POST');
    });

    it('should parse Swagger/OpenAPI JSON', async () => {
        const { result } = renderHook(() => useImportProcessor(defaultOptions, existingUrls));
        const content = JSON.stringify({
            openapi: "3.0.0",
            servers: [{ url: "https://api.swagger.com/v1" }],
            paths: {
                "/users": {
                    get: {},
                    post: {}
                },
                "/users/{id}": {
                    get: {},
                    delete: {}
                }
            }
        });

        await act(async () => {
            const assets = await result.current.parseContent(content, 'json', 'swagger.json');
            result.current.setStagedAssets(assets);
        });

        // 4 items: GET /users, POST /users, GET /users/{id}, DELETE /users/{id}
        expect(result.current.stagedAssets).toHaveLength(4);
        
        const postUsers = result.current.stagedAssets.find(a => a.url.includes('/users') && a.method === 'POST');
        expect(postUsers).toBeDefined();
        expect(postUsers?.url).toBe('https://api.swagger.com/v1/users');

        expect(result.current.isOpenApiSpec).toBe(true);
    });

    it('should handle duplicates correctly', async () => {
         // Setup existing URL with method suffix
         existingUrls.add('https://duplicate.com|GET');
         
         const { result } = renderHook(() => useImportProcessor(defaultOptions, existingUrls));
         const content = `https://duplicate.com\nhttps://new.com`;

         await act(async () => {
             const assets = await result.current.parseContent(content, 'text', 'dupe.txt');
             result.current.setStagedAssets(assets);
        });

        expect(result.current.stagedAssets).toHaveLength(2);
         const duplicate = result.current.stagedAssets.find(a => a.url === 'https://duplicate.com');
         const fresh = result.current.stagedAssets.find(a => a.url === 'https://new.com');

         expect(duplicate?.status).toBe('duplicate');
         expect(duplicate?.selected).toBe(true); // Now selected by default for mandatory review
         
         expect(fresh?.status).toBe('valid');
         expect(fresh?.selected).toBe(true);
    });

    it('should validate invalid URLs', async () => {
        const { result } = renderHook(() => useImportProcessor(defaultOptions, existingUrls));
        const content = `not-a-url\nhttps://good.com`;

        await act(async () => {
             const assets = await result.current.parseContent(content, 'text', 'test.txt');
             result.current.setStagedAssets(assets);
        });

        expect(result.current.stagedAssets).toHaveLength(1);
        expect(result.current.stagedAssets[0].url).toBe('https://good.com');
    });
});
