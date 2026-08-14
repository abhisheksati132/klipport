import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Command as Cmdk } from "cmdk";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { toast } from "react-hot-toast";
import { io } from "socket.io-client";
import {
  deriveKey,
  encryptText,
  decryptText,
  encryptFile,
  decryptFile,
  generateAsymmetricKeyPair,
  exportPublicKey,
  importPublicKey,
  encryptWorkspaceKey,
  decryptWorkspaceKey,
  encryptPrivateKey,
  decryptPrivateKey
} from "../utils/crypto";
import {
  cacheHistoryClips,
  getCachedHistoryClips,
  saveOfflineClip,
  getOfflineClips,
  deleteOfflineClip
} from "../utils/indexedDB";
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
  Share2,
  Lock,
  X,
  Shield,
  ShieldCheck,
  Download,
  Menu,
  Briefcase,
  Users,
  AlertTriangle,
  Eye,
  EyeOff,
  Mic,
  MicOff,
  Flame,
  Clock,
  Key,
  Hash,
  CheckSquare,
  Square,
  HardDrive,
  Sparkles,
  RotateCcw,
  UserCheck,
  Pin,
  QrCode,
  Globe,
  Keyboard,
  Tag,
  Sun,
  Moon,
  MoreHorizontal
} from "lucide-react";



// --- Custom Code Highlighter ---
function highlightCode(code) {
  if (!code) return "";
  let escaped = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const keywords = /\b(const|let|var|function|return|import|export|from|def|class|if|else|for|while|try|catch|async|await|default|public|private|static|void|int|float|string|boolean|null|true|false)\b/g;
  const strings = /(["'`])(.*?)\1/g;
  const comments = /(\/\/.*|#.*|\/\*[\s\S]*?\*\/)/g;
  const numbers = /\b(\d+)\b/g;

  escaped = escaped.replace(comments, '<span class="text-gray-500 font-mono">$1</span>');
  escaped = escaped.replace(strings, '<span class="text-emerald-400 font-mono">$&</span>');
  escaped = escaped.replace(keywords, '<span class="text-purple-400 font-semibold font-mono">$1</span>');
  escaped = escaped.replace(numbers, '<span class="text-amber-400 font-mono">$1</span>');

  return escaped;
}

// --- Image Compressor ---
const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1000;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            const compressedFile = new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          "image/jpeg",
          0.75 
        );
      };
    };
  });
};

const sha256 = async (ascii) => {
  const msgBuffer = new TextEncoder().encode(ascii);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [rawItems, setRawItems] = useState([]); 
  const [items, setItems] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedTag, setSelectedTag] = useState(null); 
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Socket State
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  // Real-time Presence States
  const [presenceList, setPresenceList] = useState([]);
  const [typingStatus, setTypingStatus] = useState("");
  const typingTimerRef = useRef(null);

  // E2EE States
  const [passphrase, setPassphrase] = useState("");
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [showPassphraseModal, setShowPassphraseModal] = useState(false);
  const [passphraseInput, setPassphraseInput] = useState("");
  const [showPassphraseText, setShowPassphraseText] = useState(false);
  const [useE2EE, setUseE2EE] = useState(false);
  const [decryptedFiles, setDecryptedFiles] = useState({});

  // Asymmetric E2EE Vault Keys (RSA)
  const [asymmetricPrivateKey, setAsymmetricPrivateKey] = useState(null);
  const [asymmetricPublicKey, setAsymmetricPublicKey] = useState(null);
  const [workspaceEncryptionKey, setWorkspaceEncryptionKey] = useState(null);

  // AI Assistant States
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiItem, setAiItem] = useState(null);
  const [aiResponse, setAiResponse] = useState("");
  const [aiCustomPrompt, setAiCustomPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // CLI Token Manager states
  const [cliTokens, setCliTokens] = useState([]);
  const [showCliTokenModal, setShowCliTokenModal] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [generatedTokenVal, setGeneratedTokenVal] = useState("");
  const [tokenSubmitting, setTokenSubmitting] = useState(false);

  // Mobile navigation drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Workspaces State
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null); 
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [workspaceSubmitting, setWorkspaceSubmitting] = useState(false);

  // Expiration & Self-destruct
  const [expiresInSeconds, setExpiresInSeconds] = useState("0"); 
  const [selfDestruct, setSelfDestruct] = useState(false);

  // Speech Recognition States
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  // Drag and Drop overlay State
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Rich Link Previews Map
  const [previews, setPreviews] = useState({});

  // Theme toggle
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("klipport_theme");
    return saved ? saved === "dark" : true;
  });
  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem("klipport_theme", next ? "dark" : "light");
      return next;
    });
  };

  // Copy success indicator state
  const [copiedId, setCopiedId] = useState(null);

  // Bulk Select State
  const [selectedClips, setSelectedClips] = useState(new Set());

  // QR Code Modal State
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrContent, setQrContent] = useState("");

  // Keyboard Shortcuts Modal
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // AI Enhanced States
  const [aiTranslateLang, setAiTranslateLang] = useState("Spanish");
  const [aiTone, setAiTone] = useState("Formal");

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
  const [shareExpiration, setShareExpiration] = useState("3600"); 
  const [sharePassword, setSharePassword] = useState("");
  const [showSharePasswordText, setShowSharePasswordText] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);

  const navigate = useNavigate();
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  // Request notifications permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Keyboard Shortcuts Hook
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K: focus search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder="Search history..."]');
        if (searchInput) searchInput.focus();
      }
      // Alt+N: new clip
      if (e.altKey && e.key === "n") {
        e.preventDefault();
        setItemType("text");
        const titleInput = document.querySelector('input[placeholder="Provide a name..."]');
        if (titleInput) titleInput.focus();
      }
      // Escape: close all modals + clear selection
      if (e.key === "Escape") {
        setShowShareModal(false);
        setShowPassphraseModal(false);
        setShowCliTokenModal(false);
        setShowWorkspaceModal(false);
        setShowInviteModal(false);
        setShowAiModal(false);
        setShowQrModal(false);
        setShowShortcutsModal(false);
        setMobileMenuOpen(false);
        setSelectedClips(new Set());
      }
      // ?: show shortcuts help (only when not typing)
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const active = document.activeElement;
        if (active.tagName !== "INPUT" && active.tagName !== "TEXTAREA" && active.tagName !== "SELECT") {
          setShowShortcutsModal(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Broadcast typing presence
  const handleTypingBroadcast = () => {
    if (socket && user) {
      socket.emit("typing", {
        name: user.user_metadata?.full_name || user.email.split("@")[0],
        workspace_id: activeWorkspace ? activeWorkspace.id : null
      });
    }
  };



  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      if (droppedFile.type.startsWith("image/")) {
        setItemType("image");
      } else {
        setItemType("file");
      }
      toast.success(`Loaded dropped file: ${droppedFile.name}`);
    }
  };

  const toggleSpeechDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Web Speech API is not supported in this browser.");
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsRecording(false);
      toast.success("Voice recording stopped.");
    } else {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsRecording(true);
        toast.success("Listening... Speak now!");
      };

      rec.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        if (itemType === "text") {
          setTextContent((prev) => (prev ? prev + " " + transcript : transcript));
        } else if (itemType === "code") {
          setCodeContent((prev) => (prev ? prev + " " + transcript : transcript));
        }
      };

      rec.onerror = () => {
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = rec;
      rec.start();
    }
  };

  const fetchLinkPreview = async (itemId, url) => {
    if (previews[itemId]) return;
    try {
      const res = await fetch(`${backendUrl}/api/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      if (res.ok) {
        const data = await res.json();
        setPreviews((prev) => ({ ...prev, [itemId]: data }));
      }
    } catch (err) {
      console.error("Preview Scrape Error:", err);
    }
  };

  const syncOfflineClips = async () => {
    if (!navigator.onLine || !user) return;

    try {
      const offlineClips = await getOfflineClips();
      if (offlineClips.length === 0) return;

      toast.loading("Syncing offline items...", { id: "offlinesync" });

      for (const clip of offlineClips) {
        const { id, isOffline, ...cleanClip } = clip;
        const { error } = await supabase.from("clipboard_items").insert([cleanClip]);
        if (!error) {
          await deleteOfflineClip(id);
        }
      }

      toast.dismiss("offlinesync");
      toast.success("Synchronized offline items to cloud!", { icon: "☁️" });

      if (socket) {
        if (activeWorkspace) {
          socket.emit("workspace-clip-update", { workspace_id: activeWorkspace.id });
        } else {
          socket.emit("clip-update", { user_id: user.id });
        }
      }

      fetchItems(user.id);
    } catch (err) {
      console.error("Failed to sync offline items:", err);
      toast.dismiss("offlinesync");
    }
  };

  useEffect(() => {
    let socketInstance = null;

    const initApp = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        
        const storedPassphrase = sessionStorage.getItem("klipport_passphrase");
        if (storedPassphrase) {
          setPassphrase(storedPassphrase);
          try {
            const key = await deriveKey(storedPassphrase);
            setEncryptionKey(key);
            setUseE2EE(true);
            
            // Decrypt local RSA asymmetric keys if they exist in DB
            const { data: pkData } = await supabase
              .from("user_public_keys")
              .select("*")
              .eq("user_id", session.user.id)
              .single();

            if (pkData) {
              const privKey = await decryptPrivateKey(pkData.encrypted_private_key, key);
              const pubKey = await importPublicKey(pkData.public_key_jwk);
              setAsymmetricPrivateKey(privKey);
              setAsymmetricPublicKey(pubKey);
            }
          } catch (err) {
            console.error("Failed to auto-derive key:", err);
          }
        }

        fetchItems(session.user.id);
        fetchWorkspaces();
        fetchCliTokens();

        socketInstance = io(backendUrl);
        setSocket(socketInstance);

        socketInstance.on("connect", () => {
          setConnected(true);
          socketInstance.emit("join-room", session.user.id);
          
          // Emit presence join details
          socketInstance.emit("presence-join", {
            user_id: session.user.id,
            email: session.user.email,
            device: "Web Browser"
          });
        });

        socketInstance.on("disconnect", () => {
          setConnected(false);
          setPresenceList([]);
        });

        // Socket.io Real-time Presence handlers
        socketInstance.on("presence-list", (list) => {
          setPresenceList(list || []);
        });

        socketInstance.on("typing-broadcast", (data) => {
          setTypingStatus(`${data.name} is typing...`);
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => {
            setTypingStatus("");
          }, 2000);
        });

        socketInstance.on("clip-sync", () => {
          triggerBrowserNotification("Personal Clip Sync", "Your personal clipboard was updated!");
          toast.success("Personal Clipboard synced!", { icon: "🔄" });
          fetchItems(session.user.id);
        });

        socketInstance.on("workspace-clip-sync", () => {
          triggerBrowserNotification("Team Sync", "A shared workspace clipboard was updated!");
          toast.success("Shared Workspace synced!", { icon: "👥" });
          fetchItems(session.user.id);
        });
      } else {
        navigate("/");
      }
    };
    
    initApp();

    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [navigate, backendUrl]);

  // Load decrypt keys when switching workspaces
  useEffect(() => {
    const handleWorkspaceVaultCheck = async () => {
      if (!activeWorkspace || !asymmetricPrivateKey || !user) {
        setWorkspaceEncryptionKey(null);
        return;
      }

      try {
        const { data: vaultData, error } = await supabase
          .from("workspace_vault_keys")
          .select("*")
          .eq("workspace_id", activeWorkspace.id)
          .eq("user_id", user.id)
          .single();

        if (error) {
          // If Owner and key not found, generate it!
          if (activeWorkspace.owner_id === user.id) {
            const rawKeyBytes = window.crypto.getRandomValues(new Uint8Array(32));
            const importedKey = await window.crypto.subtle.importKey(
              "raw",
              rawKeyBytes,
              { name: "AES-GCM", length: 256 },
              true,
              ["encrypt", "decrypt"]
            );

            const encryptedBase64 = await encryptWorkspaceKey(rawKeyBytes, asymmetricPublicKey);
            
            const { error: insertError } = await supabase
              .from("workspace_vault_keys")
              .insert([{
                workspace_id: activeWorkspace.id,
                user_id: user.id,
                encrypted_key: encryptedBase64,
                iv: "default"
              }]);

            if (insertError) throw insertError;

            setWorkspaceEncryptionKey(importedKey);
          } else {
            setWorkspaceEncryptionKey(null);
          }
        } else {
          // Key exists, decrypt it
          const rawKeyBuffer = await decryptWorkspaceKey(vaultData.encrypted_key, asymmetricPrivateKey);
          const importedKey = await window.crypto.subtle.importKey(
            "raw",
            rawKeyBuffer,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
          );
          setWorkspaceEncryptionKey(importedKey);
        }
      } catch (err) {
        console.error("Failed to load workspace encryption keys:", err);
        setWorkspaceEncryptionKey(null);
        toast.error("Failed to load workspace E2EE encryption key.");
      }
    };

    handleWorkspaceVaultCheck();
  }, [activeWorkspace, asymmetricPrivateKey, user]);

  // Decrypt items feed
  useEffect(() => {
    const processItems = async () => {
      const currentDecryptionKey = activeWorkspace ? workspaceEncryptionKey : encryptionKey;

      const dbClips = await Promise.all(
        rawItems.map(async (item) => {
          if (item.type === "text" && !item.is_encrypted) {
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const match = item.content?.match(urlRegex);
            if (match) {
              fetchLinkPreview(item.id, match[0]);
            }
          }

          if (!item.is_encrypted) return item;

          if (!currentDecryptionKey) {
            return {
              ...item,
              title: item.title,
              content: "[Locked - Enter Passphrase to Decrypt]",
              locked: true
            };
          }

          try {
            if (item.type === "text" || item.type === "code") {
              const decryptedContent = await decryptText(item.content, currentDecryptionKey);
              const urlRegex = /(https?:\/\/[^\s]+)/g;
              const match = decryptedContent?.match(urlRegex);
              if (match) {
                fetchLinkPreview(item.id, match[0]);
              }
              return { ...item, content: decryptedContent, locked: false };
            } else {
              triggerFileDecryption(item, currentDecryptionKey);
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

      const offlineClips = await getOfflineClips();
      const filteredOffline = offlineClips
        .filter(clip => activeWorkspace ? clip.workspace_id === activeWorkspace.id : !clip.workspace_id)
        .map(clip => ({
          ...clip,
          isOffline: true,
          created_at: clip.created_at || new Date().toISOString()
        }));

      setItems([...filteredOffline, ...dbClips]);
    };

    processItems();
  }, [rawItems, encryptionKey, workspaceEncryptionKey, activeWorkspace]);

  const triggerBrowserNotification = (title, body) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/logo.svg" });
    }
  };

  const triggerFileDecryption = async (item, keyToUse) => {
    if (decryptedFiles[item.id]) return;

    try {
      const response = await fetch(item.file_url);
      const encryptedBuffer = await response.arrayBuffer();
      const decryptedBuffer = await decryptFile(encryptedBuffer, keyToUse);
      
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

  // Cleanup Object URLs on unmount to prevent browser memory leaks
  useEffect(() => {
    return () => {
      Object.values(decryptedFiles).forEach((url) => {
        if (url && typeof url === "string" && url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [decryptedFiles]);

  const handleChecklistToggle = async (item, index, currentState) => {
    let content = item.content;
    const checkboxRegex = /-\s*\[([ xX])\]/g;
    let occurrences = 0;
    
    const newContent = content.replace(checkboxRegex, (match, char) => {
      if (occurrences === index) {
        occurrences++;
        return currentState ? "- [ ]" : "- [x]";
      }
      occurrences++;
      return match;
    });

    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, content: newContent } : i))
    );

    try {
      let finalContent = newContent;
      const keyToUse = activeWorkspace ? workspaceEncryptionKey : encryptionKey;
      if (item.is_encrypted && keyToUse) {
        finalContent = await encryptText(newContent, keyToUse);
      }
      
      const { error } = await supabase
        .from("clipboard_items")
        .update({ content: finalContent })
        .eq("id", item.id);

      if (error) throw error;
      
      if (socket) {
        if (activeWorkspace) {
          socket.emit("workspace-clip-update", { workspace_id: activeWorkspace.id });
        } else {
          socket.emit("clip-update", { user_id: user.id });
        }
      }
    } catch (err) {
      toast.error("Failed to update checklist: " + err.message);
    }
  };

  const renderMarkdownContent = (item) => {
    const text = item.content;
    if (!text) return "";

    const lines = text.split("\n");
    let checkboxIndex = 0;

    return lines.map((line, lineIdx) => {
      const match = line.match(/^-\s*\[([ xX])\]\s*(.*)/);
      if (match) {
        const isChecked = match[1].toLowerCase() === "x";
        const taskText = match[2];
        const currentIdx = checkboxIndex;
        checkboxIndex++;

        return (
          <div key={lineIdx} className="flex items-center gap-2 py-0.5 select-none font-sans">
            <button
              onClick={() => handleChecklistToggle(item, currentIdx, isChecked)}
              className="text-brand-500 hover:text-brand-400 transition-all cursor-pointer"
            >
              {isChecked ? <CheckSquare className="h-4.5 w-4.5" /> : <Square className="h-4.5 w-4.5" />}
            </button>
            <span className={`text-xs ${isChecked ? "line-through text-gray-500" : "text-gray-300"}`}>
              {taskText}
            </span>
          </div>
        );
      }

      if (line.startsWith("# ")) {
        return <h4 key={lineIdx} className="text-sm font-bold text-white mt-2 mb-1">{line.slice(2)}</h4>;
      }
      if (line.startsWith("## ")) {
        return <h5 key={lineIdx} className="text-xs font-bold text-white mt-2 mb-1">{line.slice(3)}</h5>;
      }
      
      return <p key={lineIdx} className="m-0 py-0.5 leading-relaxed font-sans text-xs">{line}</p>;
    });
  };

  const getAllHashtags = () => {
    const tags = new Set();
    items.forEach((item) => {
      if (item.content && !item.locked) {
        const hashtagRegex = /#([a-zA-Z0-9_\-]+)/g;
        const matches = item.content.match(hashtagRegex);
        if (matches) {
          matches.forEach((t) => tags.add(t));
        }
      }
    });
    return Array.from(tags);
  };

  const fetchItems = async (userId, targetWorkspace = activeWorkspace) => {
    setLoading(true);
    let query = supabase
      .from("clipboard_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (targetWorkspace) {
      query = query.eq("workspace_id", targetWorkspace.id);
    } else {
      query = query.is("workspace_id", null).eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      try {
        const cachedClips = await getCachedHistoryClips();
        const filteredCached = cachedClips.filter(c => 
          targetWorkspace ? c.workspace_id === targetWorkspace.id : !c.workspace_id && c.user_id === userId
        );
        filteredCached.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setRawItems(filteredCached);
        toast.success("Loaded clips from offline cache!", { icon: "📥" });
      } catch (cacheErr) {
        console.error("Failed to load history cache:", cacheErr);
        toast.error("Failed to fetch items: " + error.message);
      }
    } else {
      setRawItems(data || []);
      try {
        await cacheHistoryClips(data || []);
      } catch (cacheErr) {
        console.error("Failed to save history cache:", cacheErr);
      }
    }
    setLoading(false);
  };

  const fetchWorkspaces = async () => {
    const { data, error } = await supabase
      .from("workspaces")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load workspaces.");
    } else if (data) {
      setWorkspaces(data);
    }
  };

  const fetchCliTokens = async () => {
    const { data, error } = await supabase
      .from("cli_tokens")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load CLI tokens.");
    } else if (data) {
      setCliTokens(data);
    }
  };

  const handleCreateCliToken = async (e) => {
    e.preventDefault();
    if (!newTokenName.trim() || !user) return;

    setTokenSubmitting(true);
    const randArr = new Uint8Array(16);
    crypto.getRandomValues(randArr);
    const rawToken = "klipport_pat_" + Array.from(randArr).map(b => b.toString(16).padStart(2, '0')).join('');
    
    try {
      const hash = await sha256(rawToken);
      const { error } = await supabase
        .from("cli_tokens")
        .insert([{ name: newTokenName.trim(), token_hash: hash, user_id: user.id }]);

      if (error) throw error;

      setGeneratedTokenVal(rawToken);
      setNewTokenName("");
      fetchCliTokens();
      toast.success("CLI Access Token generated!");
    } catch (err) {
      toast.error("Failed to generate token: " + err.message);
    } finally {
      setTokenSubmitting(false);
    }
  };

  const handleRevokeCliToken = async (tokenId) => {
    const { error } = await supabase
      .from("cli_tokens")
      .delete()
      .eq("id", tokenId);

    if (error) {
      toast.error("Failed to revoke: " + error.message);
    } else {
      toast.success("Token revoked permanently");
      setCliTokens(cliTokens.filter(t => t.id !== tokenId));
    }
  };

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!newWorkspaceName.trim() || !user) return;

    setWorkspaceSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("workspaces")
        .insert([{ name: newWorkspaceName.trim(), owner_id: user.id }])
        .select();

      if (error) throw error;

      toast.success("Workspace created!");
      setNewWorkspaceName("");
      setShowWorkspaceModal(false);
      fetchWorkspaces();
    } catch (err) {
      toast.error("Failed to create workspace: " + err.message);
    } finally {
      setWorkspaceSubmitting(false);
    }
  };

  const handleInviteMember = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !activeWorkspace || !user) return;

    setWorkspaceSubmitting(true);
    try {
      // 1. Fetch user's public key registry
      const { data: pkData, error: pkError } = await supabase
        .from("user_public_keys")
        .select("*")
        .eq("user_email", inviteEmail.trim().toLowerCase())
        .single();

      if (pkError || !pkData) {
        toast.error("Teammate's public keys not found. They must set up their E2EE passphrase first.");
        setWorkspaceSubmitting(false);
        return;
      }

      // 2. Add teammate to workspace_members
      const { error: inviteError } = await supabase
        .from("workspace_members")
        .insert([{ workspace_id: activeWorkspace.id, user_email: inviteEmail.trim().toLowerCase() }]);

      if (inviteError) throw inviteError;

      // 3. Encrypt the workspace symmetric key using the teammate's public key
      // First, get owner's decrypted workspace key
      const { data: ownerVault } = await supabase
        .from("workspace_vault_keys")
        .select("*")
        .eq("workspace_id", activeWorkspace.id)
        .eq("user_id", user.id)
        .single();

      if (ownerVault && asymmetricPrivateKey) {
        const rawKeyBuffer = await decryptWorkspaceKey(ownerVault.encrypted_key, asymmetricPrivateKey);
        const importedPeerPubKey = await importPublicKey(pkData.public_key_jwk);
        const encryptedForPeer = await encryptWorkspaceKey(new Uint8Array(rawKeyBuffer), importedPeerPubKey);
        
        // Save encrypted key in vault for teammate
        await supabase
          .from("workspace_vault_keys")
          .insert([{
            workspace_id: activeWorkspace.id,
            user_id: pkData.user_id,
            encrypted_key: encryptedForPeer,
            iv: "default"
          }]);
      }

      toast.success(`Successfully invited and shared E2EE keys with ${inviteEmail}!`);
      setInviteEmail("");
      setShowInviteModal(false);
    } catch (err) {
      toast.error("Failed to invite member: " + err.message);
    } finally {
      setWorkspaceSubmitting(false);
    }
  };

  const handleWorkspaceChange = (workspace) => {
    setActiveWorkspace(workspace);
    setMobileMenuOpen(false);

    if (socket) {
      if (workspace) {
        socket.emit("join-workspace", workspace.id);
      } else if (user) {
        socket.emit("join-room", user.id);
      }
    }
  };

  const handleCopy = async (item) => {
    try {
      await navigator.clipboard.writeText(item.content);
    } catch {
      toast.error("Clipboard access denied. Please copy manually.");
      return;
    }

    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);

    if (item.self_destruct && !item.isOffline) {
      const { error } = await supabase.from("clipboard_items").delete().eq("id", item.id);
      if (!error) {
        toast.error("Clip self-destructed permanently!", { icon: "🔥" });
        setRawItems((prev) => prev.filter((i) => i.id !== item.id));
      }
    } else {
      toast.success("Copied to clipboard!", { icon: "📋" });
    }
  };

  const handleDelete = async (id) => {
    // If we are in the trash tab, delete permanently!
    if (activeTab === "trash") {
      const { error } = await supabase
        .from("clipboard_items")
        .delete()
        .eq("id", id);

      if (error) {
        toast.error("Failed to purge item: " + error.message);
      } else {
        toast.success("Permanently purged clip");
        setRawItems((prev) => prev.filter((item) => item.id !== id));
      }
      return;
    }

    // Soft delete with 5-second undo window
    const { error } = await supabase
      .from("clipboard_items")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete: " + error.message);
    } else {
      setRawItems((prev) => prev.map((item) => item.id === id ? { ...item, is_deleted: true } : item));

      toast(
        (t) => (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "13px" }}>Moved to Trash</span>
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                const { error: restoreErr } = await supabase
                  .from("clipboard_items")
                  .update({ is_deleted: false, deleted_at: null })
                  .eq("id", id);
                if (!restoreErr) {
                  setRawItems((prev) => prev.map((item) => item.id === id ? { ...item, is_deleted: false, deleted_at: null } : item));
                  toast.success("Restored!", { icon: "↩️" });
                }
              }}
              style={{
                background: "#0078d4", color: "white", border: "none",
                borderRadius: "8px", padding: "4px 12px", fontSize: "11px",
                fontWeight: "bold", cursor: "pointer"
              }}
            >
              Undo
            </button>
          </div>
        ),
        { icon: "🗑️", duration: 5000 }
      );

      if (socket) {
        if (activeWorkspace) {
          socket.emit("workspace-clip-update", { workspace_id: activeWorkspace.id });
        } else {
          socket.emit("clip-update", { user_id: user.id });
        }
      }
    }
  };

  const handleRestore = async (id) => {
    const { error } = await supabase
      .from("clipboard_items")
      .update({ is_deleted: false, deleted_at: null })
      .eq("id", id);

    if (error) {
      toast.error("Failed to restore: " + error.message);
    } else {
      toast.success("Restored clip to dashboard!", { icon: "🔄" });
      
      if (socket) {
        if (activeWorkspace) {
          socket.emit("workspace-clip-update", { workspace_id: activeWorkspace.id });
        } else {
          socket.emit("clip-update", { user_id: user.id });
        }
      }

      setRawItems((prev) => prev.map((item) => item.id === id ? { ...item, is_deleted: false } : item));
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
    const randomBytes = new Uint8Array(12);
    window.crypto.getRandomValues(randomBytes);
    const token = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

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

  const handleSetPassphrase = async (e) => {
    e.preventDefault();
    if (!passphraseInput.trim() || !user) {
      toast.error("Please enter a passphrase");
      return;
    }

    try {
      const key = await deriveKey(passphraseInput);
      setEncryptionKey(key);
      setPassphrase(passphraseInput);
      sessionStorage.setItem("klipport_passphrase", passphraseInput);
      setUseE2EE(true);
      setShowPassphraseModal(false);
      toast.success("E2EE Passphrase Set Successfully!", { icon: "🔒" });

      // Generate or retrieve public/private asymmetric keys registry
      const { data: pkData } = await supabase
        .from("user_public_keys")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!pkData) {
        // Generate new keypair
        const pair = await generateAsymmetricKeyPair();
        const jwk = await exportPublicKey(pair.publicKey);
        const encryptedPriv = await encryptPrivateKey(pair.privateKey, key);

        await supabase
          .from("user_public_keys")
          .insert([{
            user_id: user.id,
            user_email: user.email.toLowerCase(),
            public_key_jwk: jwk,
            encrypted_private_key: encryptedPriv.encryptedKey,
            private_key_iv: encryptedPriv.iv
          }]);

        setAsymmetricPrivateKey(pair.privateKey);
        setAsymmetricPublicKey(pair.publicKey);
      } else {
        const privKey = await decryptPrivateKey(pkData.encrypted_private_key, key);
        const pubKey = await importPublicKey(pkData.public_key_jwk);
        setAsymmetricPrivateKey(privKey);
        setAsymmetricPublicKey(pubKey);
      }
    } catch (err) {
      toast.error("Failed to derive E2EE keys: " + err.message);
    }
  };

  const handleClearPassphrase = () => {
    setEncryptionKey(null);
    setAsymmetricPrivateKey(null);
    setAsymmetricPublicKey(null);
    setPassphrase("");
    sessionStorage.removeItem("klipport_passphrase");
    setUseE2EE(false);
    toast.success("Passphrase cleared. E2EE locked.");
  };

  const handleFileUpload = async (userId, keyToUse) => {
    if (!file) return null;
    
    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    let bodyData = file;
    if (file.type.startsWith("image/")) {
      toast.loading("Compressing image client-side...", { id: "compress" });
      bodyData = await compressImage(file);
      toast.dismiss("compress");
    }

    if (keyToUse) {
      const fileBuffer = await bodyData.arrayBuffer();
      const encryptedBuffer = await encryptFile(fileBuffer, keyToUse);
      bodyData = new Blob([encryptedBuffer], { type: "application/octet-stream" });
    }

    const { error: uploadError } = await supabase.storage
      .from("clip-files")
      .upload(filePath, bodyData);

    if (uploadError) {
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

    const currentKeyToUse = activeWorkspace ? workspaceEncryptionKey : encryptionKey;

    if (useE2EE && !currentKeyToUse) {
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
        
        if (!isOnline) {
          toast.error("Files/Images cannot be queued offline. Please restore connection.");
          setSubmitting(false);
          return;
        }

        toast.loading("Uploading file to Supabase...", { id: "upload" });
        fileUrlVal = await handleFileUpload(user.id, useE2EE ? currentKeyToUse : null);
        contentVal = file.name;
        toast.dismiss("upload");

        if (itemType === "image" && file.type.startsWith("image/")) {
          toast.loading("Running Tesseract OCR on image...", { id: "ocr" });
          try {
            const { default: Tesseract } = await import("tesseract.js");
            const ocrResult = await Tesseract.recognize(file, "eng");
            if (ocrResult.data.text.trim()) {
              contentVal = ocrResult.data.text.trim();
              toast.success("Text extracted from image successfully!", { icon: "🔍" });
            }
          } catch (ocrErr) {
            console.error("OCR Failed:", ocrErr);
          } finally {
            toast.dismiss("ocr");
          }
        }
      }

      let finalExpiresAt = null;
      if (expiresInSeconds !== "0") {
        finalExpiresAt = new Date(Date.now() + parseInt(expiresInSeconds) * 1000).toISOString();
      }

      let calculatedSize = 0;
      if (itemType === "file" || itemType === "image") {
        calculatedSize = file ? file.size : 0;
      } else {
        calculatedSize = new Blob([contentVal]).size;
      }

      const newItem = {
        user_id: user.id,
        type: itemType,
        title: title.trim() || (itemType === "file" || itemType === "image" ? file.name : `Snippet (${new Date().toLocaleTimeString()})`),
        content: contentVal,
        file_url: fileUrlVal,
        is_encrypted: useE2EE,
        workspace_id: activeWorkspace ? activeWorkspace.id : null,
        self_destruct: selfDestruct,
        expires_at: finalExpiresAt,
        file_size: calculatedSize,
        is_deleted: false
      };

      if (itemType === "code") {
        newItem.title = `${title.trim() || "Code Snippet"} [${codeLanguage}]`;
      }

      if (useE2EE && (itemType === "text" || itemType === "code") && currentKeyToUse) {
        const ciphertext = await encryptText(contentVal, currentKeyToUse);
        newItem.content = ciphertext;
      }

      if (!isOnline) {
        await saveOfflineClip(newItem);
        toast.success("Saved locally (Offline Queue)!", { icon: "📥" });
        // Trigger re-render to show the newly queued offline clip
        setRawItems((prev) => [...prev]);
        setTextContent("");
        setCodeContent("");
        setFile(null);
        setTitle("");
        setSubmitting(false);
        return;
      }

      const { error } = await supabase
        .from("clipboard_items")
        .insert([newItem]);

      if (error) throw error;

      toast.success("Synced to cloud!");
      
      if (socket) {
        if (activeWorkspace) {
          socket.emit("workspace-clip-update", { workspace_id: activeWorkspace.id });
        } else {
          socket.emit("clip-update", { user_id: user.id });
        }
      }

      setTextContent("");
      setCodeContent("");
      setFile(null);
      setTitle("");
      setSelfDestruct(false);
      setExpiresInSeconds("0");

      fetchItems(user.id);
    } catch (err) {
      toast.dismiss("upload");
      toast.error(err.message || "Failed to add item");
      // Reset file state on failure so user can re-select
      setFile(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAiAction = async (actionType) => {
    if (!aiItem) return;
    setAiLoading(true);
    setAiResponse("");

    try {
      const isCustom = actionType === "custom";
      if (isCustom && !aiCustomPrompt.trim()) {
        toast.error("Please enter a custom instruction first.");
        setAiLoading(false);
        return;
      }

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          content: aiItem.content,
          customPrompt: actionType === "custom" ? aiCustomPrompt.trim()
            : actionType === "translate" ? aiTranslateLang
            : actionType === "rewrite_tone" ? aiTone
            : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI processing failed.");

      setAiResponse(data.result);
      toast.success("AI operation completed successfully!");
    } catch (err) {
      toast.error("AI Error: " + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveAiOutputToFeed = async () => {
    if (!aiResponse || !user) return;
    try {
      const isCode = aiItem.type === "code" || aiResponse.trim().startsWith("```");
      const contentVal = aiResponse.trim();
      const calculatedSize = new Blob([contentVal]).size;
      const keyToUse = activeWorkspace ? workspaceEncryptionKey : encryptionKey;

      const newItem = {
        user_id: user.id,
        type: isCode ? "code" : "text",
        title: `AI Assistant: ${aiItem.title || "Clip"}`,
        content: contentVal,
        file_url: "",
        is_encrypted: useE2EE,
        workspace_id: activeWorkspace ? activeWorkspace.id : null,
        self_destruct: false,
        expires_at: null,
        file_size: calculatedSize,
        is_deleted: false
      };

      if (useE2EE && keyToUse) {
        const ciphertext = await encryptText(contentVal, keyToUse);
        newItem.content = ciphertext;
      }

      const { error } = await supabase.from("clipboard_items").insert([newItem]);
      if (error) throw error;

      toast.success("Saved AI result to clipboard feed!");
      setShowAiModal(false);
      fetchItems(user.id);
    } catch (err) {
      toast.error("Failed to save AI output: " + err.message);
    }
  };

  const handleLogout = async () => {
    if (socket) socket.disconnect();
    sessionStorage.removeItem("klipport_passphrase");
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/");
  };

  const getContributionGrid = () => {
    const calendarDays = [];
    const today = new Date();
    
    const counts = {};
    rawItems.filter(item => !item.is_deleted).forEach(item => {
      const day = new Date(item.created_at).toISOString().split("T")[0];
      counts[day] = (counts[day] || 0) + 1;
    });

    for (let i = 29; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const dayString = day.toISOString().split("T")[0];
      calendarDays.push({
        date: dayString,
        count: counts[dayString] || 0
      });
    }
    return calendarDays;
  };

  const getDateLabel = (item) => {
    if (item.isOffline) return "Offline Queue";
    const date = new Date(item.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getWordCount = (content) => {
    if (!content || typeof content !== "string") return { words: 0, chars: 0 };
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    return { words, chars: content.length };
  };

  const handlePin = async (id, currentPinned) => {
    const { error } = await supabase
      .from("clipboard_items")
      .update({ is_pinned: !currentPinned })
      .eq("id", id);
    if (!error) {
      setRawItems(prev => prev.map(item => item.id === id ? { ...item, is_pinned: !currentPinned } : item));
      toast.success(currentPinned ? "Unpinned" : "Pinned to top!", { icon: "📌" });
    } else {
      toast.error("Failed to pin: " + error.message);
    }
  };

  const toggleClipSelect = (id) => {
    setSelectedClips(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedClips.size === 0) return;
    const ids = Array.from(selectedClips);
    const { error } = await supabase
      .from("clipboard_items")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .in("id", ids);
    if (!error) {
      toast.success(`Moved ${ids.length} clip${ids.length > 1 ? "s" : ""} to Trash`, { icon: "🗑️" });
      setRawItems(prev => prev.map(item => ids.includes(item.id) ? { ...item, is_deleted: true } : item));
      setSelectedClips(new Set());
    } else {
      toast.error("Bulk delete failed: " + error.message);
    }
  };

  const handleBulkCopy = () => {
    if (selectedClips.size === 0) return;
    const textItems = items.filter(item =>
      selectedClips.has(item.id) && !item.locked && (item.type === "text" || item.type === "code")
    );
    if (textItems.length === 0) { toast.error("No copyable text items selected."); return; }
    const combined = textItems.map(i => i.content).join("\n\n---\n\n");
    navigator.clipboard.writeText(combined).then(() => {
      toast.success(`Copied ${textItems.length} clip${textItems.length > 1 ? "s" : ""}!`, { icon: "📋" });
      setSelectedClips(new Set());
    });
  };

  const filteredItems = items
    .filter((item) => {
      // Filter out deleted items unless activeTab is "trash"
      if (activeTab === "trash") return item.is_deleted === true;
      if (item.is_deleted) return false;

      if (activeTab === "all") return true;
      if (activeTab === "text") return item.type === "text";
      if (activeTab === "code") return item.type === "code";
      if (activeTab === "files") return item.type === "file" || item.type === "image";
      return true;
    })
    .filter((item) => {
      if (!selectedTag) return true;
      return item.content && !item.locked && item.content.toLowerCase().includes(selectedTag.toLowerCase());
    })
    .filter((item) => {
      const search = searchQuery.toLowerCase();
      return (
        item.title?.toLowerCase().includes(search) ||
        (item.content && !item.locked && item.content.toLowerCase().includes(search))
      );
    })
    .sort((a, b) => {
      // Pinned items always float to the top
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return 0;
    });

  const getIcon = (type, locked) => {
    if (locked) return <Lock className="h-5 w-5 text-red-400" />;
    switch (type) {
      case "text": return <FileText className="h-5 w-5 text-blue-400" />;
      case "code": return <Code className="h-5 w-5 text-emerald-400" />;
      case "image": return <ImageIcon className="h-5 w-5 text-cyan-400" />;
      default: return <FileIcon className="h-5 w-5 text-orange-400" />;
    }
  };

  const MobileDrawerContent = () => (
    <div className="flex flex-col justify-between h-full space-y-6">
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-500">
            <Clipboard className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight m-0 font-sans" style={{ color: "var(--text1)" }}>Klipport</h2>
            <span className="text-xs text-brand-500 font-semibold tracking-wider uppercase">Cloud Settings</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Active Workspace</label>
          <div className="space-y-1">
            <button
              onClick={() => handleWorkspaceChange(null)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                !activeWorkspace ? "bg-white/5 border border-white/10 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              <User className="h-3.5 w-3.5" /> Personal Workspace
            </button>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => handleWorkspaceChange(ws)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  activeWorkspace?.id === ws.id ? "bg-white/5 border border-white/10 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                <Briefcase className="h-3.5 w-3.5" /> {ws.name}
              </button>
            ))}
            <button
              onClick={() => {
                setShowWorkspaceModal(true);
                setMobileMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-brand-500 hover:text-brand-400 transition-all cursor-pointer border border-dashed border-brand-500/25 bg-brand-500/5"
            >
              <Plus className="h-3.5 w-3.5" /> Create Workspace
            </button>
          </div>
        </div>

        <button
          onClick={() => {
            setGeneratedTokenVal("");
            setShowCliTokenModal(true);
            setMobileMenuOpen(false);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-gray-300 hover:text-white transition-all cursor-pointer border border-white/10 bg-white/[0.02]"
        >
          <Key className="h-3.5 w-3.5" /> Manage CLI Tokens
        </button>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className={`h-5 w-5 ${encryptionKey ? "text-emerald-400" : "text-gray-500"}`} />
            <span className="text-xs font-bold text-white uppercase tracking-wider">Encryption status</span>
          </div>
          {encryptionKey ? (
            <button
              onClick={handleClearPassphrase}
              className="w-full rounded-lg bg-white/5 border border-white/10 py-1.5 text-[10px] font-semibold text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              Lock E2EE keys
            </button>
          ) : (
            <button
              onClick={() => {
                setPassphraseInput("");
                setShowPassphraseText(false);
                setShowPassphraseModal(true);
                setMobileMenuOpen(false);
              }}
              className="w-full rounded-lg bg-brand-600/10 border border-brand-500/30 py-1.5 text-[10px] font-semibold text-brand-500 hover:bg-brand-600/20 transition-all cursor-pointer"
            >
              Set Passphrase
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-white/5 pt-6 space-y-4">
        {user && (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 border border-white/10 text-gray-400">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate m-0 font-sans">{user.user_metadata?.full_name || "User"}</p>
              <p className="text-xs text-gray-500 truncate m-0 font-mono">{user.email}</p>
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
    <div
      className={`flex flex-col min-h-screen w-full max-w-full overflow-x-hidden relative font-sans ${isDark ? "theme-dark" : "theme-light"}`}
      style={{ background: "var(--bg)", color: "var(--text1)" }}
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)", border: "2px dashed var(--brand)" }}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full mb-6 animate-bounce" style={{ background: "var(--brand-bg)", border: "2px solid var(--brand)", color: "var(--brand)" }}>
            <Clipboard className="h-9 w-9" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-2" style={{ color: "var(--text1)" }}>Drop to sync</h2>
          <p className="text-sm" style={{ color: "var(--text2)" }}>Release the file to load it into Klipport.</p>
        </div>
      )}

      {/* Desktop Navigation Header */}
      <header className="hidden xl:flex items-center justify-between px-7 py-3.5 sticky top-0 z-40 a-header">
        {/* Logo + Workspace */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "var(--brand-bg)", border: "1px solid var(--brand-bd)", color: "var(--brand)" }}>
              <Clipboard className="h-4 w-4" />
            </div>
            <span className="text-[17px] font-bold tracking-tight font-editorial" style={{ color: "var(--text1)" }}>Klipport</span>
          </div>

          <div style={{ width: "1px", height: "18px", background: "var(--border)" }} />

          <select
            value={activeWorkspace ? activeWorkspace.id : ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "") handleWorkspaceChange(null);
              else if (val === "__create") setShowWorkspaceModal(true);
              else { const wsObj = workspaces.find((w) => w.id === val); if (wsObj) handleWorkspaceChange(wsObj); }
            }}
            className="a-select text-xs font-medium"
            style={{ fontSize: "13px", padding: "6px 28px 6px 10px" }}
          >
            <option value="">Personal</option>
            {workspaces.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
            <option value="__create">+ New Workspace</option>
          </select>
        </div>

        {/* Center */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { if (encryptionKey) handleClearPassphrase(); else { setPassphraseInput(""); setShowPassphraseText(false); setShowPassphraseModal(true); } }}
            className="a-btn2 text-xs"
            style={encryptionKey ? { color: "var(--green)", background: "var(--green-bg)", borderColor: "var(--green-bd)" } : {}}
          >
            <Shield className="h-3.5 w-3.5" />
            {encryptionKey ? "E2EE Active" : "E2EE Off"}
          </button>

          <button
            onClick={() => { setGeneratedTokenVal(""); setShowCliTokenModal(true); }}
            className="a-btn2 text-xs"
          >
            <Key className="h-3.5 w-3.5" /> CLI Keys
          </button>

          {presenceList.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs" style={{ background: "var(--fill1)", border: "1px solid var(--border)" }}>
              <span className="font-medium" style={{ color: "var(--text3)" }}>Active:</span>
              <div className="flex -space-x-1">
                {presenceList.slice(0, 3).map((p, idx) => (
                  <div key={idx} className="relative group cursor-help h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white uppercase" style={{ background: "var(--brand)", border: "1.5px solid var(--bg)" }}>
                    {p.email ? p.email.substring(0, 2) : "TM"}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 px-2 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap shadow-xl" style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text1)" }}>
                      {p.email}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {typingStatus && (
            <span className="text-xs font-medium animate-pulse" style={{ color: "var(--brand)" }}>{typingStatus}</span>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {user && (
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "var(--fill2)", color: "var(--text2)" }}>
                <User className="h-3.5 w-3.5" />
              </div>
              <span className="text-[13px] font-medium truncate max-w-[120px]" style={{ color: "var(--text1)" }}>{user.user_metadata?.full_name || user.email?.split("@")[0]}</span>
            </div>
          )}

          {/* Theme Toggle */}
          <button onClick={toggleTheme} className="a-icon-btn" title={isDark ? "Switch to Light" : "Switch to Dark"}>
            {isDark
              ? <Sun className="h-4 w-4 theme-icon-pop" />
              : <Moon className="h-4 w-4 theme-icon-pop" />}
          </button>

          <button onClick={handleLogout} className="a-icon-btn" style={{ color: "var(--red)" }} title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>


      {/* Mobile Header */}
      <header className="xl:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-40 a-header">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "var(--brand-bg)", border: "1px solid var(--brand-bd)", color: "var(--brand)" }}>
            <Clipboard className="h-4 w-4" />
          </div>
          <span className="text-[17px] font-bold tracking-tight font-editorial" style={{ color: "var(--text1)" }}>Klipport</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="a-icon-btn" title={isDark ? "Light mode" : "Dark mode"}>
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="a-icon-btn"
            style={{ border: "1px solid var(--border)", padding: "7px", borderRadius: "9px" }}
          >
            <Menu className="h-4.5 w-4.5" />
          </button>
        </div>
      </header>


      {/* CMDK Global Palette */}
      <Cmdk.Dialog open={cmdOpen} onOpenChange={setCmdOpen} cmdk-overlay="">
        <div cmdk-dialog="">
          <Cmdk.Input autoFocus placeholder="Type a command or search..." cmdk-input="" />
          <Cmdk.List cmdk-list="">
            <Cmdk.Empty cmdk-empty="">No results found.</Cmdk.Empty>
            <Cmdk.Group heading="Quick Actions" cmdk-group-heading="">
              <Cmdk.Item cmdk-item="" onSelect={() => { setCmdOpen(false); document.getElementById('new-item-input')?.focus(); }}>
                <Plus /> Create New Clip
              </Cmdk.Item>
              <Cmdk.Item cmdk-item="" onSelect={() => { setCmdOpen(false); toggleTheme(); }}>
                {isDark ? <Sun /> : <Moon />} Toggle Theme
              </Cmdk.Item>
              <Cmdk.Item cmdk-item="" onSelect={() => { setCmdOpen(false); setShowShortcutsModal(true); }}>
                <Keyboard /> Keyboard Shortcuts
              </Cmdk.Item>
            </Cmdk.Group>
            {workspaces.length > 0 && (
              <Cmdk.Group heading="Workspaces" cmdk-group-heading="">
                {workspaces.map(w => (
                  <Cmdk.Item key={w.id} cmdk-item="" onSelect={() => { setActiveWorkspaceId(w.id); setCmdOpen(false); }}>
                    <Briefcase /> Switch to {w.name}
                  </Cmdk.Item>
                ))}
              </Cmdk.Group>
            )}
          </Cmdk.List>
        </div>
      </Cmdk.Dialog>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 xl:hidden flex">
          <div 
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          ></div>
          <div className="relative w-64 bg-dark-card border-r border-white/5 p-6 flex flex-col justify-between h-full shadow-2xl animate-in slide-in-from-left duration-200 ml-auto">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <MobileDrawerContent />
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <main className="flex-1 p-4 sm:p-6 xl:p-8 overflow-y-auto max-h-screen z-10 relative">
        
        {/* Offline notice */}
        {!isOnline && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-6 flex items-center justify-center gap-2 text-xs font-semibold text-amber-500">
            <AlertTriangle className="h-4 w-4 shrink-0 animate-bounce" /> Currently Offline. Text/Code clips will be queued locally and auto-synced when online.
          </div>
        )}

        {/* Workspace Title & Search / Tag filter sub-bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight m-0 flex items-center gap-3" style={{ color: "var(--text1)" }}>
              {activeWorkspace ? activeWorkspace.name : "Universal Clipboard"}
              {activeWorkspace && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="rounded-lg bg-brand-600/10 border border-brand-500/30 px-3 py-1.5 text-xs font-semibold text-brand-500 hover:bg-brand-600/20 flex items-center gap-1 cursor-pointer animate-in fade-in"
                >
                  <Users className="h-3.5 w-3.5" /> Invite Member
                </button>
              )}
            </h1>
            <p className="mt-1 text-xs sm:text-sm" style={{ color: "var(--text2)" }}>
              {activeWorkspace ? "Collaborating with teammates in real-time." : "Instantly share notes, code, and files across all your devices."}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Horizontal Filter Navigation pills */}
            <div className="a-tabs">
              {["all", "text", "code", "files", "trash"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`a-tab ${activeTab === tab ? "active" : ""}`}
                >
                  {tab === "all" ? "All" : tab === "files" ? "Files" : tab}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text3)" }} />
              <input
                type="text"
                placeholder="Search history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="a-input"
                style={{ paddingLeft: "36px" }}
              />
            </div>
          </div>
        </div>

        {/* Dynamic Category Hashtags Bar */}
        {getAllHashtags().length > 0 && (
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-3 scrollbar-thin" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="date-label flex items-center gap-0.5 shrink-0" style={{ color: "var(--text3)" }}>
              <Hash className="h-3.5 w-3.5" style={{ color: "var(--brand)" }} /> Tag Categories:
            </span>
            <div className="flex items-center gap-1.5">
              {getAllHashtags().map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`a-tag cursor-pointer ${selectedTag === tag ? "a-tag-blue" : ""}`}
                  style={selectedTag !== tag ? { color: "var(--text2)", border: "1px solid var(--border)" } : {}}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8">
          {/* Form and Visual Map widgets */}
          <section className="xl:col-span-1 space-y-6">
            <div className="a-panel p-5 sm:p-6">
              <h3 className="text-[17px] font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text1)", letterSpacing: "-0.01em" }}>
                <Plus className="h-5 w-5" style={{ color: "var(--brand)" }} /> Sync New Item
              </h3>

              <div className="a-tabs w-full mb-6 flex">
                {["text", "code", "file", "image"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setItemType(type);
                      setFile(null);
                    }}
                    className={`a-tab flex-1 text-center ${itemType === type ? "active" : ""}`}
                    style={{ textTransform: "capitalize" }}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <form onSubmit={handleAddItem} className="space-y-4">
                {encryptionKey && (
                  <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--green-bg)", border: "1px solid var(--green-bd)" }}>
                    <span className="text-[13px] font-medium flex items-center gap-1.5" style={{ color: "var(--green)" }}>
                      <ShieldCheck className="h-4 w-4" /> Encrypt client-side (E2EE)
                    </span>
                    <input
                      type="checkbox"
                      checked={useE2EE}
                      onChange={(e) => setUseE2EE(e.target.checked)}
                      className="cursor-pointer h-4 w-4"
                      style={{ accentColor: "var(--green)" }}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[13px] font-medium mb-1.5" style={{ color: "var(--text2)" }}>Custom Title (Optional)</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Provide a name..."
                    className="a-input"
                  />
                </div>

                {itemType === "text" && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-gray-400">Your Text (supports Markdown)</label>
                      <button
                        type="button"
                        onClick={toggleSpeechDictation}
                        className={`p-1.5 rounded-lg border flex items-center gap-1 text-[10px] font-bold transition-all cursor-pointer ${
                          isRecording 
                            ? "bg-red-500/10 border-red-500/30 text-red-500 animate-pulse" 
                            : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                        }`}
                      >
                        {isRecording ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                        {isRecording ? "Recording..." : "Dictate Text"}
                      </button>
                    </div>
                    <textarea
                      value={textContent}
                      onChange={(e) => {
                        setTextContent(e.target.value);
                        handleTypingBroadcast();
                      }}
                      placeholder="Paste text here..."
                      rows="5"
                      className="a-textarea"
                    ></textarea>
                  </div>
                )}

                {itemType === "code" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[13px] font-medium mb-1.5" style={{ color: "var(--text2)" }}>Language</label>
                      <select
                        value={codeLanguage}
                        onChange={(e) => setCodeLanguage(e.target.value)}
                        className="a-select w-full"
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
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-gray-400">Code Snippet</label>
                        <button
                          type="button"
                          onClick={toggleSpeechDictation}
                          className={`p-1.5 rounded-lg border flex items-center gap-1 text-[10px] font-bold transition-all cursor-pointer ${
                            isRecording 
                              ? "bg-red-500/10 border-red-500/30 text-red-500 animate-pulse" 
                              : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                          }`}
                        >
                          {isRecording ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                          {isRecording ? "Listening..." : "Dictate Code"}
                        </button>
                      </div>
                      <textarea
                        value={codeContent}
                        onChange={(e) => {
                          setCodeContent(e.target.value);
                          handleTypingBroadcast();
                        }}
                        placeholder="Paste code here..."
                        rows="6"
                        className="a-textarea font-mono"
                      ></textarea>
                    </div>
                  </div>
                )}

                {(itemType === "file" || itemType === "image") && (
                  <div>
                    <label className="block text-[13px] font-medium mb-1.5" style={{ color: "var(--text2)" }}>
                      Select {itemType === "image" ? "Image" : "File"}
                    </label>
                    <div className="flex flex-col items-center justify-center rounded-xl p-6 transition-all relative overflow-hidden" style={{ border: "1.5px dashed var(--border2)", background: "var(--fill1)" }}>
                      <input
                        type="file"
                        onChange={(e) => setFile(e.target.files[0])}
                        accept={itemType === "image" ? "image/*" : "*"}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <Plus className="h-8 w-8 mb-2" style={{ color: "var(--text3)" }} />
                      <p className="text-sm font-semibold truncate max-w-[200px]" style={{ color: "var(--text1)" }}>
                        {file ? file.name : "Click to select a file"}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>
                        {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Up to 50MB"}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 uppercase tracking-wider" style={{ color: "var(--text3)" }}>Expires In</label>
                    <select
                      value={expiresInSeconds}
                      onChange={(e) => setExpiresInSeconds(e.target.value)}
                      className="a-select w-full"
                    >
                      <option value="0">Never</option>
                      <option value="600">10 Minutes</option>
                      <option value="3600">1 Hour</option>
                      <option value="86400">1 Day</option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-end pb-2">
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none" style={{ color: "var(--text2)" }}>
                      <input
                        type="checkbox"
                        checked={selfDestruct}
                        onChange={(e) => setSelfDestruct(e.target.checked)}
                        className="h-3.5 w-3.5 cursor-pointer"
                        style={{ accentColor: "var(--brand)" }}
                      />
                      <Flame className={`h-4 w-4 ${selfDestruct ? "" : ""}`} style={selfDestruct ? { color: "var(--amber)" } : { color: "var(--text3)" }} /> Self-Destruct
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="a-btn w-full py-3"
                >
                  {submitting ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : (
                    <>Sync to Workspace</>
                  )}
                </button>
              </form>
            </div>



            {/* System Status Widget (Combined Storage & Sync) */}
            <div className="a-panel overflow-hidden mt-6">
              {/* Storage Quota utilization tracker */}
              <div className="p-4 sm:p-5 border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <h4 className="text-[11px] font-extrabold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: "var(--text1)" }}>
                  <HardDrive className="h-3.5 w-3.5" style={{ color: "var(--brand)" }} /> Storage
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-semibold" style={{ color: "var(--text2)" }}>
                    <span>{(rawItems.reduce((acc, curr) => acc + (curr.file_size || 0), 0) / 1024 / 1024).toFixed(2)} MB used</span>
                    <span>50.00 MB Limit</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--fill2)" }}>
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        background: "var(--brand)",
                        width: `${Math.min((rawItems.reduce((acc, curr) => acc + (curr.file_size || 0), 0) / (50 * 1024 * 1024)) * 100, 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Sync Activity contribution calendar */}
              <div className="p-4 sm:p-5" style={{ background: "var(--surface2)" }}>
                <h4 className="text-[11px] font-extrabold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: "var(--text1)" }}>
                  <Clock className="h-3.5 w-3.5" style={{ color: "var(--brand)" }} /> Activity
                </h4>
                <div className="grid grid-cols-10 gap-1.5">
                  {getContributionGrid().map((day, idx) => (
                    <div
                      key={idx}
                      className={`h-4 w-4 sm:h-5 sm:w-5 rounded-[4px] transition-all cursor-help relative group ${
                        day.count === 0 
                          ? "bg-white/[0.04] dark:bg-white/[0.02]" 
                          : day.count < 3 
                          ? "bg-brand-500/20 text-brand-400" 
                          : day.count < 6 
                          ? "bg-brand-500/50 text-brand-300" 
                          : "bg-brand-500 text-white"
                      }`}
                      style={day.count === 0 ? { background: "var(--fill2)" } : {}}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-10 px-2 py-1 rounded-lg text-[9px] font-bold whitespace-nowrap shadow-xl" style={{ background: "var(--surface3)", border: "1px solid var(--border)", color: "var(--text1)" }}>
                        {day.date}: {day.count} syncs
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* List Section */}
          <section className="xl:col-span-2 space-y-4">
            {/* Bulk Action Bar — appears when clips are selected */}
            {selectedClips.size > 0 && (
              <div className="sticky top-20 z-30 flex items-center justify-between gap-3 rounded-[14px] border px-4 py-3 shadow-xl bulk-bar" style={{ background: "var(--header-bg)", borderColor: "var(--brand-bd)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}>
                <span className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text1)" }}>
                  <CheckSquare className="h-4 w-4" style={{ color: "var(--brand)" }} />
                  {selectedClips.size} clip{selectedClips.size > 1 ? "s" : ""} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBulkCopy}
                    className="a-btn2"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy All
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="a-btn2"
                    style={{ color: "var(--red)", background: "var(--red-bg)", borderColor: "var(--red-bd)" }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete All
                  </button>
                  <button
                    onClick={() => setSelectedClips(new Set())}
                    className="a-icon-btn"
                    title="Clear selection"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5, 6].map((val) => (
                  <div key={val} className="a-card p-5 space-y-3 skeleton" style={{ background: "transparent" }}>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg shrink-0" style={{ background: "var(--fill2)" }}></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-1/3 rounded" style={{ background: "var(--fill2)" }}></div>
                        <div className="h-3 w-1/5 rounded" style={{ background: "var(--fill2)" }}></div>
                      </div>
                      <div className="flex gap-1.5">
                        <div className="h-7 w-7 rounded-lg" style={{ background: "var(--fill2)" }}></div>
                        <div className="h-7 w-7 rounded-lg" style={{ background: "var(--fill2)" }}></div>
                      </div>
                    </div>
                    <div className="h-12 w-full rounded-lg" style={{ background: "var(--fill2)" }}></div>
                  </div>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="a-panel p-16 text-center flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-[18px] mb-5" style={{ background: "var(--fill1)", border: "1px solid var(--border)", color: "var(--text2)" }}>
                  <Clipboard className="h-8 w-8" />
                </div>
                <h4 className="text-[17px] font-semibold mb-1" style={{ color: "var(--text1)", letterSpacing: "-0.01em" }}>
                  {searchQuery ? "No results found" : activeTab === "trash" ? "Trash is empty" : "No clips yet"}
                </h4>
                <p className="text-sm max-w-xs" style={{ color: "var(--text2)" }}>
                  {searchQuery
                    ? `No clips match "${searchQuery}". Try a different search.`
                    : activeTab === "trash"
                    ? "Deleted clips appear here for recovery."
                    : "Sync your first item using the form on the left. Supports text, code, files, and images."}
                </p>
                {!searchQuery && activeTab !== "trash" && (
                  <div className="mt-5 flex items-center gap-2 text-[11px] font-medium" style={{ color: "var(--text3)" }}>
                    <span>Press</span>
                    <kbd className="px-1.5 py-0.5 rounded" style={{ border: "1px solid var(--border)", background: "var(--fill1)", color: "var(--text2)" }}>Alt</kbd>
                    <span>+</span>
                    <kbd className="px-1.5 py-0.5 rounded" style={{ border: "1px solid var(--border)", background: "var(--fill1)", color: "var(--text2)" }}>N</kbd>
                    <span>to create your first clip</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(
                  filteredItems.reduce((acc, item) => {
                    const dl = getDateLabel(item);
                    if (!acc[dl]) acc[dl] = [];
                    acc[dl].push(item);
                    return acc;
                  }, {})
                ).map(([dateLabel, items]) => (
                  <div key={dateLabel}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="date-label whitespace-nowrap">{dateLabel}</span>
                      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                    </div>
                    <div className="columns-1 sm:columns-2 xl:columns-3 gap-4">
                      <AnimatePresence>
                        {items.map(item => {
                          const wc = getWordCount(item.content);
                          return (
                            <motion.div
                              layoutId={item.id}
                              initial={{ opacity: 0, y: 15 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              transition={{ type: "spring", stiffness: 400, damping: 30 }}
                              key={item.id}
                              className={`group relative p-4 sm:p-5 mb-4 break-inside-avoid ${
                                copiedId === item.id
                                  ? "a-card-copied"
                                  : selectedClips.has(item.id)
                                  ? "a-card-selected"
                                  : item.is_pinned
                                  ? "a-card-pinned"
                                  : "a-card"
                              }`}
                            >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Bulk select checkbox */}
                          <input
                            type="checkbox"
                            checked={selectedClips.has(item.id)}
                            onChange={() => toggleClipSelect(item.id)}
                            className="h-4 w-4 shrink-0 accent-brand-600 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                            style={selectedClips.has(item.id) ? { opacity: 1 } : {}}
                            title="Select clip"
                          />
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]" style={{ background: "var(--fill1)", border: "1px solid var(--border)", color: "var(--text2)" }}>
                            {getIcon(item.type, item.locked)}
                          </div>
                          <div className="min-w-0 flex flex-col justify-center">
                            <h4 className="text-[14px] font-semibold m-0 truncate max-w-[150px] xs:max-w-[200px] sm:max-w-md flex flex-wrap items-center gap-1.5" style={{ color: "var(--text1)", letterSpacing: "-0.01em" }}>
                              {item.title}
                              {item.is_pinned && (
                                <span className="a-tag a-tag-amber"><Pin className="h-2.5 w-2.5" /> Pinned</span>
                              )}
                              {item.is_encrypted && (
                                <span className="a-tag a-tag-green"><ShieldCheck className="h-3 w-3" /> E2EE</span>
                              )}
                              {item.isOffline && (
                                <span className="a-tag a-tag-amber">Offline Queue</span>
                              )}
                              {item.self_destruct && (
                                <span className="a-tag a-tag-red"><Flame className="h-3 w-3" /> Self-Destruct</span>
                              )}
                            </h4>
                            <span className="text-xs" style={{ color: "var(--text3)" }}>
                              {new Date(item.created_at).toLocaleString()}
                              {!item.locked && (item.type === "text" || item.type === "code") && wc.words > 0 && (
                                <span className="ml-2 font-medium" style={{ color: "var(--text2)" }}>· {wc.words} words · {wc.chars} chars</span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity shrink-0">
                          {activeTab === "trash" ? (
                            <>
                              <button onClick={() => handleRestore(item.id)} className="a-icon-btn" title="Restore item">
                                <RotateCcw className="h-4 w-4" />
                              </button>
                              <button onClick={() => handleDelete(item.id)} className="a-icon-btn" style={{ color: "var(--red)" }} title="Delete permanently">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              {!item.isOffline && (
                                <button
                                  onClick={() => handlePin(item.id, item.is_pinned)}
                                  className="a-icon-btn"
                                  style={item.is_pinned ? { color: "var(--amber)", background: "var(--fill2)" } : {}}
                                  title={item.is_pinned ? "Unpin" : "Pin to top"}
                                >
                                  <Pin className="h-4 w-4" />
                                </button>
                              )}
                              {!item.locked && (item.type === "text" || item.type === "code") && (
                                <button
                                  onClick={() => { setQrContent(item.content?.slice(0, 500) || item.title); setShowQrModal(true); }}
                                  className="a-icon-btn"
                                  title="Generate QR code"
                                >
                                  <QrCode className="h-4 w-4" />
                                </button>
                              )}
                              {!item.locked && !item.isOffline && (
                                <button
                                  onClick={() => { setShareItem(item); setGeneratedLink(""); setSharePassword(""); setShowSharePasswordText(false); setShowShareModal(true); }}
                                  className="a-icon-btn"
                                  title="Generate shareable link"
                                >
                                  <Share2 className="h-4 w-4" />
                                </button>
                              )}
                              {!item.locked && !item.isOffline && (
                                <button
                                  onClick={() => { setAiItem(item); setAiResponse(""); setAiCustomPrompt(""); setShowAiModal(true); }}
                                  className="a-icon-btn"
                                  style={{ color: "var(--brand)" }}
                                  title="AI Clipboard Assist"
                                >
                                  <Sparkles className="h-4 w-4" />
                                </button>
                              )}
                              {!item.locked && (item.type === "text" || item.type === "code") && (
                                <button
                                  onClick={() => handleCopy(item)}
                                  className="a-icon-btn relative"
                                  style={copiedId === item.id ? { color: "var(--green)", background: "var(--fill2)" } : {}}
                                  title="Copy to Clipboard"
                                >
                                  {copiedId === item.id ? <UserCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </button>
                              )}
                              {!item.locked && !item.isOffline && (item.type === "file" || item.type === "image") && (
                                <a
                                  href={item.is_encrypted ? (decryptedFiles[item.id] || "#") : item.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="a-icon-btn flex items-center justify-center"
                                  title="Open Link"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                              {!item.isOffline && (
                                <button onClick={() => handleDelete(item.id)} className="a-icon-btn" title="Move to Trash">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 text-sm" style={{ color: "var(--text2)" }}>
                        {item.locked ? (
                          <div className="rounded-[12px] p-4 flex items-center gap-3" style={{ background: "var(--red-bg)", border: "1px solid var(--red-bd)", color: "var(--red)" }}>
                            <Lock className="h-5 w-5 flex-shrink-0" />
                            <div>
                              <p className="font-semibold text-[13px] m-0">Item encrypted client-side</p>
                              <p className="text-[11px] m-0 mt-0.5" style={{ color: "var(--red)" }}>Unlock E2EE by entering your passphrase in the header to access.</p>
                            </div>
                          </div>
                        ) : (
                          <>
                            {item.type === "text" && (
                              <div className="p-3 rounded-xl max-h-40 overflow-y-auto leading-relaxed" style={{ background: "var(--fill1)", border: "1px solid var(--border)", fontSize: "13px" }}>
                                {renderMarkdownContent(item)}
                              </div>
                            )}

                            {item.type === "code" && (
                              <pre className="overflow-x-auto p-4 rounded-xl font-mono text-[11px] max-h-60" style={{ background: "var(--surface3)", border: "1px solid var(--border)", color: "var(--text1)" }}>
                                <code dangerouslySetInnerHTML={{ __html: highlightCode(item.content) }} />
                              </pre>
                            )}

                            {item.type === "image" && (
                              <div className="space-y-2">
                                <div className="relative mt-2 max-w-sm rounded-xl overflow-hidden transition-all" style={{ border: "1px solid var(--border)" }}>
                                  {item.is_encrypted ? (
                                    decryptedFiles[item.id] ? (
                                      <img src={decryptedFiles[item.id]} alt={item.title} className="w-full h-auto max-h-64 object-cover" />
                                    ) : (
                                      <div className="h-32 flex items-center justify-center text-xs animate-pulse" style={{ background: "var(--fill2)", color: "var(--text3)" }}>Decrypting image binary...</div>
                                    )
                                  ) : (
                                    <img src={item.file_url} alt={item.title} className="w-full h-auto max-h-64 object-cover" />
                                  )}
                                </div>
                                {item.content && item.content !== item.title && (
                                  <div className="p-3 rounded-xl text-[10px] font-mono whitespace-pre-wrap max-h-24 overflow-y-auto" style={{ background: "var(--fill1)", border: "1px solid var(--border)" }}>
                                    <span className="text-[9px] font-bold block mb-1" style={{ color: "var(--cyan)" }}>🔍 EXTRACTED OCR TEXT:</span>
                                    {item.content}
                                  </div>
                                )}
                              </div>
                            )}

                            {item.type === "file" && (
                              <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "var(--fill1)", border: "1px solid var(--border)" }}>
                                <span className="font-mono text-xs truncate max-w-[120px] sm:max-w-xs">{item.content}</span>
                                {item.is_encrypted ? (
                                  decryptedFiles[item.id] ? (
                                    <a href={decryptedFiles[item.id]} download={item.title} className="text-xs font-semibold hover:underline flex items-center gap-1 shrink-0 ml-2" style={{ color: "var(--brand)" }}>
                                      <Download className="h-3.5 w-3.5" /> Download
                                    </a>
                                  ) : (
                                    <span className="text-[10px] animate-pulse shrink-0 ml-2" style={{ color: "var(--text3)" }}>Decrypting...</span>
                                  )
                                ) : (
                                  <a href={item.file_url} download className="text-xs font-semibold hover:underline shrink-0 ml-2" style={{ color: "var(--brand)" }}>Download File</a>
                                )}
                              </div>
                            )}

                            {previews[item.id] && (
                              <div className="mt-3 flex gap-3 p-3 rounded-xl" style={{ background: "var(--fill1)", border: "1px solid var(--border)" }}>
                                {previews[item.id].image && (
                                  <img src={previews[item.id].image} className="w-16 h-16 object-cover rounded-lg shrink-0" style={{ border: "1px solid var(--border)" }} />
                                )}
                                <div className="min-w-0 flex-1">
                                  <h5 className="font-semibold text-[13px] truncate" style={{ color: "var(--text1)" }}>{previews[item.id].title}</h5>
                                  <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: "var(--text3)" }}>{previews[item.id].description}</p>
                                  <a href={previews[item.id].url} target="_blank" rel="noreferrer" className="text-[10px] mt-1.5 font-semibold flex items-center gap-0.5 hover:underline font-sans" style={{ color: "var(--brand)" }}>
                                    Go to link <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
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
        <div className="a-modal-overlay">
          <div className="a-modal-panel w-full max-w-md">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2 font-sans">
              <Share2 className="h-5 w-5 text-brand-500" /> Share Clipboard Item
            </h3>
            <p className="text-xs mb-6 font-sans" style={{ color: "var(--text2)" }}>Create a secure link for "{shareItem.title}"</p>

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
                  <div className="relative font-sans">
                    <input
                      type={showSharePasswordText ? "text" : "password"}
                      value={sharePassword}
                      onChange={(e) => setSharePassword(e.target.value)}
                      placeholder="Leave blank for no password"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.02] py-2.5 pl-4 pr-10 text-sm text-white placeholder-gray-600 outline-none transition-all focus:border-brand-500/30"
                    />
                    {sharePassword && (
                      <button
                        type="button"
                        onClick={() => setShowSharePasswordText(!showSharePasswordText)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white cursor-pointer"
                      >
                        {showSharePasswordText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </div>

                <button type="submit" className="a-btn w-full py-3">
                  {generatingLink ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : (
                    <>Generate Shareable Link</>
                  )}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="bg-black/20 border border-white/5 rounded-xl p-3.5 flex items-center justify-between gap-3 font-mono">
                  <span className="text-xs text-brand-500 truncate max-w-xs select-all">
                    {generatedLink}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedLink);
                      toast.success("Copied share link!");
                    }}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 hover:text-brand-500 transition-all shrink-0 cursor-pointer"
                    title="Copy sharing link"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="a-btn a-btn-ghost w-full py-3"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Set Passphrase Modal */}
      {showPassphraseModal && (
        <div className="a-modal-overlay">
          <div className="a-modal-panel w-full max-w-md">
            <button
              onClick={() => setShowPassphraseModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold mb-1 flex items-center gap-2" style={{ color: "var(--text1)" }}>
              <Shield className="h-5 w-5 text-brand-500" /> E2EE Passphrase
            </h3>
            <p className="text-xs mb-6 font-sans" style={{ color: "var(--text2)" }}>
              Enter your secret decryption password. This is stored only in your browser memory and used to encrypt/decrypt synced cloud items.
            </p>

            <form onSubmit={handleSetPassphrase} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text2)" }}>Encryption Passphrase</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                  <input
                    type={showPassphraseText ? "text" : "password"}
                    value={passphraseInput}
                    onChange={(e) => setPassphraseInput(e.target.value)}
                    placeholder="Enter secret passphrase"
                    className="a-input" style={{ paddingLeft: "2.75rem", paddingRight: "2.5rem" }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassphraseText(!showPassphraseText)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white cursor-pointer"
                  >
                    {showPassphraseText ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <button type="submit" className="a-btn w-full py-3">
                Activate E2EE Keys
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CLI Tokens Management Modal */}
      {showCliTokenModal && (
        <div className="a-modal-overlay">
          <div className="a-modal-panel w-full max-w-lg">
            <button
              onClick={() => setShowCliTokenModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold mb-1 flex items-center gap-2" style={{ color: "var(--text1)" }}>
              <Key className="h-5 w-5 text-brand-500" /> CLI Access Tokens
            </h3>
            <p className="text-xs mb-6" style={{ color: "var(--text2)" }}>
              Generate Personal Access Tokens (PAT) to log in to the Desktop CLI Companion securely without typing your account password.
            </p>

            <form onSubmit={handleCreateCliToken} className="space-y-4 border-b border-white/5 pb-6 mb-6">
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    placeholder="Token name (e.g. My Laptop)"
                    className="a-input"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={tokenSubmitting}
                  className="rounded-xl bg-brand-600 hover:bg-brand-500 px-5 text-sm font-semibold text-white cursor-pointer"
                >
                  {tokenSubmitting ? "Generating..." : "Generate"}
                </button>
              </div>

              {generatedTokenVal && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-2">
                  <span className="text-[10px] font-bold text-emerald-400 block">⚠️ COPY THIS TOKEN NOW (It will not be displayed again):</span>
                  <div className="flex items-center justify-between gap-3 bg-black/25 p-2.5 rounded border border-white/5">
                    <span className="text-xs text-emerald-400 font-mono truncate select-all">{generatedTokenVal}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedTokenVal);
                        toast.success("Token copied!");
                      }}
                      className="p-1 rounded bg-white/5 hover:bg-white/10 hover:text-emerald-400"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </form>

            <div className="space-y-3 max-h-52 overflow-y-auto">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider m-0">Active Tokens</h4>
              {cliTokens.length === 0 ? (
                <p className="text-xs text-gray-500 m-0">No active access tokens. Generate one above to link your terminal.</p>
              ) : (
                <div className="space-y-2">
                  {cliTokens.map((t) => (
                    <div key={t.id} className="flex items-center justify-between bg-white/[0.01] border border-white/5 p-3 rounded-xl">
                      <div>
                        <span className="text-xs font-bold text-white block">{t.name}</span>
                        <span className="text-[10px] text-gray-500 block">Created: {new Date(t.created_at).toLocaleDateString()}</span>
                      </div>
                      <button
                        onClick={() => handleRevokeCliToken(t.id)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                        title="Revoke Token"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Workspace Modal */}
      {showWorkspaceModal && (
        <div className="a-modal-overlay">
          <div className="a-modal-panel w-full max-w-md">
            <button
              onClick={() => setShowWorkspaceModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold mb-1 flex items-center gap-2" style={{ color: "var(--text1)" }}>
              <Briefcase className="h-5 w-5 text-brand-500" /> Create Workspace
            </h3>
            <p className="text-xs mb-6" style={{ color: "var(--text2)" }}>
              Create a shared environment to collaborate on files, links, and code snippets with your team.
            </p>

            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Workspace Name</label>
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="e.g. Design Team, Project Alpha"
                  className="a-input"
                  required
                />
              </div>

              <button type="submit" className="a-btn w-full py-3">
                {workspaceSubmitting ? "Creating..." : "Create Workspace"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && activeWorkspace && (
        <div className="a-modal-overlay">
          <div className="a-modal-panel w-full max-w-md">
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold mb-1 flex items-center gap-2" style={{ color: "var(--text1)" }}>
              <Users className="h-5 w-5 text-brand-500" /> Invite to "{activeWorkspace.name}"
            </h3>
            <p className="text-xs mb-6" style={{ color: "var(--text2)" }}>
              Add a teammate by entering their email address. They will be able to view and publish items to this workspace.
            </p>

            <form onSubmit={handleInviteMember} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Teammate's Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@email.com"
                  className="a-input"
                  required
                />
              </div>

              <button type="submit" className="a-btn w-full py-3">
                {workspaceSubmitting ? "Inviting..." : `Add to ${activeWorkspace.name}`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* AI Assistant Modal */}
      {showAiModal && aiItem && (
        <div className="a-modal-overlay">
          <div className="a-modal-panel w-full max-w-lg">
            <button
              onClick={() => setShowAiModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold mb-1 flex items-center gap-2" style={{ color: "var(--text1)" }}>
              <Sparkles className="h-5 w-5 text-brand-500 animate-pulse" /> AI Clipboard Copilot
            </h3>
            <p className="text-xs mb-6" style={{ color: "var(--text2)" }}>
              Transform, analyze, and sync your clipboard content using Gemini.
            </p>

            <div className="space-y-4">
              <div className="bg-black/25 p-3.5 rounded-xl border border-white/5 space-y-1">
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block font-mono">Original Content Preview:</span>
                <p className="text-xs text-gray-300 m-0 truncate max-w-md font-mono">{aiItem.content}</p>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Quick AI Presets:</span>
                <div className="flex flex-wrap gap-2">
                  {aiItem.type === "text" && (
                    <button
                      onClick={() => handleAiAction("summarize")}
                      disabled={aiLoading}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-50"
                    >
                      Summarize Text
                    </button>
                  )}
                  {aiItem.type === "code" && (
                    <>
                      <button
                        onClick={() => handleAiAction("explain_code")}
                        disabled={aiLoading}
                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-50"
                      >
                        Explain Code
                      </button>
                      <button
                        onClick={() => handleAiAction("fix_syntax")}
                        disabled={aiLoading}
                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-50"
                      >
                        Fix Syntax & Bugs
                      </button>
                    </>
                  )}
                  {aiItem.type === "image" && (
                    <button
                      onClick={() => handleAiAction("ocr_json")}
                      disabled={aiLoading}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-50"
                    >
                      Convert OCR to JSON
                    </button>
                  )}
                </div>
              </div>

              {/* Translate Preset */}
              {(aiItem.type === "text" || aiItem.type === "code") && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block flex items-center gap-1">
                    <Globe className="h-3 w-3" /> Translate To:
                  </span>
                  <div className="flex gap-2">
                    <select
                      value={aiTranslateLang}
                      onChange={(e) => setAiTranslateLang(e.target.value)}
                      disabled={aiLoading}
                      className="flex-1 rounded-xl border border-white/10 bg-dark-card py-2 px-3 text-xs text-white outline-none focus:border-brand-500/30"
                    >
                      {["Spanish","French","German","Hindi","Japanese","Chinese","Arabic","Portuguese","Italian","Korean","Russian"].map(lang => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleAiAction("translate")}
                      disabled={aiLoading}
                      className="rounded-xl bg-cyan-600/20 border border-cyan-500/30 hover:bg-cyan-600/30 px-4 text-xs font-semibold text-cyan-400 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      Translate
                    </button>
                  </div>
                </div>
              )}

              {/* Tone Rewriter Preset */}
              {aiItem.type === "text" && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Rewrite Tone:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {["Formal","Casual","Professional","Friendly","Concise"].map(tone => (
                      <button
                        key={tone}
                        onClick={() => { setAiTone(tone); handleAiAction("rewrite_tone"); }}
                        disabled={aiLoading}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 ${
                          aiTone === tone
                            ? "bg-brand-600/20 border-brand-500/40 text-brand-400"
                            : "bg-white/5 border-white/10 hover:bg-white/10 text-white"
                        }`}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2 border-t border-white/5">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Custom AI Instructions:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiCustomPrompt}
                    onChange={(e) => setAiCustomPrompt(e.target.value)}
                    placeholder="e.g. Translate to German, rewrite as Python, make it formal..."
                    className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] py-2 px-3.5 text-xs text-white placeholder-gray-500 outline-none focus:border-brand-500/30"
                    disabled={aiLoading}
                  />
                  <button
                    onClick={() => handleAiAction("custom")}
                    disabled={aiLoading}
                    className="rounded-xl bg-brand-600 hover:bg-brand-500 px-4 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                  >
                    Run
                  </button>
                </div>
              </div>

              {(aiLoading || aiResponse) && (
                <div className="space-y-2 pt-4 border-t border-white/5">
                  <span className="text-[10px] font-bold text-brand-500 uppercase tracking-widest flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 animate-spin" /> AI Copilot Result:
                  </span>
                  
                  {aiLoading ? (
                    <div className="rounded-xl border border-white/5 bg-black/25 p-4 animate-pulse space-y-2 h-28 flex flex-col justify-center items-center text-xs text-gray-500">
                      <span>Gemini is thinking...</span>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/5 bg-black/35 p-4 space-y-3">
                      <div className="text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                        {aiResponse}
                      </div>

                      <div className="flex gap-2 justify-end pt-2 border-t border-white/5">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(aiResponse);
                            toast.success("AI output copied!");
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-[10px] font-semibold text-gray-300 hover:text-white transition-all cursor-pointer"
                        >
                          Copy Output
                        </button>
                        <button
                          onClick={handleSaveAiOutputToFeed}
                          className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-[10px] font-semibold text-white transition-all cursor-pointer"
                        >
                          Save as New Clip
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="a-modal-overlay">
          <div className="a-modal-panel w-full max-w-sm">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-1 flex items-center justify-center gap-2">
              <QrCode className="h-5 w-5 text-cyan-400" /> QR Code
            </h3>
            <p className="text-xs text-gray-400 mb-5">Scan with any QR reader to access this content.</p>
            <div className="flex justify-center mb-4">
              <canvas
                ref={el => {
                  if (el && qrContent) {
                    import("qrcode").then(QRCode => {
                      QRCode.default.toCanvas(el, qrContent, {
                        width: 220,
                        color: { dark: "#ffffff", light: "#14151b" },
                        margin: 2
                      });
                    });
                  }
                }}
                className="rounded-xl"
              />
            </div>
            <p className="text-[10px] text-gray-500 font-mono truncate px-2">{qrContent?.slice(0, 60)}{qrContent?.length > 60 ? "..." : ""}</p>
            <button
              onClick={() => setShowQrModal(false)}
              className="a-btn a-btn-ghost w-full py-3 mt-5"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help Modal */}
      {showShortcutsModal && (
        <div className="a-modal-overlay">
          <div className="a-modal-panel w-full max-w-md">
            <button
              onClick={() => setShowShortcutsModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-xl font-bold mb-1 flex items-center gap-2" style={{ color: "var(--text1)" }}>
              <Keyboard className="h-5 w-5 text-brand-500" /> Keyboard Shortcuts
            </h3>
            <p className="text-xs mb-6" style={{ color: "var(--text2)" }}>Use these shortcuts to navigate Klipport faster.</p>
            <div className="space-y-3">
              {[
                { keys: ["Ctrl", "K"], desc: "Focus search bar" },
                { keys: ["Alt", "N"], desc: "Create new clip (focus form)" },
                { keys: ["Esc"], desc: "Close modal / clear selection" },
                { keys: ["?"], desc: "Show this shortcuts guide" },
              ].map(({ keys, desc }) => (
                <div key={desc} className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-sm text-gray-300">{desc}</span>
                  <div className="flex items-center gap-1">
                    {keys.map((k, i) => (
                      <span key={k}>
                        <kbd className="px-2 py-1 rounded-lg border border-white/15 bg-white/5 text-xs font-mono font-bold text-gray-300">{k}</kbd>
                        {i < keys.length - 1 && <span className="text-gray-600 mx-0.5 text-xs">+</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowShortcutsModal(false)}
              className="a-btn a-btn-ghost w-full py-3 mt-6"
            >
              Got it
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
