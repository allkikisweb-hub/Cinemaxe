/**
 * Cinemax API base URL + fetch shim.
 *
 * The backend now lives on a separate origin (e.g. Render), while this app
 * is served from InfinityFree. Any code that calls `fetch("/api/...")` with
 * a relative path is transparently rewritten to hit the backend, and any
 * such request is sent with credentials so the session cookie flows.
 *
 * Import this file ONCE from main.tsx (side-effect import).
 */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

if (typeof window !== "undefined" && API_BASE) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init: RequestInit = {}) => {
    let url: string;
    if (typeof input === "string") url = input;
    else if (input instanceof URL) url = input.toString();
    else url = input.url;

    // Only rewrite relative /api/... URLs — leave absolute URLs alone.
    if (url.startsWith("/api/") || url === "/api") {
      const nextUrl = API_BASE + url;
      const nextInit: RequestInit = { credentials: "include", ...init };
      if (typeof input === "string" || input instanceof URL) {
        return originalFetch(nextUrl, nextInit);
      }
      // Request object — rebuild it against the new URL.
      return originalFetch(new Request(nextUrl, input), nextInit);
    }
    return originalFetch(input as any, init);
  }) as typeof window.fetch;
}
