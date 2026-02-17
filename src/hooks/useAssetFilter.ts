import { useState, useMemo } from 'react';
import { Asset } from '../types';

export function useAssetFilter(assets: Asset[], activeFolderId: number | null, selectedTreePath: string | null) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSource, setFilterSource] = useState<string>('All');
    const [filterMethod, setFilterMethod] = useState<string>('All');
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [filterRisk, setFilterRisk] = useState<number>(0);
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(['url', 'source', 'detections', 'status', 'method', 'risk']));
    const [bodySearchTerm, setBodySearchTerm] = useState('');

    const filteredAssets = useMemo(() => {
        let result = assets;
        if (filterSource && filterSource !== 'All') {
             result = result.filter(a => a.source === filterSource);
        }
        if (filterMethod && filterMethod !== 'All') {
            result = result.filter(a => a.method === filterMethod);
        }
        if (filterStatus && filterStatus !== 'All') {
             if (filterStatus === 'Safe (2xx)') result = result.filter(a => a.status_code >= 200 && a.status_code < 300);
             else if (filterStatus === 'Redirect (3xx)') result = result.filter(a => a.status_code >= 300 && a.status_code < 400);
             else if (filterStatus === 'Error (4xx)') result = result.filter(a => a.status_code >= 400 && a.status_code < 500);
             else if (filterStatus === 'Critical (5xx)') result = result.filter(a => a.status_code >= 500);
        }
        if (filterRisk > 0) {
            result = result.filter(a => a.risk_score >= filterRisk);
        }
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(a => a.url.toLowerCase().includes(lower)); 
        }
        if (activeFolderId) {
            result = result.filter(a => a.folder_id === activeFolderId);
        }
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
    }, [assets, filterSource, filterMethod, filterStatus, filterRisk, searchTerm, activeFolderId, selectedTreePath]);

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
