import React, { useState } from 'react';
import { Search, Globe, Plus, ShieldCheck, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

interface DiscoveredAsset {
    id: string;
    url: string;
    source: 'cert' | 'crawl' | 'wayback' | 'port_scan' | 'js_analysis';
    risk_estimate: 'High' | 'Medium' | 'Low' | 'Info';
    findings: string[];
    selected: boolean;
}

export const DiscoveryView: React.FC = () => {
    const [domain, setDomain] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [assets, setAssets] = useState<DiscoveredAsset[]>([]);
    const [error, setError] = useState<string | null>(null);
    
    // Advanced Toggles
    const [includeWayback, setIncludeWayback] = useState(true);
    const [includePorts, setIncludePorts] = useState(false);
    const [deepJS, setDeepJS] = useState(true);

    const handleStartDiscovery = async () => {
        if (!domain) return;
        setIsSearching(true);
        setError(null);
        try {
            let allResults: DiscoveredAsset[] = [];
            
            // 1. Certificate Discovery (OSINT)
            const certResults = await invoke<DiscoveredAsset[]>('discover_subdomains', { domain });
            allResults = [...certResults];

            // 2. Wayback Machine (Historical)
            if (includeWayback) {
                try {
                    const waybackResults = await invoke<DiscoveredAsset[]>('fetch_wayback_urls', { domain });
                    allResults = [...allResults, ...waybackResults];
                } catch (e) {
                    console.error("Wayback failed:", e);
                }
            }

            // 3. Port Scanning (Active)
            if (includePorts) {
                try {
                    const portResults = await invoke<DiscoveredAsset[]>('scan_ports', { domain });
                    allResults = [...allResults, ...portResults];
                } catch (e) {
                    console.error("Port scan failed:", e);
                }
            }

            // Deduplicate by URL
            const uniqueResults = Array.from(new Map(allResults.map(a => [a.url, a])).values());
            setAssets(uniqueResults.map(a => ({ ...a, selected: true })));
            toast.success(`Discovery complete: ${uniqueResults.length} assets found.`);
        } catch (e) {
            setError(String(e));
            toast.error(`Discovery failed: ${e}`);
        } finally {
            setIsSearching(false);
        }
    };

    const handleToggleSelect = (id: string) => {
        setAssets(prev => prev.map(a => a.id === id ? { ...a, selected: !a.selected } : a));
    };

    const handlePromote = async () => {
        const selected = assets.filter(a => a.selected);
        if (selected.length === 0) return;
        
        try {
            await invoke('promote_discovered_assets', { assets: selected });
            toast.success(`Successfully added ${selected.length} assets to Manager`);
            setAssets(prev => prev.filter(a => !a.selected));
        } catch (e) {
            toast.error("Failed to promote assets: " + e);
        }
    };

    const handleCrawl = async () => {
        const selected = assets.filter(a => a.selected);
        if (selected.length === 0) return;
        setIsSearching(true);
        setError(null);
        try {
            const results = await invoke<DiscoveredAsset[]>('crawl_discovered_assets', { assets: selected });
            // Add new findings, avoid duplicates
            setAssets(prev => {
                const existingUrls = new Set(prev.map(a => a.url));
                const newAssets = results.filter(a => !existingUrls.has(a.url));
                return [...prev, ...newAssets];
            });
            toast.success(`Crawl complete. Discovered ${results.length} new potential endpoints.`);
        } catch (e) {
            setError(String(e));
            toast.error(`Crawl failed: ${e}`);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="discovery-view" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px' }}>Asset Discovery</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Discover subdomains and hidden endpoints via OSINT and active crawling.</p>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} size={16} />
                        <input 
                            value={domain}
                            onChange={(e) => setDomain(e.target.value)}
                            placeholder="Enter domain (e.g. ford.com)" 
                            style={{ width: '100%', padding: '12px 12px 12px 40px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', fontSize: '14px' }}
                        />
                    </div>
                    <button 
                        onClick={handleStartDiscovery}
                        disabled={isSearching || !domain}
                        style={{ padding: '0 24px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: (isSearching || !domain) ? 0.5 : 1 }}
                    >
                        {isSearching ? <Loader2 size={18} className="spin" /> : <Globe size={18} />}
                        {isSearching ? 'Discovering...' : 'Start Discovery'}
                    </button>
                    {assets.length > 0 && (
                        <button 
                            onClick={handleCrawl}
                            disabled={isSearching || assets.filter(a => a.selected).length === 0}
                            style={{ padding: '0 24px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: isSearching ? 0.5 : 1 }}
                        >
                            {isSearching ? <Loader2 size={18} className="spin" /> : <Search size={18} />}
                            Crawl Selected
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '24px', paddingLeft: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        <input type="checkbox" checked={includeWayback} onChange={(e) => setIncludeWayback(e.target.checked)} />
                        Historical (Wayback)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        <input type="checkbox" checked={includePorts} onChange={(e) => setIncludePorts(e.target.checked)} />
                        Scan Common Ports
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        <input type="checkbox" checked={deepJS} onChange={(e) => setDeepJS(e.target.checked)} />
                        Deep JS Analysis
                    </label>
                </div>
            </div>

            {error && (
                <div style={{ padding: '12px', background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.2)', color: '#ff6b6b', borderRadius: '8px', fontSize: '13px' }}>
                    Error: {error}
                </div>
            )}

            <div style={{ flex: 1, overflow: 'auto', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
                {assets.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', gap: '12px' }}>
                        <Globe size={48} opacity={0.2} />
                        <p>No assets discovered yet. Enter a domain and click Start.</p>
                    </div>
                ) : (
                    <>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{assets.length} results found</span>
                            <button 
                                onClick={handlePromote}
                                style={{ background: 'white', color: 'black', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                            >
                                Add {assets.filter(a => a.selected).length} Selected to Manager
                            </button>
                        </div>
                        <div style={{ overflow: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 1, borderBottom: '1px solid var(--border-color)' }}>
                                    <tr>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', width: '40px' }}></th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Endpoint / Subdomain</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Source</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>CVSS Estimate</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Detections</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {assets.map(asset => (
                                        <tr key={asset.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: asset.selected ? 'rgba(var(--accent-color-rgb), 0.05)' : 'transparent' }}>
                                            <td style={{ padding: '12px 16px' }}>
                                                <input type="checkbox" checked={asset.selected} onChange={() => handleToggleSelect(asset.id)} />
                                            </td>
                                            <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {asset.url}
                                                    <ExternalLink size={12} style={{ color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => window.open(asset.url)} />
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>{asset.source}</span>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: asset.risk_estimate === 'High' ? '#ff6b6b' : asset.risk_estimate === 'Medium' ? '#ffd93d' : '#white' }}>
                                                    {asset.risk_estimate === 'High' ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
                                                    {asset.risk_estimate}
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                    {asset.findings.map((f, i) => (
                                                        <span key={i} style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', padding: '2px 6px', borderRadius: '10px' }}>{f}</span>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
