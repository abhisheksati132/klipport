import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { toast } from "react-hot-toast";
import {
  Clipboard,
  Lock,
  ArrowRight,
  Copy,
  Download,
  Image as ImageIcon,
  FileText,
  File as FileIcon,
  AlertCircle,
  ExternalLink,
  Code
} from "lucide-react";

export default function ShareViewer() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [item, setItem] = useState(null);
  
  // Password protection state
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);

  const fetchSharedItem = async (passwordVal = null) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: rpcError } = await supabase.rpc("get_shared_item", {
        token_val: token,
        password_val: passwordVal
      });

      if (rpcError) {
        const msg = rpcError.message;
        if (msg.includes("Invalid password")) {
          setPasswordRequired(true);
          if (passwordVal !== null) {
            toast.error("Incorrect password. Please try again.");
          }
        } else if (msg.includes("Link has expired")) {
          setError("This shared link has expired.");
        } else if (msg.includes("Link not found")) {
          setError("This shared link does not exist or has been deleted.");
        } else {
          setError(rpcError.message || "Failed to load shared item.");
        }
      } else if (data && data.length > 0) {
        setItem(data[0]);
        setPasswordRequired(false);
      } else {
        setError("This shared link is empty or invalid.");
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchSharedItem();
    }
  }, [token]);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) {
      toast.error("Please enter the password");
      return;
    }
    setVerifying(true);
    fetchSharedItem(password);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!", { icon: "📋" });
  };

  const getIcon = (type) => {
    switch (type) {
      case "text":
        return <FileText className="h-6 w-6 text-blue-400" />;
      case "code":
        return <Code className="h-6 w-6 text-emerald-400" />;
      case "image":
        return <ImageIcon className="h-6 w-6 text-cyan-400" />;
      default:
        return <FileIcon className="h-6 w-6 text-orange-400" />;
    }
  };

  return (
    <div className="relative flex min-h-screen w-full max-w-full items-center justify-center bg-dark-bg p-4 overflow-hidden">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/4 -z-10 h-72 w-72 rounded-full bg-brand-500/10 blur-[80px]"></div>
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-80 w-80 rounded-full bg-cyan-500/10 blur-[100px]"></div>

      {/* Floating Header */}
      <div className="absolute top-4 left-4">
        <Link
          to="/login"
          className="flex items-center gap-2 rounded-xl bg-white/[0.02] border border-white/5 px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-white/[0.06] transition-all"
        >
          <Clipboard className="h-4 w-4 text-brand-500" /> ClipSync
        </Link>
      </div>

      {loading && !verifying ? (
        <div className="flex flex-col items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent"></div>
          <span className="mt-4 text-sm text-gray-400">Loading secure link...</span>
        </div>
      ) : error ? (
        /* Error View */
        <div className="w-full max-w-md rounded-2xl border border-white/5 bg-white/[0.02] p-8 shadow-2xl backdrop-blur-xl text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h2 className="text-2xl font-bold text-white m-0">Unable to Open Link</h2>
          <p className="mt-2 text-sm text-gray-400 leading-relaxed">{error}</p>
          <Link
            to="/login"
            className="mt-6 inline-block rounded-xl bg-white/5 border border-white/10 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-all"
          >
            Create Your Own Clipboard
          </Link>
        </div>
      ) : passwordRequired ? (
        /* Password Prompt View */
        <div className="w-full max-w-md rounded-2xl border border-white/5 bg-white/[0.02] p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-white m-0">Password Protected</h1>
            <p className="mt-2 text-sm text-gray-400">Enter the decryption password to view this item</p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter link password"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 pl-11 pr-4 text-white placeholder-gray-500 outline-none transition-all focus:border-brand-500/50"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={verifying}
              className="group w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white transition-all hover:bg-brand-500 flex items-center justify-center gap-2 cursor-pointer"
            >
              {verifying ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  Access Content
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>
        </div>
      ) : item ? (
        /* Shared Content View */
        <div className="w-full max-w-2xl rounded-2xl border border-white/5 bg-white/[0.02] p-6 md:p-8 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/5 pb-4 mb-6 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                {getIcon(item.type)}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white m-0">{item.title}</h2>
                <span className="text-xs text-gray-500">
                  Shared on {new Date(item.created_at).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              {(item.type === "text" || item.type === "code") && (
                <button
                  onClick={() => handleCopy(item.content)}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-brand-500 transition-all cursor-pointer"
                  title="Copy to Clipboard"
                >
                  <Copy className="h-4.5 w-4.5" />
                </button>
              )}
              {item.file_url && (
                <a
                  href={item.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-brand-500 transition-all flex items-center justify-center"
                  title="Open Link"
                >
                  <ExternalLink className="h-4.5 w-4.5" />
                </a>
              )}
            </div>
          </div>

          <div className="text-sm text-gray-200">
            {item.type === "text" && (
              <p className="whitespace-pre-wrap font-sans bg-black/25 p-4 rounded-xl border border-white/5 max-h-96 overflow-y-auto leading-relaxed">
                {item.content}
              </p>
            )}

            {item.type === "code" && (
              <pre className="overflow-x-auto bg-black/40 p-5 rounded-xl border border-white/5 font-mono text-xs max-h-96">
                <code>{item.content}</code>
              </pre>
            )}

            {item.type === "image" && item.file_url && (
              <div className="relative rounded-xl overflow-hidden border border-white/10">
                <img
                  src={item.file_url}
                  alt={item.title}
                  className="w-full h-auto max-h-[50vh] object-contain mx-auto"
                />
              </div>
            )}

            {item.type === "file" && item.file_url && (
              <div className="flex items-center justify-between bg-black/20 px-5 py-4 rounded-xl border border-white/5">
                <span className="font-mono text-sm truncate max-w-sm">{item.content}</span>
                <a
                  href={item.file_url}
                  download
                  className="rounded-xl bg-brand-600 hover:bg-brand-500 px-5 py-2.5 text-xs font-semibold text-white transition-all hover:shadow-[0_0_10px_rgba(168,85,247,0.3)] flex items-center gap-1.5"
                >
                  <Download className="h-4 w-4" /> Download File
                </a>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
