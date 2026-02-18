self.onmessage = (event: MessageEvent) => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'PROCESS_ASSETS':
            processAssets(data);
            break;
        case 'SEARCH_ASSETS':
            searchAssets(data);
            break;
        default:
            console.warn('Unknown worker message type:', type);
    }
};

function processAssets(assets: any[]) {
    // Heavy computation: process asset data
    const processed = assets.map((asset: any) => ({
        ...asset,
        risk_score: calculateRiskScore(asset),
        badges: generateBadges(asset)
    }));
    
    postMessage({ type: 'PROCESS_ASSETS_COMPLETE', data: processed });
}

function searchAssets(_query: string) {
    const results: any[] = [];
    postMessage({ type: 'SEARCH_ASSETS_COMPLETE', data: results });
}

function calculateRiskScore(asset: any) {
    let score = 0;
    if (asset.status_code >= 500) score += 50;
    if (asset.risk_score) score += asset.risk_score;
    if (asset.findings && asset.findings.length > 0) {
        score += asset.findings.reduce((sum: number, finding: any) => sum + (finding.severity === 'Critical' ? 10 : finding.severity === 'High' ? 7 : 3), 0);
    }
    return score;
}

function generateBadges(asset: any) {
    const badges: Array<{ type: string; count: number }> = [];
    if (asset.status_code >= 500) {
        badges.push({ type: 'critical', count: 1 });
    }
    if (asset.findings && asset.findings.length > 0) {
        badges.push({ type: 'detection', count: asset.findings.length });
    }
    return badges;
}