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

## ⚙️ Getting Started

### 1. Database & Storage Setup
1.  Create a free project on [Supabase](https://supabase.com).
2.  Open the **SQL Editor** in your Supabase dashboard, copy the contents of [database_schema.sql](database_schema.sql), and run the query to set up the tables, enable the `pgcrypto` extension, and configure the security RPC functions.
3.  Go to the **Storage** dashboard on Supabase and create a new public bucket named **`clip-files`**.

### 2. Configure Environment
1.  Navigate to the `client/` folder and create a `.env` file:
    ```env
    VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
    VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
    VITE_BACKEND_URL=http://localhost:5000
    ```

### 3. Run Locally
1.  **Start the Backend**:
    ```bash
    cd server
    npm install
    npm run dev
    ```
2.  **Start the Frontend**:
    ```bash
    cd client
    npm install
    npm run dev
    ```
3.  Open the local address shown in your terminal (usually `http://localhost:5173` or `http://localhost:5174`) to access the app!

---

## 🔒 Security Notice
*   **Passphrase Privacy**: Your E2EE passphrase is kept strictly in your browser session memory (`sessionStorage`) and is never sent to the network. If you clear the session or close the tab, the keys are securely wiped.
*   **Serverless Validations**: Password checks and expiration windows for shared links are checked inside Postgres RPCs utilizing cryptographic hash comparisons (`crypt()`), preventing client-side bypasses.
