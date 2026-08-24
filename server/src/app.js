const express = require("express");
const cors = require("cors");

const app = express();

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: "100kb" }));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

app.use("/api", (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`[api] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30;
const rateLimitBuckets = new Map();

function checkRateLimit(key) {
  const now = Date.now();
  let bucket = rateLimitBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitBuckets.set(key, bucket);
  }
  bucket.count++;
  if (rateLimitBuckets.size > 10000) {
    for (const [k, b] of rateLimitBuckets) {
      if (now > b.resetAt) rateLimitBuckets.delete(k);
    }
  }
  return { allowed: bucket.count <= RATE_LIMIT_MAX };
}

function rateLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  if (!checkRateLimit(key).allowed) {
    return res.status(429).json({ error: "Too many requests. Please slow down." });
  }
  next();
}

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Klipport Backend Running 🚀"
    });
});

const PREVIEW_CACHE_MAX = 200;
const PREVIEW_CACHE_TTL_MS = 10 * 60 * 1000;
const previewCache = new Map();

function previewCacheGet(url) {
  const entry = previewCache.get(url);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    previewCache.delete(url);
    return null;
  }
  return entry.payload;
}

function previewCacheSet(url, payload) {
  if (previewCache.size >= PREVIEW_CACHE_MAX) {
    const oldestKey = previewCache.keys().next().value;
    previewCache.delete(oldestKey);
  }
  previewCache.set(url, { payload, expiresAt: Date.now() + PREVIEW_CACHE_TTL_MS });
}

function isPrivateHost(hostname) {
  if (!hostname) return true;
  const host = hostname.toLowerCase();
  
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }

  // IPv4 private ranges check
  const ipMatch = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipMatch) {
    const [, a, b] = ipMatch.map(Number);
    if (a === 127) return true; // loopback
    if (a === 10) return true; // Class A private
    if (a === 172 && b >= 16 && b <= 31) return true; // Class B private
    if (a === 192 && b === 168) return true; // Class C private
    if (a === 169 && b === 254) return true; // Link-local
    if (a === 0) return true;
  }

  return false;
}

app.post("/api/preview", rateLimit, async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  const cached = previewCacheGet(url);
  if (cached) {
    return res.json(cached);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL format" });
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return res.status(400).json({ error: "Only HTTP and HTTPS URLs are supported" });
  }

  if (isPrivateHost(parsedUrl.hostname)) {
    return res.status(400).json({ error: "Access to private or local network hosts is prohibited" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const MAX_HTML_BYTES = 5 * 1024 * 1024;

  try {
    const response = await fetch(parsedUrl.href, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(400).json({ error: "Failed to fetch URL" });
    }

    // Guard against redirects that land on private/internal hosts
    try {
      const finalUrl = new URL(response.url);
      if (finalUrl.hostname !== parsedUrl.hostname && isPrivateHost(finalUrl.hostname)) {
        return res.status(400).json({ error: "Redirect to private or local network hosts is prohibited" });
      }
    } catch {}

    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_HTML_BYTES) {
      return res.status(400).json({ error: "Target page exceeds the 5MB preview limit" });
    }

    let html;
    if (response.body) {
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > MAX_HTML_BYTES) {
          controller.abort();
          return res.status(400).json({ error: "Target page exceeds the 5MB preview limit" });
        }
        chunks.push(value);
      }
      html = Buffer.concat(chunks).toString("utf8");
    } else {
      html = await response.text();
    }

    const getMetaTag = (property) => {
      const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i");
      const match = html.match(regex);
      if (match) return match[1];

      const altRegex = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, "i");
      const altMatch = html.match(altRegex);
      return altMatch ? altMatch[1] : null;
    };

    const titleRegex = /<title[^>]*>([^<]+)<\/title>/i;
    const titleMatch = html.match(titleRegex);
    const fallbackTitle = titleMatch ? titleMatch[1] : url;

    const title = getMetaTag("og:title") || getMetaTag("twitter:title") || fallbackTitle;
    const description = getMetaTag("og:description") || getMetaTag("twitter:description") || getMetaTag("description") || "";
    const image = getMetaTag("og:image") || getMetaTag("twitter:image") || "";

    const payload = { title, description, image, url };
    previewCacheSet(url, payload);
    res.json(payload);
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "Link preview request timed out (5s limit)" });
    }
    res.status(500).json({ error: "Failed to parse link preview: " + err.message });
  }
});

function getPromptForAction(action, customPrompt) {
  switch (action) {
    case "summarize":
      return "Summarize the following text concisely. Highlight the main takeaways as bullet points.";
    case "explain_code":
      return "Explain what the following code snippet does step-by-step. Keep it concise, clear, and formatted for developers.";
    case "fix_syntax":
      return "Analyze the following code, correct any syntax errors or bugs, and return ONLY the corrected code. Do not add conversational intro/outro text, markdown wrapper lines like ```, or extra explanations—just return the clean, functional code.";
    case "ocr_json":
      return "The following text was extracted from an image via OCR. Clean up the spelling, format it as structured JSON, and return ONLY the clean JSON block. Do not add markdown wrappers or conversational text.";
    case "translate":
      return `Translate the following text to ${customPrompt || "Spanish"}. Return ONLY the translated text, no explanations or labels.`;
    case "rewrite_tone":
      return `Rewrite the following text in a ${customPrompt || "Formal"} tone. Return ONLY the rewritten text, no explanations or labels.`;
    case "custom":
      return customPrompt || "Analyze the following content and provide a helpful response.";
    default:
      return "Analyze the following content and provide a helpful response.";
  }
}

const AI_MODELS = [
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
  "gemini-pro"
];

app.post("/api/ai", rateLimit, async (req, res) => {
  const { action, content, customPrompt } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not set on the server." });
  }

  if (!content) {
    return res.status(400).json({ error: "Content is required." });
  }

  if (typeof content !== "string" || content.length > 10000) {
    return res.status(400).json({ error: "Content exceeds maximum length of 10,000 characters." });
  }

  const systemPrompt = getPromptForAction(action, customPrompt);
  let lastError = null;

  for (const model of AI_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\nContent:\n${content}` }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
          })
        }
      );

      const data = await response.json();

      if (response.ok) {
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI.";
        return res.json({ result: reply, model });
      }

      lastError = data.error?.message || `Model ${model} failed`;
      if (response.status === 404 || lastError.includes("not found")) continue;

      return res.status(response.status).json({ error: lastError });
    } catch (err) {
      lastError = err.message;
      continue;
    }
  }

  return res.status(500).json({ error: `No available AI model found. Last error: ${lastError}` });
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

module.exports = app;
module.exports.isPrivateHost = isPrivateHost;
module.exports.checkRateLimit = checkRateLimit;
module.exports.previewCacheGet = previewCacheGet;
module.exports.previewCacheSet = previewCacheSet;