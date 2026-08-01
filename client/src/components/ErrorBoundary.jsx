import React from "react";
import { Clipboard, RotateCcw, Home } from "lucide-react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught application error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="relative flex min-h-screen w-full items-center justify-center bg-[#070709] p-4 text-gray-200 font-sans overflow-hidden">
          {/* Background ambient glows */}
          <div className="absolute top-1/4 left-1/4 -z-10 h-72 w-72 rounded-full bg-brand-500/10 blur-[100px]"></div>
          <div className="absolute bottom-1/4 right-1/4 -z-10 h-80 w-80 rounded-full bg-red-500/10 blur-[120px]"></div>

          <div className="w-full max-w-md rounded-2xl border border-white/5 bg-dark-card p-8 text-center shadow-2xl backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
              <Clipboard className="h-7 w-7" />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Something went wrong</h1>
            <p className="text-xs text-gray-400 leading-relaxed mb-6">
              An unexpected error occurred while rendering this page. Our application state has been safely preserved.
            </p>

            {this.state.error?.message && (
              <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-left">
                <span className="block text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1 font-mono">Error Details:</span>
                <p className="text-xs font-mono text-gray-300 m-0 break-words line-clamp-3">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 rounded-xl bg-brand-600 hover:bg-brand-500 py-3 text-xs font-semibold text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-brand-500/25"
              >
                <RotateCcw className="h-4 w-4" /> Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 py-3 text-xs font-semibold text-gray-300 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="h-4 w-4" /> Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
