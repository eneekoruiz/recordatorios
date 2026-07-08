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
          height: '100vh',
          background: '#09090b',
          color: '#f4f4f5',
          fontFamily: "'Inter', system-ui, sans-serif",
          gap: 24,
          padding: 32,
          textAlign: 'center'
        }}>
          <AlertTriangle size={48} color="#ff453a" />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            Algo salió mal
          </h1>
          <p style={{ color: '#a1a1aa', maxWidth: 400, lineHeight: 1.6 }}>
            La aplicación encontró un error inesperado. Tus datos están seguros en almacenamiento local.
          </p>
          {this.state.error && (
            <pre style={{
              background: '#18181b',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              padding: 16,
              fontSize: '0.8rem',
              color: '#ff453a',
              maxWidth: 500,
              overflow: 'auto',
              textAlign: 'left'
            }}>
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={this.handleRecover}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#f4f4f5',
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
                background: '#0a84ff',
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
