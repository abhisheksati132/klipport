import { Link } from "react-router-dom";
import { Clipboard, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center p-4 font-sans"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      <div className="w-full max-w-sm rounded-2xl border p-8 text-center shadow-sm" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: "var(--accent-primary-subtle)", border: "1px solid var(--accent-primary-border)", color: "var(--accent-primary)" }}>
          <Clipboard className="h-6 w-6" />
        </div>

        <span className="text-3xl font-bold tracking-tight block mb-1 font-mono" style={{ color: "var(--text-primary)" }}>404</span>
        <h1 className="text-base font-semibold mb-2 m-0" style={{ color: "var(--text-primary)" }}>Page not found</h1>
        <p className="text-xs leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
          The page or route you are looking for does not exist or has moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <Link
            to="/dashboard"
            className="a-btn flex-1 py-2.5 text-xs justify-center"
          >
            <Home className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <Link
            to="/"
            className="a-btn2 flex-1 py-2.5 text-xs justify-center"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
        </div>
      </div>
    </div>
  );
}
