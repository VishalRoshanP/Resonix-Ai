import React from 'react';
import Button from '../ui/Button';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[RESONIX Error Boundary Caught Error]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      console.error('[RESONIX Error Boundary Caught Error]:', this.state.error);
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-14 h-14 bg-error/10 border border-error/20 rounded-2xl flex items-center justify-center">
            <span className="material-symbols-outlined text-error text-3xl">warning</span>
          </div>
          <div className="space-y-1 max-w-lg">
            <h2 className="text-xl font-bold text-primary">Something went wrong</h2>
            <p className="text-xs text-error font-mono font-bold leading-relaxed bg-error/10 p-2 rounded break-words">
              {this.state.error?.toString()}
            </p>
            {this.state.error?.stack && (
              <pre className="text-[10px] text-left text-on-surface-variant font-mono max-h-48 overflow-auto bg-surface border border-outline-variant p-2 rounded break-all whitespace-pre-wrap">
                {this.state.error.stack}
              </pre>
            )}
            <p className="text-xs text-on-surface-variant leading-relaxed pt-2">
              An unexpected error occurred in the Citizen Application. Your emergency telemetry state is safe.
            </p>
          </div>
          <Button variant="primary" icon="refresh" onClick={() => window.location.reload()}>
            Reload Application
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
