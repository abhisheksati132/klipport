import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { toast } from "react-hot-toast";
import { io } from "socket.io-client";
import { deriveKey, encryptText, decryptText, encryptFile, decryptFile } from "../utils/crypto";
import {
  Clipboard,
  FileText,
  Code,
  Image as ImageIcon,
  File as FileIcon,
  Trash2,
  Copy,
  LogOut,
  User,
  Plus,
  Search,
  ExternalLink,
  Wifi,
  WifiOff,
  Share2,
  Lock,
  X,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Download,
  Menu
} from "lucide-react";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [rawItems, setRawItems] = useState([]); // unmodified Supabase items
  const [items, setItems] = useState([]); // processed/decrypted items
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  
  // Socket State
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  // E2EE States
  const [passphrase, setPassphrase] = useState("");
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [showPassphraseModal, setShowPassphraseModal] = useState(false);
  const [passphraseInput, setPassphraseInput] = useState("");
  const [useE2EE, setUseE2EE] = useState(false);
  const [decryptedFiles, setDecryptedFiles] = useState({}); // maps item.id to local decrypted blob URLs

  // Mobile navigation state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // New item form state
  const [itemType, setItemType] = useState("text");
  const [textContent, setTextContent] = useState("");
  const [codeContent, setCodeContent] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("javascript");
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Sharing Modal State
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareItem, setShareItem] = useState(null);
  const [shareExpiration, setShareExpiration] = useState("3600"); // 1 hour default
  const [sharePassword, setSharePassword] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);

  const navigate = useNavigate();
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  useEffect(() => {
    let socketInstance = null;

    const initApp = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        
        // Auto-load passphrase if saved in sessionStorage
        const storedPassphrase = sessionStorage.getItem("clipsync_passphrase");
        if (storedPassphrase) {
          setPassphrase(storedPassphrase);
          try {
            const key = await deriveKey(storedPassphrase);
            setEncryptionKey(key);
            setUseE2EE(true);
          } catch (err) {
            console.error("Failed to auto-derive key:", err);
          }
        }

        fetchItems(session.user.id);

        socketInstance = io(backendUrl);
        setSocket(socketInstance);

        socketInstance.on("connect", () => {
          setConnected(true);
          socketInstance.emit("join-room", session.user.id);
        });

        socketInstance.on("disconnect", () => {
          setConnected(false);
        });

        socketInstance.on("clip-sync", (data) => {
          toast.success("Updated in real-time from another device!", { icon: "🔄" });
          fetchItems(session.user.id);
        });
      } else {
        navigate("/login");
      }
    };
    
    initApp();

    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, [navigate, backendUrl]);

  // Decrypt items when rawItems or encryptionKey changes
  useEffect(() => {
    const processItems = async () => {
      const processed = await Promise.all(
        rawItems.map(async (item) => {
          if (!item.is_encrypted) {
            return item;
          }

          if (!encryptionKey) {
            return {
              ...item,
              title: item.title,
              content: "[Locked - Enter Passphrase to Decrypt]",
              locked: true
            };
          }

          try {
            if (item.type === "text" || item.type === "code") {
              const decryptedContent = await decryptText(item.content, encryptionKey);
              return { ...item, content: decryptedContent, locked: false };
            } else {
              triggerFileDecryption(item);
              return { ...item, locked: false };
            }
          } catch (err) {
            return {
              ...item,
              content: "[Decryption Failed - Check Passphrase]",
              locked: true
            };
          }
        })
      );
      setItems(processed);
    };

    processItems();
  }, [rawItems, encryptionKey]);

  const triggerFileDecryption = async (item) => {
    if (decryptedFiles[item.id]) return;

    try {
      const response = await fetch(item.file_url);
      const encryptedBuffer = await response.arrayBuffer();
      const decryptedBuffer = await decryptFile(encryptedBuffer, encryptionKey);
      
      const blobType = item.type === "image" ? "image/*" : "application/octet-stream";
      const blob = new Blob([decryptedBuffer], { type: blobType });
      const localUrl = URL.createObjectURL(blob);
      
      setDecryptedFiles(prev => ({
        ...prev,
        [item.id]: localUrl
      }));
    } catch (err) {
      console.error(`Failed to decrypt file for item ${item.id}:`, err);
    }
  };

  const fetchItems = async (userId) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clipboard_items")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "P0001" || error.message.includes("does not exist")) {
        toast.error("Database table 'clipboard_items' not found. Please run the SQL migration in Supabase SQL editor.");
      } else {
        toast.error("Failed to fetch items: " + error.message);
      }
    } else {
      setRawItems(data || []);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    if (socket) socket.disconnect();
    sessionStorage.removeItem("clipsync_passphrase");
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!", { icon: "📋" });
  };

  const handleSetPassphrase = async (e) => {
    e.preventDefault();
    if (!passphraseInput.trim()) {
      toast.error("Please enter a passphrase");
      return;
    }

    try {
      const key = await deriveKey(passphraseInput);
      setEncryptionKey(key);
      setPassphrase(passphraseInput);
      sessionStorage.setItem("clipsync_passphrase", passphraseInput);
      setUseE2EE(true);
      setShowPassphraseModal(false);
      toast.success("E2EE Passphrase Set Successfully!", { icon: "🔒" });
    } catch (err) {
      toast.error("Failed to derive encryption key: " + err.message);
    }
  };

  const handleClearPassphrase = () => {
    setEncryptionKey(null);
    setPassphrase("");
    sessionStorage.removeItem("clipsync_passphrase");
    setUseE2EE(false);
    toast.success("Passphrase cleared. E2EE locked.");
  };

  const handleFileUpload = async (userId, keyToUse) => {
    if (!file) return null;
    
    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    let bodyData = file;
    
    if (keyToUse) {
      const fileBuffer = await file.arrayBuffer();
      const encryptedBuffer = await encryptFile(fileBuffer, keyToUse);
      bodyData = new Blob([encryptedBuffer], { type: "application/octet-stream" });
    }

    const { error: uploadError } = await supabase.storage
      .from("clip-files")
      .upload(filePath, bodyData);

    if (uploadError) {
      if (uploadError.message.includes("Bucket not found") || uploadError.error === "Bucket not found") {
        throw new Error("Storage bucket 'clip-files' not found in Supabase. Please create a public bucket named 'clip-files' first.");
      }
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("clip-files")
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!user) return;

    if (useE2EE && !encryptionKey) {
      toast.error("Please set your E2EE passphrase first to encrypt items.");
      return;
    }

    setSubmitting(true);
    let contentVal = "";
    let fileUrlVal = "";

    try {
      if (itemType === "text") {
        if (!textContent.trim()) {
          toast.error("Please enter some text");
          setSubmitting(false);
          return;
        }
        contentVal = textContent;
      } else if (itemType === "code") {
        if (!codeContent.trim()) {
          toast.error("Please enter some code");
          setSubmitting(false);
          return;
        }
        contentVal = codeContent;
      } else if (itemType === "file" || itemType === "image") {
        if (!file) {
          toast.error("Please select a file");
          setSubmitting(false);
          return;
        }
        toast.loading("Uploading file to Supabase...", { id: "upload" });
        fileUrlVal = await handleFileUpload(user.id, useE2EE ? encryptionKey : null);
        contentVal = file.name;
        toast.dismiss("upload");
      }

      const newItem = {
        user_id: user.id,
        type: itemType,
        title: title.trim() || (itemType === "file" || itemType === "image" ? file.name : `Snippet (${new Date().toLocaleTimeString()})`),
        content: contentVal,
        file_url: fileUrlVal,
        is_encrypted: useE2EE
      };

      if (itemType === "code") {
        newItem.title = `${title.trim() || "Code Snippet"} [${codeLanguage}]`;
      }

      if (useE2EE) {
        if (itemType === "text" || itemType === "code") {
          const ciphertext = await encryptText(contentVal, encryptionKey);
          newItem.content = ciphertext;
        }
      }

      const { error } = await supabase
        .from("clipboard_items")
        .insert([newItem]);

      if (error) throw error;

      toast.success("Synced to cloud!");
      
      if (socket) {
        socket.emit("clip-update", { user_id: user.id });
      }

      setTextContent("");
      setCodeContent("");
      setFile(null);
      setTitle("");
      
      fetchItems(user.id);
    } catch (err) {
      toast.dismiss("upload");
      toast.error(err.message || "Failed to add item");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const { error } = await supabase
      .from("clipboard_items")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete: " + error.message);
    } else {
      toast.success("Deleted from cloud");
      
      if (socket) {
        socket.emit("clip-update", { user_id: user.id });
      }

      setRawItems(rawItems.filter((item) => item.id !== id));
    }
  };

  const handleGenerateShareLink = async (e) => {
    e.preventDefault();
    if (!shareItem) return;

    if (shareItem.is_encrypted) {
      toast.error("End-to-End Encrypted items cannot be shared publicly. Turn off E2EE when syncing items you wish to share.");
      return;
    }

    setGeneratingLink(true);
    const token = Math.random().toString(36).substring(2, 14);

    try {
      const { error } = await supabase.rpc("create_shared_link", {
        item_id: shareItem.id,
        token_val: token,
        password_val: sharePassword,
        expires_in_seconds: parseInt(shareExpiration)
      });

      if (error) throw error;

      const link = `${window.location.origin}/share/${token}`;
      setGeneratedLink(link);
      toast.success("Shared link created!");
    } catch (err) {
      toast.error("Failed to create shared link: " + err.message);
    } finally {
      setGeneratingLink(false);
    }
  };

  const filteredItems = items
    .filter((item) => {
      if (activeTab === "all") return true;
      if (activeTab === "text") return item.type === "text";
      if (activeTab === "code") return item.type === "code";
      if (activeTab === "files") return item.type === "file" || item.type === "image";
      return true;
    })
    .filter((item) => {
      const search = searchQuery.toLowerCase();
      return (
        item.title?.toLowerCase().includes(search) ||
        (item.content && !item.locked && item.content.toLowerCase().includes(search))
      );
    });

  const getIcon = (type, locked) => {
    if (locked) {
      return <Lock className="h-5 w-5 text-red-400" />;
    }
    switch (type) {
      case "text":
        return <FileText className="h-5 w-5 text-blue-400" />;
      case "code":
        return <Code className="h-5 w-5 text-emerald-400" />;
      case "image":
        return <ImageIcon className="h-5 w-5 text-purple-400" />;
      default:
        return <FileIcon className="h-5 w-5 text-orange-400" />;
    }
  };

  // Shared Sidebar Component for Desktop and Mobile
  const SidebarContent = () => (
    <div className="flex flex-col justify-between h-full">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-500">
            <Clipboard className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white m-0">ClipSync</h2>
            <span className="text-xs text-brand-500 font-semibold tracking-wider uppercase">Cloud Sync</span>
          </div>
        </div>

        {/* E2EE Passphrase Manager */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className={`h-5 w-5 ${encryptionKey ? "text-emerald-400" : "text-gray-500"}`} />
            <span className="text-xs font-bold text-white uppercase tracking-wider">End-to-End Encryption</span>
          </div>

          {encryptionKey ? (
            <div className="space-y-2">
              <span className="text-[10px] text-emerald-400/90 font-medium flex items-center justify-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> E2EE Enabled
              </span>
              <button
                onClick={handleClearPassphrase}
                className="w-full rounded-lg bg-white/5 border border-white/10 py-1.5 text-[10px] font-semibold text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                Lock E2EE Keys
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <span className="text-[10px] text-gray-500 font-medium flex items-center justify-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5" /> E2EE Inactive
              </span>
              <button
                onClick={() => {
                  setPassphraseInput("");
                  setShowPassphraseModal(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full rounded-lg bg-brand-600/10 border border-brand-500/30 py-1.5 text-[10px] font-semibold text-brand-500 hover:bg-brand-600/20 transition-all cursor-pointer"
              >
                Set Passphrase
              </button>
            </div>
          )}
        </div>

        <nav className="space-y-1">
          {["all", "text", "code", "files"].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setMobileMenuOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all cursor-pointer ${
                activeTab === tab 
                  ? "bg-brand-500/15 text-brand-500 border-l-2 border-brand-500 pl-3.5" 
                  : "text-gray-400 hover:bg-white/[0.02] hover:text-white"
              }`}
            >
              {tab === "all" && "All Items"}
              {tab === "text" && "Texts"}
              {tab === "code" && "Code Snippets"}
              {tab === "files" && "Files & Images"}
            </button>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/5 pt-6 space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2">
          <span className="text-xs text-gray-400 font-medium">Real-time status</span>
          {connected ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
              <Wifi className="h-3.5 w-3.5 animate-pulse" /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-red-400 font-semibold">
              <WifiOff className="h-3.5 w-3.5" /> Offline
            </span>
          )}
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 border border-white/10 text-gray-400">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate m-0">{user.user_metadata?.full_name || "User"}</p>
              <p className="text-xs text-gray-500 truncate m-0">{user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col xl:flex-row min-h-screen w-full max-w-full bg-dark-bg text-gray-200 overflow-x-hidden">
      
      {/* Mobile Top Navigation Header */}
      <header className="xl:hidden flex items-center justify-between p-4 bg-white/[0.01] border-b border-white/5 z-40">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-500">
            <Clipboard className="h-4 w-4" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">ClipSync</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-1.5 rounded-lg border border-white/10 bg-white/[0.02] text-gray-300 hover:text-white"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden xl:flex w-64 border-r border-white/5 bg-white/[0.01] p-6 flex-col justify-between shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 xl:hidden flex">
          {/* Backdrop */}
          <div 
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          ></div>
          {/* Drawer body */}
          <div className="relative w-64 bg-dark-card border-r border-white/5 p-6 flex flex-col justify-between h-full shadow-2xl animate-in slide-in-from-left duration-200">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <main className="flex-1 p-4 sm:p-6 xl:p-8 overflow-y-auto max-h-screen">
        {/* Workspace Title & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white m-0">Universal Clipboard</h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-400">Instantly share notes, code, and files across all your devices.</p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.02] py-2 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-brand-500/40 focus:bg-white/[0.04]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8">
          {/* Form Section */}
          <section className="xl:col-span-1">
            <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 sm:p-6 backdrop-blur-xl">
              <h3 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Plus className="h-5 w-5 text-brand-500" /> Sync New Item
              </h3>

              {/* Selector Tabs */}
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/5 mb-6">
                {["text", "code", "file", "image"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setItemType(type);
                      setFile(null);
                    }}
                    className={`rounded-lg py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                      itemType === type ? "bg-brand-600 text-white shadow-md" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <form onSubmit={handleAddItem} className="space-y-4">
                {/* E2EE Toggle */}
                {encryptionKey && (
                  <div className="flex items-center justify-between p-3 rounded-xl border border-brand-500/20 bg-brand-500/5">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-brand-500" /> Encrypt client-side (E2EE)
                    </span>
                    <input
                      type="checkbox"
                      checked={useE2EE}
                      onChange={(e) => setUseE2EE(e.target.checked)}
                      className="accent-brand-600 cursor-pointer h-4 w-4"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Custom Title (Optional)</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Provide a name..."
                    className="w-full rounded-xl border border-white/10 bg-white/[0.02] py-2.5 px-4 text-sm text-white placeholder-gray-600 outline-none transition-all focus:border-brand-500/30"
                  />
                </div>

                {itemType === "text" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Your Text</label>
                    <textarea
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      placeholder="Paste text here..."
                      rows="5"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.02] py-3 px-4 text-sm text-white placeholder-gray-600 outline-none transition-all focus:border-brand-500/30 font-sans resize-y"
                    ></textarea>
                  </div>
                )}

                {itemType === "code" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Language</label>
                      <select
                        value={codeLanguage}
                        onChange={(e) => setCodeLanguage(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-dark-card py-2.5 px-3 text-sm text-white outline-none focus:border-brand-500/30"
                      >
                        <option value="javascript">JavaScript</option>
                        <option value="typescript">TypeScript</option>
                        <option value="python">Python</option>
                        <option value="html">HTML</option>
                        <option value="css">CSS</option>
                        <option value="cpp">C++</option>
                        <option value="java">Java</option>
                        <option value="sql">SQL</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Code Snippet</label>
                      <textarea
                        value={codeContent}
                        onChange={(e) => setCodeContent(e.target.value)}
                        placeholder="Paste code here..."
                        rows="6"
                        className="w-full rounded-xl border border-white/10 bg-white/[0.01] py-3 px-4 text-sm text-white placeholder-gray-600 outline-none transition-all focus:border-brand-500/30 font-mono resize-y"
                      ></textarea>
                    </div>
                  </div>
                )}

                {(itemType === "file" || itemType === "image") && (
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Select {itemType === "image" ? "Image" : "File"}
                    </label>
                    <div className="flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl bg-white/[0.01] p-6 hover:bg-white/[0.02] transition-all relative overflow-hidden">
                      <input
                        type="file"
                        onChange={(e) => setFile(e.target.files[0])}
                        accept={itemType === "image" ? "image/*" : "*"}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <Plus className="h-8 w-8 text-gray-500 mb-2" />
                      <p className="text-sm font-semibold text-gray-300 truncate max-w-[200px]">
                        {file ? file.name : "Click to select a file"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Up to 50MB"}
                      </p>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white transition-all hover:bg-brand-500 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : (
                    <>Sync to Cloud</>
                  )}
                </button>
              </form>
            </div>
          </section>

          {/* List Section */}
          <section className="xl:col-span-2 space-y-4">
            <h3 className="text-base sm:text-lg font-semibold text-white mb-2 flex items-center gap-2">
              Sync History 
              <span className="text-xs font-normal text-gray-500 bg-white/5 border border-white/5 px-2 py-0.5 rounded-full">
                {filteredItems.length}
              </span>
            </h3>

            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent"></div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-600 mb-3" />
                <h4 className="text-base font-semibold text-white">No items found</h4>
                <p className="text-sm text-gray-500 mt-1">Add items or adjust your search filter to populate your feed.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="group relative rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] p-4 sm:p-5 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10">
                          {getIcon(item.type, item.locked)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-white m-0 truncate max-w-[150px] xs:max-w-[200px] sm:max-w-md flex items-center gap-1.5">
                            {item.title}
                            {item.is_encrypted && (
                              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                <ShieldCheck className="h-3 w-3" /> E2EE
                              </span>
                            )}
                          </h4>
                          <span className="text-xs text-gray-500">
                            {new Date(item.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Responsive Action Buttons (Always visible on mobile/touch, hover-visible on desktop) */}
                      <div className="flex items-center gap-1.5 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
                        {!item.locked && (
                          <button
                            onClick={() => {
                              setShareItem(item);
                              setGeneratedLink("");
                              setSharePassword("");
                              setShowShareModal(true);
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-white/5 hover:text-brand-500 transition-all cursor-pointer"
                            title="Generate shareable link"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                        )}
                        {!item.locked && (item.type === "text" || item.type === "code") && (
                          <button
                            onClick={() => handleCopy(item.content)}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-white/5 hover:text-brand-500 transition-all cursor-pointer"
                            title="Copy to Clipboard"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        )}
                        {!item.locked && (item.type === "file" || item.type === "image") && (
                          <a
                            href={item.is_encrypted ? (decryptedFiles[item.id] || "#") : item.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-white/5 hover:text-brand-500 transition-all flex items-center justify-center"
                            title="Open Link"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all cursor-pointer"
                          title="Delete cloud record"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Rendering item content */}
                    <div className="mt-4 text-sm text-gray-300">
                      {item.locked ? (
                        <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 flex items-center gap-3 text-red-400">
                          <Lock className="h-5 w-5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-xs m-0">Item encrypted client-side</p>
                            <p className="text-[10px] text-gray-400 m-0 mt-0.5">Please unlock E2EE by entering your passphrase in the sidebar to access.</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {item.type === "text" && (
                            <p className="whitespace-pre-wrap font-sans bg-black/20 p-3 rounded-lg border border-white/5 max-h-40 overflow-y-auto leading-relaxed">
                              {item.content}
                            </p>
                          )}

                          {item.type === "code" && (
                            <pre className="overflow-x-auto bg-black/35 p-4 rounded-xl border border-white/5 font-mono text-xs max-h-60">
                              <code>{item.content}</code>
                            </pre>
                          )}

                          {item.type === "image" && (
                            <div className="relative mt-2 max-w-sm rounded-lg overflow-hidden border border-white/10 group-hover:border-white/20 transition-all">
                              {item.is_encrypted ? (
                                decryptedFiles[item.id] ? (
                                  <img
                                    src={decryptedFiles[item.id]}
                                    alt={item.title}
                                    className="w-full h-auto max-h-64 object-cover"
                                  />
                                ) : (
                                  <div className="h-32 flex items-center justify-center bg-black/25 text-xs text-gray-400 animate-pulse">
                                    Decrypting image binary...
                                  </div>
                                )
                              ) : (
                                <img
                                  src={item.file_url}
                                  alt={item.title}
                                  className="w-full h-auto max-h-64 object-cover"
                                />
                              )}
                            </div>
                          )}

                          {item.type === "file" && (
                            <div className="flex items-center justify-between bg-black/25 px-4 py-3 rounded-xl border border-white/5">
                              <span className="font-mono text-xs truncate max-w-[120px] sm:max-w-xs">{item.content}</span>
                              {item.is_encrypted ? (
                                decryptedFiles[item.id] ? (
                                  <a
                                    href={decryptedFiles[item.id]}
                                    download={item.title}
                                    className="text-xs font-semibold text-brand-500 hover:underline flex items-center gap-1 shrink-0 ml-2"
                                  >
                                    <Download className="h-3.5 w-3.5" /> Download
                                  </a>
                                ) : (
                                  <span className="text-[10px] text-gray-500 animate-pulse shrink-0 ml-2">Decrypting...</span>
                                )
                              ) : (
                                <a
                                  href={item.file_url}
                                  download
                                  className="text-xs font-semibold text-brand-500 hover:underline shrink-0 ml-2"
                                >
                                  Download File
                                </a>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Share Modal Overlay */}
      {showShareModal && shareItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/5 bg-dark-card p-6 shadow-2xl relative">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Share2 className="h-5 w-5 text-brand-500" /> Share Clipboard Item
            </h3>
            <p className="text-xs text-gray-400 mb-6">Create a secure link for "{shareItem.title}"</p>

            {!generatedLink ? (
              <form onSubmit={handleGenerateShareLink} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Link Expiration</label>
                  <select
                    value={shareExpiration}
                    onChange={(e) => setShareExpiration(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.02] py-2.5 px-3 text-sm text-white outline-none focus:border-brand-500/30"
                  >
                    <option value="600">10 Minutes</option>
                    <option value="3600">1 Hour</option>
                    <option value="86400">1 Day</option>
                    <option value="604800">7 Days</option>
                    <option value="0">Never Expires</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1">
                    <Lock className="h-3.5 w-3.5 text-gray-500" /> Password Protection (Optional)
                  </label>
                  <input
                    type="password"
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    placeholder="Leave blank for no password"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.02] py-2.5 px-4 text-sm text-white placeholder-gray-600 outline-none transition-all focus:border-brand-500/30"
                  />
                </div>

                <button
                  type="submit"
                  disabled={generatingLink}
                  className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white transition-all hover:bg-brand-500 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {generatingLink ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : (
                    <>Generate Shareable Link</>
                  )}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="bg-black/20 border border-white/5 rounded-xl p-3.5 flex items-center justify-between gap-3">
                  <span className="text-xs text-brand-500 font-mono truncate max-w-xs select-all">
                    {generatedLink}
                  </span>
                  <button
                    onClick={() => handleCopy(generatedLink)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 hover:text-brand-500 transition-all shrink-0 cursor-pointer"
                    title="Copy sharing link"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>

                <div className="text-xs text-gray-400 leading-relaxed border-t border-white/5 pt-4">
                  <p className="m-0">• Anyone with this link can view the shared item.</p>
                  {shareExpiration !== "0" && (
                    <p className="m-0 mt-1">• This link will automatically expire in {shareExpiration === "600" ? "10 minutes" : shareExpiration === "3600" ? "1 hour" : shareExpiration === "86400" ? "1 day" : "7 days"}.</p>
                  )}
                  {sharePassword && (
                    <p className="m-0 mt-1">• A password is required to unlock this item.</p>
                  )}
                </div>

                <button
                  onClick={() => setShowShareModal(false)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10 cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Set Passphrase Modal Overlay */}
      {showPassphraseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/5 bg-dark-card p-6 shadow-2xl relative">
            <button
              onClick={() => setShowPassphraseModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Shield className="h-5 w-5 text-brand-500" /> E2EE Passphrase
            </h3>
            <p className="text-xs text-gray-400 mb-6 font-sans">
              Enter your secret decryption password. This is stored only in your browser memory and used to encrypt/decrypt synced cloud items.
            </p>

            <form onSubmit={handleSetPassphrase} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Encryption Passphrase</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                  <input
                    type="password"
                    value={passphraseInput}
                    onChange={(e) => setPassphraseInput(e.target.value)}
                    placeholder="Enter secret passphrase"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.02] py-2.5 pl-11 pr-4 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-brand-500/30"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white transition-all hover:bg-brand-500 flex items-center justify-center gap-2 cursor-pointer"
              >
                Activate E2EE Keys
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
