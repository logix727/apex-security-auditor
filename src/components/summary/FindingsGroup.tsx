import React, { memo, useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Bot } from 'lucide-react';
import { Badge } from '../../types';

export interface FindingsGroupProps {
  title: string;
  icon: React.ReactNode;
  findings: Badge[];
  defaultExpanded?: boolean;
  onFindingClick?: (finding: Badge) => void;
  onAIReview?: (finding: Badge) => void;
  onToggleFP?: (finding: Badge, is_fp: boolean) => void;
  severityColors?: Record<string, string>;
}

const defaultSeverityColors: Record<string, string> = {
  Critical: 'var(--status-critical)',
  High: 'var(--status-warning)',
  Medium: '#eab308',
  Low: '#3b82f6',
  Info: 'var(--status-safe)'
};

const OWASP_URLS: Record<string, string> = {
    'API1:2023 BOLA': 'https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/',
    'API2:2023 Broken Authentication': 'https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/',
    'API3:2023 Broken Object Property Level Authorization': 'https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/',
    'API4:2023 Unrestricted Resource Consumption': 'https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/',
    'API5:2023 Broken Function Level Authorization': 'https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/',
    'API6:2023 Unrestricted Access to Sensitive Business Flows': 'https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/',
    'API7:2023 SSRF': 'https://owasp.org/API-Security/editions/2023/en/0xa7-server-side-request-forgery/',
    'API8:2023 Security Misconfiguration': 'https://owasp.org/API-Security/editions/2023/en/0xa8-security-misconfiguration/',
    'API8:2023 Injection': 'https://owasp.org/API-Security/editions/2023/en/0xa8-security-misconfiguration/', // Mapped to Misconfig as closest 2023 container
    'API9:2023 Improper Inventory Management': 'https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/',
    'API10:2023 Unsafe Consumption of APIs': 'https://owasp.org/API-Security/editions/2023/en/0xaa-unsafe-consumption-of-apis/',
    'Sensitive Data Exposure': 'https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/', // Closest to BOPLA
};

/**
 * FindingsGroup - Grouped findings by severity with expand/collapse functionality
 * Displays findings in a collapsible card format
 */
const FindingsGroup: React.FC<FindingsGroupProps> = memo(({
  title,
  icon,
  findings,
  defaultExpanded = true,
  onFindingClick,
  onAIReview,
  onToggleFP,
  severityColors = defaultSeverityColors
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExpanded();
    }
  }, [toggleExpanded]);

  const handleFindingKeyDown = useCallback((e: React.KeyboardEvent, finding: Badge) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onFindingClick?.(finding);
    }
  }, [onFindingClick]);

  if (findings.length === 0) {
    return null;
  }

  return (
    <div 
      className="findings-group"
      style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          background: 'var(--bg-secondary)',
          cursor: 'pointer',
          userSelect: 'none'
        }}
        onClick={toggleExpanded}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon}
          <span 
            style={{ 
              fontSize: '11px', 
              fontWeight: 'bold', 
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            {title}
          </span>
          <span
            style={{
              background: 'var(--accent-color)20',
              color: 'var(--accent-color)',
              fontSize: '10px',
              fontWeight: 'bold',
              padding: '2px 8px',
              borderRadius: '10px'
            }}
          >
            {findings.length}
          </span>
        </div>
        
        {isExpanded ? (
          <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />
        ) : (
          <ChevronRight size={16} style={{ color: 'var(--text-secondary)' }} />
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px',
            padding: '12px 14px'
          }}
        >
          {findings.map((finding, index) => {
            const severityColor = severityColors[finding.severity] || 'var(--accent-color)';
            
            return (
              <div
                key={`${finding.short}-${index}`}
                style={{
                  background: finding.is_fp ? 'rgba(255,255,255,0.02)' : 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderLeft: `3px solid ${finding.is_fp ? 'var(--text-secondary)' : severityColor}`,
                  borderRadius: '6px',
                  padding: '10px 12px',
                  cursor: onFindingClick ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  opacity: finding.is_fp ? 0.5 : 1
                }}
                onClick={() => onFindingClick?.(finding)}
                onKeyDown={(e) => handleFindingKeyDown(e, finding)}
                role={onFindingClick ? 'button' : undefined}
                tabIndex={onFindingClick ? 0 : undefined}
                className="finding-item"
              >
                {/* Title row */}
                <div 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '0px'
                  }}
                >
                  <span 
                    style={{ 
                      fontSize: '12px', 
                      fontWeight: 'bold', 
                      color: severityColor 
                    }}
                  >
                    {finding.emoji} {finding.short}
                  </span>
                  <div style={{display: 'flex', gap: '6px', alignItems: 'center'}}>
                    {finding.owasp_category && (
                        <a 
                            href={OWASP_URLS[finding.owasp_category] || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                                if (OWASP_URLS[finding.owasp_category || '']) {
                                    e.stopPropagation();
                                } else {
                                    e.preventDefault();
                                }
                            }}
                            title={OWASP_URLS[finding.owasp_category] ? "Open OWASP Documentation" : "OWASP Category"}
                            style={{
                                fontSize: '9px',
                                background: OWASP_URLS[finding.owasp_category] ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.05)',
                                border: OWASP_URLS[finding.owasp_category] ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-color)',
                                color: OWASP_URLS[finding.owasp_category] ? '#60a5fa' : 'var(--text-secondary)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: '600',
                                textDecoration: 'none',
                                cursor: OWASP_URLS[finding.owasp_category] ? 'pointer' : 'default',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            {finding.owasp_category}
                            {OWASP_URLS[finding.owasp_category] && <span style={{fontSize: '8px'}}>↗</span>}
                        </a>
                    )}
                    <span
                        style={{
                        fontSize: '9px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        background: `${severityColor}20`,
                        color: severityColor,
                        padding: '2px 6px',
                        borderRadius: '4px'
                        }}
                    >
                        {finding.severity}
                    </span>
                    {onAIReview && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAIReview(finding);
                            }}
                            title="Get AI Security Analysis"
                            style={{
                                background: 'rgba(99, 102, 241, 0.1)',
                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                color: 'var(--accent-color)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '9px',
                                fontWeight: 'bold'
                            }}
                        >
                            <Bot size={10} /> AI
                        </button>
                    )}
                    {onToggleFP && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleFP(finding, !finding.is_fp);
                            }}
                            title={finding.is_fp ? "Mark as Legitimate" : "Mark as False Positive"}
                            style={{
                                background: finding.is_fp ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                                border: `1px solid ${finding.is_fp ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.2)'}`,
                                color: finding.is_fp ? '#10b981' : 'var(--text-secondary)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '9px',
                                fontWeight: 'bold'
                            }}
                        >
                            {finding.is_fp ? "✓ Valid" : "✕ FP"}
                        </button>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p 
                  style={{ 
                    fontSize: '11px', 
                    color: 'var(--text-secondary)', 
                    margin: 0,
                    lineHeight: '1.4'
                  }}
                >
                  {finding.description}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

FindingsGroup.displayName = 'FindingsGroup';

export default FindingsGroup;
