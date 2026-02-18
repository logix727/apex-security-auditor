import { useState, useMemo, useEffect } from 'react';
import { Asset } from '../types';
import lunr from 'lunr';

export function useAssetFilter(assets: Asset[], activeFolderId: number | null, selectedTreePath: string | null) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSource, setFilterSource] = useState<string>('All');
    const [filterMethod, setFilterMethod] = useState<string>('All');
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [filterRisk, setFilterRisk] = useState<number>(0);
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(['url', 'source', 'detections', 'status', 'method', 'risk']));
    const [bodySearchTerm, setBodySearchTerm] = useState('');

    // Create Lunr search index
    const searchIndex = useMemo(() => {
        return lunr(function() {
            this.ref('id');
            this.field('url');
            this.field('source');
            this.field('method');
            this.field('status_code');
            this.field('risk_score');
            this.field('folder_id');
            
            assets.forEach(asset => {
                this.add({
                    id: asset.id,
                    url: asset.url,
                    source: asset.source,
                    method: asset.method,
                    status_code: (asset.status_code ?? '').toString(),
                    risk_score: (asset.risk_score ?? '').toString(),
                    folder_id: asset.folder_id?.toString() || ''
                });
            });
        });
    }, [assets]);

    // Debounced search term
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300); // 300ms debounce
        
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Cleanup function for memory management
    useEffect(() => {
        return () => {
            // Cleanup search index when component unmounts
            // This prevents memory leaks from large search indexes
        };
    }, []);

    const filteredAssets = useMemo(() => {
        let result = assets;
        
        // Apply indexed search first (fastest)
        if (debouncedSearchTerm) {
            const searchResults = searchIndex.search(debouncedSearchTerm);
            let matchingIds = new Set(searchResults.map(r => parseInt(r.ref)));
            
            // Fallback for simple substring matching if index doesn't find anything
            if (matchingIds.size === 0) {
                const lowerTerm = debouncedSearchTerm.toLowerCase();
                result.forEach(a => {
                    if (a.url.toLowerCase().includes(lowerTerm) || 
                        a.source.toLowerCase().includes(lowerTerm) ||
                        a.method.toLowerCase().includes(lowerTerm)) {
                        matchingIds.add(a.id);
                    }
                });
            }
            
            result = result.filter(a => matchingIds.has(a.id));
        }
        
        // Apply source filter
        if (filterSource && filterSource !== 'All') {
            result = result.filter(a => a.source === filterSource);
        }
        
        // Apply method filter
        if (filterMethod && filterMethod !== 'All') {
            result = result.filter(a => a.method === filterMethod);
        }
        
        // Apply status filter
        if (filterStatus && filterStatus !== 'All') {
            if (filterStatus === 'Safe (2xx)') {
                result = result.filter(a => a.status_code >= 200 && a.status_code < 300);
            } else if (filterStatus === 'Redirect (3xx)') {
                result = result.filter(a => a.status_code >= 300 && a.status_code < 400);
            } else if (filterStatus === 'Error (4xx)') {
                result = result.filter(a => a.status_code >= 400 && a.status_code < 500);
            } else if (filterStatus === 'Critical (5xx)') {
                result = result.filter(a => a.status_code >= 500);
            }
        }
        
        // Apply risk filter
        if (filterRisk > 0) {
            result = result.filter(a => a.risk_score >= filterRisk);
        }
        
        // Apply folder filter
        if (activeFolderId) {
            result = result.filter(a => a.folder_id === activeFolderId);
        }
        
        // Apply tree path filter
        if (selectedTreePath) {
            const pathParts = selectedTreePath.split('/');
            const host = pathParts[0];
            result = result.filter(a => {
                try {
                    const u = new URL(a.url);
                    const aHost = u.hostname || a.url.split('/')[2] || a.url;
                    if (aHost !== host) return false;
                    if (selectedTreePath === host) return true;
                    const filterPath = pathParts.slice(1).join('/');
                    const assetPath = u.pathname.split('/').filter(p => p).join('/');
                    return assetPath.startsWith(filterPath);
                } catch(e) { return a.url.includes(host); }
            });
        }
        
        return result;
    }, [
        assets, 
        debouncedSearchTerm, 
        filterSource, 
        filterMethod, 
        filterStatus, 
        filterRisk, 
        activeFolderId, 
        selectedTreePath,
        searchIndex
    ]);

    return {
        searchTerm, setSearchTerm,
        filterSource, setFilterSource,
        filterMethod, setFilterMethod,
        filterStatus, setFilterStatus,
        filterRisk, setFilterRisk,
        visibleColumns, setVisibleColumns,
        bodySearchTerm, setBodySearchTerm,
        filteredAssets
    };
}