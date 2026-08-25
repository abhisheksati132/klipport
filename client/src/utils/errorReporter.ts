// Zero-dependency client error reporting: posts crashes to the app's own backend.
// Swap the endpoint for Sentry/whatever later without touching call sites.

const REPORT_ENDPOINT = `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"}/api/client-errors`;

let lastReportedAt = 0;

export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  try {
    // Throttle: never send more than one report per 5 seconds
    const now = Date.now();
    if (now - lastReportedAt < 5000) return;
    lastReportedAt = now;

    const err = error as { message?: unknown; stack?: unknown } | null | undefined;
    const payload = JSON.stringify({
      message: String(err?.message || error || "unknown").slice(0, 2000),
      stack: String(err?.stack || "").slice(0, 8000),
      url: window.location.href,
      userAgent: navigator.userAgent,
      context,
      ts: new Date().toISOString()
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(REPORT_ENDPOINT, new Blob([payload], { type: "application/json" }));
    } else {
      fetch(REPORT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true
      }).catch(() => {});
    }
  } catch {
    // Reporting must never itself crash the app
  }
}
