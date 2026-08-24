import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  Clipboard,
  Wifi,
  Lock,
  Share2,
  Users,
  Database,
  Terminal,
  ArrowRight,
  ShieldCheck,
  Sun,
  Moon
} from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("klipport_theme");
    if (saved) return saved === "dark";
    return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const theme = isDark ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("klipport_theme", theme);
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(prev => !prev);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div
      data-theme={isDark ? "dark" : "light"}
      className={`min-h-screen w-full max-w-full flex flex-col justify-between font-sans ${isDark ? "theme-dark" : "theme-light"}`}
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      {/* Header */}
      <header className="w-full border-b sticky top-0 z-40 a-header">
        <div className="max-w-5xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "var(--accent-primary-subtle)", border: "1px solid var(--accent-primary-border)", color: "var(--accent-primary)" }}>
              <Clipboard className="h-4 w-4" />
            </div>
            <span className="text-[17px] font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Klipport</span>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="a-icon-btn" title={isDark ? "Switch to Light" : "Switch to Dark"}>
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to="/quick-share"
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: "var(--text-secondary)" }}
            >
              Quick Share
            </Link>
            <Link
              to="/login"
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: "var(--text-secondary)" }}
            >
              Sign In
            </Link>
            <Link
              to="/dashboard"
              className="a-btn text-xs py-2 px-3.5"
            >
              Open App
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-3xl mx-auto px-6 text-center pt-20 pb-16 flex-1 flex flex-col justify-center">
        {/* Author Credit Badge */}
        <div
          className="mx-auto mb-6 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-medium"
          style={{ background: "var(--accent-primary-subtle)", border: "1px solid var(--accent-primary-border)", color: "var(--accent-primary)" }}
        >
          <ShieldCheck className="h-3.5 w-3.5" /> Designed &amp; Developed by Abhishek Sati
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight m-0" style={{ color: "var(--text-primary)" }}>
          Universal Cross-Device <br />
          <span style={{ color: "var(--accent-primary)" }}>
            Clipboard &amp; Sync Platform
          </span>
        </h1>
        
        <p className="mt-5 text-sm sm:text-base max-w-xl mx-auto leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Instantly synchronize code snippets, notes, images, and files across all your devices with client-side End-to-End Encryption. Built for calm, reliable developer workflows.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/dashboard"
            className="a-btn w-full sm:w-auto px-6 py-2.5 text-sm"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/quick-share"
            className="a-btn2 w-full sm:w-auto px-5 py-2.5 text-sm justify-center"
          >
            Instant Quick Share
          </Link>
        </div>
      </section>

      {/* Feature Showcase Grid */}
      <section className="max-w-5xl mx-auto px-6 py-16 border-t w-full" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="text-center mb-10">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight m-0" style={{ color: "var(--text-primary)" }}>
            Calm, focused tools for your daily sync
          </h2>
          <p className="text-xs sm:text-sm mt-1.5" style={{ color: "var(--text-secondary)" }}>
            Everything needed to transfer and transform content without friction.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1 */}
          <div className="a-card p-5" style={{ margin: 0 }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg mb-3.5" style={{ background: "var(--accent-primary-subtle)", color: "var(--accent-primary)" }}>
              <Wifi className="h-4 w-4" />
            </div>
            <h4 className="text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>Real-Time Sync</h4>
            <p className="text-xs leading-relaxed m-0" style={{ color: "var(--text-secondary)" }}>
              Updates broadcast instantly over secure WebSockets. Copied snippets populate across devices without page refreshes.
            </p>
          </div>

          {/* Card 2 */}
          <div className="a-card p-5" style={{ margin: 0 }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg mb-3.5" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
              <Lock className="h-4 w-4" />
            </div>
            <h4 className="text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>Client-Side E2EE</h4>
            <p className="text-xs leading-relaxed m-0" style={{ color: "var(--text-secondary)" }}>
              Optionally encrypt text, code, and files in your browser with PBKDF2 and AES-GCM before upload — encrypted clips stay unreadable to the server.
            </p>
          </div>

          {/* Card 3 */}
          <div className="a-card p-5" style={{ margin: 0 }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg mb-3.5" style={{ background: "var(--accent-primary-subtle)", color: "var(--accent-primary)" }}>
              <Share2 className="h-4 w-4" />
            </div>
            <h4 className="text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>Expiring Public Links</h4>
            <p className="text-xs leading-relaxed m-0" style={{ color: "var(--text-secondary)" }}>
              Share clips securely with custom expiration timers and optional passphrases for quick cross-network transfers.
            </p>
          </div>

          {/* Card 4 */}
          <div className="a-card p-5" style={{ margin: 0 }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg mb-3.5" style={{ background: "var(--cyan-bg)", color: "var(--cyan)" }}>
              <Users className="h-4 w-4" />
            </div>
            <h4 className="text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>Team Workspaces</h4>
            <p className="text-xs leading-relaxed m-0" style={{ color: "var(--text-secondary)" }}>
              Collaborate on code and assets with teammates. Switch workspaces instantly and invite members with role-based access.
            </p>
          </div>

          {/* Card 5 */}
          <div className="a-card p-5" style={{ margin: 0 }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg mb-3.5" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
              <Database className="h-4 w-4" />
            </div>
            <h4 className="text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>Offline Support</h4>
            <p className="text-xs leading-relaxed m-0" style={{ color: "var(--text-secondary)" }}>
              IndexedDB queues clips locally when offline and seamlessly syncs them the moment your connection restores.
            </p>
          </div>

          {/* Card 6 */}
          <div className="a-card p-5" style={{ margin: 0 }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg mb-3.5" style={{ background: "var(--accent-primary-subtle)", color: "var(--accent-primary)" }}>
              <Terminal className="h-4 w-4" />
            </div>
            <h4 className="text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>Developer CLI</h4>
            <p className="text-xs leading-relaxed m-0" style={{ color: "var(--text-secondary)" }}>
              Interact with your cloud clipboard directly from your terminal. Pipe console outputs or retrieve stored keys via CLI.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t py-6 text-center text-xs" style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="m-0">© {new Date().getFullYear()} Klipport. All rights reserved.</p>
          <p className="m-0 font-medium" style={{ color: "var(--accent-primary)" }}>
            Designed &amp; Crafted by Abhishek Sati
          </p>
        </div>
      </footer>
    </div>
  );
}
