require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./src/app");

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", // In production, configure specific allowed origins
    methods: ["GET", "POST"]
  }
});

// In-memory store for active account-free Quick Share sessions
const quickSessions = new Set();

function generateSessionCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (quickSessions.has(code));
  return code;
}

// Socket connection handler
io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // --- Phase 1: Authenticated Room Sync ---
  socket.on("join-room", (userId) => {
    socket.join(userId);
    console.log(`👤 User ${userId} joined their sync room`);
  });

  socket.on("clip-update", (data) => {
    if (data && data.user_id) {
      socket.to(data.user_id).emit("clip-sync", data);
      console.log(`🔄 Sync update broadcasted for user: ${data.user_id}`);
    }
  });

  // --- Ultimate Upgrade: Workspace Room Sync ---
  socket.on("join-workspace", (workspaceId) => {
    socket.join(workspaceId);
    console.log(`🏢 Client joined workspace sync room: ${workspaceId}`);
  });

  socket.on("workspace-clip-update", (data) => {
    if (data && data.workspace_id) {
      socket.to(data.workspace_id).emit("workspace-clip-sync", data);
      console.log(`🔄 Workspace update broadcasted for workspace: ${data.workspace_id}`);
    }
  });

  // --- Phase 2: Account-Free Quick Share ---
  
  // Request a new quick share session
  socket.on("request-quick-session", () => {
    const code = generateSessionCode();
    quickSessions.add(code);
    socket.join(code);
    socket.emit("quick-session-created", { code });
    console.log(`🆕 Created Quick Share session: ${code}`);
  });

  // Join an existing quick share session
  socket.on("join-quick-session", ({ code }) => {
    if (quickSessions.has(code)) {
      socket.join(code);
      socket.emit("quick-session-joined", { code });
      // Notify other peer(s) in the room that connection is established
      socket.to(code).emit("peer-connected");
      console.log(`➕ Client joined Quick Share session: ${code}`);
    } else {
      socket.emit("quick-session-error", { message: "Session code invalid or expired." });
      console.log(`⚠️ Invalid Quick Share join attempt for code: ${code}`);
    }
  });

  // Share clipboard item within the quick share room
  socket.on("send-quick-item", ({ code, item }) => {
    if (quickSessions.has(code)) {
      socket.to(code).emit("receive-quick-item", item);
      console.log(`📤 Quick Share item broadcasted in session ${code}`);
    }
  });

  // Cleanup sessions when sockets disconnect
  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (quickSessions.has(room)) {
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
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});