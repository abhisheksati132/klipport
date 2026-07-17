#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const SUPABASE_URL = "https://qpbuwbnyqesuwqckljjg.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwYnV3Ym55cWVzdXdxY2tsampnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMDM3NTgsImV4cCI6MjA5OTc3OTc1OH0.GVFLHN1GM6pW1vjOuhS-WsWFiC17Nm5U4pybvsi10z4";
const CONFIG_PATH = path.join(process.env.HOME || process.env.USERPROFILE || ".", ".klipport-cli.json");

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
  console.log("🔒 Log in to Klipport:");
  console.log("You can log in using either your account credentials or a Personal Access Token (PAT).");
  
  const authMethod = await question("Choose Auth Method (1: Password, 2: Token): ");
  
  if (authMethod.trim() === "2") {
    const token = await question("Enter Personal Access Token (PAT): ");
    rl.close();

    if (!token.trim()) {
      console.error("❌ Token cannot be empty.");
      return;
    }

    console.log("⏳ Verifying token...");
    try {
      // Validate token by making a dry-run RPC call
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/cli_get_item`, {
        method: "POST",
        headers: {
          "apikey": ANON_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ token_val: token.trim() })
      });

      if (!res.ok) {
        const err = await res.json();
        console.error(`❌ Token validation failed: ${err.message || res.statusText}`);
        return;
      }

      const config = {
        token: token.trim(),
        email: "Token Authentication"
      };
      saveConfig(config);
      console.log(`✅ Authenticated successfully using Personal Access Token!`);
    } catch (err) {
      console.error("❌ Network error:", err.message);
    }
  } else {
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
}

async function handlePush(content, customTitle) {
  const config = loadConfig();
  if (!config) {
    console.error("❌ Not logged in. Please run: klipport login");
    process.exit(1);
  }

  const title = customTitle || `CLI Sync (${new Date().toLocaleTimeString()})`;

  try {
    let res;
    if (config.token) {
      // Personal Access Token flow (using Postgres RPC)
      res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/cli_push_item`, {
        method: "POST",
        headers: {
          "apikey": ANON_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token_val: config.token,
          type_val: "text",
          title_val: title,
          content_val: content
        })
      });
    } else {
      // Standard JWT access token flow
      res = await fetch(`${SUPABASE_URL}/rest/v1/clipboard_items`, {
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
    }

    if (res.ok) {
      console.log(`☁️ Synced to Klipport: "${title}"`);
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
    console.error("❌ Not logged in. Please run: klipport login");
    process.exit(1);
  }

  try {
    let res;
    if (config.token) {
      // Personal Access Token flow (using Postgres RPC)
      res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/cli_get_item`, {
        method: "POST",
        headers: {
          "apikey": ANON_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ token_val: config.token })
      });
    } else {
      // Standard JWT access token flow
      res = await fetch(`${SUPABASE_URL}/rest/v1/clipboard_items?select=*&order=created_at.desc&limit=1`, {
        headers: {
          "apikey": ANON_KEY,
          "Authorization": `Bearer ${config.access_token}`
        }
      });
    }

    const data = await res.json();
    if (!res.ok) {
      console.error("❌ Failed to fetch clip:", data.message || res.statusText);
      return;
    }

    const itemsList = Array.isArray(data) ? data : [data];
    if (itemsList && itemsList.length > 0 && itemsList[0].content) {
      const item = itemsList[0];
      console.log(`\n📋 Title: ${item.title || "CLI Sync"}`);
      console.log(`🕒 Synced: ${item.created_at ? new Date(item.created_at).toLocaleString() : "Recently"}`);
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
Klipport Desktop CLI Companion
Usage:
  klipport login         Log in to your Klipport account
  klipport get           Retrieve your latest cloud clipboard item
  klipport push <text>   Push text content to the cloud
  echo "logs" | klipport  Pipe console output directly to the cloud

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
    console.error("❌ Please provide text content to push. Example: klipport push \"hello\"");
    process.exit(1);
  }
  handlePush(content);
} else {
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
      console.error(`❌ Unknown command: ${command}. Run klipport --help for usage.`);
      process.exit(1);
    }
  });
}
