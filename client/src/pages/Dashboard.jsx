import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { toast } from "react-hot-toast";
import { io } from "socket.io-client";
import { deriveKey, encryptText, decryptText, encryptFile, decryptFile } from "../utils/crypto";
import Tesseract from "tesseract.js";
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
  Laptop,
  CheckCircle,
  HelpCircle
} from "lucide-react";

// --- IndexedDB Configuration for Offline Caching ---
const openIndexedDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("ClipSyncOffline", 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("offline_clips")) {
        db.createObjectStore("offline_clips", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

const saveOfflineClip = async (clip) => {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("offline_clips", "readwrite");
    const store = transaction.objectStore("offline_clips");
    const request = store.add(clip);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
};

const getOfflineClips = async () => {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("offline_clips", "readonly");
    const store = transaction.objectStore("offline_clips");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => reject(e.target.error);
  });
};

const deleteOfflineClip = async (id) => {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("offline_clips", "readwrite");
    const store = transaction.objectStore("offline_clips");
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
};

// --- Custom Code Highlighter ---
function highlightCode(code, lang) {
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
          0.75 // 75% Quality
        );
      };
    };
  });
};

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [rawItems, setRawItems] = useState([]); 
  const [items, setItems] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Socket State
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  // E2EE States
  const [passphrase, setPassphrase] = useState("");
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [showPassphraseModal, setShowPassphraseModal] = useState(false);
  const [passphraseInput, setPassphraseInput] = useState("");
  const [showPassphraseText, setShowPassphraseText] = useState(false);
  const [useE2EE, setUseE2EE] = useState(false);
  const [decryptedFiles, setDecryptedFiles] = useState({});

  // Mobile navigation state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Workspaces State
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null); 
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [workspaceSubmitting, setWorkspaceSubmitting] = useState(false);

  // Advanced inputs: Expiration, Self-destruct
  const [expiresInSeconds, setExpiresInSeconds] = useState("0"); // 0 = never
  const [selfDestruct, setSelfDestruct] = useState(false);

  // Speech Recognition States
  const [isRecording, setIsRecording] = useState(false);

  // Drag and Drop overlay State
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Rich Link Previews Map
  const [previews, setPreviews] = useState({});

  // Connected clients count simulation
  const [connectedTerminals, setConnectedTerminals] = useState(1);

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
      // Ctrl + K / Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder="Search history..."]');
        if (searchInput) searchInput.focus();
      }
      // Alt + N to switch text inputs
      if (e.altKey && e.key === "n") {
        e.preventDefault();
        setItemType("text");
        const titleInput = document.querySelector('input[placeholder="Provide a name..."]');
        if (titleInput) titleInput.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Drag and Drop File Handlers
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

  // Web Speech API Microphone Dictation
  const toggleSpeechDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Web Speech API is not supported in this browser.");
      return;
    }

    if (isRecording) {
      if (window.clipsync_recognition) {
        window.clipsync_recognition.stop();
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

      rec.onerror = (e) => {
        console.error("Speech Recognition Error:", e);
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      window.clipsync_recognition = rec;
      rec.start();
    }
  };

  // Parse URLs and fetch Rich Link Previews
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

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Connection restored! Syncing database...");
      syncOfflineClips();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.error("You are offline. Clips will be saved locally.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [user, activeWorkspace, socket]);

  // Sync Offline Queue
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
        fetchWorkspaces(session.user.id);

        socketInstance = io(backendUrl);
        setSocket(socketInstance);

        socketInstance.on("connect", () => {
          setConnected(true);
          socketInstance.emit("join-room", session.user.id);
          // Simulate multiple terminals dynamically
          setConnectedTerminals(Math.floor(Math.random() * 2) + 2);
        });

        socketInstance.on("disconnect", () => {
          setConnected(false);
          setConnectedTerminals(1);
        });

        socketInstance.on("clip-sync", (data) => {
          triggerBrowserNotification("Personal Clip Sync", "Your personal clipboard was updated!");
          toast.success("Personal Clipboard synced!", { icon: "🔄" });
          fetchItems(session.user.id);
        });

        socketInstance.on("workspace-clip-sync", (data) => {
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
    };
  }, [navigate, backendUrl]);

  // Decrypt items when rawItems or encryptionKey changes
  useEffect(() => {
    const processItems = async () => {
      const dbClips = await Promise.all(
        rawItems.map(async (item) => {
          // Detect link previews dynamically
          if (item.type === "text" && !item.is_encrypted) {
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const match = item.content?.match(urlRegex);
            if (match) {
              fetchLinkPreview(item.id, match[0]);
            }
          }

          if (!item.is_encrypted) return item;

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
              // Check link preview for decrypted text
              const urlRegex = /(https?:\/\/[^\s]+)/g;
              const match = decryptedContent?.match(urlRegex);
              if (match) {
                fetchLinkPreview(item.id, match[0]);
              }
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

      // Fetch locally queued offline items
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
  }, [rawItems, encryptionKey, activeWorkspace]);

  // Trigger local OS notification
  const triggerBrowserNotification = (title, body) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/logo.svg"
      });
    }
  };

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
    let query = supabase
      .from("clipboard_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (activeWorkspace) {
      query = query.eq("workspace_id", activeWorkspace.id);
    } else {
      query = query.is("workspace_id", null).eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      toast.error("Failed to fetch items: " + error.message);
    } else {
      setRawItems(data || []);
    }
    setLoading(false);
  };

  const fetchWorkspaces = async (userId) => {
    const { data, error } = await supabase
      .from("workspaces")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setWorkspaces(data);
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
      fetchWorkspaces(user.id);
    } catch (err) {
      toast.error("Failed to create workspace: " + err.message);
    } finally {
      setWorkspaceSubmitting(false);
    }
  };

  const handleInviteMember = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !activeWorkspace) return;

    setWorkspaceSubmitting(true);
    try {
      const { error } = await supabase
        .from("workspace_members")
        .insert([{ workspace_id: activeWorkspace.id, user_email: inviteEmail.trim().toLowerCase() }]);

      if (error) throw error;

      toast.success(`Invitation sent to ${inviteEmail}!`);
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

  useEffect(() => {
    if (user) {
      fetchItems(user.id);
    }
  }, [activeWorkspace, user]);

  const handleLogout = async () => {
    if (socket) socket.disconnect();
    sessionStorage.removeItem("clipsync_passphrase");
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/");
  };

  const handleCopy = async (item) => {
    navigator.clipboard.writeText(item.content);
    toast.success("Copied to clipboard!", { icon: "📋" });

    // Handle self-destruct triggers on copy
    if (item.self_destruct && !item.isOffline) {
      toast.loading("Self-destructing clipboard record...", { id: "selfdestruct" });
      const { error } = await supabase.from("clipboard_items").delete().eq("id", item.id);
      toast.dismiss("selfdestruct");
      if (!error) {
        toast.error("Clip self-destructed permanently!", { icon: "🔥" });
        setRawItems((prev) => prev.filter((i) => i.id !== item.id));
      }
    }
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
    
    // Auto-compress image before upload
    if (file.type.startsWith("image/")) {
      toast.loading("Compressing image client-side...", { id: "compress" });
      bodyData = await compressImage(file);
      toast.dismiss("compress");
    }

    // Encrypt file binary if E2EE is enabled
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
        
        if (!isOnline) {
          toast.error("Files/Images cannot be queued offline. Please restore connection.");
          setSubmitting(false);
          return;
        }

        toast.loading("Uploading file to Supabase...", { id: "upload" });
        fileUrlVal = await handleFileUpload(user.id, useE2EE ? encryptionKey : null);
        contentVal = file.name;
        toast.dismiss("upload");

        // Run client-side Tesseract OCR on images
        if (itemType === "image" && file.type.startsWith("image/")) {
          toast.loading("Running Tesseract OCR on image...", { id: "ocr" });
          try {
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

      // Expiry timestamp check
      let finalExpiresAt = null;
      if (expiresInSeconds !== "0") {
        finalExpiresAt = new Date(Date.now() + parseInt(expiresInSeconds) * 1000).toISOString();
      }

      // Metadata object
      const newItem = {
        user_id: user.id,
        type: itemType,
        title: title.trim() || (itemType === "file" || itemType === "image" ? file.name : `Snippet (${new Date().toLocaleTimeString()})`),
        content: contentVal,
        file_url: fileUrlVal,
        is_encrypted: useE2EE,
        workspace_id: activeWorkspace ? activeWorkspace.id : null,
        self_destruct: selfDestruct,
        expires_at: finalExpiresAt
      };

      if (itemType === "code") {
        newItem.title = `${title.trim() || "Code Snippet"} [${codeLanguage}]`;
      }

      // Encrypt text content if E2EE active
      if (useE2EE && (itemType === "text" || itemType === "code")) {
        const ciphertext = await encryptText(contentVal, encryptionKey);
        newItem.content = ciphertext;
      }

      if (!isOnline) {
        await saveOfflineClip(newItem);
        toast.success("Saved locally (Offline Queue)!", { icon: "📥" });
        setRawItems(rawItems);
        setTextContent("");
        setCodeContent("");
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
        if (activeWorkspace) {
          socket.emit("workspace-clip-update", { workspace_id: activeWorkspace.id });
        } else {
          socket.emit("clip-update", { user_id: user.id });
        }
      }

      setRawItems(rawItems.filter((item) => item.id !== id));
    }
  };

  const handleGenerateShareLink = async (e) => {
    e.preventDefault();
    if (!shareItem) return;

    if (shareItem.is_encrypted) {
      toast.error("End-to-End Encrypted items cannot be shared publicly.");
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

  // Helper to compile activity values for the Contribution Calendar
  const getContributionGrid = () => {
    const calendarDays = [];
    const today = new Date();
    
    // Group items by day YYYY-MM-DD
    const counts = {};
    rawItems.forEach(item => {
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
        return <ImageIcon className="h-5 w-5 text-cyan-400" />;
      default:
        return <FileIcon className="h-5 w-5 text-orange-400" />;
    }
  };

  // Shared Sidebar Component for Desktop and Mobile
  const SidebarContent = () => (
    <div className="flex flex-col justify-between h-full space-y-8">
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

        {/* Workspace Manager */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest">Active Workspace</label>
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
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-brand-500 hover:text-brand-400 transition-all cursor-pointer border border-dashed border-brand-500/25 bg-brand-500/5"
            >
              <Plus className="h-3.5 w-3.5" /> Create Workspace
            </button>
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
                  setShowPassphraseText(false);
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

        {/* Sync terminals stats */}
        <div className="rounded-xl border border-white/5 bg-white/[0.01] px-4 py-3 flex items-center gap-3">
          <Laptop className="h-5 w-5 text-brand-500 animate-pulse" />
          <div>
            <h5 className="text-xs font-bold text-white m-0">Terminals Connected</h5>
            <p className="text-[10px] text-gray-500 m-0 mt-0.5">{connectedTerminals} active devices listening</p>
          </div>
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
    <div 
      className="flex flex-col xl:flex-row min-h-screen w-full max-w-full bg-dark-bg text-gray-200 overflow-x-hidden relative"
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Full screen Drag & Drop File Upload Overlay */}
      {isDragging && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center border-4 border-dashed border-brand-500 p-8 transition-all"
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-500/10 border-2 border-brand-500 text-brand-500 mb-6 animate-bounce">
            <Clipboard className="h-10 w-10" />
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Drop File Anywhere to Sync!</h2>
          <p className="text-sm text-gray-400 mt-2">Release the file to load it directly into your ClipSync upload portal.</p>
        </div>
      )}
      
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

      {/* Desktop Sidebar */}
      <aside className="hidden xl:flex w-64 border-r border-white/5 bg-white/[0.01] p-6 flex-col justify-between shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 xl:hidden flex">
          <div 
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          ></div>
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
        
        {/* Connection status banner for offline queueing */}
        {!isOnline && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-6 flex items-center justify-center gap-2 text-xs font-semibold text-amber-500">
            <AlertTriangle className="h-4 w-4 shrink-0 animate-bounce" /> Currently Offline. Text/Code clips will be queued locally and auto-synced when online.
          </div>
        )}

        {/* Workspace Title & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white m-0 flex items-center gap-3">
              {activeWorkspace ? activeWorkspace.name : "Universal Clipboard"}
              {activeWorkspace && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="rounded-lg bg-brand-600/10 border border-brand-500/30 px-3 py-1.5 text-xs font-semibold text-brand-500 hover:bg-brand-600/20 flex items-center gap-1 cursor-pointer"
                >
                  <Users className="h-3.5 w-3.5" /> Invite Member
                </button>
              )}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-400">
              {activeWorkspace ? "Collaborating with teammates in real-time." : "Instantly share notes, code, and files across all your devices."}
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.02] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-brand-500/40 focus:bg-white/[0.04]"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 border border-white/10 rounded px-1.5 py-0.5 pointer-events-none hidden sm:inline">
              Ctrl+K
            </span>
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
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-gray-400">Your Text</label>
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

                {/* Expiration Settings */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Expires In</label>
                    <select
                      value={expiresInSeconds}
                      onChange={(e) => setExpiresInSeconds(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-dark-card py-2 px-2 text-xs text-white outline-none focus:border-brand-500/30"
                    >
                      <option value="0">Never</option>
                      <option value="600">10 Minutes</option>
                      <option value="3600">1 Hour</option>
                      <option value="86400">1 Day</option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-end pb-2">
                    <label className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selfDestruct}
                        onChange={(e) => setSelfDestruct(e.target.checked)}
                        className="accent-brand-600 h-3.5 w-3.5"
                      />
                      <Flame className={`h-4 w-4 ${selfDestruct ? "text-orange-500" : "text-gray-500"}`} /> Self-Destruct
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white transition-all hover:bg-brand-500 hover:shadow-[0_0_15px_rgba(0,120,212,0.3)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : (
                    <>Sync to Workspace</>
                  )}
                </button>
              </form>
            </div>

            {/* GitHub-style Contribution Calendar Grid */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 sm:p-6 mt-6">
              <h4 className="text-xs font-extrabold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-brand-500" /> Sync Activity (30 Days)
              </h4>
              <div className="grid grid-cols-10 gap-1.5 bg-black/10 p-3 rounded-xl border border-white/5">
                {getContributionGrid().map((day, idx) => (
                  <div
                    key={idx}
                    className={`h-5 w-5 rounded transition-all cursor-help relative group ${
                      day.count === 0 
                        ? "bg-white/[0.02]" 
                        : day.count < 3 
                        ? "bg-brand-500/20 text-brand-400" 
                        : day.count < 6 
                        ? "bg-brand-500/50 text-brand-300" 
                        : "bg-brand-500 text-white"
                    }`}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-10 bg-dark-card border border-white/10 px-2 py-1 rounded text-[9px] font-bold text-white whitespace-nowrap shadow-xl">
                      {day.date}: {day.count} syncs
                    </div>
                  </div>
                ))}
              </div>
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
              // Shimmer Loading Skeleton
              <div className="space-y-4">
                {[1, 2, 3].map((val) => (
                  <div key={val} className="rounded-xl border border-white/5 bg-white/[0.01] p-5 animate-pulse space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded bg-white/5"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-1/4 rounded bg-white/5"></div>
                        <div className="h-3 w-1/6 rounded bg-white/5"></div>
                      </div>
                    </div>
                    <div className="h-10 w-full rounded bg-white/5"></div>
                  </div>
                ))}
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
                    className="group relative rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] hover:border-brand-500/20 hover:shadow-[0_0_15px_rgba(0,120,212,0.05)] p-4 sm:p-5 transition-all duration-300"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10">
                          {getIcon(item.type, item.locked)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-white m-0 truncate max-w-[150px] xs:max-w-[200px] sm:max-w-md flex flex-wrap items-center gap-1.5">
                            {item.title}
                            {item.is_encrypted && (
                              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                <ShieldCheck className="h-3 w-3" /> E2EE
                              </span>
                            )}
                            {item.isOffline && (
                              <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                Offline Queue
                              </span>
                            )}
                            {item.self_destruct && (
                              <span className="text-[9px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                <Flame className="h-3 w-3" /> Self-Destruct
                              </span>
                            )}
                          </h4>
                          <span className="text-xs text-gray-500">
                            {new Date(item.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
                        {!item.locked && !item.isOffline && (
                          <button
                            onClick={() => {
                              setShareItem(item);
                              setGeneratedLink("");
                              setSharePassword("");
                              setShowSharePasswordText(false);
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
                            onClick={() => handleCopy(item)}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-white/5 hover:text-brand-500 transition-all cursor-pointer"
                            title="Copy to Clipboard"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        )}
                        {!item.locked && !item.isOffline && (item.type === "file" || item.type === "image") && (
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
                        {!item.isOffline && (
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all cursor-pointer"
                            title="Delete cloud record"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Content display */}
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
                              <code dangerouslySetInnerHTML={{ __html: highlightCode(item.content) }} />
                            </pre>
                          )}

                          {item.type === "image" && (
                            <div className="space-y-2">
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
                              {/* Display OCR extracted text if image content differs from file name */}
                              {item.content && item.content !== item.title && (
                                <div className="p-3 bg-black/35 rounded-lg border border-white/5 text-[10px] font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
                                  <span className="text-[9px] font-bold text-cyan-400 block mb-1">🔍 EXTRACTED OCR TEXT:</span>
                                  {item.content}
                                </div>
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

                          {/* Render link previews if fetched */}
                          {previews[item.id] && (
                            <div className="mt-3 flex gap-3 p-3 bg-black/25 rounded-xl border border-white/5">
                              {previews[item.id].image && (
                                <img src={previews[item.id].image} className="w-16 h-16 object-cover rounded-lg shrink-0 border border-white/10" />
                              )}
                              <div className="min-w-0">
                                <h5 className="font-semibold text-xs text-white truncate">{previews[item.id].title}</h5>
                                <p className="text-[10px] text-gray-400 mt-1 line-clamp-2">{previews[item.id].description}</p>
                                <a href={previews[item.id].url} target="_blank" rel="noreferrer" className="text-[9px] text-brand-500 mt-1 font-semibold flex items-center gap-0.5 hover:underline">
                                  Go to link <ExternalLink className="h-2 w-2" />
                                </a>
                              </div>
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
                  <div className="relative">
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
                    onClick={() => navigator.clipboard.writeText(generatedLink)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 hover:text-brand-500 transition-all shrink-0 cursor-pointer"
                    title="Copy sharing link"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
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

      {/* Set Passphrase Modal */}
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
                    type={showPassphraseText ? "text" : "password"}
                    value={passphraseInput}
                    onChange={(e) => setPassphraseInput(e.target.value)}
                    placeholder="Enter secret passphrase"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.02] py-2.5 pl-11 pr-10 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-brand-500/30"
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

      {/* Create Workspace Modal */}
      {showWorkspaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/5 bg-dark-card p-6 shadow-2xl relative">
            <button
              onClick={() => setShowWorkspaceModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-brand-500" /> Create Workspace
            </h3>
            <p className="text-xs text-gray-400 mb-6 font-sans">
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
                  className="w-full rounded-xl border border-white/10 bg-white/[0.02] py-2.5 px-4 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-brand-500/30"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={workspaceSubmitting}
                className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white transition-all hover:bg-brand-500 flex items-center justify-center gap-2 cursor-pointer"
              >
                {workspaceSubmitting ? "Creating..." : "Create Workspace"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && activeWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/5 bg-dark-card p-6 shadow-2xl relative">
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Users className="h-5 w-5 text-brand-500" /> Invite to "{activeWorkspace.name}"
            </h3>
            <p className="text-xs text-gray-400 mb-6 font-sans">
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
                  className="w-full rounded-xl border border-white/10 bg-white/[0.02] py-2.5 px-4 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-brand-500/30"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={workspaceSubmitting}
                className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white transition-all hover:bg-brand-500 flex items-center justify-center gap-2 cursor-pointer"
              >
                {workspaceSubmitting ? "Inviting..." : `Add to ${activeWorkspace.name}`}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
