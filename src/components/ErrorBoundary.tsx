import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error in tab:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 my-4 bg-parchment border border-parchment-2 rounded-md shadow-xs text-text-main flex flex-col items-center justify-center text-center">
          <div className="w-10 h-10 bg-polish/10 border border-polish/30 rounded-[3px] flex items-center justify-center text-polish mb-3">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-display font-bold text-text-main mb-1">
            {this.props.fallbackTitle || 'Đã xảy ra lỗi tại phân vùng này'}
          </h2>
          <p className="text-xs text-text-muted max-w-md mb-4 font-mono overflow-auto max-h-24 p-2 bg-ink rounded-[2px] border border-parchment-2">
            {this.state.error?.toString() || 'Lỗi không rõ nguồn gốc.'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-1.5 bg-polish hover:bg-[#A03522] text-white py-1.5 px-4 rounded-[2px] text-xs font-bold cursor-pointer transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Khôi phục phân vùng
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 bg-ink hover:bg-parchment-2 text-text-muted hover:text-text-main py-1.5 px-4 rounded-[2px] text-xs font-medium cursor-pointer transition-colors border border-parchment-2"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
