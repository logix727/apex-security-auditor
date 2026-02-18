import { Badge, Asset } from '../types';
import { User, Lock, Key, Shield, AlertCircle, FileDigit, Info, Car, Server, Database, Hourglass } from 'lucide-react';

// Re-export for direct usage
export { getDetectionBadges, getStatusBadge, getSourceIcon, getStatusColor };

export const assetUtils = {
  badges: {
    getDetectionBadges,
    getStatusBadge,
  },
  filters: {
    applyFilters,
    createFilterIndex,
    optimizeFilter,
  },
  validation: {
    validateAsset,
    sanitizeInput,
    checkIntegrity,
  },
  icons: {
    getSourceIcon,
  },
  colors: {
    getStatusColor,
  },
};

function getDetectionBadges(findings: Badge[]) {
  if (!findings || findings.length === 0) return null;

  // Categorize findings using the actual backend fields: short, owasp_category, description
  const categories: Record<string, { count: number; findings: Badge[]; icon: any; color: string; label: string }> = {
    'PII':       { count: 0, findings: [], icon: User,        color: '#a855f7', label: 'PII & Privacy' },
    'Auth':      { count: 0, findings: [], icon: Lock,        color: '#ef4444', label: 'Authentication' },
    'Secret':    { count: 0, findings: [], icon: Key,         color: '#f59e0b', label: 'Secrets' },
    'Header':    { count: 0, findings: [], icon: Shield,      color: '#3b82f6', label: 'Security Headers' },
    'SSRF':      { count: 0, findings: [], icon: Server,      color: '#ec4899', label: 'SSRF' },
    'MassAssign':{ count: 0, findings: [], icon: Database,    color: '#f59e0b', label: 'Mass Assignment' },
    'RateLimit': { count: 0, findings: [], icon: Hourglass,   color: '#6366f1', label: 'Rate Limiting' },
    'Auto':      { count: 0, findings: [], icon: Car,         color: '#ec4899', label: 'Automotive' },
    'BOLA':      { count: 0, findings: [], icon: FileDigit,   color: '#f97316', label: 'BOLA / IDOR' },
    'Info':      { count: 0, findings: [], icon: Info,        color: '#8b5cf6', label: 'Info Disclosure' },
    'Other':     { count: 0, findings: [], icon: AlertCircle, color: '#64748b', label: 'Other Detections' }
  };

  findings.forEach((f) => {
    // Use the actual populated fields from the backend
    const short = (f.short || '').toLowerCase();
    const desc  = (f.description || '').toLowerCase();
    const owasp = (f.owasp_category || '').toLowerCase();

    // PII — owasp API3 + PII-related short names
    if (short.includes('ssn') || short.includes('email') || short.includes('phone') ||
        short.includes('credit') || short.includes('passport') || short.includes('iban') ||
        short.includes('nino') || short.includes('sin') || short.includes('pii') ||
        (owasp.includes('api3') && desc.includes('pii'))) {
      categories['PII'].count++; categories['PII'].findings.push(f);
    // Auth — broken auth owasp or auth-related short
    } else if (short.includes('jwt') || short.includes('auth') || short.includes('bearer') ||
               short.includes('session') || short.includes('token') ||
               (owasp.includes('api2') && !short.includes('key') && !short.includes('secret'))) {
      categories['Auth'].count++; categories['Auth'].findings.push(f);
    // Secrets — API keys, tokens, passwords
    } else if (short.includes('key') || short.includes('secret') || short.includes('password') ||
               short.includes('credential') || short.includes('aws') || short.includes('stripe') ||
               short.includes('github') || short.includes('slack') || short.includes('twilio') ||
               short.includes('sendgrid') || short.includes('openai') || short.includes('api_key')) {
      categories['Secret'].count++; categories['Secret'].findings.push(f);
    // SSRF
    } else if (short.includes('ssrf') || owasp.includes('api7') || desc.includes('server side request')) {
      categories['SSRF'].count++; categories['SSRF'].findings.push(f);
    // Mass Assignment
    } else if (short.includes('mass') || short.includes('assignment') ||
               (owasp.includes('api3') && desc.includes('mass'))) {
      categories['MassAssign'].count++; categories['MassAssign'].findings.push(f);
    // Rate Limiting
    } else if (short.includes('rate') || short.includes('limit') || owasp.includes('api4')) {
      categories['RateLimit'].count++; categories['RateLimit'].findings.push(f);
    // Security Headers — missing headers, CSP, HSTS, etc.
    } else if (short.includes('content-security') || short.includes('x-content') ||
               short.includes('x-frame') || short.includes('strict-transport') ||
               short.includes('hsts') || short.includes('csp') || short.includes('cors') ||
               short.includes('access-control') || short.includes('referrer') ||
               (owasp.includes('api8') && (desc.includes('header') || desc.includes('missing')))) {
      categories['Header'].count++; categories['Header'].findings.push(f);
    // Automotive
    } else if (short.includes('vin') || short.includes('dtc') || short.includes('gps') ||
               short.includes('nmea') || short.includes('obd') || short.includes('can bus')) {
      categories['Auto'].count++; categories['Auto'].findings.push(f);
    // BOLA / IDOR
    } else if (short === 'bola' || short.includes('idor') || short.includes('object level') ||
               owasp.includes('api1')) {
      categories['BOLA'].count++; categories['BOLA'].findings.push(f);
    // Info Disclosure — tech stack errors, stack traces
    } else if (short.includes('error') || short.includes('stack') || short.includes('trace') ||
               short.includes('disclosure') || short.includes('laravel') || short.includes('django') ||
               short.includes('rails') || short.includes('spring') || short.includes('express') ||
               owasp.includes('api8')) {
      categories['Info'].count++; categories['Info'].findings.push(f);
    } else {
      categories['Other'].count++; categories['Other'].findings.push(f);
    }
  });

  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {Object.entries(categories).map(([key, cat]) => {
        if (cat.count === 0) return null;
        const Icon = cat.icon;
        
        // Tooltip content
        const tooltipContent = `${cat.label} (${cat.count}):\n\n` + cat.findings.map((f) => 
          `• [${f.severity}] ${f.short}: ${f.description}`
        ).join('\n');

        return (
          <span key={key} title={tooltipContent} style={{ 
            background: `${cat.color}15`, 
            color: cat.color, 
            border: `1px solid ${cat.color}30`,
            padding: '2px 4px', 
            borderRadius: '4px', 
            fontSize: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'help',
            gap: '3px',
            height: '18px'
          }}>
            <Icon size={10} strokeWidth={2.5} />
            <span style={{ fontWeight: 'bold' }}>{cat.count}</span>
          </span>
        );
      })}
    </div>
  );
}

function getSourceIcon(source: string, isRecursive?: boolean) {
  let icon = '📥';
  let label = source || 'Import';
  let color = '#3b82f6';
  let bg = 'rgba(59, 130, 246, 0.1)';

  const s = (source || '').toLowerCase();

  if (s === 'recursive' || s === 'discovery' || isRecursive) {
    icon = '🔄';
    label = 'Recursive';
    color = '#a855f7';
    bg = 'rgba(168, 85, 247, 0.1)';
  } else if (s === 'proxy') {
    icon = '🛡️';
    label = 'Proxy';
    color = '#10b981';
    bg = 'rgba(16, 185, 129, 0.1)';
  } else if (s.includes('openapi') || s.includes('swagger') || s.includes('.yaml') || s.includes('.yml') || s.includes('.json')) {
    icon = '📋';
    label = 'OpenAPI';
    color = '#10b981';
    bg = 'rgba(16, 185, 129, 0.1)';
  } else if (s.includes('csv') || s.includes('.csv')) {
    icon = '📊';
    label = 'CSV';
    color = '#10b981';
    bg = 'rgba(16, 185, 129, 0.1)';
  } else if (s === 'paste' || s === 'dropped text') {
    icon = '📋';
    label = 'Paste';
    color = '#6366f1';
    bg = 'rgba(99, 102, 241, 0.1)';
  } else if (s === 'user' || s === 'manual') {
    icon = '✏️';
    label = 'Manual';
    color = '#3b82f6';
    bg = 'rgba(59, 130, 246, 0.1)';
  } else if (s === 'workbench') {
    // Legacy: assets that had source overwritten to 'Workbench'
    icon = '🔬';
    label = 'Import';
    color = '#3b82f6';
    bg = 'rgba(59, 130, 246, 0.1)';
  } else if (s.startsWith('reimport')) {
    icon = '♻️';
    label = 'Reimport';
    color = '#6366f1';
    bg = 'rgba(99, 102, 241, 0.1)';
  } else {
    // File name or other source — show truncated
    icon = '📥';
    label = source.length > 12 ? source.slice(0, 12) + '…' : source;
    color = '#3b82f6';
    bg = 'rgba(59, 130, 246, 0.1)';
  }

  return (
    <span title={`Source: ${label}`} style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      gap: '4px',
      background: bg,
      color: color,
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '10px',
      fontWeight: '600',
      border: `1px solid ${color}30`,
      cursor: 'help',
      whiteSpace: 'nowrap'
    }}>
      <span>{icon}</span>
      {label}
    </span>
  );
}

function getStatusColor(code: number) {
  if (code === 0) return 'var(--status-critical)';
  if (code >= 200 && code < 300) return 'var(--status-safe)';
  if (code >= 300 && code < 400) return '#3b82f6';
  if (code >= 400 && code < 500) return 'var(--status-warning)';
  if (code >= 500) return 'var(--status-critical)';
  return 'var(--text-secondary)';
}

function getStatusBadge(code: number, findings: Badge[]) {
  let emoji = '🌐';
  if (code === 0) emoji = '💀';
  else if (code === 401) emoji = '🔒';
  else if (code === 403) emoji = '🚫';
  else if (code === 429) emoji = '⏱️';
  else if (code >= 500) emoji = '⚠️';
  // Keeping these checks for emoji selection as they are useful visual indicators
  else if (findings.some((f) => f.short === 'Auth')) emoji = '🔒';
  else if (findings.some((f) => f.short === '403')) emoji = '🚫';
  else if (findings.some((f) => f.short === 'Rate')) emoji = '⏱️';

  return (
    <span style={{ 
      color: getStatusColor(code), 
      fontWeight: 'bold',
      fontFamily: 'monospace',
      background: `${getStatusColor(code)}20`,
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '11px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px'
    }}>
      <span>{emoji}</span>
      {code === 0 ? 'FAIL' : code}
    </span>
  );
}

// Filter functions
function applyFilters(assets: Asset[], _filters: Record<string, unknown>): Asset[] {
  return assets.filter((_asset) => {
    // Implement filtering logic here
    return true;
  });
}

function createFilterIndex(_assets: Asset[]): Record<string, Asset[]> {
  // Implement indexed search
  return {};
}

function optimizeFilter(assets: Asset[], _filter: string): Asset[] {
  // Implement optimized filtering
  return assets;
}

// Validation functions
function validateAsset(_asset: Asset): boolean {
  // Implement validation logic
  return true;
}

function sanitizeInput(input: string): string {
  // Implement sanitization
  return input;
}

function checkIntegrity(_asset: Asset): boolean {
  // Implement integrity check
  return true;
}