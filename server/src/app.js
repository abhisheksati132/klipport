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

app.post("/api/preview", async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36"
      }
    });

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
    res.status(500).json({ error: "Failed to parse link preview: " + err.message });
  }
});

module.exports = app;