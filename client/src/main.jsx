import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { reportError } from './utils/errorReporter'

// Auto-reload on stale bundle/chunk error after deployments
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

// Global crash reporting (uncaught errors + unhandled promise rejections)
window.addEventListener('error', (event) => {
  reportError(event.error || event.message, { type: 'error' });
});
window.addEventListener('unhandledrejection', (event) => {
  reportError(event.reason, { type: 'unhandledrejection' });
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        // Check for updates and auto-apply when new SW installs
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.postMessage({ action: 'skipWaiting' });
              }
            });
          }
        });
      })
      .catch(() => {
        // Service worker registration failed silently — not critical
      });
  });

  // Reload page when SW controller changes (new SW activated)
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}
