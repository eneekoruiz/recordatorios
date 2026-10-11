import { Component, type ReactNode, type ErrorInfo } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleRecover = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          boxSizing: 'border-box',
          background: 'var(--bg-primary, #09090b)',
          color: 'var(--text-primary, #f4f4f5)',
          fontFamily: 'inherit',
          gap: 24,
          padding: 32,
          textAlign: 'center'
        }}>
          <AlertTriangle size={48} color="#ff453a" />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, letterSpacing: '-0.025em', textWrap: 'balance' }}>
            Algo salió mal
          </h1>
          <p style={{ color: 'var(--text-secondary, #a1a1aa)', maxWidth: 400, lineHeight: 1.6 }}>
            La aplicación encontró un error inesperado. Si aparece un aviso de guardado pendiente, mantén esta pestaña abierta hasta resolverlo.
          </p>
          {this.state.error && (
            <details style={{ width: '100%', maxWidth: 500, minWidth: 0 }}>
              <summary style={{ minHeight: 44, cursor: 'pointer', lineHeight: '44px', color: 'var(--text-secondary, #a1a1aa)' }}>Detalles del error</summary>
            <pre style={{
              background: 'var(--bg-elevated, #18181b)',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
              borderRadius: 12,
              padding: 16,
              fontSize: '0.8rem',
              color: '#ff453a',
              maxWidth: '100%',
              boxSizing: 'border-box',
              overflow: 'auto',
              textAlign: 'left'
            }}>
              {this.state.error.message}
            </pre>
            </details>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
            <button
              onClick={this.handleRecover}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                color: 'var(--text-primary, #f4f4f5)',
                minHeight: 44,
                padding: '10px 20px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 500
              }}
            >
              Intentar recuperar
            </button>
            <button
              onClick={this.handleReload}
              style={{
                background: 'var(--accent-primary, #0a84ff)',
                minHeight: 44,
                border: 'none',
                color: 'white',
                padding: '10px 20px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <RefreshCw size={16} />
              Recargar App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
