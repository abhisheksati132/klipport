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
        <div
          className="relative flex min-h-screen w-full items-center justify-center p-4 font-sans"
          style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
        >
          <div className="w-full max-w-sm rounded-2xl border p-8 text-center shadow-sm" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", color: "var(--danger)" }}>
              <Clipboard className="h-6 w-6" />
            </div>

            <h1 className="text-lg font-bold tracking-tight mb-1.5 m-0" style={{ color: "var(--text-primary)" }}>Something went wrong</h1>
            <p className="text-xs leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
              An unexpected error occurred while rendering this page.
            </p>

            {this.state.error?.message && (
              <div className="mb-6 rounded-xl border p-3 text-left" style={{ background: "var(--danger-bg)", borderColor: "var(--danger-border)" }}>
                <span className="block text-[10px] font-bold uppercase tracking-wider mb-1 font-mono" style={{ color: "var(--danger)" }}>Error Details:</span>
                <p className="text-xs font-mono m-0 break-words line-clamp-3" style={{ color: "var(--text-primary)" }}>
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={this.handleReload}
                className="a-btn flex-1 py-2.5 text-xs justify-center cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="a-btn2 flex-1 py-2.5 text-xs justify-center cursor-pointer"
              >
                <Home className="h-3.5 w-3.5" /> Return Home
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
