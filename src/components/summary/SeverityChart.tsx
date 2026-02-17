import React, { memo, useMemo } from 'react';
import { Badge } from '../../types';

export interface SeverityChartProps {
  findings: Badge[];
  type?: 'donut' | 'bar' | 'pie';
  size?: 'small' | 'medium';
  interactive?: boolean;
  onSegmentClick?: (severity: string) => void;
}

interface SeverityConfig {
  color: string;
  label: string;
  order: number;
}

const severityConfigs: Record<string, SeverityConfig> = {
  Critical: { color: '#ef4444', label: 'Critical', order: 1 },
  High: { color: '#f97316', label: 'High', order: 2 },
  Medium: { color: '#eab308', label: 'Medium', order: 3 },
  Low: { color: '#3b82f6', label: 'Low', order: 4 },
  Info: { color: '#10b981', label: 'Info', order: 5 }
};

/**
 * SeverityChart - Visual bar chart showing severity distribution
 * Supports bar, donut, and pie chart types
 */
const SeverityChart: React.FC<SeverityChartProps> = memo(({
  findings,
  type = 'bar',
  size = 'medium',
  interactive = false,
  onSegmentClick
}) => {
  // Calculate severity counts
  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0,
      Info: 0
    };
    
    findings.forEach(f => {
      if (counts[f.severity] !== undefined) {
        counts[f.severity]++;
      }
    });
    
    return counts;
  }, [findings]);

  const total = findings.length;
  const maxCount = Math.max(...Object.values(severityCounts), 1);

  // Bar chart rendering
  if (type === 'bar') {
    return (
      <div 
        className="severity-chart severity-chart-bar"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: size === 'small' ? '12px' : '16px'
        }}
      >
        <div 
          style={{
            fontSize: '11px',
            fontWeight: 'bold',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            marginBottom: '12px',
            letterSpacing: '0.5px'
          }}
        >
          Severity Distribution
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Object.entries(severityConfigs)
            .sort((a, b) => a[1].order - b[1].order)
            .map(([severity, config]) => {
              const count = severityCounts[severity];
              const percentage = total > 0 ? (count / total) * 100 : 0;
              const barWidth = (count / maxCount) * 100;
              
              return (
                <div 
                  key={severity}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {/* Label */}
                  <div 
                    style={{
                      width: '60px',
                      fontSize: '10px',
                      color: 'var(--text-secondary)',
                      flexShrink: 0
                    }}
                  >
                    {config.label}
                  </div>
                  
                  {/* Bar container */}
                  <div 
                    style={{
                      flex: 1,
                      height: '20px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      position: 'relative'
                    }}
                  >
                    {/* Bar fill */}
                    <div
                      style={{
                        width: `${barWidth}%`,
                        height: '100%',
                        background: config.color,
                        borderRadius: '4px',
                        transition: 'width 0.3s ease',
                        cursor: interactive ? 'pointer' : 'default',
                        opacity: count > 0 ? 1 : 0.3
                      }}
                      onClick={() => interactive && onSegmentClick?.(severity)}
                      role={interactive ? 'button' : undefined}
                      tabIndex={interactive ? 0 : undefined}
                      onKeyDown={(e) => {
                        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          onSegmentClick?.(severity);
                        }
                      }}
                    />
                    
                    {/* Count label */}
                    {count > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          color: barWidth > 30 ? 'white' : config.color
                        }}
                      >
                        {count}
                      </div>
                    )}
                  </div>
                  
                  {/* Percentage */}
                  <div 
                    style={{
                      width: '40px',
                      fontSize: '10px',
                      color: 'var(--text-secondary)',
                      textAlign: 'right',
                      flexShrink: 0
                    }}
                  >
                    {percentage.toFixed(0)}%
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    );
  }

  // Donut/Pie chart rendering - memoize derived values to avoid stale closures
  const { centerX, centerY, radius, innerRadius } = useMemo(() => {
    const cx = size === 'small' ? 60 : 80;
    const cy = size === 'small' ? 60 : 80;
    const r = size === 'small' ? 50 : 70;
    const ir = type === 'donut' ? (size === 'small' ? 30 : 40) : 0;
    return { centerX: cx, centerY: cy, radius: r, innerRadius: ir };
  }, [size, type]);

  // Calculate SVG arc paths
  const segments = useMemo(() => {
    if (total === 0) return [];
    
    let currentAngle = -90; // Start from top
    const segmentData: Array<{
      severity: string;
      config: SeverityConfig;
      count: number;
      startAngle: number;
      endAngle: number;
      path: string;
    }> = [];

    Object.entries(severityConfigs)
      .sort((a, b) => a[1].order - b[1].order)
      .forEach(([severity, config]) => {
        const count = severityCounts[severity];
        if (count === 0) return;

        const angleSpan = (count / total) * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angleSpan;

        // Calculate arc path
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;

        const x1 = centerX + radius * Math.cos(startRad);
        const y1 = centerY + radius * Math.sin(startRad);
        const x2 = centerX + radius * Math.cos(endRad);
        const y2 = centerY + radius * Math.sin(endRad);

        const largeArc = angleSpan > 180 ? 1 : 0;

        let path: string;
        if (type === 'donut' && innerRadius > 0) {
          const ix1 = centerX + innerRadius * Math.cos(startRad);
          const iy1 = centerY + innerRadius * Math.sin(startRad);
          const ix2 = centerX + innerRadius * Math.cos(endRad);
          const iy2 = centerY + innerRadius * Math.sin(endRad);

          path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
        } else {
          path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
        }

        segmentData.push({
          severity,
          config,
          count,
          startAngle,
          endAngle,
          path
        });

        currentAngle = endAngle;
      });

    return segmentData;
  }, [severityCounts, total, centerX, centerY, radius, innerRadius, type]);

  return (
    <div 
      className="severity-chart severity-chart-donut"
      style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: size === 'small' ? '12px' : '16px'
      }}
    >
      <div 
        style={{
          fontSize: '11px',
          fontWeight: 'bold',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          marginBottom: '12px',
          letterSpacing: '0.5px'
        }}
      >
        Severity Distribution
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Chart */}
        <svg 
          width={centerX * 2} 
          height={centerY * 2}
          style={{ transform: 'rotate(0deg)' }}
        >
          {total === 0 ? (
            <circle
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="var(--bg-secondary)"
              stroke="var(--border-color)"
              strokeWidth="1"
            />
          ) : (
            segments.map((segment, index) => (
              <path
                key={index}
                d={segment.path}
                fill={segment.config.color}
                stroke="var(--bg-primary)"
                strokeWidth="2"
                style={{
                  cursor: interactive ? 'pointer' : 'default',
                  transition: 'transform 0.2s ease'
                }}
                onClick={() => interactive && onSegmentClick?.(segment.severity)}
                role={interactive ? 'button' : undefined}
                tabIndex={interactive ? 0 : undefined}
                aria-label={interactive ? `${segment.config.label}: ${segment.count} findings` : undefined}
              />
            ))
          )}

          {/* Center text for donut */}
          {type === 'donut' && (
            <text
              x={centerX}
              y={centerY}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fontSize: size === 'small' ? '16px' : '20px',
                fontWeight: '900',
                fill: 'var(--text-primary)'
              }}
            >
              {total}
            </text>
          )}
        </svg>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {Object.entries(severityConfigs)
            .sort((a, b) => a[1].order - b[1].order)
            .map(([severity, config]) => (
              <div 
                key={severity}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  cursor: interactive ? 'pointer' : 'default'
                }}
                onClick={() => interactive && onSegmentClick?.(severity)}
              >
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '2px',
                    background: config.color,
                    opacity: severityCounts[severity] > 0 ? 1 : 0.3
                  }}
                />
                <span 
                  style={{ 
                    fontSize: '10px', 
                    color: 'var(--text-secondary)',
                    opacity: severityCounts[severity] > 0 ? 1 : 0.5
                  }}
                >
                  {config.label} ({severityCounts[severity]})
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
});

SeverityChart.displayName = 'SeverityChart';

export default SeverityChart;
