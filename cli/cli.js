#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const SUPABASE_URL = "https://qpbuwbnyqesuwqckljjg.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwYnV3Ym55cWVzdXdxY2tsampnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMDM3NTgsImV4cCI6MjA5OTc3OTc1OH0.GVFLHN1GM6pW1vjOuhS-WsWFiC17Nm5U4pybvsi10z4";
const CONFIG_PATH = path.join(process.env.HOME || process.env.USERPROFILE || ".", ".clipsync-cli.json");

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    } catch (e) {
      return null;
    }
  }
  return null;
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function handleLogin() {
  console.log("🔒 Log in to ClipSync:");
  const email = await question("Email: ");
  const password = await question("Password: ");
  rl.close();

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "apikey": ANON_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      console.error(`❌ Login failed: ${data.error_description || data.msg || "Invalid credentials"}`);
      return;
    }

    const config = {
      access_token: data.access_token,
      user_id: data.user.id,
      email: data.user.email
    };
    saveConfig(config);
    console.log(`✅ Logged in successfully as ${config.email}! Auth token saved locally.`);
  } catch (err) {
    console.error("❌ Network error:", err.message);
  }
}

async function handlePush(content, customTitle) {
  const config = loadConfig();
  if (!config) {
    console.error("❌ Not logged in. Please run: clipsync login");
    process.exit(1);
  }

  const title = customTitle || `CLI Sync (${new Date().toLocaleTimeString()})`;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/clipboard_items`, {
      method: "POST",
      headers: {
        "apikey": ANON_KEY,
        "Authorization": `Bearer ${config.access_token}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        user_id: config.user_id,
        type: "text",
        title: title,
        content: content
      })
    });

    if (res.ok) {
      console.log(`☁️ Synced to ClipSync: "${title}"`);
    } else {
      const err = await res.json();
      console.error("❌ Sync failed:", err.message || res.statusText);
    }
  } catch (err) {
    console.error("❌ Network error:", err.message);
  }
}

async function handleGet() {
  const config = loadConfig();
  if (!config) {
    console.error("❌ Not logged in. Please run: clipsync login");
    process.exit(1);
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/clipboard_items?select=*&order=created_at.desc&limit=1`, {
      headers: {
        "apikey": ANON_KEY,
        "Authorization": `Bearer ${config.access_token}`
      }
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("❌ Failed to fetch clip:", data.message || res.statusText);
      return;
    }

    if (data && data.length > 0) {
      const item = data[0];
      console.log(`\n📋 Title: ${item.title}`);
      console.log(`🕒 Synced: ${new Date(item.created_at).toLocaleString()}`);
      console.log(`🔒 Encrypted: ${item.is_encrypted ? "Yes" : "No"}`);
      console.log("-----------------------------------------");
      console.log(item.content);
      console.log("-----------------------------------------\n");
    } else {
      console.log("ℹ️ No clipboard items found.");
    }
  } catch (err) {
    console.error("❌ Network error:", err.message);
  }
}

// CLI Routing
const args = process.argv.slice(2);
const command = args[0];

if (!command || command === "--help" || command === "-h") {
  console.log(`
ClipSync Desktop CLI Companion
Usage:
  clipsync login         Log in to your ClipSync account
  clipsync get           Retrieve your latest cloud clipboard item
  clipsync push <text>   Push text content to the cloud
  echo "logs" | clipsync  Pipe console output directly to the cloud

Options:
  --title, -t            Set custom title when pushing clips
  `);
  process.exit(0);
}

if (command === "login") {
  handleLogin();
} else if (command === "get") {
  handleGet();
} else if (command === "push") {
  const content = args.slice(1).join(" ");
  if (!content) {
    console.error("❌ Please provide text content to push. Example: clipsync push \"hello\"");
    process.exit(1);
  }
  handlePush(content);
} else {
  // Check if stdin is being piped (e.g. echo "hello" | clipsync)
  let inputData = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    inputData += chunk;
  });

  process.stdin.on("end", () => {
    inputData = inputData.trim();
    if (inputData) {
      handlePush(inputData, "Terminal Pipe Sync");
    } else {
      console.error(`❌ Unknown command: ${command}. Run clipsync --help for usage.`);
      process.exit(1);
    }
  });
}
