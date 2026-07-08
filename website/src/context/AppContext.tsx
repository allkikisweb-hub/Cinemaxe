import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { t as translate, AppLang, APP_LANGUAGES, LANG_CODES } from "../i18n/translations";
import { ADMIN_ROUTING_EMAIL } from "../components/AdminDestinationModal";
import { Movie, UserProfile, Message, UserPreferences, DEFAULT_PREFERENCES, AssistantAction, AppNotification, DownloadItem } from "../types";
import {
  saveLocalDownload,
  removeLocalDownload,
  clearAllLocalDownloads,
  fetchPosterBlob,
  triggerBrowserDownload,
  downloadRemoteFile,
  computeDownloadSize,
  formatBytes,
} from "../utils/localDownloads";
import { getImageUrl } from "../utils/tmdb";
import { initTmdbFromSiteConfig, setTmdbApiKey } from "../utils/tmdb";
import {
  DEFAULT_PUBLIC_CONFIG,
  fetchPublicSiteConfig,
  PublicSiteConfig,
} from "../utils/siteConfig";

interface AppContextType {
  currentView: string;
  setCurrentView: (view: string) => void;
  selectedMovie: Movie | null;
  setSelectedMovie: (movie: Movie | null) => void;
  playerMode: "full" | "trailer" | null;
  setPlayerMode: (mode: "full" | "trailer" | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  authLoading: boolean;
  authError: string | null;
  signUp: (email: string, password: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  requestSignupVerification: (email: string, password: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  verifySignup: (email: string, otp: string) => Promise<{ ok: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>;
  checkEmailForReset: (email: string) => Promise<{ ok: boolean; found?: boolean; error?: string }>;
  resetPassword: (email: string, token: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  getLoginMethod: (email: string) => Promise<{ ok: boolean; method?: "otp" | "password"; error?: string }>;
  requestOtp: (email: string) => Promise<{ ok: boolean; error?: string }>;
  verifyOtp: (email: string, otp: string) => Promise<{ ok: boolean; error?: string }>;
  enterAsGuest: (email?: string) => void;
  isGuest: boolean;
  authModalOpen: boolean;
  authModalMode: "signin" | "signup";
  authModalInitialStep: "signin" | "signup" | "forgot";
  openAuthModal: (mode?: "signin" | "signup") => void;
  openForgotPasswordModal: () => void;
  closeAuthModal: () => void;
  rememberChoice: boolean;
  setRememberChoice: (remember: boolean) => void;
  defaultWatchChoice: "full" | "trailer" | null;
  setDefaultWatchChoice: (choice: "full" | "trailer" | null) => void;
  activeGenre: number | string | null;
  setActiveGenre: (genreId: number | string | null) => void;
  activeGenreName: string | null;
  setActiveGenreName: (name: string | null) => void;
  addToFavorites: (id: number) => void;
  removeFromFavorites: (id: number) => void;
  likeMovie: (id: number) => void;
  unlikeMovie: (id: number) => void;
  addToWatchlist: (id: number) => void;
  removeFromWatchlist: (id: number) => void;
  addToHistory: (id: number, title: string, poster: string, type: "movie" | "tv", duration: number, season?: number, episode?: number) => void;
  updateHistoryProgress: (id: number, progress: number) => void;
  updateUserProfile: (name: string, avatar: string, banner: string) => void;
  logoutUser: () => void;
  updateAccountDetails: (name: string, email: string) => Promise<{ ok: boolean; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  updatePreferences: (partial: Partial<UserPreferences>) => void;
  clearWatchHistory: () => void;
  clearAllCache: () => Promise<{ ok: boolean; error?: string }>;
  deleteAccount: () => void;
  applyAssistantAction: (action: AssistantAction) => string;
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (n: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  requireSignInPrompt: () => void;
  downloads: DownloadItem[];
  downloadStorageUsed: number;
  downloadStorageLimit: number;
  downloadMovie: (movie: Movie, mode?: "device" | "library") => Promise<{ ok: boolean; error?: string }>;
  removeDownload: (movieId: number) => Promise<{ ok: boolean; error?: string }>;
  fetchDownloads: () => Promise<void>;
  pipMovie: Movie | null;
  setPipMovie: (movie: Movie | null) => void;
  pipProviderId: string | null;
  setPipProviderId: (id: string | null) => void;
  pipProgress: number;
  setPipProgress: (progress: number) => void;
  pipSeason: number;
  setPipSeason: (season: number) => void;
  pipEpisode: number;
  setPipEpisode: (episode: number) => void;
  pipIsPlaying: boolean;
  setPipIsPlaying: (isPlaying: boolean) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
  t: (key: string) => string;
  appLanguage: AppLang;
  setAppLanguage: (lang: AppLang) => void;
  adminDestinationOpen: boolean;
  closeAdminDestination: () => void;
  goToAdminPanel: () => Promise<void>;
  dismissAdminToWebsite: () => void;
  siteConfig: PublicSiteConfig;
  refreshSiteConfig: () => Promise<void>;
  isPrimaryAdmin: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const API_BASE = ""; // same-origin — requests go through the Express server

/**
 * Parses a fetch Response as JSON, but fails with a specific, actionable
 * message when the response isn't JSON at all — which happens when a
 * request to /api/* hits a static file / SPA fallback instead of the
 * Express backend (i.e. the backend process isn't actually running).
 */
async function parseApiResponse(res: Response): Promise<any> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      "The server didn't return a valid response. This usually means the backend isn't running — start it with `npm run dev` (not just a static preview) and make sure it's on the same origin as this page."
    );
  }
  return res.json();
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<string>("home");
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [playerMode, setPlayerMode] = useState<"full" | "trailer" | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  // Prevents several near-simultaneous background 401s (e.g. a few
  // requests firing around the same time as a token expires) from each
  // independently forcing a logout + modal open — that repeated state
  // thrashing is what looked like the login modal "glitching/shaking".
  // Reset to false on every successful sign-in.
  const sessionExpiredRef = useRef(false);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<"signin" | "signup">("signin");
  const [authModalInitialStep, setAuthModalInitialStep] = useState<"signin" | "signup" | "forgot">("signin");
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [rememberChoice, setRememberChoice] = useState<boolean>(false);
  const [defaultWatchChoice, setDefaultWatchChoice] = useState<"full" | "trailer" | null>(null);
  const [activeGenre, setActiveGenre] = useState<number | string | null>(null);
  const [activeGenreName, setActiveGenreName] = useState<string | null>(null);

  // Picture in Picture states
  const [pipMovie, setPipMovie] = useState<Movie | null>(null);
  const [pipProviderId, setPipProviderId] = useState<string | null>("vidsrc-pm");
  const [pipProgress, setPipProgress] = useState<number>(0);
  const [pipSeason, setPipSeason] = useState<number>(1);
  const [pipEpisode, setPipEpisode] = useState<number>(1);
  const [pipIsPlaying, setPipIsPlaying] = useState<boolean>(false);

  // Theme — the site is dark by default (its original design), with an
  // optional light mode the person can switch to and which persists across
  // visits.
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("cinemax_theme") : null;
    return saved === "light" ? "light" : "dark";
  });
  const [guestLanguage, setGuestLanguage] = useState<AppLang>(() => {
    if (typeof window === "undefined") return "English";
    const saved = localStorage.getItem("cinemax_lang");
    return saved && APP_LANGUAGES.includes(saved as AppLang) ? (saved as AppLang) : "English";
  });
  const [adminDestinationOpen, setAdminDestinationOpen] = useState(false);
  const [siteConfig, setSiteConfig] = useState<PublicSiteConfig>(DEFAULT_PUBLIC_CONFIG);

  const refreshSiteConfig = async () => {
    const cfg = await fetchPublicSiteConfig(true);
    setSiteConfig(cfg);
    if (cfg.tmdbApiKey) setTmdbApiKey(cfg.tmdbApiKey);
  };

  useEffect(() => {
    initTmdbFromSiteConfig().then(() => refreshSiteConfig());
  }, []);

  const isPrimaryAdmin =
    user?.role === "admin" &&
    user.email?.toLowerCase() === ADMIN_ROUTING_EMAIL.toLowerCase();

  const maybeShowAdminDestination = (profile: UserProfile) => {
    if (profile.role === "admin") {
      setAdminDestinationOpen(true);
    }
  };

  const closeAdminDestination = () => setAdminDestinationOpen(false);

  const goToAdminPanel = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/admin-portal-url`, { credentials: "include" });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.error || "Could not open admin panel.");
      window.open(data.url, "_blank", "noopener,noreferrer");
      setAdminDestinationOpen(false);
    } catch (err: any) {
      console.error(err?.message || "Admin portal redirect failed.");
      setAdminDestinationOpen(false);
    }
  };

  const dismissAdminToWebsite = () => {
    setAdminDestinationOpen(false);
    setCurrentView("home");
  };

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("cinemax_theme", theme);
  }, [theme]);

  useEffect(() => {
    const reduced = user?.preferences?.reducedMotion ?? false;
    document.documentElement.classList.toggle("reduce-motion", reduced);
    document.documentElement.classList.toggle("compact-layout", user?.preferences?.compactLayout ?? false);
  }, [user?.preferences?.reducedMotion, user?.preferences?.compactLayout]);

  useEffect(() => {
    const lang = (user && !isGuest ? user.preferences?.appLanguage : guestLanguage) || "English";
    const code = LANG_CODES[lang as AppLang] || "en";
    document.documentElement.lang = code;
    document.documentElement.dir = lang === "Arabic" ? "rtl" : "ltr";
  }, [user?.preferences?.appLanguage, guestLanguage, isGuest]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  // Notification Center
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [downloadStorageUsed, setDownloadStorageUsed] = useState(0);
  const [downloadStorageLimit, setDownloadStorageLimit] = useState(2 * 1024 * 1024 * 1024);

  const syncDownloadState = (raw: { downloads?: any[]; downloadStorageUsed?: number; downloadStorageLimit?: number }) => {
    const items: DownloadItem[] = (raw.downloads || []).map((d: any) => ({
      movie_id: d.movie_id,
      title: d.title,
      poster: d.poster,
      size_bytes: d.size_bytes,
      added_at: d.added_at,
      media_type: d.media_type,
    }));
    setDownloads(items);
    if (raw.downloadStorageUsed !== undefined) setDownloadStorageUsed(raw.downloadStorageUsed);
    if (raw.downloadStorageLimit !== undefined) setDownloadStorageLimit(raw.downloadStorageLimit);
  };

  // Maps a server user payload (base profile + watchlist/favorites/history) to
  // the client-side UserProfile shape used throughout the UI.
  const mapServerUser = (raw: any): UserProfile => ({
    id: raw.id,
    name: raw.name,
    email: raw.email,
    avatar: raw.avatar,
    banner: raw.banner || "https://images.unsplash.com/photo-1574375927938-d5a98e8edd86?q=80&w=1200&auto=format&fit=crop",
    subscription: raw.subscription || "Free",
    badges: raw.role === "admin" ? ["Member", "Admin"] : ["Member"],
    role: raw.role || "user",
    favorites: raw.favorites || [],
    myList: raw.myList || raw.watchlist || [],
    watchlist: raw.watchlist || [],
    listStorageUsed: raw.listStorageUsed || 0,
    listStorageLimit: raw.listStorageLimit || 2 * 1024 * 1024 * 1024,
    downloadStorageUsed: raw.downloadStorageUsed || 0,
    downloadStorageLimit: raw.downloadStorageLimit || 2 * 1024 * 1024 * 1024,
    downloads: (raw.downloads || []).map((d: any) => ({
      movie_id: d.movie_id,
      title: d.title,
      poster: d.poster,
      size_bytes: d.size_bytes,
      added_at: d.added_at,
      media_type: d.media_type,
    })),
    watchHistory: (raw.watchHistory || []).map((h: any) => ({
      id: h.movie_id,
      title: h.title,
      poster: h.poster,
      type: (h.media_type as "movie" | "tv") || "movie",
      watchedAt: h.watched_at,
      progress: h.progress || 0,
      duration: h.duration || 0,
      season: h.season ?? undefined,
      episode: h.episode ?? undefined,
    })),
    preferences: { ...DEFAULT_PREFERENCES, ...(raw.preferences || {}) },
  });

  /**
   * Wraps the many "fire and forget" background sync calls (favorites,
   * watchlist, history, preferences, notifications, ...) so an expired
   * session is never silently swallowed. Previously these only caught
   * network-level failures — a 401 from an expired token would still
   * resolve normally, so the UI kept showing an optimistic local update
   * ("Added to Watchlist") while the server had actually rejected it,
   * silently drifting the client out of sync with what's really saved.
   */
  const syncFetch = async (input: string, init?: RequestInit) => {
    try {
      const res = await fetch(input, { credentials: "include", ...init });
      // Guests were never signed in server-side — a 401 for a guest is
      // completely expected (there's no session to expire), not a real
      // auth failure. Without this check, ordinary guest actions like
      // watching a video (which tries to sync watch history) would force
      // a full logout and pop the sign-in modal open unprompted.
      if (res.status === 401 && !isGuest && !sessionExpiredRef.current) {
        sessionExpiredRef.current = true;
        setUser(null);
        setIsGuest(false);
        setAuthError("Your session has expired. Please sign in again to keep syncing your changes.");
        setAuthModalMode("signin");
        setAuthModalOpen(true);
      }
      return res;
    } catch (err) {
      console.error(`Failed to sync with ${input}:`, err);
      return null;
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/notifications`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const mapped: AppNotification[] = (data.notifications || []).map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        timestamp: n.created_at,
        read: !!n.read,
      }));
      setNotifications(mapped);
    } catch {
      // notification fetch failures are non-critical — leave list as-is
    }
  };

  // Check for an existing session on load
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          const mapped = mapServerUser(data.user);
          setUser(mapped);
          syncDownloadState(data.user);
          sessionExpiredRef.current = false;
          fetchNotifications();
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    })();

    const savedRemember = localStorage.getItem("cinemax_remember_choice");
    if (savedRemember) {
      setRememberChoice(JSON.parse(savedRemember));
    }

    const savedChoice = localStorage.getItem("cinemax_default_choice");
    if (savedChoice) {
      setDefaultWatchChoice(savedChoice as "full" | "trailer");
    }
  }, []);

  const signUp = async (email: string, password: string, name: string): Promise<{ ok: boolean; error?: string }> => {
    return requestSignupVerification(email, password, name);
  };

  const requestSignupVerification = async (email: string, password: string, name: string): Promise<{ ok: boolean; error?: string }> => {
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, name }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) {
        setAuthError(data.error || "Something went wrong.");
        return { ok: false, error: data.error };
      }
      return { ok: true };
    } catch (err: any) {
      const error = err?.message || "Couldn't reach the server.";
      setAuthError(error);
      return { ok: false, error };
    }
  };

  const verifySignup = async (email: string, otp: string): Promise<{ ok: boolean; error?: string }> => {
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, otp }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) {
        setAuthError(data.error || "Verification failed.");
        return { ok: false, error: data.error };
      }
      const mapped = mapServerUser(data.user);
      setUser(mapped);
      syncDownloadState(data.user);
      sessionExpiredRef.current = false;
      setIsGuest(false);
      fetchNotifications();
      maybeShowAdminDestination(mapped);
      return { ok: true };
    } catch (err: any) {
      const error = err?.message || "Couldn't reach the server.";
      setAuthError(error);
      return { ok: false, error };
    }
  };

  const checkEmailForReset = async (email: string): Promise<{ ok: boolean; found?: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password/check-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) return { ok: false, error: data.error };
      return { ok: true, found: !!data.found };
    } catch (err: any) {
      return { ok: false, error: err?.message };
    }
  };

  const requestPasswordReset = async (email: string): Promise<{ ok: boolean; error?: string; resetToken?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) return { ok: false, error: data.error };
      return { ok: true, resetToken: data.resetToken };
    } catch (err: any) {
      return { ok: false, error: err?.message };
    }
  };

  const resetPassword = async (email: string, token: string, newPassword: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, token, newPassword }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) return { ok: false, error: data.error };
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) {
        setAuthError(data.error || "Invalid email or password.");
        return { ok: false, error: data.error };
      }
      const mapped = mapServerUser(data.user);
      setUser(mapped);
      syncDownloadState(data.user);
      sessionExpiredRef.current = false;
      setIsGuest(false);
      fetchNotifications();
      maybeShowAdminDestination(mapped);
      return { ok: true };
    } catch (err: any) {
      const error = err?.message || "Couldn't reach the server. Please try again.";
      setAuthError(error);
      return { ok: false, error };
    }
  };

  /**
   * Checks whether an email should sign in with a password or an emailed
   * OTP. Only the admin account resolves to "otp" — everyone else uses the
   * normal password flow. Used by AuthModal to decide which step to render
   * next after the person enters their email and taps Continue.
   */
  const getLoginMethod = async (email: string): Promise<{ ok: boolean; method?: "otp" | "password"; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login/method`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) {
        return { ok: false, error: data.error || "Something went wrong. Please try again." };
      }
      return { ok: true, method: data.method };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Couldn't reach the server. Please try again." };
    }
  };

  /** Sends a fresh one-time login code to the admin's email address. */
  const requestOtp = async (email: string): Promise<{ ok: boolean; error?: string }> => {
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) {
        setAuthError(data.error || "Couldn't send the code. Please try again.");
        return { ok: false, error: data.error };
      }
      return { ok: true };
    } catch (err: any) {
      const error = err?.message || "Couldn't reach the server. Please try again.";
      setAuthError(error);
      return { ok: false, error };
    }
  };

  /** Verifies the OTP the admin received by email and, on success, signs them in. */
  const verifyOtp = async (email: string, otp: string): Promise<{ ok: boolean; error?: string }> => {
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, otp }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) {
        setAuthError(data.error || "Incorrect code. Please try again.");
        return { ok: false, error: data.error };
      }
      const mapped = mapServerUser(data.user);
      setUser(mapped);
      syncDownloadState(data.user);
      sessionExpiredRef.current = false;
      setIsGuest(false);
      fetchNotifications();
      maybeShowAdminDestination(mapped);
      return { ok: true };
    } catch (err: any) {
      const error = err?.message || "Couldn't reach the server. Please try again.";
      setAuthError(error);
      return { ok: false, error };
    }
  };

  /**
   * Bypasses authentication entirely — used by the landing page's
   * "Start Watch Free" button so a visitor can jump straight into the
   * dashboard and browse/watch movies. Unlike a real account, guest mode
   * does NOT unlock Profile, Notifications, Favorites, or My List — those
   * stay gated behind a "please sign in" prompt (see requireSignInPrompt).
   */
  const enterAsGuest = (email?: string) => {
    setAuthError(null);
    setIsGuest(true);
    setUser({
      name: "Guest",
      email: email || "guest@cinemax.app",
      avatar: "cartoon:nova",
      banner: "https://images.unsplash.com/photo-1574375927938-d5a98e8edd86?q=80&w=1200&auto=format&fit=crop",
      subscription: "Free",
      badges: ["Guest"],
      favorites: [],
      myList: [],
      watchlist: [],
      watchHistory: [],
      preferences: { ...DEFAULT_PREFERENCES },
    });
    setCurrentView("home");
  };

  const openAuthModal = (mode: "signin" | "signup" = "signin") => {
    setAuthModalMode(mode);
    setAuthModalInitialStep(mode === "signup" ? "signup" : "signin");
    setAuthModalOpen(true);
  };

  const openForgotPasswordModal = () => {
    setAuthModalMode("signin");
    setAuthModalInitialStep("forgot");
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => setAuthModalOpen(false);

  const logoutUser = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
    } catch {
      // even if the request fails, clear local state so the UI reflects logout
    }
    setUser(null);
    setIsGuest(false);
    setNotifications([]);
    setCurrentView("home");
  };

  /** Shown by UI entry points (profile, notifications, favorites, my list)
   * that require a real account — guests get routed here instead of the
   * feature itself, opening the sign-in modal directly. */
  const requireSignInPrompt = () => {
    setAuthError(null);
    openAuthModal("signin");
  };

  const addToFavorites = (id: number) => {
    if (!user || isGuest) { requireSignInPrompt(); return; }
    setUser({ ...user, favorites: [...user.favorites.filter((fid) => fid !== id), id] });
    syncFetch(`${API_BASE}/api/favorites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ movieId: id }),
    }).catch(() => console.error("Failed to sync favorite to server"));
  };

  const removeFromFavorites = (id: number) => {
    if (!user || isGuest) { requireSignInPrompt(); return; }
    setUser({ ...user, favorites: user.favorites.filter((fid) => fid !== id) });
    syncFetch(`${API_BASE}/api/favorites/${id}`, { method: "DELETE", credentials: "include" }).catch(() =>
      console.error("Failed to sync favorite removal to server")
    );
  };

  /**
   * Like a title — saves to Favorites only (Shorts Save uses this).
   */
  const likeMovie = (id: number) => {
    addToFavorites(id);
  };

  /** Un-likes a title. Deliberately leaves the watchlist alone — removing a
   * saved title is a separate, more deliberate action than un-liking it. */
  const unlikeMovie = (id: number) => {
    removeFromFavorites(id);
  };

  const addToWatchlist = (id: number) => {
    if (!user || isGuest) { requireSignInPrompt(); return; }
    const myList = [...(user.myList || []).filter((wid) => wid !== id), id];
    setUser({ ...user, myList });
    syncFetch(`${API_BASE}/api/my-list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ movieId: id }),
    }).catch(() => console.error("Failed to sync my list to server"));
    addNotification({
      type: "watchlist",
      title: "Added to My List",
      message: "Saved for later — find it in My List anytime.",
    });
  };

  const removeFromWatchlist = (id: number) => {
    if (!user || isGuest) { requireSignInPrompt(); return; }
    setUser({ ...user, myList: (user.myList || []).filter((wid) => wid !== id) });
    syncFetch(`${API_BASE}/api/my-list/${id}`, { method: "DELETE", credentials: "include" }).catch(() =>
      console.error("Failed to sync my list removal to server")
    );
  };

  const addToHistory = (
    id: number,
    title: string,
    poster: string,
    type: "movie" | "tv",
    duration: number,
    season?: number,
    episode?: number
  ) => {
    if (!user) return;
    const existingIndex = user.watchHistory.findIndex(h => h.id === id && h.season === season && h.episode === episode);

    let updatedHistory = [...user.watchHistory];
    if (existingIndex >= 0) {
      const item = updatedHistory[existingIndex];
      updatedHistory.splice(existingIndex, 1);
      updatedHistory.unshift({ ...item, watchedAt: new Date().toISOString(), progress: Math.max(item.progress || 0, 1) });
    } else {
      updatedHistory.unshift({
        id,
        title,
        poster,
        type,
        watchedAt: new Date().toISOString(),
        progress: 1,
        duration,
        season,
        episode,
      });
    }

    if (updatedHistory.length > 50) {
      updatedHistory = updatedHistory.slice(0, 50);
    }

    setUser({ ...user, watchHistory: updatedHistory });
    // Guests have no server-side session to sync to — keep history local
    // to their browser session only, exactly like favorites/watchlist do.
    if (!isGuest) {
      syncFetch(`${API_BASE}/api/watch-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ movieId: id, title, poster, mediaType: type, duration, season, episode }),
      }).catch(() => console.error("Failed to sync watch history to server"));
    }
  };

  const updateHistoryProgress = (id: number, progress: number) => {
    if (!user) return;
    setUser({ ...user, watchHistory: user.watchHistory.map((h) => (h.id === id ? { ...h, progress } : h)) });
    if (!isGuest) {
      syncFetch(`${API_BASE}/api/watch-history/${id}/progress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ progress }),
      }).catch(() => console.error("Failed to sync watch progress to server"));
    }
  };

  const updateUserProfile = (name: string, avatar: string, banner: string) => {
    if (!user || isGuest) return;
    setUser({ ...user, name, avatar, banner });
    syncFetch(`${API_BASE}/api/auth/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name }),
    }).catch(() => console.error("Failed to sync profile name to server"));
    syncFetch(`${API_BASE}/api/auth/avatar`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ avatar, banner }),
    }).catch(() => console.error("Failed to sync avatar to server"));
  };

  const updateAccountDetails = async (name: string, email: string): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: "You must be signed in." };
    if (!name.trim()) return { ok: false, error: "Display name cannot be empty." };
    if (!email.includes("@")) return { ok: false, error: "Please enter a valid email address." };
    try {
      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) return { ok: false, error: data.error || "Something went wrong." };
      setUser({ ...user, name: data.user.name, email: data.user.email });
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Couldn't reach the server. Please try again." };
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: "You must be signed in." };
    try {
      const res = await fetch(`${API_BASE}/api/auth/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) return { ok: false, error: data.error || "Something went wrong." };
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Couldn't reach the server. Please try again." };
    }
  };

  const updatePreferences = (partial: Partial<UserPreferences>) => {
    if (!user) return;
    setUser({ ...user, preferences: { ...(user.preferences || DEFAULT_PREFERENCES), ...partial } });
    if (!isGuest) {
      syncFetch(`${API_BASE}/api/auth/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(partial),
      }).catch(() => console.error("Failed to sync preferences to server"));
    }
  };

  const clearWatchHistory = () => {
    if (!user) return;
    setUser({ ...user, watchHistory: [] });
    if (!isGuest) {
      syncFetch(`${API_BASE}/api/watch-history`, { method: "DELETE", credentials: "include" }).catch(() =>
        console.error("Failed to clear watch history on server")
      );
    }
  };

  const fetchDownloads = async () => {
    if (isGuest || !user) return;
    try {
      const res = await fetch(`${API_BASE}/api/downloads`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      syncDownloadState(data);
      setUser((u) =>
        u
          ? {
              ...u,
              downloads: (data.downloads || []).map((d: any) => ({
                movie_id: d.movie_id,
                title: d.title,
                poster: d.poster,
                size_bytes: d.size_bytes,
                added_at: d.added_at,
                media_type: d.media_type,
              })),
              downloadStorageUsed: data.storageUsed,
              downloadStorageLimit: data.storageLimit,
            }
          : u
      );
    } catch {
      /* non-critical */
    }
  };

  const downloadMovie = async (movie: Movie, mode: "device" | "library" = "library"): Promise<{ ok: boolean; error?: string }> => {
    if (mode === "library" && (!user || isGuest)) {
      requireSignInPrompt();
      return { ok: false, error: "Sign in to download." };
    }
    const title = movie.title || movie.name || "Untitled";
    const mediaType: "movie" | "tv" = movie.title ? "movie" : "tv";

    if (mode === "library" && downloads.some((d) => d.movie_id === movie.id)) {
      return { ok: false, error: "This title is already in your Download History." };
    }

    try {
      const posterUrl = movie.poster_path ? getImageUrl(movie.poster_path, "w780") : "";
      const backdropUrl = movie.backdrop_path ? getImageUrl(movie.backdrop_path, "w780") : "";
      const [posterBlob, backdropBlob] = await Promise.all([
        posterUrl ? fetchPosterBlob(posterUrl) : Promise.resolve(null),
        backdropUrl ? fetchPosterBlob(backdropUrl) : Promise.resolve(null),
      ]);

      const packageData = {
        id: movie.id,
        title,
        mediaType,
        overview: movie.overview || "",
        poster_path: movie.poster_path,
        backdrop_path: movie.backdrop_path,
        vote_average: movie.vote_average,
        release_date: movie.release_date || movie.first_air_date || null,
        downloadedAt: new Date().toISOString(),
        cinemaxVersion: 2,
        note: "Cinemax offline library package — metadata and artwork. Stream playback requires internet.",
      };

      const jsonBlob = new Blob([JSON.stringify(packageData, null, 2)], { type: "application/json" });
      const sizeBytes = computeDownloadSize(jsonBlob.size, posterBlob?.size || 0, backdropBlob?.size || 0);

      if (mode === "library" && downloadStorageUsed + sizeBytes > downloadStorageLimit) {
        return {
          ok: false,
          error: "Download storage is full (2 GB limit). Delete items from Download History to free space.",
        };
      }

      const safeName = title.replace(/[^\w\s-]/g, "").trim().slice(0, 60) || "cinemax-title";
      if (mode === "device") {
        const dlUrl = (movie as any).download_url as string | undefined | null;
        if (dlUrl) {
          try {
            // download the video file robustly (streams when supported)
            await downloadRemoteFile(dlUrl, `${safeName}.mp4`, (_loaded, _total) => {
              // progress callback intentionally left blank — UI can show progress separately if needed
            });
            // also save metadata and artwork to device
            triggerBrowserDownload(jsonBlob, `${safeName}.cinemax.json`);
            if (posterBlob) triggerBrowserDownload(posterBlob, `${safeName}-poster.jpg`);
            if (backdropBlob) triggerBrowserDownload(backdropBlob, `${safeName}-backdrop.jpg`);
            addNotification({
              type: "system",
              title: "Device download started",
              message: `"${title}" is being saved to your device (${formatBytes(sizeBytes)}).`,
            });
            return { ok: true };
          } catch (err: any) {
            // fallback to the existing behavior below if remote download fails
            console.error("Full movie device download failed:", err);
          }
        }

        // fallback — save package + artwork only
        triggerBrowserDownload(jsonBlob, `${safeName}.cinemax.json`);
        if (posterBlob) triggerBrowserDownload(posterBlob, `${safeName}-poster.jpg`);
        if (backdropBlob) triggerBrowserDownload(backdropBlob, `${safeName}-backdrop.jpg`);
        addNotification({
          type: "system",
          title: "Device download started",
          message: `"${title}" is being saved to your device (${formatBytes(sizeBytes)}).`,
        });
        return { ok: true };
      }

      await saveLocalDownload({
        movieId: movie.id,
        title,
        mediaType,
        overview: movie.overview || "",
        posterPath: movie.poster_path || null,
        backdropPath: movie.backdrop_path || null,
        voteAverage: movie.vote_average ?? 0,
        releaseDate: movie.release_date || movie.first_air_date || null,
        posterBlob,
        backdropBlob,
        savedAt: packageData.downloadedAt,
        sizeBytes,
      });

      const res = await fetch(`${API_BASE}/api/downloads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          movieId: movie.id,
          title,
          poster: movie.poster_path || null,
          sizeBytes,
          mediaType,
        }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) {
        await removeLocalDownload(movie.id);
        return { ok: false, error: data.error || "Download failed." };
      }

      syncDownloadState(data);
      setUser((u) =>
        u
          ? {
              ...u,
              downloadStorageUsed: data.storageUsed,
              downloadStorageLimit: data.storageLimit,
              downloads: (data.downloads || []).map((d: any) => ({
                movie_id: d.movie_id,
                title: d.title,
                poster: d.poster,
                size_bytes: d.size_bytes,
                added_at: d.added_at,
                media_type: d.media_type,
              })),
            }
          : u
      );

      addNotification({
        type: "system",
        title: "Download complete",
        message: `"${title}" saved to your Cinemax Download History (${formatBytes(sizeBytes)}).`,
      });

      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Download failed." };
    }
  };

  const removeDownload = async (movieId: number): Promise<{ ok: boolean; error?: string }> => {
    if (!user || isGuest) return { ok: false, error: "Sign in required." };
    try {
      await removeLocalDownload(movieId);
      const res = await fetch(`${API_BASE}/api/downloads/${movieId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await parseApiResponse(res);
      if (!res.ok) return { ok: false, error: data.error };
      syncDownloadState(data);
      setUser((u) =>
        u
          ? {
              ...u,
              downloadStorageUsed: data.storageUsed,
              downloads: (data.downloads || []).map((d: any) => ({
                movie_id: d.movie_id,
                title: d.title,
                poster: d.poster,
                size_bytes: d.size_bytes,
                added_at: d.added_at,
                media_type: d.media_type,
              })),
            }
          : u
      );
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message };
    }
  };

  const clearAllCache = async (): Promise<{ ok: boolean; error?: string }> => {
    if (!user || isGuest) return { ok: false, error: "Sign in required." };
    try {
      localStorage.removeItem("cinemax_remember_choice");
      localStorage.removeItem("cinemax_default_choice");
      localStorage.removeItem("cinemax_theme");
      const res = await fetch(`${API_BASE}/api/auth/clear-cache`, {
        method: "POST",
        credentials: "include",
      });
      const data = await parseApiResponse(res);
      if (!res.ok) return { ok: false, error: data.error };
      await clearAllLocalDownloads();
      setDownloads([]);
      setDownloadStorageUsed(0);
      setUser(mapServerUser(data.user));
      syncDownloadState(data.user);
      setNotifications([]);
      setRememberChoice(false);
      setDefaultWatchChoice(null);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message };
    }
  };

  const appLanguage = ((user && !isGuest ? user.preferences?.appLanguage : guestLanguage) || "English") as AppLang;
  const setAppLanguage = (lang: AppLang) => {
    if (!APP_LANGUAGES.includes(lang)) return;
    if (user && !isGuest) {
      setUser((prev) => prev ? { ...prev, preferences: { ...(prev.preferences || DEFAULT_PREFERENCES), appLanguage: lang } } : prev);
      updatePreferences({ appLanguage: lang });
    } else {
      setGuestLanguage(lang);
      localStorage.setItem("cinemax_lang", lang);
    }
    localStorage.setItem("cinemax_lang", lang);
    document.documentElement.lang = LANG_CODES[lang] || "en";
    document.documentElement.dir = lang === "Arabic" ? "rtl" : "ltr";
  };
  const t = (key: string) => translate(appLanguage, key);

  const deleteAccount = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/account`, { method: "DELETE", credentials: "include" });
    } catch {
      // proceed to clear local state regardless
    }
    setUser(null);
    setNotifications([]);
    localStorage.removeItem("cinemax_remember_choice");
    localStorage.removeItem("cinemax_default_choice");
    setCurrentView("home");
  };

  // Executes a structured action proposed by the AI Help Desk assistant, after
  // the user has confirmed it in the chat UI. Returns a short confirmation string.
  const applyAssistantAction = (action: AssistantAction): string => {
    switch (action.type) {
      case "update_name": {
        if (!user || !action.value) return "I couldn't update your name — please sign in first.";
        updateUserProfile(action.value, user.avatar, user.banner);
        return `Done — your display name is now "${action.value}".`;
      }
      case "toggle_autoplay_next": {
        const next = !(user?.preferences?.autoplayNext ?? true);
        updatePreferences({ autoplayNext: next });
        return `Autoplay next episode is now ${next ? "ON" : "OFF"}.`;
      }
      case "toggle_autoplay_trailers": {
        const next = !(user?.preferences?.autoplayTrailers ?? true);
        updatePreferences({ autoplayTrailers: next });
        return `Autoplay trailers is now ${next ? "ON" : "OFF"}.`;
      }
      case "set_subtitle_language": {
        if (!action.value) return "Please tell me which subtitle language you'd like.";
        updatePreferences({ subtitleLanguage: action.value });
        return `Subtitles are now set to ${action.value}.`;
      }
      case "set_default_quality": {
        const q = (action.value || "Auto") as UserPreferences["defaultQuality"];
        updatePreferences({ defaultQuality: q });
        return `Default streaming quality is now ${q}.`;
      }
      case "toggle_mature_lock": {
        const next = !(user?.preferences?.matureContentLock ?? false);
        updatePreferences({ matureContentLock: next });
        return `Mature content lock is now ${next ? "ENABLED" : "DISABLED"}.`;
      }
      case "clear_watch_history": {
        clearWatchHistory();
        return "Your watch history has been cleared.";
      }
      case "navigate": {
        if (action.value) setCurrentView(action.value);
        return `Taking you to ${action.value}.`;
      }
      default:
        return "I'm not able to perform that action yet.";
    }
  };

  const addNotification = (n: Omit<AppNotification, "id" | "timestamp" | "read">) => {
    const optimistic: AppNotification = {
      ...n,
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [optimistic, ...prev].slice(0, 50));
    if (!user || isGuest) return;
    syncFetch(`${API_BASE}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(n),
    })
      .then(() => fetchNotifications())
      .catch(() => console.error("Failed to sync notification to server"));
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    if (isGuest) return;
    syncFetch(`${API_BASE}/api/notifications/${id}/read`, { method: "PUT", credentials: "include" }).catch(() =>
      console.error("Failed to sync read status to server")
    );
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (isGuest) return;
    syncFetch(`${API_BASE}/api/notifications/read-all`, { method: "PUT", credentials: "include" }).catch(() =>
      console.error("Failed to sync read status to server")
    );
  };

  const clearNotifications = () => {
    setNotifications([]);
    if (isGuest) return;
    syncFetch(`${API_BASE}/api/notifications`, { method: "DELETE", credentials: "include" }).catch(() =>
      console.error("Failed to clear notifications on server")
    );
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AppContext.Provider
      value={{
        currentView,
        setCurrentView,
        selectedMovie,
        setSelectedMovie,
        playerMode,
        setPlayerMode,
        searchQuery,
        setSearchQuery,
        user,
        setUser,
        authLoading,
        authError,
        signUp,
        requestSignupVerification,
        verifySignup,
        requestPasswordReset,
        checkEmailForReset,
        resetPassword,
        signIn,
        getLoginMethod,
        requestOtp,
        verifyOtp,
        enterAsGuest,
        isGuest,
        authModalOpen,
        authModalMode,
        authModalInitialStep,
        openAuthModal,
        openForgotPasswordModal,
        closeAuthModal,
        rememberChoice,
        setRememberChoice,
        defaultWatchChoice,
        setDefaultWatchChoice,
        activeGenre,
        setActiveGenre,
        activeGenreName,
        setActiveGenreName,
        addToFavorites,
        removeFromFavorites,
        likeMovie,
        unlikeMovie,
        addToWatchlist,
        removeFromWatchlist,
        addToHistory,
        updateHistoryProgress,
        updateUserProfile,
        logoutUser,
        updateAccountDetails,
        changePassword,
        updatePreferences,
        clearWatchHistory,
        clearAllCache,
        deleteAccount,
        applyAssistantAction,
        notifications,
        unreadCount,
        addNotification,
        markNotificationRead,
        markAllNotificationsRead,
        clearNotifications,
        requireSignInPrompt,
        downloads,
        downloadStorageUsed,
        downloadStorageLimit,
        downloadMovie,
        removeDownload,
        fetchDownloads,
        pipMovie,
        setPipMovie,
        pipProviderId,
        setPipProviderId,
        pipProgress,
        setPipProgress,
        pipSeason,
        setPipSeason,
        pipEpisode,
        setPipEpisode,
        pipIsPlaying,
        setPipIsPlaying,
        theme,
        toggleTheme,
        t,
        appLanguage,
        setAppLanguage,
        adminDestinationOpen,
        closeAdminDestination,
        goToAdminPanel,
        dismissAdminToWebsite,
        siteConfig,
        refreshSiteConfig,
        isPrimaryAdmin,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
