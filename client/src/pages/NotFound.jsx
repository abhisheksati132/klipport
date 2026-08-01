import { Link } from "react-router-dom";
import { Clipboard, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-[#070709] p-4 text-gray-200 font-sans overflow-hidden">
      {/* Background ambient glows */}
      <div className="absolute top-1/3 left-1/3 -z-10 h-80 w-80 rounded-full bg-brand-500/10 blur-[120px]"></div>
      <div className="absolute bottom-1/3 right-1/3 -z-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-[100px]"></div>

      <div className="w-full max-w-md rounded-2xl border border-white/5 bg-dark-card p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-500">
          <Clipboard className="h-7 w-7" />
        </div>

        <span className="text-5xl font-extrabold text-white tracking-tight block mb-2 font-mono">404</span>
        <h1 className="text-xl font-bold text-white mb-2">Page Not Found</h1>
        <p className="text-xs text-gray-400 leading-relaxed mb-6">
          The page or route you are looking for does not exist, has been moved, or the link has expired.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/dashboard"
            className="flex-1 rounded-xl bg-brand-600 hover:bg-brand-500 py-3 text-xs font-semibold text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            <Home className="h-4 w-4" /> Go to Dashboard
          </Link>
          <Link
            to="/"
            className="flex-1 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 py-3 text-xs font-semibold text-gray-300 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Landing Page
          </Link>
        </div>
      </div>
    </div>
  );
}
