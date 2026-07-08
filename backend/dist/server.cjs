var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/server.ts
var import_config = require("dotenv/config");
var import_express3 = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_cookie_parser = __toESM(require("cookie-parser"), 1);
var import_genai = require("@google/genai");

// src/routes/website.ts
var import_express = require("express");
var import_crypto2 = __toESM(require("crypto"), 1);

// src/lib/db.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var dataDir = import_path.default.join(process.cwd(), "data");
if (!import_fs.default.existsSync(dataDir)) import_fs.default.mkdirSync(dataDir, { recursive: true });
var DB_PATH = import_path.default.join(dataDir, "cinemax.json");
function defaultSiteSettings() {
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
      { id: "now_playing", label: "Now Playing in Theaters", visible: true }
    ],
    apiKeys: {
      tmdb: process.env.TMDB_API_KEY || "8e887749d8a5b7a31b807aadd903d25a",
      gemini: process.env.GEMINI_API_KEY || "",
      groq: process.env.GROQ_API_KEY || ""
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
      downloads: { enabled: true, label: "Downloads" }
    }
  };
}
function emptySchema() {
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
    support_inquiries: []
  };
}
function load() {
  if (!import_fs.default.existsSync(DB_PATH)) {
    const fresh = emptySchema();
    import_fs.default.writeFileSync(DB_PATH, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  try {
    const parsed = JSON.parse(import_fs.default.readFileSync(DB_PATH, "utf-8"));
    const merged = { ...emptySchema(), ...parsed };
    merged.site_settings = { ...defaultSiteSettings(), ...parsed.site_settings || {} };
    if (!merged.support_inquiries) merged.support_inquiries = [];
    if (!merged.my_list) merged.my_list = [];
    if (!merged.downloads) merged.downloads = [];
    if (merged.watchlist?.length && merged.my_list.length === 0) {
      for (const w of merged.watchlist) {
        if (!merged.my_list.some((m) => m.user_id === w.user_id && m.movie_id === w.movie_id)) {
          merged.my_list.push({
            user_id: w.user_id,
            movie_id: w.movie_id,
            added_at: w.added_at,
            estimated_bytes: 150 * 1024 * 1024
          });
        }
      }
    }
    merged.users = merged.users.map((u) => ({
      ...u,
      role: u.role || "user",
      status: u.status || "active"
    }));
    return merged;
  } catch (err) {
    console.error(`[db] Failed to parse ${DB_PATH} \u2014 starting from an empty database.`, err);
    return emptySchema();
  }
}
var data = load();
function save() {
  import_fs.default.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}
var db = {
  get data() {
    return data;
  },
  save,
  /** Mints the next unique negative id for a new custom content entry. */
  nextCustomContentId() {
    data.custom_content_seq += 1;
    return -data.custom_content_seq;
  }
};
var db_default = db;

// src/lib/auth.ts
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var COOKIE_NAME = "cinemax_session";
var TOKEN_EXPIRY = "7d";
var TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1e3;
var JWT_SECRET = process.env.JWT_SECRET || (() => {
  return import_crypto.default.randomBytes(32).toString("hex");
})();
var DEFAULT_PREFERENCES = {
  autoplayNext: true,
  autoplayTrailers: true,
  defaultQuality: "Auto",
  subtitleLanguage: "Off",
  audioLanguage: "English",
  notifyNewReleases: true,
  notifyRecommendations: false,
  matureContentLock: false,
  appLanguage: "English"
};
function publicUser(u) {
  let preferences = DEFAULT_PREFERENCES;
  try {
    preferences = { ...DEFAULT_PREFERENCES, ...JSON.parse(u.preferences || "{}") };
  } catch {
  }
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatar: u.avatar,
    banner: u.banner,
    subscription: u.subscription,
    role: u.role,
    status: u.status,
    preferences,
    createdAt: u.created_at
  };
}
function isValidEmail(email) {
  const normalized = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(normalized)) return false;
  if (normalized.length > 254) return false;
  const [local, domain] = normalized.split("@");
  if (!local || !domain || local.length > 64) return false;
  if (domain.includes("..") || local.startsWith(".") || local.endsWith(".")) return false;
  return isRealEmailDomain(domain);
}
var DISPOSABLE_DOMAINS = /* @__PURE__ */ new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "10minutemail.com",
  "throwaway.email",
  "yopmail.com",
  "fakeinbox.com",
  "trashmail.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "sharklasers.com",
  "example.com",
  "test.com",
  "localhost.com"
]);
function isRealEmailDomain(domain) {
  if (DISPOSABLE_DOMAINS.has(domain)) return false;
  const parts = domain.split(".");
  if (parts.length < 2) return false;
  const tld = parts[parts.length - 1];
  if (tld.length < 2) return false;
  return true;
}
function isStrongPassword(password) {
  return typeof password === "string" && password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
}
function getUserByEmail(email) {
  const normalized = email.toLowerCase().trim();
  return db_default.data.users.find((u) => u.email === normalized);
}
function getUserById(id) {
  return db_default.data.users.find((u) => u.id === id);
}
function createUser(email, password, name, passwordHashOverride) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const user = {
    id: import_crypto.default.randomUUID(),
    email: email.toLowerCase().trim(),
    password_hash: passwordHashOverride || import_bcryptjs.default.hashSync(password, 12),
    name: name.trim(),
    avatar: "anim:aurora",
    banner: "",
    subscription: "Free",
    role: "user",
    status: "active",
    preferences: JSON.stringify(DEFAULT_PREFERENCES),
    created_at: now,
    updated_at: now
  };
  db_default.data.users.push(user);
  db_default.save();
  return user;
}
function seedAdminUser() {
  const email = (process.env.ADMIN_EMAIL || "allkikisweb@gmail.com").toLowerCase().trim();
  const password = (process.env.ADMIN_PASSWORD || "").trim();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const existingByEmail = getUserByEmail(email);
  const existingAdmin = db_default.data.users.find((u) => u.role === "admin");
  if (existingByEmail || existingAdmin) {
    const target = existingByEmail || existingAdmin;
    target.email = email;
    target.name = "Cinemax Admin";
    target.role = "admin";
    target.status = "active";
    if (password) {
      target.password_hash = import_bcryptjs.default.hashSync(password, 12);
    }
    target.updated_at = now;
    db_default.save();
    if (password) {
      console.warn(`[startup] Admin account ready for email/password sign-in (${email}).`);
    } else {
      console.warn(
        `[startup] Admin account ready for OTP-only sign-in (${email}). Set ADMIN_PASSWORD in .env to allow password-based admin login.`
      );
    }
    return;
  }
  const passwordHash = password ? import_bcryptjs.default.hashSync(password, 12) : import_bcryptjs.default.hashSync(import_crypto.default.randomBytes(32).toString("hex"), 12);
  const admin = {
    id: import_crypto.default.randomUUID(),
    email,
    password_hash: passwordHash,
    name: "Cinemax Admin",
    avatar: "cartoon:orion",
    banner: "",
    subscription: "Premium",
    role: "admin",
    status: "active",
    preferences: JSON.stringify(DEFAULT_PREFERENCES),
    created_at: now,
    updated_at: now
  };
  db_default.data.users.push(admin);
  db_default.save();
  if (password) {
    console.warn(`[startup] Seeded admin account for email/password sign-in (${email}).`);
  } else {
    console.warn(
      `[startup] Seeded the initial admin account (${email}). Set ADMIN_PASSWORD in .env to allow password-based admin login.`
    );
  }
}
function verifyPassword(user, password) {
  return import_bcryptjs.default.compareSync(password, user.password_hash);
}
var OTP_TTL_MS = 10 * 60 * 1e3;
var OTP_RESEND_COOLDOWN_MS = 60 * 1e3;
var OTP_MAX_ATTEMPTS = 5;
var otpStore = /* @__PURE__ */ new Map();
var signupVerifyStore = /* @__PURE__ */ new Map();
var passwordResetStore = /* @__PURE__ */ new Map();
function isAdminEmail(email) {
  const normalized = email.toLowerCase().trim();
  const user = getUserByEmail(normalized);
  return !!user && user.role === "admin";
}
function getAdminLoginMethod(email) {
  if (!isAdminEmail(email)) return "password";
  if ((process.env.ADMIN_PASSWORD || "").trim()) return "password";
  return "otp";
}
function canSendOtp(email) {
  const record = otpStore.get(email.toLowerCase().trim());
  if (!record) return { status: "ready" };
  const elapsed = Date.now() - record.lastSentAt;
  if (elapsed < OTP_RESEND_COOLDOWN_MS) {
    return { status: "cooldown", retryAfterMs: OTP_RESEND_COOLDOWN_MS - elapsed };
  }
  return { status: "ready" };
}
function issueOtp(email) {
  const normalized = email.toLowerCase().trim();
  const otp = import_crypto.default.randomInt(0, 1e6).toString().padStart(6, "0");
  otpStore.set(normalized, {
    hash: import_bcryptjs.default.hashSync(otp, 10),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: Date.now()
  });
  return otp;
}
function verifyOtp(email, code) {
  const normalized = email.toLowerCase().trim();
  const record = otpStore.get(normalized);
  if (!record) return "not_found";
  if (Date.now() > record.expiresAt) {
    otpStore.delete(normalized);
    return "expired";
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    otpStore.delete(normalized);
    return "too_many_attempts";
  }
  record.attempts += 1;
  if (!import_bcryptjs.default.compareSync(String(code || ""), record.hash)) {
    return "invalid";
  }
  otpStore.delete(normalized);
  return "ok";
}
function issueSignupVerification(email, name, password) {
  const normalized = email.toLowerCase().trim();
  const otp = import_crypto.default.randomInt(0, 1e6).toString().padStart(6, "0");
  signupVerifyStore.set(normalized, {
    hash: import_bcryptjs.default.hashSync(otp, 10),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: Date.now(),
    name: name.trim(),
    passwordHash: import_bcryptjs.default.hashSync(password, 12)
  });
  return otp;
}
function verifySignupCode(email, code) {
  const normalized = email.toLowerCase().trim();
  const record = signupVerifyStore.get(normalized);
  if (!record) return { status: "not_found" };
  if (Date.now() > record.expiresAt) {
    signupVerifyStore.delete(normalized);
    return { status: "expired" };
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    signupVerifyStore.delete(normalized);
    return { status: "too_many_attempts" };
  }
  record.attempts += 1;
  if (!import_bcryptjs.default.compareSync(String(code || ""), record.hash)) {
    return { status: "invalid" };
  }
  signupVerifyStore.delete(normalized);
  return { status: "ok", name: record.name, passwordHash: record.passwordHash };
}
function issuePasswordReset(email) {
  const normalized = email.toLowerCase().trim();
  const token = import_crypto.default.randomBytes(32).toString("hex");
  passwordResetStore.set(normalized, {
    hash: import_bcryptjs.default.hashSync(token, 10),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: Date.now()
  });
  return token;
}
function verifyPasswordResetToken(email, token) {
  const normalized = email.toLowerCase().trim();
  const record = passwordResetStore.get(normalized);
  if (!record) return "not_found";
  if (Date.now() > record.expiresAt) {
    passwordResetStore.delete(normalized);
    return "expired";
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    passwordResetStore.delete(normalized);
    return "too_many_attempts";
  }
  record.attempts += 1;
  if (!import_bcryptjs.default.compareSync(String(token || ""), record.hash)) return "invalid";
  return "ok";
}
function consumePasswordReset(email) {
  passwordResetStore.delete(email.toLowerCase().trim());
}
function updatePasswordHash(userId, newPassword) {
  const user = getUserById(userId);
  if (!user) return;
  user.password_hash = import_bcryptjs.default.hashSync(newPassword, 10);
  user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
}
function signToken(userId) {
  return import_jsonwebtoken.default.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}
function signPortalToken(userId) {
  return import_jsonwebtoken.default.sign({ sub: userId, purpose: "admin_portal" }, JWT_SECRET, { expiresIn: "15m" });
}
function verifyPortalToken(token) {
  try {
    const payload = import_jsonwebtoken.default.verify(token, JWT_SECRET);
    if (payload.purpose !== "admin_portal" || !payload.sub) return null;
    const user = getUserById(payload.sub);
    if (!user || user.role !== "admin" || user.status !== "active") return null;
    return payload.sub;
  } catch {
    return null;
  }
}
function setSessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: TOKEN_EXPIRY_MS,
    path: "/"
  });
}
function clearSessionCookie(res) {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie(COOKIE_NAME, {
    path: "/",
    sameSite: isProd ? "none" : "lax",
    secure: isProd
  });
}
var ACTIVE_WINDOW_MS = 5 * 60 * 1e3;
var lastSeenAt = /* @__PURE__ */ new Map();
function markSeen(userId) {
  lastSeenAt.set(userId, Date.now());
}
function getActiveSessionCount() {
  const cutoff = Date.now() - ACTIVE_WINDOW_MS;
  let count = 0;
  for (const ts of lastSeenAt.values()) {
    if (ts >= cutoff) count += 1;
  }
  return count;
}
function extractToken(req) {
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (cookieToken) return cookieToken;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice("Bearer ".length).trim();
  return void 0;
}
function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Please sign in to continue." });
    return;
  }
  try {
    const payload = import_jsonwebtoken.default.verify(token, JWT_SECRET);
    const user = getUserById(payload.sub);
    if (!user) {
      res.status(401).json({ error: "Your session is no longer valid. Please sign in again." });
      return;
    }
    if (user.status === "banned") {
      clearSessionCookie(res);
      res.status(403).json({ error: "This account has been banned. Contact support if you believe this is a mistake." });
      return;
    }
    if (user.status === "suspended") {
      clearSessionCookie(res);
      res.status(403).json({ error: "This account is currently suspended." });
      return;
    }
    req.user = user;
    markSeen(user.id);
    next();
  } catch {
    res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
}
function getOptionalUserId(req) {
  const token = extractToken(req);
  if (!token) return void 0;
  try {
    const payload = import_jsonwebtoken.default.verify(token, JWT_SECRET);
    const user = getUserById(payload.sub);
    return user && user.status === "active" ? user.id : void 0;
  } catch {
    return void 0;
  }
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Administrator access required." });
    return;
  }
  next();
}
function logActivity(actorEmail, action, target, meta = {}) {
  db_default.data.activity_logs.push({
    id: import_crypto.default.randomUUID(),
    actor_email: actorEmail,
    action,
    target,
    meta: JSON.stringify(meta),
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (db_default.data.activity_logs.length > 500) {
    db_default.data.activity_logs = db_default.data.activity_logs.slice(-500);
  }
  db_default.save();
}

// src/lib/mailer.ts
var import_nodemailer = __toESM(require("nodemailer"), 1);
var EMAIL_USER = process.env.EMAIL_USER || "";
var EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD || "";
var transporter = null;
if (EMAIL_USER && EMAIL_APP_PASSWORD) {
  transporter = import_nodemailer.default.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_APP_PASSWORD
    },
    // Fail fast instead of hanging the request indefinitely if the SMTP
    // connection can't be established (e.g. an egress firewall silently
    // drops the packets rather than rejecting the connection outright).
    connectionTimeout: 1e4,
    greetingTimeout: 1e4,
    socketTimeout: 1e4
  });
} else {
}
function isMailerConfigured() {
  return transporter !== null;
}
async function sendOtpEmail(toEmail, otp) {
  await sendEmail(
    toEmail,
    `Your Cinemax admin login code: ${otp}`,
    `Your one-time login code is ${otp}. It expires in 10 minutes.`,
    buildCodeEmailHtml("Your admin login code", "Enter this code to finish signing in to the Cinemax admin panel.", otp)
  );
}
async function sendSignupVerificationEmail(toEmail, otp) {
  await sendEmail(
    toEmail,
    `Verify your Cinemax account: ${otp}`,
    `Your verification code is ${otp}. It expires in 10 minutes.`,
    buildCodeEmailHtml("Verify your email", "Enter this code to complete your Cinemax sign-up.", otp)
  );
}
async function sendPasswordResetEmail(toEmail, resetToken, baseUrl) {
  const resetUrl = `${baseUrl}?reset=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(toEmail)}`;
  await sendEmail(
    toEmail,
    "Reset your Cinemax password",
    `Reset your password: ${resetUrl}`,
    `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 32px 24px; background:#0a0a0a; border-radius: 16px; color:#fff;">
        <div style="width:40px;height:40px;border-radius:12px;background:#22c55e;display:flex;align-items:center;justify-content:center;font-weight:900;color:#000;font-size:20px;">C</div>
        <h2 style="margin: 20px 0 8px; font-size: 18px;">Reset your password</h2>
        <p style="color:#a3a3a3; font-size: 13px; margin-bottom: 24px;">Click the button below to choose a new password. This link expires in 10 minutes.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#22c55e;color:#000;font-weight:700;padding:12px 24px;border-radius:12px;text-decoration:none;">Reset Password</a>
        <p style="color:#525252; font-size: 11px; margin-top: 24px;">If you didn't request this, ignore this email.</p>
      </div>
    `
  );
}
function buildCodeEmailHtml(title, subtitle, otp) {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 32px 24px; background:#0a0a0a; border-radius: 16px; color:#fff;">
      <div style="width:40px;height:40px;border-radius:12px;background:#22c55e;display:flex;align-items:center;justify-content:center;font-weight:900;color:#000;font-size:20px;">C</div>
      <h2 style="margin: 20px 0 8px; font-size: 18px;">${title}</h2>
      <p style="color:#a3a3a3; font-size: 13px; margin-bottom: 24px;">${subtitle} It expires in 10 minutes.</p>
      <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; background:#141414; border:1px solid #262626; border-radius:12px; padding: 16px; text-align:center;">${otp}</div>
      <p style="color:#525252; font-size: 11px; margin-top: 24px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
}
async function sendEmail(toEmail, subject, text, html) {
  if (!transporter) {
    throw new Error("Email delivery is not configured on the server.");
  }
  await transporter.sendMail({
    from: `"Cinemax" <${EMAIL_USER}>`,
    to: toEmail,
    subject,
    text,
    html
  });
}

// src/routes/website.ts
var LIST_STORAGE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;
var DOWNLOAD_STORAGE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;
var DEFAULT_ITEM_BYTES = 150 * 1024 * 1024;
var authRouter = (0, import_express.Router)();
function getUserExtras(userId) {
  const myList = (db_default.data.my_list || []).filter((w) => w.user_id === userId).sort((a, b) => a.added_at < b.added_at ? 1 : -1).map((w) => w.movie_id);
  const favorites = db_default.data.favorites.filter((f) => f.user_id === userId).sort((a, b) => a.added_at < b.added_at ? 1 : -1).map((f) => f.movie_id);
  const watchHistory = db_default.data.watch_history.filter((h) => h.user_id === userId).sort((a, b) => a.watched_at < b.watched_at ? 1 : -1).slice(0, 50);
  const watchlist = watchHistory.filter((h) => h.progress > 0 && h.progress < 100).map((h) => h.movie_id);
  const downloads = (db_default.data.downloads || []).filter((d) => d.user_id === userId).sort((a, b) => a.added_at < b.added_at ? 1 : -1);
  const listStorageUsed = computeListStorageUsed(userId);
  const downloadStorageUsed = downloads.reduce((sum, d) => sum + (d.size_bytes || 0), 0);
  return { myList, watchlist, favorites, watchHistory, downloads, listStorageUsed, listStorageLimit: LIST_STORAGE_LIMIT_BYTES, downloadStorageUsed, downloadStorageLimit: DOWNLOAD_STORAGE_LIMIT_BYTES };
}
function computeListStorageUsed(userId) {
  let total = 0;
  for (const item of (db_default.data.my_list || []).filter((m) => m.user_id === userId)) {
    total += item.estimated_bytes || DEFAULT_ITEM_BYTES;
  }
  for (const item of db_default.data.favorites.filter((f) => f.user_id === userId)) {
    total += DEFAULT_ITEM_BYTES;
  }
  for (const item of db_default.data.watch_history.filter((h) => h.user_id === userId && h.progress > 0)) {
    total += DEFAULT_ITEM_BYTES;
  }
  return total;
}
function userWithExtras(u) {
  return { ...publicUser(u), ...getUserExtras(u.id) };
}
authRouter.post("/api/auth/signup/request", async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: "Please enter a valid, real email address." });
    return;
  }
  if (!isStrongPassword(password || "")) {
    res.status(400).json({ error: "Password must be at least 8 characters with uppercase, lowercase, and a number." });
    return;
  }
  if (getUserByEmail(email)) {
    res.status(409).json({ error: "An account with this email already exists. Try signing in instead." });
    return;
  }
  if (!isMailerConfigured()) {
    res.status(503).json({ error: "Email verification isn't configured yet. Contact support." });
    return;
  }
  const otp = issueSignupVerification(email, name || email.split("@")[0], password);
  try {
    await sendSignupVerificationEmail(email.toLowerCase().trim(), otp);
  } catch (err) {
    console.error("[auth] Failed to send signup verification:", err);
    res.status(502).json({ error: "Couldn't send verification email. Please try again." });
    return;
  }
  res.json({ ok: true, message: "Verification code sent to your email." });
});
authRouter.post("/api/auth/signup/verify", (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !isValidEmail(email) || !otp) {
    res.status(400).json({ error: "Email and verification code are required." });
    return;
  }
  const result = verifySignupCode(email, String(otp));
  if (result.status === "not_found") {
    res.status(400).json({ error: "Request a new verification code first." });
    return;
  }
  if (result.status === "expired") {
    res.status(400).json({ error: "That code has expired. Please request a new one." });
    return;
  }
  if (result.status === "too_many_attempts") {
    res.status(429).json({ error: "Too many incorrect attempts. Request a new code." });
    return;
  }
  if (result.status === "invalid") {
    res.status(401).json({ error: "Incorrect verification code." });
    return;
  }
  if (result.status !== "ok") {
    res.status(400).json({ error: "Verification failed." });
    return;
  }
  if (getUserByEmail(email)) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }
  const user = createUser(email, "", result.name, result.passwordHash);
  const token = signToken(user.id);
  setSessionCookie(res, token);
  res.status(201).json({ user: userWithExtras(user) });
  db_default.data.notifications.push({
    id: import_crypto2.default.randomUUID(),
    user_id: user.id,
    type: "account",
    title: "Welcome to Cinemax",
    message: "Your account is verified and ready. Explore trending titles and build your lists.",
    read: 0,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  db_default.save();
});
authRouter.post("/api/auth/signup", (req, res) => {
  res.status(400).json({ error: "Please verify your email first. Use signup/request then signup/verify." });
});
authRouter.post("/api/auth/forgot-password/check-email", (req, res) => {
  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  const normalized = email.toLowerCase().trim();
  const user = getUserByEmail(normalized);
  if (!user || user.role === "admin") {
    res.json({ found: false });
    return;
  }
  res.json({ found: true });
});
authRouter.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  const normalized = email.toLowerCase().trim();
  const user = getUserByEmail(normalized);
  if (!user || user.role === "admin") {
    res.status(404).json({ error: "No account found with this email address." });
    return;
  }
  const token = issuePasswordReset(normalized);
  if (!isMailerConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[auth] Mailer not configured; returning a local reset token for development.");
      res.json({ ok: true, message: "Reset code generated locally because email delivery is unavailable.", resetToken: token });
      return;
    }
    res.status(503).json({ error: "Password reset email isn't configured yet." });
    return;
  }
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  try {
    await sendPasswordResetEmail(normalized, token, baseUrl);
  } catch (err) {
    console.error("[auth] Failed to send password reset:", err);
    res.status(502).json({ error: "Couldn't send reset email. Please try again." });
    return;
  }
  res.json({ ok: true, message: "Reset code sent. Check your email." });
});
authRouter.post("/api/auth/reset-password", (req, res) => {
  const { email, token, newPassword } = req.body || {};
  if (!email || !isValidEmail(email) || !token) {
    res.status(400).json({ error: "Email and reset token are required." });
    return;
  }
  if (!isStrongPassword(newPassword || "")) {
    res.status(400).json({ error: "Password must be at least 8 characters with uppercase, lowercase, and a number." });
    return;
  }
  const result = verifyPasswordResetToken(email, String(token));
  if (result === "not_found") {
    res.status(400).json({ error: "Invalid or expired reset link." });
    return;
  }
  if (result === "expired") {
    res.status(400).json({ error: "Reset link has expired. Request a new one." });
    return;
  }
  if (result === "too_many_attempts" || result === "invalid") {
    res.status(401).json({ error: "Invalid reset link." });
    return;
  }
  const user = getUserByEmail(email);
  if (!user) {
    res.status(404).json({ error: "Account not found." });
    return;
  }
  updatePasswordHash(user.id, newPassword);
  consumePasswordReset(email);
  res.json({ ok: true, message: "Password updated. You can sign in now." });
});
authRouter.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }
  const user = getUserByEmail(email);
  if (!user || !verifyPassword(user, password)) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }
  if (user.status === "banned") {
    res.status(403).json({ error: "This account has been banned. Contact support if you believe this is a mistake." });
    return;
  }
  if (user.status === "suspended") {
    res.status(403).json({ error: "This account is currently suspended." });
    return;
  }
  const token = signToken(user.id);
  setSessionCookie(res, token);
  res.json({ user: userWithExtras(user), token });
});
authRouter.post("/api/auth/login/method", (req, res) => {
  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  res.json({ method: getAdminLoginMethod(email) });
});
authRouter.post("/api/auth/otp/request", async (req, res) => {
  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  const normalized = String(email).toLowerCase().trim();
  if (!isAdminEmail(normalized)) {
    res.status(403).json({ error: "OTP sign-in isn't available for this account." });
    return;
  }
  const user = getUserByEmail(normalized);
  if (user.status === "banned") {
    res.status(403).json({ error: "This account has been banned. Contact support if you believe this is a mistake." });
    return;
  }
  if (user.status === "suspended") {
    res.status(403).json({ error: "This account is currently suspended." });
    return;
  }
  const cooldown = canSendOtp(normalized);
  if (cooldown.status === "cooldown") {
    res.status(429).json({ error: `Please wait ${Math.ceil(cooldown.retryAfterMs / 1e3)}s before requesting another code.` });
    return;
  }
  if (!isMailerConfigured()) {
    res.status(503).json({ error: "Email delivery isn't configured on the server yet." });
    return;
  }
  const otp = issueOtp(normalized);
  try {
    await sendOtpEmail(normalized, otp);
  } catch (err) {
    console.error("[auth] Failed to send admin OTP email:", err);
    res.status(502).json({ error: "Couldn't send the code right now. Please try again in a moment." });
    return;
  }
  res.json({ ok: true, message: "A one-time code has been sent to your email." });
});
authRouter.post("/api/auth/otp/verify", (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !isValidEmail(email) || !otp) {
    res.status(400).json({ error: "Email and code are required." });
    return;
  }
  const normalized = String(email).toLowerCase().trim();
  if (!isAdminEmail(normalized)) {
    res.status(403).json({ error: "OTP sign-in isn't available for this account." });
    return;
  }
  const result = verifyOtp(normalized, String(otp));
  if (result === "not_found") {
    res.status(400).json({ error: "Request a new code first." });
    return;
  }
  if (result === "expired") {
    res.status(400).json({ error: "That code has expired. Please request a new one." });
    return;
  }
  if (result === "too_many_attempts") {
    res.status(429).json({ error: "Too many incorrect attempts. Please request a new code." });
    return;
  }
  if (result === "invalid") {
    res.status(401).json({ error: "Incorrect code. Please try again." });
    return;
  }
  const user = getUserByEmail(normalized);
  if (user.status === "banned") {
    res.status(403).json({ error: "This account has been banned. Contact support if you believe this is a mistake." });
    return;
  }
  if (user.status === "suspended") {
    res.status(403).json({ error: "This account is currently suspended." });
    return;
  }
  const token = signToken(user.id);
  setSessionCookie(res, token);
  res.json({ user: userWithExtras(user), token });
});
authRouter.post("/api/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});
authRouter.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: userWithExtras(req.user) });
});
authRouter.get("/api/auth/admin-portal-url", requireAuth, (req, res) => {
  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Admin access only." });
    return;
  }
  const portalToken = signPortalToken(req.user.id);
  const base = (process.env.ADMIN_PANEL_URL || process.env.VITE_ADMIN_PANEL_URL || "http://localhost:5174").replace(/\/$/, "");
  res.json({ url: `${base}?token=${encodeURIComponent(portalToken)}` });
});
authRouter.post("/api/auth/portal/exchange", (req, res) => {
  const { token } = req.body || {};
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Secure link token is required." });
    return;
  }
  const userId = verifyPortalToken(token);
  if (!userId) {
    res.status(401).json({ error: "This secure link is invalid or has expired. Sign in from the website or use your admin credentials." });
    return;
  }
  const user = getUserById(userId);
  const sessionToken = signToken(user.id);
  res.json({ user: userWithExtras(user), token: sessionToken });
});
authRouter.post("/api/support/inquiries", (req, res) => {
  const subject = String(req.body?.subject || "").trim();
  const message = String(req.body?.message || "").trim();
  const guestName = String(req.body?.name || "").trim();
  const guestEmail = String(req.body?.email || "").trim();
  if (!subject || subject.length < 3) {
    res.status(400).json({ error: "Please enter a subject (at least 3 characters)." });
    return;
  }
  if (!message || message.length < 10) {
    res.status(400).json({ error: "Please describe your issue in at least 10 characters." });
    return;
  }
  if (subject.length > 200 || message.length > 5e3) {
    res.status(400).json({ error: "Subject or message is too long." });
    return;
  }
  const authedUserId = getOptionalUserId(req);
  let userName = guestName || "Guest";
  let userEmail = guestEmail;
  if (authedUserId) {
    const authed = getUserById(authedUserId);
    if (authed) {
      userName = authed.name;
      userEmail = authed.email;
    }
  } else {
    if (!isValidEmail(userEmail)) {
      res.status(400).json({ error: "Please sign in or provide a valid email address." });
      return;
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const inquiry = {
    id: import_crypto2.default.randomUUID(),
    user_id: authedUserId,
    user_name: userName,
    user_email: userEmail,
    subject,
    message,
    status: "open",
    admin_reply: null,
    created_at: now,
    updated_at: now
  };
  db_default.data.support_inquiries.unshift(inquiry);
  db_default.save();
  res.status(201).json({ ok: true, inquiry: { id: inquiry.id, created_at: inquiry.created_at } });
});
authRouter.put("/api/auth/profile", requireAuth, (req, res) => {
  const { name, email } = req.body || {};
  const user = req.user;
  const nextName = (name ?? user.name).trim();
  const nextEmail = (email ?? user.email).trim();
  if (!nextName) {
    res.status(400).json({ error: "Display name cannot be empty." });
    return;
  }
  if (!isValidEmail(nextEmail)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  if (nextEmail.toLowerCase() !== user.email) {
    const conflict = getUserByEmail(nextEmail);
    if (conflict) {
      res.status(409).json({ error: "That email is already in use by another account." });
      return;
    }
  }
  user.name = nextName;
  user.email = nextEmail.toLowerCase();
  user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  res.json({ user: userWithExtras(getUserById(user.id)) });
});
authRouter.put("/api/auth/password", requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = req.user;
  if (!verifyPassword(user, currentPassword || "")) {
    res.status(401).json({ error: "Current password is incorrect." });
    return;
  }
  if (!newPassword || !isStrongPassword(newPassword)) {
    res.status(400).json({ error: "New password must be at least 8 characters with uppercase, lowercase, and a number." });
    return;
  }
  updatePasswordHash(user.id, newPassword);
  res.json({ ok: true });
});
authRouter.put("/api/auth/avatar", requireAuth, (req, res) => {
  const { avatar, banner } = req.body || {};
  const MAX_AVATAR_BYTES = 6e5;
  if (typeof avatar === "string" && avatar.length > MAX_AVATAR_BYTES) {
    return res.status(400).json({ error: "Profile image is too large. Please use a photo under 500 KB." });
  }
  if (typeof banner === "string" && banner.length > MAX_AVATAR_BYTES) {
    return res.status(400).json({ error: "Banner image is too large." });
  }
  const user = req.user;
  user.avatar = avatar ?? user.avatar;
  user.banner = banner ?? user.banner;
  user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  res.json({ user: userWithExtras(getUserById(user.id)) });
});
authRouter.put("/api/auth/preferences", requireAuth, (req, res) => {
  const user = req.user;
  let current = {};
  try {
    current = JSON.parse(user.preferences || "{}");
  } catch {
  }
  const merged = { ...current, ...req.body || {} };
  user.preferences = JSON.stringify(merged);
  user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  res.json({ user: userWithExtras(getUserById(user.id)) });
});
authRouter.delete("/api/auth/account", requireAuth, (req, res) => {
  const userId = req.user.id;
  db_default.data.users = db_default.data.users.filter((u) => u.id !== userId);
  db_default.data.watchlist = db_default.data.watchlist.filter((w) => w.user_id !== userId);
  db_default.data.my_list = (db_default.data.my_list || []).filter((w) => w.user_id !== userId);
  db_default.data.downloads = (db_default.data.downloads || []).filter((d) => d.user_id !== userId);
  db_default.data.favorites = db_default.data.favorites.filter((f) => f.user_id !== userId);
  db_default.data.watch_history = db_default.data.watch_history.filter((h) => h.user_id !== userId);
  db_default.data.notifications = db_default.data.notifications.filter((n) => n.user_id !== userId);
  db_default.save();
  clearSessionCookie(res);
  res.json({ ok: true });
});
authRouter.post("/api/auth/clear-cache", requireAuth, (req, res) => {
  const userId = req.user.id;
  db_default.data.my_list = (db_default.data.my_list || []).filter((w) => w.user_id !== userId);
  db_default.data.downloads = (db_default.data.downloads || []).filter((d) => d.user_id !== userId);
  db_default.data.favorites = db_default.data.favorites.filter((f) => f.user_id !== userId);
  db_default.data.watch_history = db_default.data.watch_history.filter((h) => h.user_id !== userId);
  db_default.data.notifications = db_default.data.notifications.filter((n) => n.user_id !== userId);
  db_default.data.watchlist = db_default.data.watchlist.filter((w) => w.user_id !== userId);
  db_default.save();
  res.json({ ok: true, user: userWithExtras(getUserById(userId)) });
});
authRouter.get("/api/comments/:movieId", (req, res) => {
  const movieId = Number(req.params.movieId);
  const comments = db_default.data.comments.filter((c) => c.movie_id === movieId && c.status === "approved").sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  res.json({ comments });
});
authRouter.post("/api/comments", requireAuth, (req, res) => {
  const { movieId, movieTitle, text, rating } = req.body || {};
  if (!movieId || !text || !String(text).trim()) {
    res.status(400).json({ error: "movieId and text are required." });
    return;
  }
  const comment = {
    id: import_crypto2.default.randomUUID(),
    movie_id: Number(movieId),
    movie_title: movieTitle || null,
    user_id: req.user.id,
    user_name: req.user.name,
    text: String(text).trim().slice(0, 2e3),
    rating: rating != null ? Number(rating) : null,
    status: "pending",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  db_default.data.comments.push(comment);
  db_default.save();
  res.status(201).json({ comment });
});
authRouter.get("/api/categories/hidden", (_req, res) => {
  const hiddenIds = db_default.data.category_overrides.filter((c) => c.hidden).map((c) => c.genre_id);
  res.json({ hiddenIds });
});
authRouter.get("/api/categories/public", (_req, res) => {
  const overrides = db_default.data.category_overrides;
  res.json({
    hiddenIds: overrides.filter((c) => c.hidden).map((c) => c.genre_id),
    labels: Object.fromEntries(
      overrides.filter((c) => c.label).map((c) => [String(c.genre_id), c.label])
    )
  });
});
authRouter.get("/api/content/custom", (_req, res) => {
  const movies = db_default.data.custom_content.map((c) => ({
    id: c.numeric_id,
    title: c.title,
    overview: c.overview,
    poster_path: c.poster_url,
    backdrop_path: c.backdrop_url,
    vote_average: c.rating,
    release_date: c.release_date || void 0,
    genre_ids: [],
    genres: c.genre_names.map((name, i) => ({ id: i, name })),
    media_type: c.media_type,
    isCustom: true,
    trailerYoutubeKey: c.trailer_youtube_key || void 0,
    featured: c.featured
  }));
  res.json({ movies });
});
authRouter.get("/api/my-list", requireAuth, (req, res) => {
  res.json({ movieIds: getUserExtras(req.user.id).myList });
});
authRouter.post("/api/my-list", requireAuth, (req, res) => {
  const { movieId } = req.body || {};
  if (!movieId) {
    res.status(400).json({ error: "movieId is required." });
    return;
  }
  const userId = req.user.id;
  const used = computeListStorageUsed(userId);
  if (used + DEFAULT_ITEM_BYTES > LIST_STORAGE_LIMIT_BYTES) {
    res.status(413).json({ error: "List storage full (2GB limit). Remove items from My List, Favorites, or Watchlist to free space." });
    return;
  }
  const exists = (db_default.data.my_list || []).some((w) => w.user_id === userId && w.movie_id === movieId);
  if (!exists) {
    if (!db_default.data.my_list) db_default.data.my_list = [];
    db_default.data.my_list.push({
      user_id: userId,
      movie_id: movieId,
      added_at: (/* @__PURE__ */ new Date()).toISOString(),
      estimated_bytes: DEFAULT_ITEM_BYTES
    });
    db_default.save();
  }
  res.status(201).json({ ok: true });
});
authRouter.delete("/api/my-list/:movieId", requireAuth, (req, res) => {
  const userId = req.user.id;
  const movieId = Number(req.params.movieId);
  db_default.data.my_list = (db_default.data.my_list || []).filter((w) => !(w.user_id === userId && w.movie_id === movieId));
  db_default.save();
  res.json({ ok: true });
});
authRouter.get("/api/watchlist", requireAuth, (req, res) => {
  res.json({ movieIds: getUserExtras(req.user.id).watchlist });
});
authRouter.post("/api/watchlist", requireAuth, (req, res) => {
  const { movieId } = req.body || {};
  if (!movieId) {
    res.status(400).json({ error: "movieId is required." });
    return;
  }
  req.body = { movieId };
  const userId = req.user.id;
  const used = computeListStorageUsed(userId);
  if (used + DEFAULT_ITEM_BYTES > LIST_STORAGE_LIMIT_BYTES) {
    res.status(413).json({ error: "List storage full (2GB limit). Remove items to free space." });
    return;
  }
  if (!db_default.data.my_list) db_default.data.my_list = [];
  const exists = db_default.data.my_list.some((w) => w.user_id === userId && w.movie_id === movieId);
  if (!exists) {
    db_default.data.my_list.push({
      user_id: userId,
      movie_id: movieId,
      added_at: (/* @__PURE__ */ new Date()).toISOString(),
      estimated_bytes: DEFAULT_ITEM_BYTES
    });
    db_default.save();
  }
  res.status(201).json({ ok: true });
});
authRouter.delete("/api/watchlist/:movieId", requireAuth, (req, res) => {
  const userId = req.user.id;
  const movieId = Number(req.params.movieId);
  db_default.data.my_list = (db_default.data.my_list || []).filter((w) => !(w.user_id === userId && w.movie_id === movieId));
  db_default.save();
  res.json({ ok: true });
});
authRouter.get("/api/downloads", requireAuth, (req, res) => {
  const extras = getUserExtras(req.user.id);
  res.json({
    downloads: extras.downloads,
    storageUsed: extras.downloadStorageUsed,
    storageLimit: DOWNLOAD_STORAGE_LIMIT_BYTES
  });
});
authRouter.post("/api/downloads", requireAuth, (req, res) => {
  const { movieId, title, poster, sizeBytes, mediaType } = req.body || {};
  if (!movieId) {
    res.status(400).json({ error: "movieId is required." });
    return;
  }
  const userId = req.user.id;
  const size = Number(sizeBytes) || DEFAULT_ITEM_BYTES;
  if (size > DOWNLOAD_STORAGE_LIMIT_BYTES) {
    res.status(413).json({ error: "Single download cannot exceed 2GB." });
    return;
  }
  const extras = getUserExtras(userId);
  if (extras.downloadStorageUsed + size > DOWNLOAD_STORAGE_LIMIT_BYTES) {
    res.status(413).json({ error: "Download storage full (2GB). Delete downloads to free space." });
    return;
  }
  if (!db_default.data.downloads) db_default.data.downloads = [];
  const exists = db_default.data.downloads.some((d) => d.user_id === userId && d.movie_id === movieId);
  if (!exists) {
    db_default.data.downloads.push({
      user_id: userId,
      movie_id: movieId,
      title: title || "Untitled",
      poster: poster || null,
      size_bytes: size,
      added_at: (/* @__PURE__ */ new Date()).toISOString(),
      media_type: mediaType === "tv" ? "tv" : "movie"
    });
    db_default.save();
  }
  res.status(201).json({
    ok: true,
    storageUsed: getUserExtras(userId).downloadStorageUsed,
    storageLimit: DOWNLOAD_STORAGE_LIMIT_BYTES,
    downloads: getUserExtras(userId).downloads
  });
});
authRouter.delete("/api/downloads/:movieId", requireAuth, (req, res) => {
  const userId = req.user.id;
  const movieId = Number(req.params.movieId);
  db_default.data.downloads = (db_default.data.downloads || []).filter((d) => !(d.user_id === userId && d.movie_id === movieId));
  db_default.save();
  res.json({
    ok: true,
    storageUsed: getUserExtras(userId).downloadStorageUsed,
    storageLimit: DOWNLOAD_STORAGE_LIMIT_BYTES,
    downloads: getUserExtras(userId).downloads
  });
});
authRouter.get("/api/config/public", (_req, res) => {
  const settings = db_default.data.site_settings;
  res.json({
    tmdbApiKey: settings.apiKeys?.tmdb || process.env.TMDB_API_KEY || "",
    siteName: settings.siteName,
    heroTagline: settings.heroTagline,
    maintenanceMode: settings.maintenanceMode,
    featuredMovieIds: settings.featuredMovieIds || [],
    trendingOverrideIds: settings.trendingOverrideIds || [],
    hiddenMovieIds: settings.hiddenMovieIds || [],
    homepageSections: settings.homepageSections || [],
    contentPages: settings.contentPages || {}
  });
});
authRouter.get("/api/ads/public", (_req, res) => {
  const ads = db_default.data.ads.filter((a) => a.active).map((a) => ({
    id: a.id,
    title: a.title,
    image_url: a.image_url,
    target_url: a.target_url,
    placement: a.placement
  }));
  res.json({ ads });
});
authRouter.get("/api/favorites", requireAuth, (req, res) => {
  res.json({ movieIds: getUserExtras(req.user.id).favorites });
});
authRouter.post("/api/favorites", requireAuth, (req, res) => {
  const { movieId } = req.body || {};
  if (!movieId) {
    res.status(400).json({ error: "movieId is required." });
    return;
  }
  const userId = req.user.id;
  const used = computeListStorageUsed(userId);
  if (used + DEFAULT_ITEM_BYTES > LIST_STORAGE_LIMIT_BYTES) {
    res.status(413).json({ error: "List storage full (2GB limit). Remove items to free space." });
    return;
  }
  const exists = db_default.data.favorites.some((f) => f.user_id === userId && f.movie_id === movieId);
  if (!exists) {
    db_default.data.favorites.push({ user_id: userId, movie_id: movieId, added_at: (/* @__PURE__ */ new Date()).toISOString() });
    db_default.save();
  }
  res.status(201).json({ ok: true });
});
authRouter.delete("/api/favorites/:movieId", requireAuth, (req, res) => {
  const userId = req.user.id;
  const movieId = Number(req.params.movieId);
  db_default.data.favorites = db_default.data.favorites.filter((f) => !(f.user_id === userId && f.movie_id === movieId));
  db_default.save();
  res.json({ ok: true });
});
authRouter.get("/api/notifications", requireAuth, (req, res) => {
  const notifications = db_default.data.notifications.filter((n) => n.user_id === req.user.id).sort((a, b) => a.created_at < b.created_at ? 1 : -1).slice(0, 50);
  res.json({ notifications });
});
authRouter.post("/api/notifications", requireAuth, (req, res) => {
  const { type, title, message } = req.body || {};
  if (!type || !title || !message) {
    res.status(400).json({ error: "type, title, and message are required." });
    return;
  }
  const id = import_crypto2.default.randomUUID();
  db_default.data.notifications.push({
    id,
    user_id: req.user.id,
    type,
    title,
    message,
    read: 0,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  db_default.save();
  res.status(201).json({ id });
});
authRouter.put("/api/notifications/:id/read", requireAuth, (req, res) => {
  const n = db_default.data.notifications.find((n2) => n2.id === req.params.id && n2.user_id === req.user.id);
  if (n) {
    n.read = 1;
    db_default.save();
  }
  res.json({ ok: true });
});
authRouter.put("/api/notifications/read-all", requireAuth, (req, res) => {
  db_default.data.notifications.forEach((n) => {
    if (n.user_id === req.user.id) n.read = 1;
  });
  db_default.save();
  res.json({ ok: true });
});
authRouter.delete("/api/notifications", requireAuth, (req, res) => {
  db_default.data.notifications = db_default.data.notifications.filter((n) => n.user_id !== req.user.id);
  db_default.save();
  res.json({ ok: true });
});
authRouter.get("/api/watch-history", requireAuth, (req, res) => {
  res.json({ history: getUserExtras(req.user.id).watchHistory });
});
authRouter.post("/api/watch-history", requireAuth, (req, res) => {
  const { movieId, title, poster, mediaType, duration, season, episode } = req.body || {};
  if (!movieId) {
    res.status(400).json({ error: "movieId is required." });
    return;
  }
  const userId = req.user.id;
  const existing = db_default.data.watch_history.find((h) => h.user_id === userId && h.movie_id === movieId);
  if (existing) {
    existing.watched_at = (/* @__PURE__ */ new Date()).toISOString();
  } else {
    db_default.data.watch_history.push({
      user_id: userId,
      movie_id: movieId,
      title: title || null,
      poster: poster || null,
      media_type: mediaType || null,
      duration: duration || 0,
      season: season ?? null,
      episode: episode ?? null,
      progress: 0,
      watched_at: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  db_default.save();
  res.status(201).json({ ok: true });
});
authRouter.put("/api/watch-history/:movieId/progress", requireAuth, (req, res) => {
  const userId = req.user.id;
  const movieId = Number(req.params.movieId);
  const { progress } = req.body || {};
  const existing = db_default.data.watch_history.find((h) => h.user_id === userId && h.movie_id === movieId);
  if (existing) {
    existing.progress = progress ?? 0;
    db_default.save();
  }
  res.json({ ok: true });
});
authRouter.delete("/api/watch-history", requireAuth, (req, res) => {
  db_default.data.watch_history = db_default.data.watch_history.filter((h) => h.user_id !== req.user.id);
  db_default.save();
  res.json({ ok: true });
});
function toPublicChatMessage(m, viewerId) {
  return {
    id: m.id,
    userId: m.user_id,
    userName: m.user_name,
    userAvatar: m.user_avatar,
    text: m.text,
    parentId: m.parent_id,
    likeCount: m.liked_by.length,
    likedByMe: viewerId ? m.liked_by.includes(viewerId) : false,
    createdAt: m.created_at,
    mediaUrl: m.media_url || null,
    mediaType: m.media_type || null
  };
}
function toPublicDirectMessage(m, viewerId) {
  return {
    id: m.id,
    fromUserId: m.from_user_id,
    toUserId: m.to_user_id,
    text: m.text,
    likeCount: m.liked_by.length,
    likedByMe: m.liked_by.includes(viewerId),
    read: m.read,
    createdAt: m.created_at,
    mediaUrl: m.media_url || null,
    mediaType: m.media_type || null
  };
}
var MAX_MEDIA_DATA_URL_LENGTH = 35e5;
authRouter.get("/api/chat/global", (req, res) => {
  const viewerId = getOptionalUserId(req);
  const messages = db_default.data.chat_messages.slice(-500).map((m) => toPublicChatMessage(m, viewerId));
  res.json({ messages });
});
authRouter.post("/api/chat/global", requireAuth, (req, res) => {
  const { text, parentId, mediaUrl, mediaType } = req.body || {};
  const trimmed = String(text || "").trim();
  if (mediaType && mediaType !== "image") {
    res.status(400).json({ error: "Voice messages can only be sent in your Inbox." });
    return;
  }
  if (!trimmed && !mediaUrl) {
    res.status(400).json({ error: "Message text or an image is required." });
    return;
  }
  if (trimmed.length > 1e3) {
    res.status(400).json({ error: "Messages must be 1000 characters or fewer." });
    return;
  }
  if (mediaUrl && (typeof mediaUrl !== "string" || mediaUrl.length > MAX_MEDIA_DATA_URL_LENGTH)) {
    res.status(400).json({ error: "That image is too large to send." });
    return;
  }
  if (parentId && !db_default.data.chat_messages.some((m) => m.id === parentId)) {
    res.status(404).json({ error: "The message you're replying to no longer exists." });
    return;
  }
  const message = {
    id: import_crypto2.default.randomUUID(),
    user_id: req.user.id,
    user_name: req.user.name,
    user_avatar: req.user.avatar,
    text: trimmed,
    parent_id: parentId || null,
    liked_by: [],
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    media_url: mediaUrl ? String(mediaUrl) : null,
    media_type: mediaUrl ? "image" : null
  };
  db_default.data.chat_messages.push(message);
  db_default.save();
  res.status(201).json({ message: toPublicChatMessage(message, req.user.id) });
});
authRouter.post("/api/chat/global/:id/like", requireAuth, (req, res) => {
  const message = db_default.data.chat_messages.find((m) => m.id === req.params.id);
  if (!message) {
    res.status(404).json({ error: "Message not found." });
    return;
  }
  const userId = req.user.id;
  const idx = message.liked_by.indexOf(userId);
  if (idx === -1) message.liked_by.push(userId);
  else message.liked_by.splice(idx, 1);
  db_default.save();
  res.json({ message: toPublicChatMessage(message, userId) });
});
authRouter.delete("/api/chat/global/:id", requireAuth, (req, res) => {
  const message = db_default.data.chat_messages.find((m) => m.id === req.params.id);
  if (!message) {
    res.status(404).json({ error: "Message not found." });
    return;
  }
  if (message.user_id !== req.user.id && req.user.role !== "admin") {
    res.status(403).json({ error: "You can only delete your own messages." });
    return;
  }
  db_default.data.chat_messages = db_default.data.chat_messages.filter((m) => m.id !== req.params.id && m.parent_id !== req.params.id);
  db_default.save();
  res.json({ ok: true });
});
authRouter.get("/api/chat/directory", requireAuth, (req, res) => {
  const people = db_default.data.users.filter((u) => u.id !== req.user.id && u.status === "active").map((u) => ({ id: u.id, name: u.name, avatar: u.avatar }));
  res.json({ people });
});
authRouter.get("/api/chat/conversations", requireAuth, (req, res) => {
  const myId = req.user.id;
  const related = db_default.data.direct_messages.filter((m) => m.from_user_id === myId || m.to_user_id === myId);
  const byPartner = /* @__PURE__ */ new Map();
  for (const m of related) {
    const partnerId = m.from_user_id === myId ? m.to_user_id : m.from_user_id;
    if (!byPartner.has(partnerId)) byPartner.set(partnerId, []);
    byPartner.get(partnerId).push(m);
  }
  const conversations = Array.from(byPartner.entries()).map(([partnerId, msgs]) => {
    const partner = getUserById(partnerId);
    const sorted = msgs.slice().sort((a, b) => a.created_at < b.created_at ? -1 : 1);
    const last = sorted[sorted.length - 1];
    const unreadCount = sorted.filter((m) => m.to_user_id === myId && !m.read).length;
    return {
      userId: partnerId,
      userName: partner?.name || "Deleted user",
      userAvatar: partner?.avatar || "",
      lastMessage: last.text,
      lastMessageAt: last.created_at,
      unreadCount
    };
  }).sort((a, b) => a.lastMessageAt < b.lastMessageAt ? 1 : -1);
  res.json({ conversations });
});
authRouter.get("/api/chat/conversations/:userId", requireAuth, (req, res) => {
  const myId = req.user.id;
  const partnerId = req.params.userId;
  if (!getUserById(partnerId)) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const thread = db_default.data.direct_messages.filter(
    (m) => m.from_user_id === myId && m.to_user_id === partnerId || m.from_user_id === partnerId && m.to_user_id === myId
  ).sort((a, b) => a.created_at < b.created_at ? -1 : 1);
  let changed = false;
  for (const m of thread) {
    if (m.to_user_id === myId && !m.read) {
      m.read = true;
      changed = true;
    }
  }
  if (changed) db_default.save();
  res.json({ messages: thread.map((m) => toPublicDirectMessage(m, myId)) });
});
authRouter.post("/api/chat/conversations/:userId", requireAuth, (req, res) => {
  const myId = req.user.id;
  const partnerId = req.params.userId;
  const partner = getUserById(partnerId);
  if (!partner) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  if (partnerId === myId) {
    res.status(400).json({ error: "You can't message yourself." });
    return;
  }
  const trimmed = String(req.body?.text || "").trim();
  const { mediaUrl, mediaType } = req.body || {};
  if (mediaType && mediaType !== "image" && mediaType !== "audio") {
    res.status(400).json({ error: "Unsupported attachment type." });
    return;
  }
  if (!trimmed && !mediaUrl) {
    res.status(400).json({ error: "Message text or an attachment is required." });
    return;
  }
  if (trimmed.length > 2e3) {
    res.status(400).json({ error: "Messages must be 2000 characters or fewer." });
    return;
  }
  if (mediaUrl && (typeof mediaUrl !== "string" || mediaUrl.length > MAX_MEDIA_DATA_URL_LENGTH)) {
    res.status(400).json({ error: "That attachment is too large to send." });
    return;
  }
  const message = {
    id: import_crypto2.default.randomUUID(),
    from_user_id: myId,
    to_user_id: partnerId,
    text: trimmed,
    liked_by: [],
    read: false,
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    media_url: mediaUrl ? String(mediaUrl) : null,
    media_type: mediaUrl ? mediaType === "audio" ? "audio" : "image" : null
  };
  db_default.data.direct_messages.push(message);
  db_default.save();
  db_default.data.notifications.push({
    id: import_crypto2.default.randomUUID(),
    user_id: partnerId,
    type: "message",
    title: `New message from ${req.user.name}`,
    message: trimmed ? trimmed.slice(0, 120) : mediaType === "audio" ? "\u{1F3A4} Voice message" : "\u{1F4F7} Image",
    read: 0,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  db_default.save();
  res.status(201).json({ message: toPublicDirectMessage(message, myId) });
});
authRouter.post("/api/chat/dm/:id/like", requireAuth, (req, res) => {
  const message = db_default.data.direct_messages.find((m) => m.id === req.params.id);
  if (!message) {
    res.status(404).json({ error: "Message not found." });
    return;
  }
  const myId = req.user.id;
  if (message.from_user_id !== myId && message.to_user_id !== myId) {
    res.status(403).json({ error: "You don't have access to this conversation." });
    return;
  }
  const idx = message.liked_by.indexOf(myId);
  if (idx === -1) message.liked_by.push(myId);
  else message.liked_by.splice(idx, 1);
  db_default.save();
  res.json({ message: toPublicDirectMessage(message, myId) });
});

// src/routes/admin.ts
var import_express2 = require("express");
var import_crypto3 = __toESM(require("crypto"), 1);
var adminRouter = (0, import_express2.Router)();
adminRouter.use("/api/admin", requireAuth, requireAdmin);
adminRouter.get("/api/admin/stats", (_req, res) => {
  const users = db_default.data.users;
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1e3;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1e3;
  const signupsLast7d = users.filter((u) => new Date(u.created_at).getTime() >= sevenDaysAgo).length;
  const signupsLast30d = users.filter((u) => new Date(u.created_at).getTime() >= thirtyDaysAgo).length;
  const dailySignups = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(now - i * 24 * 60 * 60 * 1e3);
    const dayKey = day.toISOString().slice(0, 10);
    const count = users.filter((u) => u.created_at.slice(0, 10) === dayKey).length;
    dailySignups.push({ date: dayKey, count });
  }
  const watchCounts = /* @__PURE__ */ new Map();
  db_default.data.watch_history.forEach((h) => {
    const entry = watchCounts.get(h.movie_id) || { movieId: h.movie_id, title: h.title, poster: h.poster, count: 0 };
    entry.count += 1;
    watchCounts.set(h.movie_id, entry);
  });
  const topWatched = Array.from(watchCounts.values()).sort((a, b) => b.count - a.count).slice(0, 10);
  res.json({
    totalUsers: users.length,
    activeSessions: getActiveSessionCount(),
    activeUsers: users.filter((u) => u.status === "active").length,
    suspendedUsers: users.filter((u) => u.status === "suspended").length,
    bannedUsers: users.filter((u) => u.status === "banned").length,
    adminUsers: users.filter((u) => u.role === "admin").length,
    signupsLast7d,
    signupsLast30d,
    dailySignups,
    totalWatchlistEntries: db_default.data.watchlist.length,
    totalFavoriteEntries: db_default.data.favorites.length,
    totalWatchHistoryEntries: db_default.data.watch_history.length,
    totalComments: db_default.data.comments.length,
    pendingComments: db_default.data.comments.filter((c) => c.status === "pending").length,
    totalNotifications: db_default.data.notifications.length,
    totalAds: db_default.data.ads.length,
    activeAds: db_default.data.ads.filter((a) => a.active).length,
    totalDownloads: (db_default.data.downloads || []).length,
    openInquiries: (db_default.data.support_inquiries || []).filter((i) => i.status === "open").length,
    totalInquiries: (db_default.data.support_inquiries || []).length,
    topWatched
  });
});
adminRouter.post("/api/admin/users", (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !String(name).trim()) {
    res.status(400).json({ error: "Name is required." });
    return;
  }
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: "A valid email is required." });
    return;
  }
  if (!password || String(password).length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }
  if (getUserByEmail(email)) {
    res.status(409).json({ error: "An account with that email already exists." });
    return;
  }
  const user = createUser(email, password, name);
  logActivity(req.user.email, "user.create", user.email);
  res.status(201).json({ user: publicUser(user) });
});
adminRouter.get("/api/admin/users", (req, res) => {
  const { search, status, role, page = "1", pageSize = "25" } = req.query;
  let list = db_default.data.users;
  if (search) {
    const q = search.toLowerCase();
    list = list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }
  if (status) list = list.filter((u) => u.status === status);
  if (role) list = list.filter((u) => u.role === role);
  list = [...list].sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));
  const total = list.length;
  const paged = list.slice((p - 1) * ps, p * ps);
  res.json({
    total,
    page: p,
    pageSize: ps,
    users: paged.map((u) => ({
      ...publicUser(u),
      favoritesCount: db_default.data.favorites.filter((f) => f.user_id === u.id).length,
      watchlistCount: db_default.data.watchlist.filter((w) => w.user_id === u.id).length
    }))
  });
});
adminRouter.put("/api/admin/users/:id", (req, res) => {
  const target = getUserById(req.params.id);
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const { name, email } = req.body || {};
  if (name) target.name = String(name).trim();
  if (email) target.email = String(email).toLowerCase().trim();
  target.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  logActivity(req.user.email, "user.update", target.email, { name, email });
  res.json({ user: publicUser(target) });
});
adminRouter.put("/api/admin/users/:id/status", (req, res) => {
  const target = getUserById(req.params.id);
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const { status } = req.body || {};
  if (!["active", "suspended", "banned"].includes(status)) {
    res.status(400).json({ error: "status must be active, suspended, or banned." });
    return;
  }
  if (target.role === "admin") {
    res.status(400).json({ error: "Administrator accounts cannot be suspended or banned." });
    return;
  }
  target.status = status;
  target.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  logActivity(req.user.email, `user.${status}`, target.email);
  res.json({ user: publicUser(target) });
});
adminRouter.put("/api/admin/users/:id/role", (req, res) => {
  const target = getUserById(req.params.id);
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const { role } = req.body || {};
  if (!["user", "admin"].includes(role)) {
    res.status(400).json({ error: "role must be user or admin." });
    return;
  }
  target.role = role;
  target.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  logActivity(req.user.email, "user.role_change", target.email, { role });
  res.json({ user: publicUser(target) });
});
adminRouter.delete("/api/admin/users/:id", (req, res) => {
  const target = getUserById(req.params.id);
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  if (target.role === "admin") {
    res.status(400).json({ error: "Administrator accounts cannot be deleted from here." });
    return;
  }
  const userId = target.id;
  db_default.data.users = db_default.data.users.filter((u) => u.id !== userId);
  db_default.data.watchlist = db_default.data.watchlist.filter((w) => w.user_id !== userId);
  db_default.data.favorites = db_default.data.favorites.filter((f) => f.user_id !== userId);
  db_default.data.watch_history = db_default.data.watch_history.filter((h) => h.user_id !== userId);
  db_default.data.notifications = db_default.data.notifications.filter((n) => n.user_id !== userId);
  db_default.data.downloads = (db_default.data.downloads || []).filter((d) => d.user_id !== userId);
  db_default.data.my_list = (db_default.data.my_list || []).filter((m) => m.user_id !== userId);
  db_default.save();
  logActivity(req.user.email, "user.delete", target.email);
  res.json({ ok: true });
});
adminRouter.put("/api/admin/users/:id/subscription", (req, res) => {
  const target = getUserById(req.params.id);
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const { subscription } = req.body || {};
  const allowed = ["Free", "Basic", "Standard", "Premium"];
  if (!allowed.includes(subscription)) {
    res.status(400).json({ error: `subscription must be one of: ${allowed.join(", ")}.` });
    return;
  }
  target.subscription = subscription;
  target.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  logActivity(req.user.email, "user.subscription", target.email, { subscription });
  res.json({ user: publicUser(target) });
});
adminRouter.get("/api/admin/users/:id/data", (req, res) => {
  const target = getUserById(req.params.id);
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const userId = target.id;
  res.json({
    user: publicUser(target),
    favorites: db_default.data.favorites.filter((f) => f.user_id === userId).length,
    watchlist: db_default.data.watchlist.filter((w) => w.user_id === userId).length,
    myList: (db_default.data.my_list || []).filter((m) => m.user_id === userId).length,
    watchHistory: db_default.data.watch_history.filter((h) => h.user_id === userId).length,
    downloads: (db_default.data.downloads || []).filter((d) => d.user_id === userId).length,
    notifications: db_default.data.notifications.filter((n) => n.user_id === userId).length,
    comments: db_default.data.comments.filter((c) => c.user_id === userId).length
  });
});
adminRouter.delete("/api/admin/users/:id/data/:kind", (req, res) => {
  const target = getUserById(req.params.id);
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const userId = target.id;
  const kind = req.params.kind;
  switch (kind) {
    case "watch_history":
      db_default.data.watch_history = db_default.data.watch_history.filter((h) => h.user_id !== userId);
      break;
    case "favorites":
      db_default.data.favorites = db_default.data.favorites.filter((f) => f.user_id !== userId);
      break;
    case "watchlist":
      db_default.data.watchlist = db_default.data.watchlist.filter((w) => w.user_id !== userId);
      break;
    case "my_list":
      db_default.data.my_list = (db_default.data.my_list || []).filter((m) => m.user_id !== userId);
      break;
    case "downloads":
      db_default.data.downloads = (db_default.data.downloads || []).filter((d) => d.user_id !== userId);
      break;
    case "notifications":
      db_default.data.notifications = db_default.data.notifications.filter((n) => n.user_id !== userId);
      break;
    default:
      res.status(400).json({ error: "kind must be watch_history, favorites, watchlist, my_list, downloads, or notifications." });
      return;
  }
  db_default.save();
  logActivity(req.user.email, `user.clear_${kind}`, target.email);
  res.json({ ok: true });
});
adminRouter.get("/api/admin/comments", (req, res) => {
  const { status } = req.query;
  let list = db_default.data.comments;
  if (status) list = list.filter((c) => c.status === status);
  list = [...list].sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  res.json({ comments: list });
});
adminRouter.put("/api/admin/comments/:id/status", (req, res) => {
  const comment = db_default.data.comments.find((c) => c.id === req.params.id);
  if (!comment) {
    res.status(404).json({ error: "Comment not found." });
    return;
  }
  const { status } = req.body || {};
  if (!["pending", "approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "status must be pending, approved, or rejected." });
    return;
  }
  comment.status = status;
  db_default.save();
  logActivity(req.user.email, `comment.${status}`, comment.id);
  res.json({ comment });
});
adminRouter.delete("/api/admin/comments/:id", (req, res) => {
  const comment = db_default.data.comments.find((c) => c.id === req.params.id);
  db_default.data.comments = db_default.data.comments.filter((c) => c.id !== req.params.id);
  db_default.save();
  if (comment) logActivity(req.user.email, "comment.delete", comment.id);
  res.json({ ok: true });
});
adminRouter.get("/api/admin/chat", (req, res) => {
  const { search } = req.query;
  let list = [...db_default.data.chat_messages].sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter((m) => m.text.toLowerCase().includes(q) || m.user_name.toLowerCase().includes(q));
  }
  res.json({
    messages: list.slice(0, 200).map((m) => ({
      id: m.id,
      userId: m.user_id,
      userName: m.user_name,
      userAvatar: m.user_avatar,
      text: m.text,
      mediaUrl: m.media_url,
      mediaType: m.media_type,
      createdAt: m.created_at
    }))
  });
});
adminRouter.delete("/api/admin/chat/:id", (req, res) => {
  const message = db_default.data.chat_messages.find((m) => m.id === req.params.id);
  db_default.data.chat_messages = db_default.data.chat_messages.filter((m) => m.id !== req.params.id && m.parent_id !== req.params.id);
  db_default.save();
  if (message) logActivity(req.user.email, "chat.delete", message.id);
  res.json({ ok: true });
});
adminRouter.get("/api/admin/ads", (_req, res) => {
  res.json({ ads: db_default.data.ads });
});
adminRouter.post("/api/admin/ads", (req, res) => {
  const { title, imageUrl, targetUrl, placement } = req.body || {};
  if (!title || !imageUrl || !targetUrl) {
    res.status(400).json({ error: "title, imageUrl, and targetUrl are required." });
    return;
  }
  const ad = {
    id: import_crypto3.default.randomUUID(),
    title,
    image_url: imageUrl,
    target_url: targetUrl,
    placement: placement || "homepage_top",
    active: true,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  db_default.data.ads.push(ad);
  db_default.save();
  logActivity(req.user.email, "ad.create", title);
  res.status(201).json({ ad });
});
adminRouter.put("/api/admin/ads/:id", (req, res) => {
  const ad = db_default.data.ads.find((a) => a.id === req.params.id);
  if (!ad) {
    res.status(404).json({ error: "Ad not found." });
    return;
  }
  const { title, imageUrl, targetUrl, placement, active } = req.body || {};
  if (title !== void 0) ad.title = title;
  if (imageUrl !== void 0) ad.image_url = imageUrl;
  if (targetUrl !== void 0) ad.target_url = targetUrl;
  if (placement !== void 0) ad.placement = placement;
  if (active !== void 0) ad.active = active;
  db_default.save();
  logActivity(req.user.email, "ad.update", ad.title);
  res.json({ ad });
});
adminRouter.delete("/api/admin/ads/:id", (req, res) => {
  const ad = db_default.data.ads.find((a) => a.id === req.params.id);
  db_default.data.ads = db_default.data.ads.filter((a) => a.id !== req.params.id);
  db_default.save();
  if (ad) logActivity(req.user.email, "ad.delete", ad.title);
  res.json({ ok: true });
});
adminRouter.post("/api/admin/notifications/broadcast", (req, res) => {
  const { title, message, type } = req.body || {};
  if (!title || !message) {
    res.status(400).json({ error: "title and message are required." });
    return;
  }
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  db_default.data.users.forEach((u) => {
    db_default.data.notifications.push({
      id: import_crypto3.default.randomUUID(),
      user_id: u.id,
      type: type || "announcement",
      title,
      message,
      read: 0,
      created_at: createdAt
    });
  });
  db_default.save();
  logActivity(req.user.email, "notification.broadcast", title, { recipients: db_default.data.users.length });
  res.status(201).json({ ok: true, recipients: db_default.data.users.length });
});
adminRouter.post("/api/admin/notifications/user", (req, res) => {
  const { userId, title, message, type } = req.body || {};
  if (!userId || !title || !message) {
    res.status(400).json({ error: "userId, title, and message are required." });
    return;
  }
  const target = getUserById(userId);
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  db_default.data.notifications.push({
    id: import_crypto3.default.randomUUID(),
    user_id: target.id,
    type: type || "announcement",
    title,
    message,
    read: 0,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  db_default.save();
  logActivity(req.user.email, "notification.user", target.email, { title });
  res.status(201).json({ ok: true });
});
adminRouter.get("/api/admin/categories", (_req, res) => {
  res.json({ overrides: db_default.data.category_overrides });
});
adminRouter.put("/api/admin/categories/:genreId", (req, res) => {
  const genreId = Number(req.params.genreId);
  const { label, hidden } = req.body || {};
  let override = db_default.data.category_overrides.find((c) => c.genre_id === genreId);
  if (!override) {
    override = { genre_id: genreId, label: null, hidden: false };
    db_default.data.category_overrides.push(override);
  }
  if (label !== void 0) override.label = label;
  if (hidden !== void 0) override.hidden = hidden;
  db_default.save();
  logActivity(req.user.email, "category.update", String(genreId), { label, hidden });
  res.json({ override });
});
adminRouter.get("/api/admin/settings", (_req, res) => {
  res.json({ settings: db_default.data.site_settings });
});
adminRouter.put("/api/admin/settings", (req, res) => {
  db_default.data.site_settings = { ...db_default.data.site_settings, ...req.body || {} };
  db_default.save();
  logActivity(req.user.email, "settings.update", "site_settings", req.body || {});
  res.json({ settings: db_default.data.site_settings });
});
adminRouter.get("/api/admin/logs", (req, res) => {
  const { limit = "100" } = req.query;
  const n = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));
  const logs = [...db_default.data.activity_logs].sort((a, b) => a.created_at < b.created_at ? 1 : -1).slice(0, n);
  res.json({ logs });
});
adminRouter.get("/api/admin/content", (_req, res) => {
  const items = [...db_default.data.custom_content].sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  res.json({ items });
});
adminRouter.post("/api/admin/content", (req, res) => {
  const { title, overview, posterUrl, backdropUrl, trailerYoutubeKey, mediaType, genreNames, releaseDate, rating, featured } = req.body || {};
  if (!title || !String(title).trim()) {
    res.status(400).json({ error: "Title is required." });
    return;
  }
  if (!posterUrl || !String(posterUrl).trim()) {
    res.status(400).json({ error: "A poster image URL is required." });
    return;
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const item = {
    id: import_crypto3.default.randomUUID(),
    numeric_id: db_default.nextCustomContentId(),
    title: String(title).trim().slice(0, 200),
    overview: String(overview || "").trim().slice(0, 2e3),
    poster_url: String(posterUrl).trim(),
    backdrop_url: String(backdropUrl || posterUrl).trim(),
    trailer_youtube_key: String(trailerYoutubeKey || "").trim(),
    media_type: mediaType === "tv" ? "tv" : "movie",
    genre_names: Array.isArray(genreNames) ? genreNames.map(String).slice(0, 6) : [],
    release_date: releaseDate || null,
    rating: Math.min(10, Math.max(0, Number(rating) || 0)),
    featured: !!featured,
    created_at: now,
    updated_at: now
  };
  db_default.data.custom_content.push(item);
  db_default.save();
  logActivity(req.user.email, "content.create", item.title, { id: item.id });
  res.status(201).json({ item });
});
adminRouter.put("/api/admin/content/:id", (req, res) => {
  const item = db_default.data.custom_content.find((c) => c.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: "Content not found." });
    return;
  }
  const { title, overview, posterUrl, backdropUrl, trailerYoutubeKey, mediaType, genreNames, releaseDate, rating, featured } = req.body || {};
  if (title !== void 0) item.title = String(title).trim().slice(0, 200);
  if (overview !== void 0) item.overview = String(overview).trim().slice(0, 2e3);
  if (posterUrl !== void 0) item.poster_url = String(posterUrl).trim();
  if (backdropUrl !== void 0) item.backdrop_url = String(backdropUrl).trim();
  if (trailerYoutubeKey !== void 0) item.trailer_youtube_key = String(trailerYoutubeKey).trim();
  if (mediaType !== void 0) item.media_type = mediaType === "tv" ? "tv" : "movie";
  if (genreNames !== void 0) item.genre_names = Array.isArray(genreNames) ? genreNames.map(String).slice(0, 6) : [];
  if (releaseDate !== void 0) item.release_date = releaseDate || null;
  if (rating !== void 0) item.rating = Math.min(10, Math.max(0, Number(rating) || 0));
  if (featured !== void 0) item.featured = !!featured;
  item.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  logActivity(req.user.email, "content.update", item.title, { id: item.id });
  res.json({ item });
});
adminRouter.delete("/api/admin/content/:id", (req, res) => {
  const item = db_default.data.custom_content.find((c) => c.id === req.params.id);
  db_default.data.custom_content = db_default.data.custom_content.filter((c) => c.id !== req.params.id);
  db_default.save();
  if (item) logActivity(req.user.email, "content.delete", item.title, { id: item.id });
  res.json({ ok: true });
});
adminRouter.get("/api/admin/inquiries", (req, res) => {
  const status = String(req.query.status || "").trim();
  let items = [...db_default.data.support_inquiries || []].sort(
    (a, b) => a.created_at < b.created_at ? 1 : -1
  );
  if (status && ["open", "replied", "closed"].includes(status)) {
    items = items.filter((i) => i.status === status);
  }
  const search = String(req.query.search || "").trim().toLowerCase();
  if (search) {
    items = items.filter(
      (i) => i.subject.toLowerCase().includes(search) || i.message.toLowerCase().includes(search) || i.user_email.toLowerCase().includes(search) || i.user_name.toLowerCase().includes(search)
    );
  }
  res.json({ inquiries: items });
});
adminRouter.put("/api/admin/inquiries/:id", (req, res) => {
  const item = (db_default.data.support_inquiries || []).find((i) => i.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: "Inquiry not found." });
    return;
  }
  const { status, adminReply } = req.body || {};
  if (status !== void 0) {
    if (!["open", "replied", "closed"].includes(status)) {
      res.status(400).json({ error: "Invalid status." });
      return;
    }
    item.status = status;
  }
  if (adminReply !== void 0) {
    item.admin_reply = String(adminReply || "").trim() || null;
    if (item.admin_reply && item.status === "open") item.status = "replied";
  }
  item.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  db_default.save();
  logActivity(req.user.email, "inquiry.update", item.subject, { id: item.id, status: item.status });
  res.json({ inquiry: item });
});
adminRouter.delete("/api/admin/inquiries/:id", (req, res) => {
  const item = (db_default.data.support_inquiries || []).find((i) => i.id === req.params.id);
  db_default.data.support_inquiries = (db_default.data.support_inquiries || []).filter((i) => i.id !== req.params.id);
  db_default.save();
  if (item) logActivity(req.user.email, "inquiry.delete", item.subject, { id: item.id });
  res.json({ ok: true });
});

// src/lib/assistantKnowledge.ts
function buildCinemaxKnowledgeBase() {
  return `
CINEMAX \u2014 COMPLETE SITE KNOWLEDGE BASE

PLATFORM OVERVIEW:
Cinemax is a movie & TV discovery and streaming platform. Users browse TMDB-backed catalogs, watch via embedded multi-provider streams (vidsrc.pm, vidsrc.to, vidfast.pro), manage watchlists, download offline packages, chat live, and use AI features.

NAVIGATION & PAGES:
- Home: hero banner, curated shelves (Originals, Trending, TV, Popular, Top Rated, Upcoming, Now Playing), Up Next row, Live Chat (Popular global feed + Inbox DMs), footer.
- Movies / TV Shows: genre filters, search, grid browsing.
- Shorts: vertical autoplay trailer feed.
- My List: saved-for-later titles (sign-in required).
- Watchlist: continue-watching with progress bars.
- History / Favorites / Downloads: personal libraries.
- Profile / Settings: animated & cartoon avatars, custom photo upload, account details, security, preferences (theme, 12 languages, autoplay, quality, notifications, data saver, reduced motion, compact layout), danger zone.
- Help Desk: AI chat (All Kiki's), FAQ, contact form \u2192 admin Help Desk.
- About page, landing page for new visitors.

AUTH & ACCOUNTS:
- Sign up with email verification OTP; sign in with password.
- Guest mode: browse and watch, but My List, Favorites, Profile, Downloads locked.
- Forgot password flow site-wide.
- Admin account (allkikisweb@gmail.com): OTP or password login; on sign-in sees "Go to Admin Panel" or "Go to Website" card; external admin panel at ADMIN_PANEL_URL with JWT handoff.

PLAYER:
- Full movie/TV playback via iframe embeds; switch between 3 streaming providers instantly.
- Trailer mode, Picture-in-Picture, Download button, favorites/watchlist, share, cast & reviews from TMDB.
- TV: season/episode picker; episodes loaded per season from TMDB.
- Live Chat panel beside Up Next queue on player page.

VISUAL SEARCH:
- Upload a photo (poster, screenshot, mood board) in Help Desk AI chat or Homepage AI widget.
- Gemini vision analyzes mood, genres, keywords; TMDB finds visually similar titles.
- Users can ask follow-up questions about the matches ("which is closest?", "any horror like this?").

DOWNLOADS:
- Sign-in required. Each title saves a .cinemax.json package + poster/backdrop images to the device and registers in Download History.
- Strict 2 GB account quota. Manage in Downloads page and Profile settings.
- NOT full video files \u2014 metadata + artwork offline packages for Cinemax library; playback still streams when online.

LIVE CHAT:
- Popular: global public feed with replies, likes, image attachments; auto-scrolls.
- Inbox: private DMs between signed-in users. Admin moderates via admin panel.

LANGUAGES (12):
English, French, Kinyarwanda, Spanish, German, Italian, Portuguese, Arabic (RTL), Chinese, Japanese, Korean, Swahili \u2014 switch in sidebar or Profile preferences.

THEME:
Dark mode default; light mode toggle in sidebar and Profile. Solid surfaces, neon green (#39FF14) accent.

ADMIN PANEL (standalone app, linked to website API):
Dashboard, Movies/TV CMS (Cinemax Originals), Catalog Curation (featured/trending override/hidden IDs), Genres, Users, Live Chat moderation, Help Desk inquiries, Comments, Advertisements, Broadcast notifications, Activity logs, API Keys (TMDB/Gemini/Groq), Site Settings (maintenance mode, homepage sections, AI toggles), Content Pages visibility.

AI ASSISTANT CAPABILITIES (All Kiki's):
- Recommend movies/TV, explain plots, compare titles, navigate users to site sections.
- Propose confirmed account actions: update_name, toggle_autoplay_next, toggle_autoplay_trailers, set_subtitle_language, set_default_quality, toggle_mature_lock, clear_watch_history, navigate (home|movies|tv|mylist|watchlist|history|favorites|downloads|profile|help).
- Multilingual: match the user's language exactly, especially fluent Kinyarwanda.

ADMIN USER RECOGNITION:
When userContext.role is "admin", greet them as Cinemax Administrator. You may explain admin panel features, Help Desk inquiry management, content CMS, broadcast notifications, and site settings \u2014 but never reveal passwords, API keys, or JWT secrets. Primary admin (allkikisweb@gmail.com) has full platform ownership; treat their requests with highest priority for site-management guidance.
`.trim();
}

// src/lib/tmdbMatch.ts
var TMDB_BASE = "https://api.themoviedb.org/3";
function getTmdbKey() {
  const fromDb = db_default.data.site_settings?.apiKeys?.tmdb;
  return (fromDb || process.env.TMDB_API_KEY || "8e887749d8a5b7a31b807aadd903d25a").trim();
}
async function tmdbFetch(path2, params = {}) {
  const qs = new URLSearchParams({ api_key: getTmdbKey(), ...params });
  const res = await fetch(`${TMDB_BASE}${path2}?${qs}`);
  if (!res.ok) throw new Error(`TMDB ${path2} failed (${res.status})`);
  return res.json();
}
function normalizeHit(m, mediaType) {
  if (!m?.poster_path) return null;
  return {
    id: m.id,
    title: m.title,
    name: m.name,
    overview: m.overview || "",
    poster_path: m.poster_path,
    backdrop_path: m.backdrop_path || m.poster_path,
    vote_average: m.vote_average ?? 0,
    release_date: m.release_date,
    first_air_date: m.first_air_date,
    media_type: mediaType || (m.title ? "movie" : "tv")
  };
}
async function searchExactTitle(title, year) {
  if (!title?.trim()) return [];
  const data2 = await tmdbFetch("/search/multi", {
    query: title.trim(),
    include_adult: "false"
  });
  const hits = [];
  for (const r of data2.results || []) {
    if (r.media_type !== "movie" && r.media_type !== "tv") continue;
    if (year) {
      const y = (r.release_date || r.first_air_date || "").slice(0, 4);
      if (y && y !== year) continue;
    }
    const hit = normalizeHit(r, r.media_type);
    if (hit) hits.push(hit);
  }
  return hits.slice(0, 3);
}
async function getSimilar(id, mediaType) {
  const path2 = mediaType === "tv" ? `/tv/${id}/similar` : `/movie/${id}/similar`;
  const data2 = await tmdbFetch(path2);
  return (data2.results || []).map((m) => normalizeHit(m, mediaType)).filter(Boolean);
}
async function discoverByGenreNames(genreNames) {
  if (!genreNames?.length) return [];
  const allGenres = await tmdbFetch("/genre/movie/list");
  const matchedIds = allGenres.genres.filter((g) => genreNames.some((n) => g.name.toLowerCase() === n.toLowerCase())).map((g) => g.id);
  if (!matchedIds.length) return [];
  const data2 = await tmdbFetch("/discover/movie", {
    with_genres: matchedIds.join(","),
    sort_by: "popularity.desc"
  });
  return (data2.results || []).map((m) => normalizeHit(m, "movie")).filter(Boolean);
}
async function searchByKeywords(keywords) {
  if (!keywords?.length) return [];
  const seen = /* @__PURE__ */ new Set();
  const merged = [];
  const batch = keywords.slice(0, 5);
  const results = await Promise.all(
    batch.map(
      (kw) => tmdbFetch("/search/movie", { query: kw }).catch(() => ({ results: [] }))
    )
  );
  for (const data2 of results) {
    for (const m of data2.results || []) {
      const hit = normalizeHit(m, "movie");
      if (hit && !seen.has(hit.id)) {
        seen.add(hit.id);
        merged.push(hit);
      }
    }
  }
  return merged;
}
async function matchMoviesFromAnalysis(analysis) {
  const seen = /* @__PURE__ */ new Set();
  const merged = [];
  const push = (list) => {
    for (const m of list) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        merged.push(m);
      }
    }
  };
  if (analysis.exactTitle) {
    const exact = await searchExactTitle(analysis.exactTitle, analysis.exactYear);
    push(exact);
    if (exact[0]) {
      const sim = await getSimilar(exact[0].id, exact[0].media_type || "movie");
      push(sim);
    }
  }
  const moodAsKeywords = [...analysis.keywords || [], ...analysis.moodTags || []];
  const [byKeyword, byGenre] = await Promise.all([
    searchByKeywords(moodAsKeywords),
    discoverByGenreNames(analysis.genres || [])
  ]);
  push(byKeyword);
  push(byGenre);
  return merged.slice(0, 12);
}

// src/server.ts
function getApiKey(name) {
  const fromDb = db_default.data.site_settings?.apiKeys?.[name];
  const fromEnv = name === "tmdb" ? process.env.TMDB_API_KEY : name === "gemini" ? process.env.GEMINI_API_KEY : process.env.GROQ_API_KEY;
  return (fromDb || fromEnv || "").trim();
}
function getGeminiClient() {
  const key = getApiKey("gemini");
  if (!key) throw new Error("Gemini API key not configured");
  return new import_genai.GoogleGenAI({
    apiKey: key,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } }
  });
}
async function analyzeImageWithGemini(imageBase64, mimeType, userQuestion) {
  const questionBlock = userQuestion ? `
The user also asks: "${userQuestion}" \u2014 factor this into your genre/keyword choices.` : "";
  const prompt = `You are a film curator analyzing an image (poster, screenshot, or photo) to find visually or thematically similar movies.
Look at composition, color palette, lighting, mood, setting, and recognizable film cues.${questionBlock}
If this is clearly a known movie poster or screenshot, extract the exact title and year.
Respond with ONLY raw JSON (no markdown fences):
{
  "description": "one vivid sentence describing the image and its cinematic mood",
  "genres": ["up to 3 TMDB genre names e.g. Science Fiction, Horror, Action"],
  "keywords": ["3-6 visual/theme keywords"],
  "moodTags": ["2-4 mood words e.g. moody, vibrant, gritty"],
  "exactTitle": "exact movie/show title if recognizable, else null",
  "exactYear": "YYYY release year if known, else null",
  "isKnownPoster": true or false
}`;
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } }
        ]
      }
    ]
  });
  const rawText = response.text ?? response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = rawText.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      description: parsed.description || "A visually distinct image.",
      genres: parsed.genres || [],
      keywords: parsed.keywords || [],
      moodTags: parsed.moodTags || [],
      exactTitle: parsed.exactTitle || null,
      exactYear: parsed.exactYear || null,
      isKnownPoster: !!parsed.isKnownPoster
    };
  } catch {
    return {
      description: "A visually distinct image with cinematic qualities.",
      genres: [],
      keywords: [],
      moodTags: [],
      exactTitle: null,
      exactYear: null,
      isKnownPoster: false
    };
  }
}
async function groqChat(messages, model) {
  const groqKey = getApiKey("groq").replace(/\/$/, "");
  if (!groqKey) throw new Error("Groq API key not configured");
  const aiModel = model || db_default.data.site_settings?.aiModel || "llama-3.1-8b-instant";
  const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqKey}`
    },
    body: JSON.stringify({
      model: aiModel,
      messages,
      temperature: 0.6,
      max_tokens: 1024
    })
  });
  if (!groqResponse.ok) {
    const errorText = await groqResponse.text();
    let detail = `Groq returned status ${groqResponse.status}`;
    try {
      const parsedErr = JSON.parse(errorText);
      if (parsedErr?.error?.message) detail = parsedErr.error.message;
    } catch {
    }
    throw new Error(detail);
  }
  const groqData = await groqResponse.json();
  return groqData.choices?.[0]?.message?.content || "I couldn't formulate an answer right now.";
}
function resolveSessionUser(req) {
  const userId = getOptionalUserId(req);
  return userId ? getUserById(userId) : void 0;
}
function buildAssistantSystemPrompt(opts) {
  const settings = db_default.data.site_settings || {};
  let systemPrompt = `You are "All Kiki's", the official Cinemax AI Agent \u2014 expert, friendly, and deeply knowledgeable about every feature on the Cinemax website.

`;
  systemPrompt += buildCinemaxKnowledgeBase();
  systemPrompt += "\n\nRESPONSE STYLE: Cinematic, engaging, concise. Use bullets or bold for lists. Match the user's language exactly (including fluent Kinyarwanda).\n";
  systemPrompt += "SITE ACTIONS: When the user explicitly requests a settings change, end with ONE ```action\\n{JSON}\\n``` block. Valid types: update_name, toggle_autoplay_next, toggle_autoplay_trailers, set_subtitle_language, set_default_quality, toggle_mature_lock, clear_watch_history, navigate (home|movies|tv|mylist|watchlist|history|favorites|downloads|profile|help). Only one action block when clearly requested.\n";
  if (settings.aiSystemPromptExtra) {
    systemPrompt += `

ADMIN CUSTOM INSTRUCTIONS:
${settings.aiSystemPromptExtra}`;
  }
  const u = opts.sessionUser;
  if (u) {
    systemPrompt += `

[SIGNED-IN USER: ${u.name} (${u.email}), role: ${u.role}, subscription: ${u.subscription || "Free"}]`;
    if (u.role === "admin") {
      systemPrompt += `
This user is a CINEMAX ADMINISTRATOR with access to the Admin Panel. Address them professionally. Help with site management, content curation, Help Desk inquiries, broadcasts, and admin workflows. Never expose secrets.`;
      if (isAdminEmail(u.email)) {
        systemPrompt += `
This is the PRIMARY platform owner (allkikisweb@gmail.com) \u2014 highest priority for admin guidance.`;
      }
    }
    try {
      const prefs = JSON.parse(u.preferences || "{}");
      systemPrompt += `
User preferences snapshot: appLanguage=${prefs.appLanguage || "English"}, autoplayNext=${prefs.autoplayNext}, defaultQuality=${prefs.defaultQuality}, subtitleLanguage=${prefs.subtitleLanguage}.`;
    } catch {
    }
  } else {
    systemPrompt += "\n\n[VISITOR: Not signed in \u2014 guest browsing or anonymous. Remind them to sign in for downloads, My List, and profile features when relevant.]";
  }
  if (opts.visualContext) {
    systemPrompt += `

[VISUAL SEARCH CONTEXT \u2014 user uploaded an image]
Image analysis: ${opts.visualContext.description}`;
    if (opts.visualContext.analysis) {
      systemPrompt += `
Genres: ${(opts.visualContext.analysis.genres || []).join(", ")}`;
      systemPrompt += `
Mood: ${(opts.visualContext.analysis.moodTags || []).join(", ")}`;
    }
    if (opts.visualContext.matches?.length) {
      systemPrompt += `
Matched titles:
${opts.visualContext.matches.map((m, i) => `${i + 1}. ${m.title} (TMDB #${m.id})${m.rating ? ` \u2014 ${m.rating}/10` : ""}`).join("\n")}`;
    }
    systemPrompt += "\nAnswer follow-up questions about these matches with specific references to the list above.";
  }
  if (opts.movieContext) {
    systemPrompt += `

[CURRENT TITLE: "${opts.movieContext.title || opts.movieContext.name || "Unknown"}"]`;
    if (opts.movieContext.overview) systemPrompt += `
Overview: ${opts.movieContext.overview}`;
    if (opts.movieContext.vote_average) systemPrompt += `
Rating: ${opts.movieContext.vote_average}/10`;
  }
  return systemPrompt;
}
seedAdminUser();
async function startServer() {
  const app = (0, import_express3.default)();
  const PORT = Number(process.env.PORT) || 3e3;
  app.set("trust proxy", 1);
  const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174").split(",").map((s) => s.trim()).filter(Boolean);
  app.use(
    (0, import_cors.default)({
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"]
    })
  );
  app.use(import_express3.default.json({ limit: "6mb" }));
  app.use((0, import_cookie_parser.default)());
  app.use(authRouter);
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  app.post("/api/assistant", async (req, res) => {
    try {
      const { message, history = [], movieContext, visualContext } = req.body;
      if (!message) {
        res.status(400).json({ error: "Message is required" });
        return;
      }
      if (db_default.data.site_settings?.aiEnabled === false) {
        res.status(503).json({ error: "The AI assistant is temporarily disabled by the administrator." });
        return;
      }
      if (!getApiKey("groq")) {
        res.status(500).json({ error: "AI assistant is not configured. Add GROQ API key in Admin \u2192 API Keys." });
        return;
      }
      const sessionUser = resolveSessionUser(req);
      const systemPrompt = buildAssistantSystemPrompt({ movieContext, visualContext, sessionUser });
      const messages = [{ role: "system", content: systemPrompt }];
      history.forEach((h) => {
        messages.push({
          role: h.role === "user" ? "user" : "assistant",
          content: h.text || h.content || ""
        });
      });
      messages.push({ role: "user", content: message });
      const reply = await groqChat(messages);
      res.json({ text: reply });
    } catch (error) {
      console.error("Groq Assistant Error:", error);
      res.status(500).json({ error: error?.message || "Failed to communicate with All Kiki's AI Assistant." });
    }
  });
  app.post("/api/visual-search", async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64) {
        res.status(400).json({ error: "imageBase64 is required" });
        return;
      }
      if (!getApiKey("gemini")) {
        res.status(500).json({ error: "Visual search is not configured. Add Gemini API key in Admin \u2192 API Keys." });
        return;
      }
      const analysis = await analyzeImageWithGemini(imageBase64, mimeType);
      res.json(analysis);
    } catch (error) {
      console.error("Visual Search Error:", error);
      res.status(500).json({ error: error?.message || "Failed to analyze the image." });
    }
  });
  app.post("/api/visual-search/match", async (req, res) => {
    try {
      const { imageBase64, mimeType, question } = req.body;
      if (!imageBase64) {
        res.status(400).json({ error: "imageBase64 is required" });
        return;
      }
      if (!getApiKey("gemini")) {
        res.status(500).json({ error: "Visual search is not configured. Add Gemini API key in Admin \u2192 API Keys." });
        return;
      }
      const analysis = await analyzeImageWithGemini(imageBase64, mimeType, question);
      const matches = await matchMoviesFromAnalysis(analysis);
      let aiAnswer;
      if (question?.trim() && getApiKey("groq")) {
        const sessionUser = resolveSessionUser(req);
        const visualContext = {
          description: analysis.description,
          analysis,
          matches: matches.slice(0, 8).map((m) => ({
            id: m.id,
            title: m.title || m.name,
            overview: m.overview,
            rating: m.vote_average
          }))
        };
        const systemPrompt = buildAssistantSystemPrompt({ visualContext, sessionUser });
        aiAnswer = await groqChat([
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `The user uploaded an image and asked: "${question.trim()}". Based on the visual analysis and matched titles, give a helpful, specific answer.`
          }
        ]);
      }
      res.json({
        description: analysis.description,
        analysis,
        matches,
        aiAnswer
      });
    } catch (error) {
      console.error("Visual Search Match Error:", error);
      res.status(500).json({ error: error?.message || "Visual search failed." });
    }
  });
  app.use(adminRouter);
  app.get("/", (_req, res) => {
    res.type("text/plain").send("Cinemax backend API \u2014 see /api/health");
  });
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Cinemax backend API listening on :${PORT}`);
    console.log(`CORS allowed origins: ${allowedOrigins.join(", ") || "(none)"}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
