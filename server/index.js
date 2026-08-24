require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./src/app");

const PORT = process.env.PORT || 5000;
const REQUIRE_SOCKET_AUTH = process.env.REQUIRE_SOCKET_AUTH === "true";
const QUICK_SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_JOIN_ATTEMPTS = 10;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

// In-memory store for active account-free Quick Share sessions
const quickSessions = new Map();

// In-memory presence map: socket.id -> { user_id, email, device }
const presenceMap = new Map();

// Per-socket auth state and failed join-attempt counters
const socketAuth = new Map();
const joinAttempts = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [code, session] of quickSessions) {
    if (now > session.expiresAt) {
      io.in(code).emit("quick-session-error", { message: "Session expired." });
      io.socketsLeave(code);
      quickSessions.delete(code);
      console.log(`⏱️ Expired Quick Share session: ${code}`);
    }
  }
}, 60 * 1000).unref();

async function verifySupabaseToken(token) {
  try {
    const response = await fetch(`${process.env.SUPABASE_URL || "https://qpbuwbnyqesuwqckljjg.supabase.co"}/auth/v1/user`, {
      headers: {
        "apikey": process.env.SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${token}`
      },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return null;
    const user = await response.json();
    return user && user.id ? { userId: user.id, email: user.email || "" } : null;
  } catch {
    return null;
  }
}

async function isWorkspaceMember(token, workspaceId) {
  try {
    const base = `${process.env.SUPABASE_URL || "https://qpbuwbnyqesuwqckljjg.supabase.co"}/rest/v1`;
    const headers = { "apikey": process.env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` };
    const [wsRes, memberRes] = await Promise.all([
      fetch(`${base}/workspaces?id=eq.${workspaceId}&select=id`, { headers, signal: AbortSignal.timeout(5000) }),
      fetch(`${base}/workspace_members?workspace_id=eq.${workspaceId}&select=id`, { headers, signal: AbortSignal.timeout(5000) })
    ]);
    if (!wsRes.ok || !memberRes.ok) return false;
    return (await wsRes.json()).length > 0;
  } catch {
    return false;
  }
}

function generateSessionCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (quickSessions.has(code));
  return code;
}

// Socket connection handler
io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}${REQUIRE_SOCKET_AUTH ? " (unauthenticated)" : ""}`);
  socketAuth.set(socket.id, null);
  joinAttempts.set(socket.id, 0);

  if (REQUIRE_SOCKET_AUTH) {
    socket.use(async ([event], next) => {
      const allowed = ["auth", "request-quick-session", "join-quick-session", "send-quick-item"];
      if (allowed.includes(event) || socketAuth.get(socket.id)) return next();
      next(new Error("Unauthorized: emit 'auth' with a Supabase access token first"));
    });
  }

  // --- Authentication (required when REQUIRE_SOCKET_AUTH=true) ---
  socket.on("auth", async ({ token } = {}) => {
    if (!token || typeof token !== "string") {
      socket.emit("auth-error", { message: "Token required" });
      return;
    }
    const identity = await verifySupabaseToken(token);
    if (!identity) {
      socket.emit("auth-error", { message: "Invalid or expired token" });
      return;
    }
    socketAuth.set(socket.id, { ...identity, token });
    socket.join(identity.userId);
    socket.emit("auth-ok", { user_id: identity.userId });
    console.log(`🔐 Socket authenticated: ${identity.email}`);
  });

  // --- Phase 1: Authenticated Room Sync ---
  socket.on("join-room", async (userId) => {
    const auth = socketAuth.get(socket.id);
    if (REQUIRE_SOCKET_AUTH && (!auth || auth.userId !== userId)) {
      socket.emit("sync-error", { message: "Not authorized to join this room" });
      return;
    }
    socket.join(userId);
    console.log(`👤 User ${userId} joined their sync room`);
  });

  socket.on("clip-update", (data) => {
    const auth = socketAuth.get(socket.id);
    if (REQUIRE_SOCKET_AUTH && (!auth || auth.userId !== data?.user_id)) {
      return;
    }
    if (data && data.user_id) {
      socket.to(data.user_id).emit("clip-sync", data);
      console.log(`🔄 Sync update broadcasted for user: ${data.user_id}`);
    }
  });

  // --- Workspace Room Sync ---
  socket.on("join-workspace", async (workspaceId) => {
    if (typeof workspaceId !== "string" || workspaceId.length > 64) return;
    const auth = socketAuth.get(socket.id);
    if (REQUIRE_SOCKET_AUTH) {
      if (!auth) {
        socket.emit("sync-error", { message: "Authenticate before joining a workspace" });
        return;
      }
      const member = await isWorkspaceMember(auth.token, workspaceId);
      if (!member) {
        socket.emit("sync-error", { message: "Not a member of this workspace" });
        return;
      }
    }
    socket.join(workspaceId);
    console.log(`🏢 Client joined workspace sync room: ${workspaceId}`);
  });

  socket.on("workspace-clip-update", (data) => {
    const auth = socketAuth.get(socket.id);
    if (REQUIRE_SOCKET_AUTH && (!auth || !socket.rooms.has(data?.workspace_id))) {
      return;
    }
    if (data && data.workspace_id) {
      socket.to(data.workspace_id).emit("workspace-clip-sync", data);
      console.log(`🔄 Workspace update broadcasted for workspace: ${data.workspace_id}`);
    }
  });

  // --- Real-time Presence ---
  socket.on("presence-join", (payload) => {
    if (!payload || !payload.user_id || !payload.email) return;
    const { user_id, email, device } = payload;
    presenceMap.set(socket.id, { user_id, email, device: device || "Web Browser" });

    // Broadcast updated presence list to user's room (all their devices)
    const userPresence = Array.from(presenceMap.values()).filter(
      (p) => p.user_id === user_id
    );
    io.to(user_id).emit("presence-list", userPresence);
    console.log(`👁️ Presence joined: ${email} (${device})`);
  });

  // --- Typing Indicator ---
  socket.on("typing", ({ name, workspace_id }) => {
    if (workspace_id) {
      // Broadcast to workspace room excluding sender
      socket.to(workspace_id).emit("typing-broadcast", { name });
    } else {
      // Personal room — broadcast back to other devices of same user
      const presence = presenceMap.get(socket.id);
      if (presence?.user_id) {
        socket.to(presence.user_id).emit("typing-broadcast", { name });
      }
    }
  });

  // --- Phase 2: Account-Free Quick Share ---

  // Request a new quick share session
  socket.on("request-quick-session", () => {
    const code = generateSessionCode();
    quickSessions.set(code, { createdAt: Date.now(), expiresAt: Date.now() + QUICK_SESSION_TTL_MS });
    socket.join(code);
    socket.emit("quick-session-created", { code });
    console.log(`🆕 Created Quick Share session: ${code}`);
  });

  // Join an existing quick share session (with brute-force throttling)
  socket.on("join-quick-session", ({ code } = {}) => {
    if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
      socket.emit("quick-session-error", { message: "Invalid session code format." });
      return;
    }

    const session = quickSessions.get(code);
    const attempts = joinAttempts.get(socket.id) || 0;

    if (!session || Date.now() > session.expiresAt) {
      quickSessions.delete(code);
      joinAttempts.set(socket.id, attempts + 1);
      if (attempts + 1 >= MAX_JOIN_ATTEMPTS) {
        socket.emit("quick-session-error", { message: "Too many failed attempts. Reconnect to try again." });
        socket.disconnect(true);
      } else {
        socket.emit("quick-session-error", { message: "Session code invalid or expired." });
      }
      console.log(`⚠️ Invalid Quick Share join attempt for code: ${code}`);
      return;
    }

    joinAttempts.set(socket.id, 0);
    socket.join(code);
    socket.emit("quick-session-joined", { code });
    // Notify other peer(s) in the room that connection is established
    socket.to(code).emit("peer-connected");
    console.log(`➕ Client joined Quick Share session: ${code}`);
  });

  // Share clipboard item within the quick share room
  socket.on("send-quick-item", ({ code, item }) => {
    if (quickSessions.has(code)) {
      socket.to(code).emit("receive-quick-item", item);
      console.log(`📤 Quick Share item broadcasted in session ${code}`);
    }
  });

  // Cleanup sessions and presence when sockets disconnect
  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      const session = quickSessions.get(room);
      if (session) {
        const clients = io.sockets.adapter.rooms.get(room);
        if (clients && clients.size <= 1) {
          quickSessions.delete(room);
          console.log(`🗑️ Removed empty Quick Share session: ${room}`);
        } else {
          socket.to(room).emit("peer-disconnected");
          console.log(`👤 Peer disconnected from Quick Share session: ${room}`);
        }
      }
    }
  });

  socket.on("disconnect", () => {
    socketAuth.delete(socket.id);
    joinAttempts.delete(socket.id);
    // Clean up presence on disconnect
    if (presenceMap.has(socket.id)) {
      const { user_id } = presenceMap.get(socket.id);
      presenceMap.delete(socket.id);

      // Broadcast updated list to remaining devices
      const remaining = Array.from(presenceMap.values()).filter(
        (p) => p.user_id === user_id
      );
      io.to(user_id).emit("presence-list", remaining);
    }
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Klipport server running on http://localhost:${PORT}${REQUIRE_SOCKET_AUTH ? " (socket auth enforced)" : ""}`);
});

// Graceful shutdown: stop accepting connections, close cleanly on SIGTERM/SIGINT
function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully...`);
  server.close(() => {
    io.close(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));