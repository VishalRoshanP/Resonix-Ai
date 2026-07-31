import React from 'react';
import Button from '../ui/Button';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[RESONIX Responder Error Boundary Caught Exception]:', {
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-14 h-14 bg-error/10 border border-error/20 rounded-2xl flex items-center justify-center">
            <span className="material-symbols-outlined text-error text-3xl">warning</span>
          </div>
          <div className="space-y-2 max-w-lg">
            <h2 className="text-xl font-bold text-primary">Command Center Exception Handled</h2>
            <p className="text-xs text-error font-mono bg-error/10 p-2.5 rounded-xl border border-error/30 text-left overflow-x-auto max-h-32">
              {this.state.error?.toString() || 'Unknown runtime error'}
            </p>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              An exception occurred in component tree. System state has been isolated to prevent corruption.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => this.setState({ hasError: false, error: null })}>
              Dismiss Error
            </Button>
            <Button variant="primary" size="sm" icon="refresh" onClick={() => window.location.reload()}>
              Reload Command Center
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
