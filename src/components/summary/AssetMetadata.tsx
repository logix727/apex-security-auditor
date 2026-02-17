import React, { memo, useMemo } from 'react';
import { 
  Globe, 
  Activity, 
  Clock, 
  Database, 
  FileText,
  Zap,
  Calendar
} from 'lucide-react';

export interface AssetMetadataProps {
  method: string;
  statusCode: number;
  url?: string;
  contentType?: string;
  responseSize?: number;
  responseTime?: number;
  lastScanned: string;
  source: string;
  isDocumented?: boolean;
}

const methodColors: Record<string, string> = {
  GET: '#10b981',
  POST: '#3b82f6',
  PUT: '#f97316',
  PATCH: '#eab308',
  DELETE: '#ef4444',
  HEAD: '#8b5cf6',
  OPTIONS: '#6b7280'
};

const statusColors: Record<number, string> = {
  // 2xx
  200: 'var(--status-safe)',
  201: 'var(--status-safe)',
  204: 'var(--status-safe)',
  // 3xx
  301: 'var(--status-warning)',
  302: 'var(--status-warning)',
  304: 'var(--status-warning)',
  // 4xx
  400: 'var(--status-warning)',
  401: 'var(--status-critical)',
  403: 'var(--status-critical)',
  404: 'var(--status-warning)',
  // 5xx
  500: 'var(--status-critical)',
  502: 'var(--status-critical)',
  503: 'var(--status-critical)'
};

/**
 * AssetMetadata - Display quick-reference metadata about the asset
 * Shows HTTP method, status code, content type, size, timing, and source info
 */
const AssetMetadata: React.FC<AssetMetadataProps> = memo(({
  method,
  statusCode,
  url,
  contentType,
  responseSize,
  responseTime,
  lastScanned,
  source,
  isDocumented
}) => {
  const methodColor = methodColors[method.toUpperCase()] || 'var(--accent-color)';
  const statusColor = statusColors[statusCode] || 'var(--text-secondary)';

  // Format response size
  const formattedSize = useMemo(() => {
    if (responseSize === undefined || responseSize === null) return 'N/A';
    if (responseSize < 1024) return `${responseSize} B`;
    if (responseSize < 1024 * 1024) return `${(responseSize / 1024).toFixed(1)} KB`;
    return `${(responseSize / (1024 * 1024)).toFixed(2)} MB`;
  }, [responseSize]);

  // Format response time
  const formattedTime = useMemo(() => {
    if (responseTime === undefined || responseTime === null) return 'N/A';
    if (responseTime < 1000) return `${responseTime}ms`;
    return `${(responseTime / 1000).toFixed(2)}s`;
  }, [responseTime]);

  // Format last scanned date
  const formattedDate = useMemo(() => {
    if (!lastScanned) return 'Never';
    try {
      const date = new Date(lastScanned);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return lastScanned;
    }
  }, [lastScanned]);

  // Parse content type
  const displayContentType = useMemo(() => {
    if (!contentType) return 'Unknown';
    // Extract main content type (e.g., "application/json" -> "JSON")
    const match = contentType.match(/([^/;\s]+)(?:\/([^;\s]+))?/);
    if (match) {
      const subtype = match[2] || match[1];
      return subtype.toUpperCase();
    }
    return contentType.split(';')[0];
  }, [contentType]);

  return (
    <div 
      className="asset-metadata"
      style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '12px 14px'
      }}
    >
      <div 
        style={{
          fontSize: '10px',
          fontWeight: 'bold',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          marginBottom: '10px',
          letterSpacing: '0.5px'
        }}
      >
        Asset Details
      </div>

      {/* Method and Status row */}
      <div 
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '12px'
        }}
      >
        {/* HTTP Method badge */}
        <div
          style={{
            background: `${methodColor}20`,
            color: methodColor,
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <Globe size={12} />
          {method.toUpperCase()}
        </div>

        {/* Status code badge */}
        <div
          style={{
            background: `${statusColor}20`,
            color: statusColor,
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <Activity size={12} />
          {statusCode}
        </div>

        {/* Documentation status */}
        {isDocumented !== undefined && (
          <div
            style={{
              background: isDocumented ? 'var(--status-safe)20' : 'var(--status-warning)20',
              color: isDocumented ? 'var(--status-safe)' : 'var(--status-warning)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '10px',
              fontWeight: 'bold'
            }}
          >
            {isDocumented ? 'Documented' : 'Undocumented'}
          </div>
        )}
      </div>

      {/* Metadata grid */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px'
        }}
      >
        {/* Content Type */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '10px',
            color: 'var(--text-secondary)'
          }}
        >
          <FileText size={12} opacity={0.6} />
          <span style={{ opacity: 0.7 }}>Type:</span>
          <span style={{ color: 'var(--text-primary)' }}>{displayContentType}</span>
        </div>

        {/* Response Size */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '10px',
            color: 'var(--text-secondary)'
          }}
        >
          <Database size={12} opacity={0.6} />
          <span style={{ opacity: 0.7 }}>Size:</span>
          <span style={{ color: 'var(--text-primary)' }}>{formattedSize}</span>
        </div>

        {/* Response Time */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '10px',
            color: 'var(--text-secondary)'
          }}
        >
          <Zap size={12} opacity={0.6} />
          <span style={{ opacity: 0.7 }}>Time:</span>
          <span style={{ color: 'var(--text-primary)' }}>{formattedTime}</span>
        </div>

        {/* Last Scanned */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '10px',
            color: 'var(--text-secondary)'
          }}
        >
          <Clock size={12} opacity={0.6} />
          <span style={{ opacity: 0.7 }}>Scanned:</span>
          <span style={{ color: 'var(--text-primary)' }}>{formattedDate}</span>
        </div>
      </div>

      {/* Source info */}
      {source && (
        <div 
          style={{
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '10px',
            color: 'var(--text-secondary)'
          }}
        >
          <Calendar size={12} opacity={0.6} />
          <span style={{ opacity: 0.7 }}>Source:</span>
          <span 
            style={{ 
              color: 'var(--accent-color)',
              fontWeight: 'bold'
            }}
          >
            {source}
          </span>
        </div>
      )}

      {/* URL display (truncated) */}
      {url && (
        <div 
          style={{
            marginTop: '8px',
            padding: '8px 10px',
            background: 'var(--bg-secondary)',
            borderRadius: '6px',
            fontSize: '10px',
            color: 'var(--text-secondary)',
            wordBreak: 'break-all',
            fontFamily: 'monospace'
          }}
          title={url}
        >
          {url.length > 60 ? `${url.substring(0, 60)}...` : url}
        </div>
      )}
    </div>
  );
});

AssetMetadata.displayName = 'AssetMetadata';

export default AssetMetadata;
