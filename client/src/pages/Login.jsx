import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { toast } from "react-hot-toast";
import { Clipboard, Lock, Mail, ArrowRight, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      toast.success("Successfully logged in!");
      navigate("/dashboard");
    }
  };

  return (
    <div className="relative flex min-h-screen w-full max-w-full items-center justify-center bg-dark-bg p-4 overflow-hidden">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/4 -z-10 h-72 w-72 rounded-full bg-brand-500/10 blur-[80px]"></div>
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-80 w-80 rounded-full bg-cyan-500/10 blur-[100px]"></div>

      <div className="w-full max-w-md rounded-2xl border border-white/5 bg-white/[0.02] p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-500">
            <Clipboard className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white m-0">Welcome Back</h1>
          <p className="mt-2 text-sm text-gray-400">Access your synchronized clipboard anywhere</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 pl-11 pr-4 text-white placeholder-gray-500 outline-none transition-all duration-200 focus:border-brand-500/50 focus:bg-white/[0.06] focus:ring-1 focus:ring-brand-500/30"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 pl-11 pr-10 text-white placeholder-gray-500 outline-none transition-all duration-200 focus:border-brand-500/50 focus:bg-white/[0.06] focus:ring-1 focus:ring-brand-500/30"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-brand-500 disabled:opacity-50 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] cursor-pointer"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            ) : (
              <>
                Sign In
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          Don't have an account?{" "}
          <Link to="/register" className="font-semibold text-brand-500 hover:underline">
            Sign up for free
          </Link>
        </p>

        <div className="mt-6 border-t border-white/5 pt-4 text-center">
          <Link to="/quick-share" className="text-sm font-semibold text-brand-500 hover:text-brand-100 hover:underline">
            Need a quick transfer? Try Quick Share →
          </Link>
        </div>
      </div>
    </div>
  );
}
