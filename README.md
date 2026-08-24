# Klipport - Secure Cross-Device Universal Clipboard & PWA

Klipport is a cross-device universal clipboard and secure file synchronization platform designed for instant, secure data transfers. Built with React (Vite + Tailwind CSS v4), Node.js (Express + Socket.io), and Supabase (PostgreSQL + Auth + Storage), it is fully installable as a Progressive Web App (PWA) and features client-side End-to-End Encryption (E2EE).

## 🚀 Key Features

*   **Universal Cloud Clipboard**: Instantly sync text, structured code snippets, images, and files across all registered devices.
*   **Account-Free "Quick Share"**: Pair any two devices instantly using a 6-digit code or QR code to exchange files (< 5MB) directly over WebSockets, bypassing database storage completely.
*   **Secure Expiring Links**: Generate public sharing links with optional password protection and self-destruct timers (10m, 1h, 1d, 7d). All validations are handled at the database layer (PostgreSQL RPC).
*   **End-to-End Encryption (E2EE)**: Secure your personal clipboard with a client-side passphrase. Text and file streams are encrypted in-browser using the native Web Crypto API (PBKDF2 + AES-GCM) before upload.
*   **Installable Progressive Web App (PWA)**: Desktop and mobile installable with a custom service worker to enable offline app shell caching.

---

## 🛠️ Tech Stack

*   **Frontend**: React (Vite), Tailwind CSS v4, React Router, Socket.io-Client, Lucide Icons, React Hot Toast.
*   **Backend**: Node.js, Express, Socket.io (WebSocket room orchestrator).
*   **Database & Services**: Supabase (PostgreSQL, Storage, GoTrue Auth, Row Level Security).

---

## 🚦 Getting Started

### Prerequisites
*   Node.js ≥ 20
*   A Supabase project (free tier works)

### 1. Database setup
Run `database_schema.sql` in Supabase Dashboard → SQL Editor. It is idempotent — safe to re-run after pulling updates.
For automatic cleanup of expired links/trash, enable `pg_cron` and schedule:
```sql
select cron.schedule('klipport-cleanup', '0 3 * * *', $$ select cleanup_expired_data() $$);
```

### 2. Client (`/client`)
```bash
cp .env.example .env    # then fill in values
npm install
npm run dev             # http://localhost:5173
```

| Variable | Where | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | client `.env` + Vercel | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | client `.env` + Vercel | Supabase anon key |
| `VITE_BACKEND_URL` | client `.env` + Vercel | Socket.io / API server base URL |
| `GEMINI_API_KEY` | Vercel dashboard (or server `.env` for local dev) | Google Gemini key for AI features |

### 3. Server (`/server`)
```bash
npm install
npm run dev             # http://localhost:5000
```
Set `REQUIRE_SOCKET_AUTH=true` in production to require Supabase JWT authentication for sync/presence rooms (leave unset or `false` in local dev).

### 4. CLI (`/cli`)
```bash
npm link
klipport login          # personal access token (Dashboard → CLI Tokens) or email/password
klipport push "text"    # push to your universal clipboard
klipport get            # fetch latest clip
```

### Tests
```bash
cd client && npm test   # E2EE crypto round-trips
cd server && npm test   # SSRF guard matrix
```

---

## ☁️ Deployment

*   **Client**: deploy `/client` to Vercel. Set all `VITE_*` vars plus `GEMINI_API_KEY` in the Vercel dashboard. The AI function lives at `/api/ai`; in local dev, Vite proxies `/api/*` to the Express server instead.
*   **Server**: needs a long-running process for WebSockets (NOT Vercel serverless). Options: Railway, Render, Fly.io, or any VPS. Set `PORT`, `ALLOWED_ORIGIN` (your client origin — do not leave `*` in prod), `REQUIRE_SOCKET_AUTH=true`, and `SUPABASE_ANON_KEY`.

## 💾 Backups & Data Safety

Supabase's free tier has **no automated backups** and pauses projects after ~1 week of inactivity. For production use, either upgrade to a paid plan (daily backups) or schedule `pg_dump` externally. The `cleanup_expired_data()` RPC keeps expired links and trash from growing the DB unbounded; note that files hard-deleted by that job's trash purge may remain in Storage until manually removed.

---

## 🔒 Security Notice
*   **Passphrase Privacy**: Your E2EE passphrase is kept strictly in your browser session memory (`sessionStorage`) and is never sent to the network. If you clear the session or close the tab, the keys are securely wiped.
*   **Serverless Validations**: Password checks and expiration windows for shared links are checked inside Postgres RPCs utilizing cryptographic hash comparisons (`crypt()`), preventing client-side bypasses.
