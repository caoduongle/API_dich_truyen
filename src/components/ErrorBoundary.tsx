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
        <div className="p-6 my-4 bg-red-50/60 border border-red-200 rounded-xl shadow-xs text-slate-800 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-3 animate-bounce">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-bold text-slate-900 mb-1">
            {this.props.fallbackTitle || 'Đã xảy ra lỗi tại phân vùng này'}
          </h2>
          <p className="text-xs text-slate-500 max-w-md mb-4 font-mono overflow-auto max-h-24 p-2 bg-white rounded border border-slate-200">
            {this.state.error?.toString() || 'Lỗi không rõ nguồn gốc.'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white py-1.5 px-4 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Khôi phục phân vùng
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 py-1.5 px-4 rounded-lg text-xs font-bold cursor-pointer transition-colors"
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
