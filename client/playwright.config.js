import { defineConfig } from "@playwright/test";

// Dedicated ports + backend URL so E2E never collides with manually-run
// dev servers or other processes on the default ports.
const E2E_CLIENT_PORT = 5174;
const E2E_API_PORT = 5055;

export default defineConfig({
  testDir: "./e2e",
  timeout: 45000,
  retries: 1,
  use: {
    headless: true,
    baseURL: `http://localhost:${E2E_CLIENT_PORT}`
  },
  webServer: [
    {
      command: `npm start`,
      url: `http://localhost:${E2E_API_PORT}`,
      reuseExistingServer: false,
      timeout: 60000,
      cwd: "../server",
      env: { ...process.env, PORT: String(E2E_API_PORT), REQUIRE_SOCKET_AUTH: "false" }
    },
    {
      command: `npm run dev -- --port ${E2E_CLIENT_PORT} --strictPort`,
      url: `http://localhost:${E2E_CLIENT_PORT}`,
      reuseExistingServer: false,
      timeout: 60000,
      cwd: ".",
      env: { ...process.env, VITE_BACKEND_URL: `http://localhost:${E2E_API_PORT}` }
    }
  ]
});
