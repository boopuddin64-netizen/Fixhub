import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    // Ignore third-party browser extension errors (MetaMask, Phantom, etc.)
    const msg = String(error?.message || '').toLowerCase();
    if (
      msg.includes('metamask') ||
      msg.includes('ethereum') ||
      msg.includes('chrome-extension://') ||
      msg.includes('moz-extension://')
    ) {
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const msg = String(error?.message || '').toLowerCase();
    if (
      msg.includes('metamask') ||
      msg.includes('ethereum') ||
      msg.includes('chrome-extension://') ||
      msg.includes('moz-extension://')
    ) {
      // Third-party extension noise: suppress logging to console
      return;
    }
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-100">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-5">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl mx-auto flex items-center justify-center text-red-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black tracking-tight text-white">Something went wrong</h2>
              <p className="text-sm text-slate-400">
                An unexpected error occurred. You can reload the application to continue.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs font-mono text-slate-400 text-left max-h-32 overflow-y-auto break-all">
                {this.state.error.message}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload App</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
