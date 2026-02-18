import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import yaml from 'js-yaml';
import { z } from 'zod';
import { toast } from 'sonner';
import { 
  ImportAsset, 
  ImportOptions 
} from '../types';

export const AssetInputSchema = z.object({
  url: z.string().min(3, "URL/Path is too short"),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']).default('GET'),
  source: z.string().optional().default('Import'),
  recursive: z.boolean().optional().default(false),
});

export const useImportProcessor = (options: ImportOptions, existingUrls: Set<string>) => {
  const [stagedAssets, setStagedAssets] = useState<ImportAsset[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOpenApiSpec, setIsOpenApiSpec] = useState(false);
  const [rawSpecContent, setRawSpecContent] = useState<string | null>(null);

  const validateAsset = useCallback((data: any, fileName: string): ImportAsset | null => {
    const result = AssetInputSchema.safeParse({
      url: data.url,
      method: data.method || 'GET',
      source: fileName,
      recursive: options.recursive,
    });

    if (!result.success) {
      console.warn("Validation failed for asset:", data, result.error.format());
      return null;
    }

    const validated = result.data;
    const isDuplicate = existingUrls.has(`${validated.url}|${validated.method}`);

    return {
      id: crypto.randomUUID(),
      url: validated.url,
      method: validated.method as any,
      source: validated.source || fileName,
      selected: true, // Always select everything by default for review/recurse
      recursive: validated.recursive,
      status: (isDuplicate ? 'duplicate' : 'valid') as any
    };
  }, [options, existingUrls]);

  const parseContent = useCallback(async (content: string, type: 'text' | 'csv' | 'json' | 'yaml', fileName: string) => {
    const newAssets: ImportAsset[] = [];
    
    try {
      if (type === 'json') {
        try {
          const json = JSON.parse(content);
          if (json.paths || json.openapi || json.swagger) {
            setIsOpenApiSpec(true);
            setRawSpecContent(content);
            Object.keys(json.paths).forEach((path: string) => {
              const methods = Object.keys(json.paths[path]);
              methods.forEach((method: string) => {
                let baseUrl = '';
                if (json.servers && json.servers.length > 0) {
                  baseUrl = json.servers[0].url;
                }
                const fullUrl = baseUrl ? (baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl) + path : path;
                const asset = validateAsset({ url: fullUrl, method: method.toUpperCase() }, fileName);
                if (asset) newAssets.push(asset);
              });
            });
          } else if (Array.isArray(json)) {
            json.forEach((item: any) => {
              if (typeof item === 'string') {
                const asset = validateAsset({ url: item }, fileName);
                if (asset) newAssets.push(asset);
              } else if (typeof item === 'object' && item.url) {
                const asset = validateAsset({ url: item.url, method: item.method }, fileName);
                if (asset) newAssets.push(asset);
              }
            });
          }
        } catch (e) {
          console.warn("Failed to parse JSON", e);
          setErrorMsg(`Failed to parse JSON file: ${e}`);
        }
      } else if (type === 'yaml') {
        try {
          const doc = yaml.load(content) as any;
          if (doc && (doc.paths || doc.openapi || doc.swagger)) {
            setIsOpenApiSpec(true);
            setRawSpecContent(content);
            Object.keys(doc.paths).forEach((path: string) => {
              const methods = Object.keys(doc.paths[path]);
              methods.forEach((method: string) => {
                let baseUrl = '';
                if (doc.servers && doc.servers.length > 0) {
                  baseUrl = doc.servers[0].url;
                }
                const fullUrl = baseUrl ? (baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl) + path : path;
                const asset = validateAsset({ url: fullUrl, method: method.toUpperCase() }, fileName);
                if (asset) newAssets.push(asset);
              });
            });
          }
        } catch (e) {
          console.warn("Failed to parse YAML", e);
          setErrorMsg(`Failed to parse YAML file: ${e}`);
        }
      } else if (type === 'csv') {
        const results = Papa.parse(content, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true
        });

        const processRow = (row: any) => {
          let url = '';
          let method = 'GET';
          const isValidUrlStr = (s: any): boolean => {
            if (!s) return false;
            const str = String(s).trim();
            if (str === '' || str === 'null' || str === 'undefined' || str === '[object Object]') return false;
            return str.startsWith('http') || str.startsWith('/');
          };

          if (typeof row === 'object' && !Array.isArray(row)) {
            const keys = Object.keys(row);
            const urlKey = keys.find(k => {
              const lower = k.toLowerCase();
              return lower === 'url' || lower === 'path' || lower === 'endpoint' || lower.includes('address') || lower.includes('asset');
            });
            if (urlKey && row[urlKey] != null) {
              const val = String(row[urlKey]).trim();
              if (val && val !== 'null' && val !== 'undefined') url = val;
            }
            const methodKey = keys.find(k => {
              const lower = k.toLowerCase();
              return lower === 'method' || lower === 'verb' || lower.includes('http_method');
            });
            if (methodKey && row[methodKey] != null) {
              const mVal = String(row[methodKey]).trim().toUpperCase();
              if (mVal && ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(mVal)) method = mVal;
            }
            if (!url) {
              const val = Object.values(row).find(isValidUrlStr);
              if (val) url = String(val).trim();
            }
          } else if (Array.isArray(row)) {
            const val = row.find(isValidUrlStr);
            if (val) url = String(val).trim();
            const mVal = row.find(v => typeof v === 'string' && ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(v.trim().toUpperCase()));
            if (mVal) method = String(mVal).trim().toUpperCase();
          }

          if (url && url.length > 3) {
            const asset = validateAsset({ url, method }, fileName);
            if (asset) newAssets.push(asset);
          }
        };

        (results.data as any[]).forEach(processRow);
        if (newAssets.length === 0) {
           const rawResults = Papa.parse(content, { header: false, skipEmptyLines: true });
           (rawResults.data as any[]).forEach(processRow);
        }
      } else {
        // Advanced URL & Domain detection (matching backend logic)
        // 1. Full URLs
        const urlRe = /https?:\/\/[^\s"'<>()[\]{}|\\^`]+[^\s"'<>()[\]{}|\\^`.,!?;:]/gi;
        // 2. Domain-like strings (e.g. api.google.com)
        const domainRe = /\b(?:[a-zA-Z0-9][-a-zA-Z0-9]*\.)+[a-zA-Z]{2,}(?:\/[^\s"'<>()[\]{}|\\^`]*)?/gi;
        // 3. Methods + URLs
        const methodUrlRe = /\b(GET|POST|PUT|DELETE|PATCH)\b\s+(https?:\/\/[^\s"'<>()[\]{}|\\^`]+|\/[^\s"'<>()[\]{}|\\^`]*)/gi;

        const foundUrls = new Set<string>();

        // Find Methods + URLs first
        let m;
        while ((m = methodUrlRe.exec(content)) !== null) {
          const method = m[1].toUpperCase();
          const url = m[2];
          const asset = validateAsset({ url, method }, fileName);
          if (asset) {
            newAssets.push(asset);
            foundUrls.add(url);
          }
        }

        // Find remaining full URLs
        while ((m = urlRe.exec(content)) !== null) {
          const url = m[0];
          if (!foundUrls.has(url)) {
            const asset = validateAsset({ url }, fileName);
            if (asset) {
              newAssets.push(asset);
              foundUrls.add(url);
            }
          }
        }

        // Find domains (if not already matched)
        while ((m = domainRe.exec(content)) !== null) {
          const url = m[0];
          // Simple heuristic: if it looks like a version number, skip
          if (/^\d+(\.\d+)+$/.test(url)) continue;
          
          if (!foundUrls.has(url) && !foundUrls.has(`https://${url}`) && !foundUrls.has(`http://${url}`)) {
             const asset = validateAsset({ url }, fileName);
             if (asset) newAssets.push(asset);
          }
        }
      }
    } catch (e) {
      console.error("Parse error", e);
      setErrorMsg(`Parse error: ${e}`);
    }

    return newAssets;
  }, [validateAsset]);

  const processFiles = useCallback(async (files: FileList | File[] | string[]) => {
    setIsProcessing(true);
    setErrorMsg(null);
    let allNewAssets: ImportAsset[] = [];
    
    // Normalize input to array
    let items: (File | string)[] = [];
    if (Array.isArray(files)) {
      items = files;
    } else {
      items = Array.from(files);
    }

    // Dynamic import for Tauri fs, only used if we have strings
    let readTextFile: any = null;
    let readFile: any = null;

    for (const item of items) {
      try {
        let content = '';
        let fileName = '';
        let type: 'text' | 'csv' | 'json' | 'yaml' = 'text';
        let isBinary = false;

        // Handle File Object (Drag & Drop)
        if (typeof item !== 'string') {
           fileName = item.name.toLowerCase();
           if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
               const buffer = await item.arrayBuffer();
               const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
               const firstSheetName = workbook.SheetNames[0];
               content = XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheetName]);
               type = 'csv';
           } else {
               content = await item.text();
               isBinary = /[\x00-\x08\x0E-\x1F]/.test(content.substring(0, 1000));
           }
        } 
        // Handle File Path (Native Dialog)
        else {
           fileName = item.split(/[\\/]/).pop()?.toLowerCase() || 'unknown';
           
           // Lazy load Tauri FS
           if (!readTextFile) {
               const fs = await import('@tauri-apps/plugin-fs');
               readTextFile = fs.readTextFile;
               readFile = fs.readFile;
           }

           if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
               const bytes = await readFile(item);
               const workbook = XLSX.read(bytes, { type: 'array' });
               const firstSheetName = workbook.SheetNames[0];
               content = XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheetName]);
               type = 'csv';
           } else {
               content = await readTextFile(item);
               isBinary = /[\x00-\x08\x0E-\x1F]/.test(content.substring(0, 1000));
           }
        }

        if (isBinary && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
            setErrorMsg(`File "${fileName}" appears to be binary.`);
            continue;
        }

        if (fileName.endsWith('.json')) type = 'json';
        else if (fileName.endsWith('.csv')) type = 'csv';
        else if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) type = 'yaml';
        
        const assets = await parseContent(content, type, fileName);
        allNewAssets = [...allNewAssets, ...assets];
      } catch (err) {
        setErrorMsg(`Failed to process file: ${err}`);
      }
    }

    setStagedAssets(prev => [...prev, ...allNewAssets]);
    setIsProcessing(false);

    if (allNewAssets.length > 0) {
        toast.success(`Successfully staged ${allNewAssets.length} assets for review.`);
    } else if (!errorMsg) {
        toast.error("No valid URLs or assets found in the selected file(s).");
    }
  }, [parseContent, errorMsg]);

  return {
    stagedAssets,
    setStagedAssets,
    isProcessing,
    errorMsg,
    setErrorMsg,
    isOpenApiSpec,
    setIsOpenApiSpec,
    rawSpecContent,
    processFiles,
    parseContent
  };
};
