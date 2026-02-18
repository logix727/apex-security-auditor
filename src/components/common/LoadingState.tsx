import React from 'react';
import { Loader2, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

export type LoadingStateType = 'loading' | 'success' | 'error' | 'idle';

interface LoadingStateProps {
  type?: LoadingStateType;
  message?: string;
  subMessage?: string;
  progress?: number;
  size?: 'small' | 'medium' | 'large';
  inline?: boolean;
  retryAction?: () => void;
  className?: string;
}

/**
 * Loading state component with multiple states and progress support
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  type = 'loading',
  message,
  subMessage,
  progress,
  size = 'medium',
  inline = false,
  retryAction,
  className = ''
}) => {
  const sizeConfig = {
    small: { icon: 16, container: '24px', font: '12px', sub: '10px' },
    medium: { icon: 32, container: '48px', font: '14px', sub: '12px' },
    large: { icon: 48, container: '64px', font: '16px', sub: '14px' }
  };

  const config = sizeConfig[size];

  const renderIcon = () => {
    switch (type) {
      case 'loading':
        return (
          <div
            style={{
              width: config.container,
              height: config.container,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'spin 1s linear infinite'
            }}
          >
            <Loader2
              size={config.icon}
              color="var(--accent-color)"
              style={{ animation: 'spin 1s linear infinite' }}
            />
          </div>
        );
      case 'success':
        return (
          <div
            style={{
              width: config.container,
              height: config.container,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.1)'
            }}
          >
            <CheckCircle size={config.icon} color="var(--status-safe)" />
          </div>
        );
      case 'error':
        return (
          <div
            style={{
              width: config.container,
              height: config.container,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)'
            }}
          >
            <XCircle size={config.icon} color="var(--status-critical)" />
          </div>
        );
      default:
        return null;
    }
  };

  const getDefaultMessage = () => {
    switch (type) {
      case 'loading':
        return 'Loading...';
      case 'success':
        return 'Success!';
      case 'error':
        return 'Something went wrong';
      default:
        return '';
    }
  };

  if (inline) {
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: config.font,
          color: 'var(--text-secondary)'
        }}
      >
        {type === 'loading' && (
          <Loader2
            size={14}
            color="var(--accent-color)"
            style={{ animation: 'spin 1s linear infinite' }}
          />
        )}
        {message || getDefaultMessage()}
      </span>
    );
  }

  return (
    <div
      className={className}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
        textAlign: 'center'
      }}
    >
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      
      {renderIcon()}

      {message && (
        <h3
          style={{
            fontSize: config.font,
            fontWeight: 600,
            marginTop: '16px',
            marginBottom: '4px',
            color: type === 'error' ? 'var(--status-critical)' : 'var(--text-primary)'
          }}
        >
          {message}
        </h3>
      )}

      {subMessage && (
        <p
          style={{
            fontSize: config.sub,
            color: 'var(--text-secondary)',
            maxWidth: '300px',
            lineHeight: 1.5,
            marginBottom: type === 'error' && retryAction ? '16px' : '0'
          }}
        >
          {subMessage}
        </p>
      )}

      {type === 'loading' && progress !== undefined && (
        <div
          style={{
            width: '200px',
            height: '4px',
            background: 'var(--bg-secondary)',
            borderRadius: '2px',
            marginTop: '16px',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
              height: '100%',
              background: 'var(--accent-color)',
              borderRadius: '2px',
              transition: 'width 0.3s ease'
            }}
          />
        </div>
      )}

      {type === 'error' && retryAction && (
        <button
          onClick={retryAction}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            background: 'var(--accent-color)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <RefreshCw size={14} />
          Try Again
        </button>
      )}
    </div>
  );
};

/**
 * Skeleton loading component for placeholders
 */
interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '16px',
  borderRadius = '4px',
  className = ''
}) => (
  <div
    className={className}
    style={{
      width,
      height,
      borderRadius,
      background: `linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-primary) 50%, var(--bg-secondary) 75%)`,
      backgroundSize: '200% 100%',
      animation: 'skeleton-loading 1.5s ease-in-out infinite'
    }}
  >
    <style>
      {`
        @keyframes skeleton-loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}
    </style>
  </div>
);

/**
 * Table skeleton for loading states
 */
export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div style={{ padding: '16px' }}>
    {/* Header */}
    <div style={{ display: 'flex', gap: '16px', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
      <Skeleton width="40px" height="12px" />
      <Skeleton width="200px" height="12px" />
      <Skeleton width="80px" height="12px" />
      <Skeleton width="100px" height="12px" />
      <Skeleton width="80px" height="12px" />
      <Skeleton width="150px" height="12px" />
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, idx) => (
      <div
        key={idx}
        style={{
          display: 'flex',
          gap: '16px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        <Skeleton width="40px" height="16px" />
        <Skeleton width="200px" height="16px" />
        <Skeleton width="80px" height="16px" />
        <Skeleton width="100px" height="16px" />
        <Skeleton width="80px" height="16px" />
        <Skeleton width="150px" height="16px" />
      </div>
    ))}
  </div>
);

export default LoadingState;
