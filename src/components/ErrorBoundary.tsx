import React, { Component, type ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught component error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-4 rounded border border-red-900/50 bg-red-950/20 text-red-400 my-4 text-base">
          <h3 className="font-semibold mb-1">Something went wrong.</h3>
          <p className="opacity-80 font-mono text-[0.875rem]">{this.state.error?.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
