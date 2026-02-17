import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import yaml from 'js-yaml';
import { z } from 'zod';
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
      recursive: options.destination === 'asset_manager' ? true : options.recursive,
    });

    if (!result.success) {
      console.warn("Validation failed for asset:", data, result.error.format());
      return null;
    }

    const validated = result.data;
    const isDuplicate = existingUrls.has(validated.url);

    return {
      id: crypto.randomUUID(),
      url: validated.url,
      method: validated.method as any,
      source: validated.source || fileName,
      selected: !isDuplicate || !options.skipDuplicates,
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
        const urlRegex = /(?:(GET|POST|PUT|DELETE|PATCH)\s+)?(https?:\/\/[^\s"\'<>]+|(?:(?:\/[^\s"\'<>]+){2,}))/gi;
        let match;
        while ((match = urlRegex.exec(content)) !== null) {
          const method = match[1]?.toUpperCase() || 'GET';
          const url = match[2];
          if (url) {
            const asset = validateAsset({ url, method }, fileName);
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

  const processFiles = useCallback(async (files: FileList | File[]) => {
    setIsProcessing(true);
    setErrorMsg(null);
    let allNewAssets: ImportAsset[] = [];
    const fileArray = Array.isArray(files) ? files : Array.from(files);

    for (const file of fileArray) {
      try {
        const validBinaryExtensions = ['.xlsx', '.xls'];
        const fileName = file.name.toLowerCase();
        const isKnownBinary = validBinaryExtensions.some(ext => fileName.endsWith(ext));
        let content = '';
        let type: 'text' | 'csv' | 'json' | 'yaml' = 'text';

        if (isKnownBinary) {
          const buffer = await file.arrayBuffer();
          const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          content = XLSX.utils.sheet_to_csv(worksheet);
          type = 'csv';
        } else {
          content = await file.text();
          const isBinary = /[\x00-\x08\x0E-\x1F]/.test(content.substring(0, 1000));
          if (isBinary && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            setErrorMsg(`File "${file.name}" appears to be a binary file.`);
            continue;
          }
          if (file.name.endsWith('.json')) type = 'json';
          else if (file.name.endsWith('.csv')) type = 'csv';
          else if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) type = 'yaml';
        }

        const assets = await parseContent(content, type, file.name);
        allNewAssets = [...allNewAssets, ...assets];
      } catch (err) {
        setErrorMsg(`Failed to process file ${file.name}: ${err}`);
      }
    }

    setStagedAssets(prev => [...prev, ...allNewAssets]);
    setIsProcessing(false);
  }, [parseContent]);

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
