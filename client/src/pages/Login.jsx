import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { toast } from "react-hot-toast";
import { Clipboard, Lock, Mail, ArrowRight, Eye, EyeOff, Sun, Moon } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
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
      setLoading(false);
      navigate("/dashboard");
    }
  };

  return (
    <div
      data-theme={isDark ? "dark" : "light"}
      className={`relative flex min-h-screen w-full max-w-full items-center justify-center p-4 font-sans ${isDark ? "theme-dark" : "theme-light"}`}
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      <div className="absolute top-4 right-4">
        <button onClick={toggleTheme} className="a-icon-btn" title={isDark ? "Switch to Light" : "Switch to Dark"}>
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      <div className="w-full max-w-sm rounded-2xl border p-8 shadow-sm" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--accent-primary-subtle)", border: "1px solid var(--accent-primary-border)", color: "var(--accent-primary)" }}>
            <Clipboard className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight m-0" style={{ color: "var(--text-primary)" }}>Welcome back</h1>
          <p className="mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>Access your synchronized clipboard anywhere</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Email address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="a-input"
                style={{ paddingLeft: "2.5rem" }}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="a-input"
                style={{ paddingLeft: "2.5rem", paddingRight: "2.5rem" }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors cursor-pointer"
                style={{ color: "var(--text-tertiary)" }}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="a-btn w-full py-2.5 mt-2"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                Sign In
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-xs" style={{ color: "var(--text-secondary)" }}>
          Don't have an account?{" "}
          <Link to="/register" className="font-semibold hover:underline" style={{ color: "var(--accent-primary)" }}>
            Sign up
          </Link>
        </p>

        <div className="mt-5 border-t pt-4 text-center" style={{ borderColor: "var(--border-subtle)" }}>
          <Link to="/quick-share" className="text-xs font-medium hover:underline" style={{ color: "var(--text-secondary)" }}>
            Need a quick transfer? Try Quick Share →
          </Link>
        </div>
      </div>
    </div>
  );
}
