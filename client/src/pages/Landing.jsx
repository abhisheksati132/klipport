import { useEffect } from "react";
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
  ShieldCheck
} from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    // If user is already authenticated, redirect them to their dashboard
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="relative min-h-screen w-full max-w-full bg-dark-bg text-gray-200 overflow-x-hidden flex flex-col justify-between">
      {/* Background ambient glows in Windows 11 blue/cyan */}
      <div className="absolute top-[-10%] left-[-10%] -z-10 h-[500px] w-[500px] rounded-full bg-brand-500/10 blur-[120px]"></div>
      <div className="absolute bottom-[10%] right-[-10%] -z-10 h-[600px] w-[600px] rounded-full bg-cyan-500/10 blur-[150px]"></div>

      {/* Header */}
      <header className="w-full border-b border-white/5 bg-white/[0.01] backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-500">
              <Clipboard className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">Klipport</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/quick-share"
              className="hidden sm:inline-block text-sm font-semibold text-gray-400 hover:text-white transition-all"
            >
              Quick Share
            </Link>
            <Link
              to="/dashboard"
              className="rounded-xl bg-brand-600 hover:bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-[0_0_15px_rgba(0,120,212,0.4)]"
            >
              Open App
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 text-center pt-20 pb-16 flex-1 flex flex-col justify-center">
        {/* Author Credit Badge */}
        <div className="mx-auto mb-6 inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 border border-brand-500/25 px-4 py-1.5 text-xs font-semibold text-brand-500 animate-pulse">
          <ShieldCheck className="h-4 w-4" /> Designed &amp; Developed by Abhishek Sati
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Secure Cross-Device <br />
          <span className="bg-gradient-to-r from-brand-500 via-cyan-400 to-brand-500 bg-clip-text text-transparent bg-[length:200%_auto] animate-pulse">
            Universal Clipboard
          </span>
        </h1>
        
        <p className="mt-6 text-base sm:text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          Instantly synchronize code, notes, images, and files across all your devices with client-side End-to-End Encryption. Built as a desktop-installable PWA.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/dashboard"
            className="group w-full sm:w-auto rounded-xl bg-brand-600 hover:bg-brand-500 px-8 py-3.5 text-sm font-semibold text-white transition-all hover:shadow-[0_0_20px_rgba(0,120,212,0.4)] flex items-center justify-center gap-2"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/quick-share"
            className="w-full sm:w-auto rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 px-8 py-3.5 text-sm font-semibold text-white transition-all flex items-center justify-center"
          >
            Instant Quick Share
          </Link>
        </div>
      </section>

      {/* Feature Showcase Grid */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-white/5 bg-white/[0.01] w-full">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-12">
          Everything You Need to Sync Smarter
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-6 hover:bg-white/[0.02] transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 mb-4">
              <Wifi className="h-5 w-5" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Real-Time Sync</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Updates broadcast instantly over secure WebSockets. Copied snippets populate across your devices without page refreshes.
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-6 hover:bg-white/[0.02] transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 mb-4">
              <Lock className="h-5 w-5" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Zero-Knowledge E2EE</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Encrypt text, code, and files in-browser using PBKDF2 and AES-GCM before upload. Database administrators cannot read your data.
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-6 hover:bg-white/[0.02] transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 mb-4">
              <Share2 className="h-5 w-5" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Expiring Public Links</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Share items publicly with secure, expiring tokens. Optional password hashing (bcrypt) runs entirely at the database layer.
            </p>
          </div>

          {/* Card 4 */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-6 hover:bg-white/[0.02] transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 mb-4">
              <Users className="h-5 w-5" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Team Workspaces</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Collaborate on code and files with teammates. Switch workspaces instantly and invite members by email with RLS security.
            </p>
          </div>

          {/* Card 5 */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-6 hover:bg-white/[0.02] transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 mb-4">
              <Database className="h-5 w-5" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">IndexedDB Offline Queue</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Keep sync active even offline. Local caching queues text and code clips, auto-syncing them back to Supabase when you connect.
            </p>
          </div>

          {/* Card 6 */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-6 hover:bg-white/[0.02] transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400 mb-4">
              <Terminal className="h-5 w-5" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Developer CLI App</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Interact with your cloud clipboard directly from the terminal. Push custom strings or pipe console outputs directly.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 bg-white/[0.01] py-8 text-center text-xs text-gray-500">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="m-0">© {new Date().getFullYear()} Klipport. All rights reserved.</p>
          <p className="m-0 font-semibold text-brand-500">
            Designed &amp; Crafted with 💻 by Abhishek Sati
          </p>
        </div>
      </footer>
    </div>
  );
}
