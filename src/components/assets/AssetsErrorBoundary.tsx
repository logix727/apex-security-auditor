import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AssetsErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Assets error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          height: '100vh', 
          width: '100vw', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          background: 'var(--bg-primary)', 
          color: 'white',
          padding: '20px',
          textAlign: 'center'
        }}>
          <AlertCircle size={64} color="#ff6b6b" style={{ marginBottom: '24px' }} />
          <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '12px' }}>Assets Error</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: '32px' }}>
            An error occurred while loading or processing assets. Please try refreshing the page.
          </p>
          {this.state.error && (
            <pre style={{ 
              background: 'rgba(255,0,0,0.1)', 
              padding: '16px', 
              borderRadius: '8px', 
              fontSize: '12px', 
              color: '#ff6b6b',
              marginBottom: '32px',
              maxWidth: '80%',
              overflow: 'auto',
              border: '1px solid rgba(255,0,0,0.2)'
            }}>
              {this.state.error.toString()}
            </pre>
          )}
          <button 
            onClick={() => window.location.reload()}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              background: 'var(--accent-color)', 
              color: 'white', 
              border: 'none', 
              padding: '12px 24px', 
              borderRadius: '8px', 
              fontWeight: '600', 
              cursor: 'pointer' 
            }}
          >
            <RefreshCw size={18} />
            Reload Assets
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}