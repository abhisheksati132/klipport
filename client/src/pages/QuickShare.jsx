import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { io } from "socket.io-client";
import { supabase } from "../lib/supabase";
import { toast } from "react-hot-toast";
import {
  Clipboard,
  ArrowLeft,
  QrCode,
  UserCheck,
  Send,
  Plus,
  Copy,
  Download,
  Image as ImageIcon,
  FileText,
  File as FileIcon,
  Wifi,
  WifiOff
} from "lucide-react";

export default function QuickShare() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // App states: "select", "pairing", "active"
  const [step, setStep] = useState("select");
  const [code, setCode] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [peerConnected, setPeerConnected] = useState(false);
  const [sharedItems, setSharedItems] = useState([]);
  
  // Socket & Connection State
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  
  // Form states
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const shareUrl = `${window.location.origin}/quick-share?code=${code}`;

  // Initialize WebSockets connection
  useEffect(() => {
    const socketInstance = io(backendUrl);
    setSocket(socketInstance);

    socketInstance.on("connect", () => {
      setConnected(true);
    });

    socketInstance.on("disconnect", () => {
      setConnected(false);
      setPeerConnected(false);
    });

    socketInstance.on("quick-session-created", ({ code }) => {
      setCode(code);
      setStep("pairing");
      toast.success("Quick session created! Share the code to pair.");
    });

    socketInstance.on("quick-session-joined", ({ code }) => {
      setCode(code);
      setPeerConnected(true);
      setStep("active");
      toast.success("Successfully paired and connected!");
    });

    socketInstance.on("peer-connected", () => {
      setPeerConnected(true);
      setStep("active");
      toast.success("A device connected to your session!");
    });

    socketInstance.on("peer-disconnected", () => {
      setPeerConnected(false);
      toast.error("The other device disconnected.");
      setStep("pairing");
    });

    socketInstance.on("receive-quick-item", (item) => {
      toast.success(`Received ${item.type} from peer!`, { icon: "📥" });
      setSharedItems((prev) => [item, ...prev]);
    });

    socketInstance.on("quick-session-error", ({ message }) => {
      toast.error(message);
    });

    // Check if code is in URL query parameters on load
    const urlCode = searchParams.get("code");
    if (urlCode) {
      setJoinCodeInput(urlCode);
      socketInstance.emit("join-quick-session", { code: urlCode });
    }

    return () => {
      socketInstance.disconnect();
    };
  }, [backendUrl, searchParams]);

  const handleCreateSession = () => {
    if (socket) {
      socket.emit("request-quick-session");
    }
  };

  const handleJoinSession = (e) => {
    e.preventDefault();
    if (!joinCodeInput.trim() || joinCodeInput.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }
    if (socket) {
      socket.emit("join-quick-session", { code: joinCodeInput.trim() });
    }
  };

  const handleSendText = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newItem = {
      type: "text",
      title: "Pasted Text",
      content: inputText,
      created_at: new Date().toISOString(),
      sender: "me"
    };

    if (socket) {
      socket.emit("send-quick-item", { code, item: { ...newItem, sender: "peer" } });
    }

    setSharedItems((prev) => [newItem, ...prev]);
    setInputText("");
    toast.success("Text sent!");
  };

  const handleSendFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Direct direct transfers are limited to 5MB. For larger files, please log in.");
      return;
    }

    setSending(true);
    toast.loading("Converting and sending file...", { id: "filesend" });

    const reader = new FileReader();
    reader.onload = (event) => {
      const newItem = {
        type: file.type.startsWith("image/") ? "image" : "file",
        title: file.name,
        content: event.target.result, // base64 DataURL
        created_at: new Date().toISOString(),
        sender: "me"
      };

      if (socket) {
        socket.emit("send-quick-item", { code, item: { ...newItem, sender: "peer" } });
      }

      setSharedItems((prev) => [newItem, ...prev]);
      toast.dismiss("filesend");
      toast.success("File sent!");
      setSending(false);
    };

    reader.onerror = () => {
      toast.dismiss("filesend");
      toast.error("Failed to read file.");
      setSending(false);
    };

    reader.readAsDataURL(file);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!", { icon: "📋" });
  };

  const getIcon = (type) => {
    switch (type) {
      case "text":
        return <FileText className="h-5 w-5 text-blue-400" />;
      case "image":
        return <ImageIcon className="h-5 w-5 text-purple-400" />;
      default:
        return <FileIcon className="h-5 w-5 text-orange-400" />;
    }
  };

  return (
    <div className="relative flex min-h-screen w-screen flex-col items-center justify-center bg-dark-bg p-4 overflow-x-hidden">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/4 -z-10 h-72 w-72 rounded-full bg-brand-500/10 blur-[80px]"></div>
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-80 w-80 rounded-full bg-purple-500/10 blur-[100px]"></div>

      {/* Floating Status Header */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        <Link
          to="/login"
          className="pointer-events-auto flex items-center gap-2 rounded-xl bg-white/[0.02] border border-white/5 px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-white/[0.06] transition-all"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Login
        </Link>

        <div className="flex items-center gap-2 rounded-xl bg-white/[0.02] border border-white/5 px-4 py-2 text-sm">
          {connected ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
              <Wifi className="h-3.5 w-3.5 animate-pulse" /> Live Server
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-red-400 font-semibold">
              <WifiOff className="h-3.5 w-3.5" /> Server Offline
            </span>
          )}
        </div>
      </div>

      {/* STEP 1: Select Creation or Join */}
      {step === "select" && (
        <div className="w-full max-w-md rounded-2xl border border-white/5 bg-white/[0.02] p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-500">
              <Clipboard className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white m-0">Quick Share</h1>
            <p className="mt-2 text-sm text-gray-400">Instantly share data across devices without login</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleCreateSession}
              className="w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white transition-all hover:bg-brand-500 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] cursor-pointer"
            >
              Create New Session
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-white/5"></div>
              <span className="flex-shrink mx-4 text-xs text-gray-500 font-semibold tracking-wider uppercase">or</span>
              <div className="flex-grow border-t border-white/5"></div>
            </div>

            <form onSubmit={handleJoinSession} className="space-y-3">
              <div>
                <input
                  type="text"
                  maxLength="6"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter 6-digit session code"
                  className="w-full text-center rounded-xl border border-white/10 bg-white/[0.03] py-3 text-lg font-bold tracking-[0.25em] text-white placeholder-gray-500 outline-none transition-all focus:border-brand-500/50"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-white/5 border border-white/10 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10 cursor-pointer"
              >
                Join Session
              </button>
            </form>
          </div>
        </div>
      )}

      {/* STEP 2: Pairing mode (Waiting for connection) */}
      {step === "pairing" && (
        <div className="w-full max-w-md rounded-2xl border border-white/5 bg-white/[0.02] p-8 shadow-2xl backdrop-blur-xl text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Connect Device</h2>
          <p className="text-sm text-gray-400 mb-6">Scan QR or enter code on the other device to start pairing</p>

          <div className="mx-auto bg-white p-3 rounded-2xl w-[200px] h-[200px] flex items-center justify-center shadow-lg mb-6">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`}
              alt="Scan to pair"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="bg-black/20 border border-white/5 rounded-2xl p-4 mb-6">
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Session Code</span>
            <span className="text-4xl font-extrabold text-white tracking-[0.1em]">{code}</span>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => handleCopy(shareUrl)}
              className="w-full rounded-xl bg-brand-600/10 border border-brand-500/25 py-2.5 text-xs font-semibold text-brand-500 hover:bg-brand-600/20 transition-all flex items-center justify-center gap-1.5"
            >
              <Copy className="h-4 w-4" /> Copy Pairing URL
            </button>
            <button
              onClick={() => setStep("select")}
              className="w-full py-2.5 text-xs font-semibold text-gray-500 hover:text-gray-300 transition-all cursor-pointer"
            >
              Cancel Session
            </button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
            <div className="h-2 w-2 rounded-full bg-brand-500 animate-ping"></div>
            Waiting for other device...
          </div>
        </div>
      )}

      {/* STEP 3: Active Transfer Room */}
      {step === "active" && (
        <div className="w-full max-w-4xl rounded-2xl border border-white/5 bg-white/[0.02] shadow-2xl backdrop-blur-xl flex flex-col h-[80vh]">
          {/* Room Header */}
          <div className="border-b border-white/5 p-4 flex items-center justify-between bg-white/[0.01]">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-500">
                <Clipboard className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white m-0 flex items-center gap-2">
                  Session Room
                  <span className="text-xs bg-brand-500/20 border border-brand-500/30 text-brand-500 px-2 py-0.5 rounded-full font-bold">
                    {code}
                  </span>
                </h3>
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <UserCheck className="h-3 w-3" /> Connected with peer
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                if (socket) socket.disconnect();
                setStep("select");
                setSharedItems([]);
                setCode("");
              }}
              className="rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 px-4 py-2 text-xs font-semibold text-red-400 transition-all cursor-pointer"
            >
              Close Session
            </button>
          </div>

          {/* Transfer Area */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4 flex flex-col-reverse">
            {sharedItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <FileText className="h-12 w-12 text-gray-600 mb-3" />
                <h4 className="text-base font-semibold text-white">No items transferred yet</h4>
                <p className="text-sm text-gray-500 mt-1">Paste text below or drag-and-drop a file to send instantly.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sharedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl border p-4 max-w-2xl transition-all ${
                      item.sender === "me"
                        ? "bg-brand-600/5 border-brand-500/20 ml-auto"
                        : "bg-white/[0.01] border-white/5 mr-auto"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2">
                        {getIcon(item.type)}
                        <span className="text-xs font-semibold text-gray-400">
                          {item.sender === "me" ? "Sent by Me" : "Received"}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500">
                        {new Date(item.created_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="text-sm text-gray-200">
                      {item.type === "text" && (
                        <div className="relative group">
                          <p className="whitespace-pre-wrap font-sans bg-black/20 p-3 rounded-lg border border-white/5 max-h-40 overflow-y-auto">
                            {item.content}
                          </p>
                          <button
                            onClick={() => handleCopy(item.content)}
                            className="absolute top-2 right-2 p-1 rounded-lg bg-dark-card border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-brand-500 cursor-pointer"
                            title="Copy to clipboard"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      {item.type === "image" && (
                        <div className="relative max-w-sm rounded-lg overflow-hidden border border-white/10 group">
                          <img
                            src={item.content}
                            alt={item.title}
                            className="w-full h-auto max-h-60 object-cover"
                          />
                          <a
                            href={item.content}
                            download={item.title}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-dark-card border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-brand-500 flex items-center justify-center"
                            title="Download Image"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </div>
                      )}

                      {item.type === "file" && (
                        <div className="flex items-center justify-between bg-black/20 px-4 py-2.5 rounded-lg border border-white/5">
                          <span className="font-mono text-xs truncate max-w-xs">{item.title}</span>
                          <a
                            href={item.content}
                            download={item.title}
                            className="p-1 text-xs font-semibold text-brand-500 hover:underline flex items-center gap-1"
                          >
                            <Download className="h-3.5 w-3.5" /> Download
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Input Area */}
          <div className="border-t border-white/5 p-4 bg-white/[0.01]">
            <form onSubmit={handleSendText} className="flex gap-2 items-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleSendFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current.click()}
                disabled={sending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                title="Send File"
              >
                <Plus className="h-5 w-5" />
              </button>

              <input
                type="text"
                placeholder="Type or paste text to sync..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] py-2.5 px-4 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-brand-500/30"
              />

              <button
                type="submit"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition-all hover:shadow-[0_0_12px_rgba(168,85,247,0.3)] cursor-pointer"
                title="Send Text"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
