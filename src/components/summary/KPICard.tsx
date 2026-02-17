import React, { memo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface KPICardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  color?: 'default' | 'critical' | 'warning' | 'safe' | 'info';
  onClick?: () => void;
}

const colorMap = {
  default: 'var(--accent-color)',
  critical: 'var(--status-critical)',
  warning: 'var(--status-warning)',
  safe: 'var(--status-safe)',
  info: '#3b82f6'
};

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus
};

const trendColors = {
  up: 'var(--status-critical)',
  down: 'var(--status-safe)',
  stable: 'var(--text-secondary)'
};

/**
 * KPICard - Reusable metric card with icon, value, and trend indicator
 * Used for displaying key performance indicators in the Summary tab
 */
const KPICard: React.FC<KPICardProps> = memo(({
  label,
  value,
  icon,
  trend,
  trendValue,
  color = 'default',
  onClick
}) => {
  const accentColor = colorMap[color];
  const TrendIcon = trend ? trendIcons[trend] : null;

  return (
    <div 
      className={`kpi-card ${onClick ? 'kpi-card-clickable' : ''}`}
      style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: '10px',
        padding: '14px 16px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden'
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Background icon watermark */}
      <div 
        style={{
          position: 'absolute',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          opacity: 0.1,
          pointerEvents: 'none'
        }}
      >
        {icon}
      </div>

      {/* Label */}
      <div 
        style={{
          color: 'var(--text-secondary)',
          fontSize: '10px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '4px'
        }}
      >
        {label}
      </div>

      {/* Value row */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}
      >
        <div 
          style={{
            fontSize: '24px',
            fontWeight: '900',
            color: accentColor,
            lineHeight: 1
          }}
        >
          {value}
        </div>

        {/* Trend indicator */}
        {TrendIcon && trendValue && trend && (
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10px',
              color: trendColors[trend],
              background: `${trendColors[trend]}15`,
              padding: '2px 6px',
              borderRadius: '4px'
            }}
          >
            <TrendIcon size={12} />
            <span>{trendValue}</span>
          </div>
        )}
      </div>
    </div>
  );
});

KPICard.displayName = 'KPICard';

export default KPICard;
