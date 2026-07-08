/** Local device storage for downloaded movie packages (IndexedDB). */

const DB_NAME = "cinemax_offline_v1";
const STORE = "downloads";
const DB_VERSION = 1;

export interface LocalDownloadRecord {
  movieId: number;
  title: string;
  mediaType: "movie" | "tv";
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number;
  releaseDate: string | null;
  posterBlob: Blob | null;
  backdropBlob: Blob | null;
  savedAt: string;
  sizeBytes: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "movieId" });
      }
    };
  });
}

export async function saveLocalDownload(record: LocalDownloadRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getLocalDownload(movieId: number): Promise<LocalDownloadRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(movieId);
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function getAllLocalDownloads(): Promise<LocalDownloadRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function removeLocalDownload(movieId: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(movieId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function clearAllLocalDownloads(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Download a remote file URL robustly and save it with `filename`.
 * Attempts a streamed fetch to provide progress via `onProgress` if present.
 * Falls back to opening the remote URL directly when CORS prevents fetching.
 */
export async function downloadRemoteFile(url: string, filename: string, onProgress?: (loaded: number, total?: number) => void): Promise<void> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const contentLength = res.headers.get("Content-Length");
    const total = contentLength ? Number(contentLength) : undefined;
    if (!res.body) {
      // No streaming support - fall back to blob
      const blob = await res.blob();
      triggerBrowserDownload(blob, filename);
      return;
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        if (onProgress) onProgress(received, total);
      }
    }
    const blob = new Blob(chunks, { type: res.headers.get("Content-Type") || "application/octet-stream" });
    triggerBrowserDownload(blob, filename);
  } catch {
    // If CORS or network prevents fetching, fall back to opening the URL in a new tab.
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

export async function fetchPosterBlob(posterUrl: string): Promise<Blob | null> {
  try {
    const res = await fetch(posterUrl);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

/** Minimum bytes charged per title against quota (metadata + artwork). */
export const DOWNLOAD_MIN_BYTES = 2 * 1024 * 1024;
/** Maximum bytes charged per title against quota. */
export const DOWNLOAD_QUOTA_BYTES = 150 * 1024 * 1024;

export function computeDownloadSize(jsonBytes: number, posterBytes: number, backdropBytes: number): number {
  const total = jsonBytes + posterBytes + backdropBytes;
  return Math.min(DOWNLOAD_QUOTA_BYTES, Math.max(DOWNLOAD_MIN_BYTES, total));
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

