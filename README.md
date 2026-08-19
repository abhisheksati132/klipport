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

## 🔒 Security Notice
*   **Passphrase Privacy**: Your E2EE passphrase is kept strictly in your browser session memory (`sessionStorage`) and is never sent to the network. If you clear the session or close the tab, the keys are securely wiped.
*   **Serverless Validations**: Password checks and expiration windows for shared links are checked inside Postgres RPCs utilizing cryptographic hash comparisons (`crypt()`), preventing client-side bypasses.
