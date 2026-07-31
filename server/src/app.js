const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Klipport Backend Running 🚀"
    });
});

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

app.post("/api/preview", async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
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

  try {
    const response = await fetch(parsedUrl.href, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(400).json({ error: "Failed to fetch URL" });
    }

    const html = await response.text();

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

    res.json({ title, description, image, url });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "Link preview request timed out (5s limit)" });
    }
    res.status(500).json({ error: "Failed to parse link preview: " + err.message });
  }
});

module.exports = app;