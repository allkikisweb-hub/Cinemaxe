import fs from "fs";
import path from "path";

/**
 * A tiny file-backed JSON database. Deliberately NOT a native module (like
 * better-sqlite3) — those require a C++ compiler + Python to install via
 * node-gyp, which breaks on a lot of Windows machines out of the box. This
 * trades some performance/features for "just works after `npm install`",
 * which is the right tradeoff at this project's scale.
 *
 * All reads/writes happen against an in-memory copy that's persisted to disk
 * synchronously after every mutation. Fine for a single-process dev/small
 * deployment; swap for a real database engine if you outgrow this.
 */

export interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  avatar: string;
  banner: string;
  subscription: string;
  role: "user" | "admin";
  status: "active" | "suspended" | "banned";
  preferences: string; // JSON-encoded, mirrors the previous SQL column shape
  created_at: string;
  updated_at: string;
}

export interface DbWatchlistItem {
  user_id: string;
  movie_id: number;
  added_at: string;
}

/** Manually saved titles — "My List" (watch later). */
export interface DbMyListItem {
  user_id: string;
  movie_id: number;
  added_at: string;
  estimated_bytes: number;
}

export interface DbDownloadItem {
  user_id: string;
  movie_id: number;
  title: string;
  poster: string | null;
  size_bytes: number;
  added_at: string;
  media_type?: "movie" | "tv";
}

export interface DbFavoriteItem {
  user_id: string;
  movie_id: number;
  added_at: string;
}

export interface DbWatchHistoryItem {
  user_id: string;
  movie_id: number;
  title: string | null;
  poster: string | null;
  media_type: string | null;
  progress: number;
  duration: number;
  season: number | null;
  episode: number | null;
  watched_at: string;
}

export interface DbNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: number; // 0/1, mirrors the previous SQL column shape
  created_at: string;
}

export interface DbComment {
  id: string;
  movie_id: number;
  movie_title: string | null;
  user_id: string;
  user_name: string;
  text: string;
  rating: number | null; // 1-10, optional star/score rating
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface DbAd {
  id: string;
  title: string;
  image_url: string;
  target_url: string;
  placement: "homepage_top" | "homepage_mid" | "sidebar" | "player_pre_roll";
  active: boolean;
  created_at: string;
}

export interface DbActivityLog {
  id: string;
  actor_email: string;
  action: string;
  target: string;
  meta: string; // JSON-encoded free-form details
  created_at: string;
}

export interface DbCategoryOverride {
  genre_id: number;
  label: string | null; // custom display label, null = use TMDB default
  hidden: boolean;
}

export interface DbSiteSettings {
  siteName: string;
  maintenanceMode: boolean;
  heroTagline: string;
  featuredMovieIds: number[];
  trendingOverrideIds: number[];
  hiddenMovieIds: number[];
  aiModel: string;
  aiSystemPromptExtra: string;
  aiEnabled: boolean;
  homepageSections: Array<{ id: string; label: string; visible: boolean }>;
  apiKeys: {
    tmdb: string;
    gemini: string;
    groq: string;
  };
  contentPages: Record<string, { enabled: boolean; label: string }>;
}

// ---------------------------------------------------------------------------
// LIVE CHAT — "Popular" is one shared global feed everyone reads and (if
// signed in) posts to; parent_id turns a message into a threaded reply.
// Direct messages are one-to-one, addressed purely by the two participants'
// ids so a "conversation" is just every DM between the same two people.
// ---------------------------------------------------------------------------

export interface DbChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  text: string;
  parent_id: string | null; // null = top-level post, else replying to another message's id
  liked_by: string[]; // user ids who've liked this message
  created_at: string;
  media_url: string | null; // base64 data URL for an attached image (global feed: images only)
  media_type: "image" | "audio" | null;
}

export interface DbDirectMessage {
  id: string;
  from_user_id: string;
  to_user_id: string;
  text: string;
  liked_by: string[];
  read: boolean;
  created_at: string;
  media_url: string | null; // base64 data URL — images or voice notes (inbox supports both)
  media_type: "image" | "audio" | null;
}

// ---------------------------------------------------------------------------
// CUSTOM CONTENT (CMS) — admin-authored titles that don't come from TMDB.
// `numeric_id` is always negative so it can never collide with a real TMDB
// id (always positive) when the two are merged together on the homepage.
// ---------------------------------------------------------------------------

export interface DbCustomContent {
  id: string;
  numeric_id: number; // negative, used as Movie.id on the frontend
  title: string;
  overview: string;
  poster_url: string;
  backdrop_url: string;
  trailer_youtube_key: string;
  media_type: "movie" | "tv";
  genre_names: string[];
  release_date: string | null;
  rating: number; // 0-10, admin-set
  featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbSupportInquiry {
  id: string;
  user_id: string | null;
  user_name: string;
  user_email: string;
  subject: string;
  message: string;
  status: "open" | "replied" | "closed";
  admin_reply: string | null;
  created_at: string;
  updated_at: string;
}

interface DbSchema {
  users: DbUser[];
  watchlist: DbWatchlistItem[];
  my_list: DbMyListItem[];
  downloads: DbDownloadItem[];
  favorites: DbFavoriteItem[];
  watch_history: DbWatchHistoryItem[];
  notifications: DbNotification[];
  comments: DbComment[];
  ads: DbAd[];
  activity_logs: DbActivityLog[];
  category_overrides: DbCategoryOverride[];
  site_settings: DbSiteSettings;
  chat_messages: DbChatMessage[];
  direct_messages: DbDirectMessage[];
  custom_content: DbCustomContent[];
  custom_content_seq: number;
  support_inquiries: DbSupportInquiry[];
}

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const DB_PATH = path.join(dataDir, "cinemax.json");

function defaultSiteSettings(): DbSiteSettings {
  return {
    siteName: "Cinemax",
    maintenanceMode: false,
    heroTagline: "Welcome to Cinemax! Enjoy new trend movies and TV shows.",
    featuredMovieIds: [],
    trendingOverrideIds: [],
    hiddenMovieIds: [],
    aiModel: "llama-3.1-8b-instant",
    aiSystemPromptExtra: "",
    aiEnabled: true,
    homepageSections: [
      { id: "trending", label: "Trending Now", visible: true },
      { id: "tv", label: "Popular TV Broadcast Series", visible: true },
      { id: "popular", label: "Popular Movies", visible: true },
      { id: "top_rated", label: "Top Rated Cinema Hits", visible: true },
      { id: "upcoming", label: "Upcoming Blockbusters", visible: true },
      { id: "now_playing", label: "Now Playing in Theaters", visible: true },
    ],
    apiKeys: {
      tmdb: process.env.TMDB_API_KEY || "8e887749d8a5b7a31b807aadd903d25a",
      gemini: process.env.GEMINI_API_KEY || "",
      groq: process.env.GROQ_API_KEY || "",
    },
    contentPages: {
      home: { enabled: true, label: "Home" },
      movies: { enabled: true, label: "Movies" },
      tv: { enabled: true, label: "TV Shows" },
      shorts: { enabled: true, label: "Shorts" },
      mylist: { enabled: true, label: "My List" },
      watchlist: { enabled: true, label: "Watchlist" },
      history: { enabled: true, label: "History" },
      favorites: { enabled: true, label: "Favorites" },
      downloads: { enabled: true, label: "Downloads" },
    },
  };
}

function emptySchema(): DbSchema {
  return {
    users: [],
    watchlist: [],
    my_list: [],
    downloads: [],
    favorites: [],
    watch_history: [],
    notifications: [],
    comments: [],
    ads: [],
    activity_logs: [],
    category_overrides: [],
    site_settings: defaultSiteSettings(),
    chat_messages: [],
    direct_messages: [],
    custom_content: [],
    custom_content_seq: 0,
    support_inquiries: [],
  };
}

function load(): DbSchema {
  if (!fs.existsSync(DB_PATH)) {
    const fresh = emptySchema();
    fs.writeFileSync(DB_PATH, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    // Backfill any collections missing from an older/partial file
    const merged = { ...emptySchema(), ...parsed };
    merged.site_settings = { ...defaultSiteSettings(), ...(parsed.site_settings || {}) };
    if (!merged.support_inquiries) merged.support_inquiries = [];
    if (!merged.my_list) merged.my_list = [];
    if (!merged.downloads) merged.downloads = [];
    // Migrate legacy watchlist entries into my_list once
    if (merged.watchlist?.length && merged.my_list.length === 0) {
      for (const w of merged.watchlist) {
        if (!merged.my_list.some((m) => m.user_id === w.user_id && m.movie_id === w.movie_id)) {
          merged.my_list.push({
            user_id: w.user_id,
            movie_id: w.movie_id,
            added_at: w.added_at,
            estimated_bytes: 150 * 1024 * 1024,
          });
        }
      }
    }
    // Backfill role/status on users created before this field existed
    merged.users = merged.users.map((u: DbUser) => ({
      ...u,
      role: u.role || "user",
      status: u.status || "active",
    }));
    return merged;
  } catch (err) {
    console.error(`[db] Failed to parse ${DB_PATH} — starting from an empty database.`, err);
    return emptySchema();
  }
}

let data: DbSchema = load();

function save() {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

const db = {
  get data(): DbSchema {
    return data;
  },
  save,
  /** Mints the next unique negative id for a new custom content entry. */
  nextCustomContentId(): number {
    data.custom_content_seq += 1;
    return -data.custom_content_seq;
  },
};

export default db;
