import React, { useMemo, useState } from 'react';
import { Asset } from '../../types';
import { Network, ZoomIn, ZoomOut, RefreshCw, Globe } from 'lucide-react';

interface SurfaceViewProps {
  assets: Asset[];
}

interface GraphNode {
  id: string;
  label: string;
  type: 'domain' | 'subdomain' | 'path' | 'endpoint';
  risk: number;
  x: number;
  y: number;
  parentId?: string;
}

interface GraphLink {
  source: string;
  target: string;
}

export const SurfaceView: React.FC<SurfaceViewProps> = ({ assets }) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const graph = useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeMap = new Map<string, GraphNode>();

    // Root node
    const rootId = 'root-node';
    const rootNode: GraphNode = { id: rootId, label: 'Attack Surface', type: 'domain', risk: 0, x: 0, y: 0 };
    nodes.push(rootNode);
    nodeMap.set(rootId, rootNode);

    // Group by domains
    const domainMap = new Map<string, Asset[]>();
    assets.forEach(asset => {
      try {
        const url = new URL(asset.url);
        const domain = url.hostname;
        if (!domainMap.has(domain)) domainMap.set(domain, []);
        domainMap.get(domain)!.push(asset);
      } catch (e) {
        // Fallback for relative paths
        if (!domainMap.has('Local')) domainMap.set('Local', []);
        domainMap.get('Local')!.push(asset);
      }
    });

    // Circular layout
    const domains = Array.from(domainMap.keys());
    const domainRadius = 250;
    
    domains.forEach((domain, i) => {
      const angle = (i / domains.length) * 2 * Math.PI;
      const dx = Math.cos(angle) * domainRadius;
      const dy = Math.sin(angle) * domainRadius;
      
      const domainAssets = domainMap.get(domain)!;
      const maxRisk = Math.max(...domainAssets.map(a => a.risk_score));
      
      const domainNode: GraphNode = { 
        id: domain, 
        label: domain, 
        type: 'subdomain', 
        risk: maxRisk, 
        x: dx, 
        y: dy,
        parentId: rootId
      };
      
      nodes.push(domainNode);
      links.push({ source: rootId, target: domain });
      
      // Endpoints under domain
      const endpointRadius = 120;
      const endpoints = domainAssets.slice(0, 15); // Limit for performance/visuals
      endpoints.forEach((asset, j) => {
        const eAngle = angle - 0.3 + (j / endpoints.length) * 0.6; // Spread around domain
        const ex = dx + Math.cos(eAngle) * endpointRadius;
        const ey = dy + Math.sin(eAngle) * endpointRadius;
        
        const endpointId = `asset-${asset.id}`;
        nodes.push({
          id: endpointId,
          label: `${asset.method} ${new URL(asset.url).pathname.slice(0, 20)}...`,
          type: 'endpoint',
          risk: asset.risk_score,
          x: ex,
          y: ey,
          parentId: domain
        });
        links.push({ source: domain, target: endpointId });
      });
    });

    return { nodes, links };
  }, [assets]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPos.x;
    const dy = e.clientY - lastPos.y;
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  const getRiskColor = (risk: number) => {
    if (risk >= 100) return 'var(--status-critical)';
    if (risk >= 50) return 'var(--status-warning)';
    if (risk > 0) return '#eab308';
    return 'var(--status-safe)';
  };

  return (
    <div style={{ 
      flex: 1, 
      height: '100%', 
      background: 'var(--bg-primary)', 
      position: 'relative', 
      overflow: 'hidden',
      cursor: isDragging ? 'grabbing' : 'grab'
    }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header Controls */}
      <div style={{ 
        position: 'absolute', top: '24px', left: '24px', zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: '12px'
      }}>
        <div className="glass-morphism" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Network size={20} className="text-accent" />
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Attack Surface</h2>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
                Visual mapping of identified infra & endpoints
            </p>
        </div>

        <div className="glass-morphism" style={{ display: 'flex', gap: '8px', padding: '8px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <button onClick={() => setZoom(prev => Math.min(prev + 0.2, 3))} className="title-btn" style={{ padding: '8px' }}><ZoomIn size={16} /></button>
            <button onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.4))} className="title-btn" style={{ padding: '8px' }}><ZoomOut size={16} /></button>
            <button onClick={() => { setZoom(1); setOffset({x:0, y:0}); }} className="title-btn" style={{ padding: '8px' }}><RefreshCw size={16} /></button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ position: 'absolute', bottom: '24px', left: '24px', zIndex: 10 }}>
          <div className="glass-morphism" style={{ padding: '12px', borderRadius: '10px', display: 'flex', gap: '16px', fontSize: '10px', fontWeight: 'bold' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--status-critical)' }}></div> Critical Risk</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--status-warning)' }}></div> High Risk</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--status-safe)' }}></div> Safe / Low</div>
          </div>
      </div>

      {/* Graph Area */}
      <svg 
        style={{ width: '100%', height: '100%' }}
        viewBox={`${-window.innerWidth/2} ${-window.innerHeight/2} ${window.innerWidth} ${window.innerHeight}`}
      >
        <g transform={`translate(${offset.x}, ${offset.y}) scale(${zoom})`}>
          {/* Links */}
          {graph.links.map((link, i) => {
            const sourceNode = graph.nodes.find(n => n.id === link.source);
            const targetNode = graph.nodes.find(n => n.id === link.target);
            if (!sourceNode || !targetNode) return null;
            
            return (
              <line 
                key={i}
                x1={sourceNode.x} y1={sourceNode.y}
                x2={targetNode.x} y2={targetNode.y}
                stroke="var(--border-color)"
                strokeOpacity="0.4"
                strokeWidth="1"
              />
            );
          })}

          {/* Nodes */}
          {graph.nodes.map(node => (
            <g 
                key={node.id} 
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => setSelectedNodeId(node.id)}
                style={{ cursor: 'pointer' }}
            >
              <circle 
                r={node.type === 'domain' ? 30 : node.type === 'subdomain' ? 20 : 8}
                fill={node.type === 'domain' ? 'var(--bg-secondary)' : getRiskColor(node.risk)}
                fillOpacity={node.type === 'endpoint' ? 0.8 : 0.2}
                stroke={getRiskColor(node.risk)}
                strokeWidth={selectedNodeId === node.id ? 3 : 1}
                style={{ transition: 'all 0.3s ease' }}
              />
              {node.type !== 'endpoint' && (
                <text 
                  y={node.type === 'domain' ? 45 : 35}
                  textAnchor="middle"
                  fill="white"
                  fontSize={node.type === 'domain' ? '14px' : '11px'}
                  fontWeight="bold"
                  style={{ pointerEvents: 'none', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                >
                  {node.label}
                </text>
              )}
              {node.type === 'endpoint' && selectedNodeId === node.id && (
                  <text 
                    y={18}
                    textAnchor="middle"
                    fill="white"
                    fontSize="10px"
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.label}
                  </text>
              )}
              {/* Icons for special nodes */}
              {node.type === 'domain' && <Globe size={24} x={-12} y={-12} color="var(--accent-color)" style={{ pointerEvents: 'none' }} />}
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
};
