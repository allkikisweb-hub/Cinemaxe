import { Router } from "express";
import crypto from "crypto";
import db, { DbDirectMessage } from "../lib/db";
import {
  publicUser,
  isValidEmail,
  isStrongPassword,
  getUserByEmail,
  getUserById,
  createUser,
  verifyPassword,
  updatePasswordHash,
  signToken,
  signPortalToken,
  verifyPortalToken,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  AuthedRequest,
  isAdminEmail,
  getAdminLoginMethod,
  canSendOtp,
  issueOtp,
  verifyOtp,
  getOptionalUserId,
  issueSignupVerification,
  verifySignupCode,
  issuePasswordReset,
  verifyPasswordResetToken,
  consumePasswordReset,
} from "../lib/auth";
import { sendOtpEmail, isMailerConfigured, sendSignupVerificationEmail, sendPasswordResetEmail } from "../lib/mailer";

const LIST_STORAGE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const DOWNLOAD_STORAGE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const DEFAULT_ITEM_BYTES = 150 * 1024 * 1024; // ~150MB per title for quota math

export const authRouter = Router();

function getUserExtras(userId: string) {
  const myList = (db.data.my_list || [])
    .filter((w) => w.user_id === userId)
    .sort((a, b) => (a.added_at < b.added_at ? 1 : -1))
    .map((w) => w.movie_id);
  const favorites = db.data.favorites
    .filter((f) => f.user_id === userId)
    .sort((a, b) => (a.added_at < b.added_at ? 1 : -1))
    .map((f) => f.movie_id);
  const watchHistory = db.data.watch_history
    .filter((h) => h.user_id === userId)
    .sort((a, b) => (a.watched_at < b.watched_at ? 1 : -1))
    .slice(0, 50);
  // Continue-watching: titles with progress > 0 and not finished
  const watchlist = watchHistory
    .filter((h) => h.progress > 0 && h.progress < 100)
    .map((h) => h.movie_id);
  const downloads = (db.data.downloads || [])
    .filter((d) => d.user_id === userId)
    .sort((a, b) => (a.added_at < b.added_at ? 1 : -1));
  const listStorageUsed = computeListStorageUsed(userId);
  const downloadStorageUsed = downloads.reduce((sum, d) => sum + (d.size_bytes || 0), 0);
  return { myList, watchlist, favorites, watchHistory, downloads, listStorageUsed, listStorageLimit: LIST_STORAGE_LIMIT_BYTES, downloadStorageUsed, downloadStorageLimit: DOWNLOAD_STORAGE_LIMIT_BYTES };
}

function computeListStorageUsed(userId: string): number {
  let total = 0;
  for (const item of (db.data.my_list || []).filter((m) => m.user_id === userId)) {
    total += item.estimated_bytes || DEFAULT_ITEM_BYTES;
  }
  for (const item of db.data.favorites.filter((f) => f.user_id === userId)) {
    total += DEFAULT_ITEM_BYTES;
  }
  for (const item of db.data.watch_history.filter((h) => h.user_id === userId && h.progress > 0)) {
    total += DEFAULT_ITEM_BYTES;
  }
  return total;
}

function userWithExtras(u: Parameters<typeof publicUser>[0]) {
  return { ...publicUser(u), ...getUserExtras(u.id) };
}

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------

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

  db.data.notifications.push({
    id: crypto.randomUUID(),
    user_id: user.id,
    type: "account",
    title: "Welcome to Cinemax",
    message: "Your account is verified and ready. Explore trending titles and build your lists.",
    read: 0,
    created_at: new Date().toISOString(),
  });
  db.save();
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

  // Generic message on both "no such user" and "wrong password" — avoids
  // leaking which part was incorrect.
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

// ---------------------------------------------------------------------------
// ADMIN OTP LOGIN — the sole sign-in path for the administrator account.
// Step 1: POST /login/method tells the client whether an email belongs to
//         the admin account (→ "otp") or a regular one (→ "password"), so
//         the UI can render the right next step.
// Step 2: POST /otp/request sends a fresh 6-digit code to that email —
//         but ONLY if the email actually belongs to the admin account.
// Step 3: POST /otp/verify checks the code and, on success, logs them in
//         exactly like a normal login (session cookie + user payload).
// ---------------------------------------------------------------------------

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

  // Only the admin account may request an OTP. Respond identically whether
  // the email doesn't exist or simply isn't an admin, so this endpoint can't
  // be used to enumerate which addresses are administrators.
  if (!isAdminEmail(normalized)) {
    res.status(403).json({ error: "OTP sign-in isn't available for this account." });
    return;
  }

  const user = getUserByEmail(normalized)!;
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
    res.status(429).json({ error: `Please wait ${Math.ceil(cooldown.retryAfterMs / 1000)}s before requesting another code.` });
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

  const user = getUserByEmail(normalized)!;
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
  // The cookie is what the main site uses. `token` is also returned in the
  // body so the standalone admin panel (a separate origin, so it can't rely
  // on this cookie) can store it and send it as `Authorization: Bearer`.
  res.json({ user: userWithExtras(user), token });
});

authRouter.post("/api/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get("/api/auth/me", requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: userWithExtras(req.user!) });
});

/** Short-lived signed URL so admins can open the standalone panel securely. */
authRouter.get("/api/auth/admin-portal-url", requireAuth, (req: AuthedRequest, res) => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Admin access only." });
    return;
  }
  const portalToken = signPortalToken(req.user!.id);
  const base = (process.env.ADMIN_PANEL_URL || process.env.VITE_ADMIN_PANEL_URL || "http://localhost:5174").replace(/\/$/, "");
  res.json({ url: `${base}?token=${encodeURIComponent(portalToken)}` });
});

/** Exchange a short-lived portal handoff token for a full admin session JWT. */
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
  const user = getUserById(userId)!;
  const sessionToken = signToken(user.id);
  res.json({ user: userWithExtras(user), token: sessionToken });
});

/** Help Desk contact form — stored for admin review. */
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
  if (subject.length > 200 || message.length > 5000) {
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

  const now = new Date().toISOString();
  const inquiry = {
    id: crypto.randomUUID(),
    user_id: authedUserId,
    user_name: userName,
    user_email: userEmail,
    subject,
    message,
    status: "open" as const,
    admin_reply: null,
    created_at: now,
    updated_at: now,
  };
  db.data.support_inquiries.unshift(inquiry);
  db.save();
  res.status(201).json({ ok: true, inquiry: { id: inquiry.id, created_at: inquiry.created_at } });
});

authRouter.put("/api/auth/profile", requireAuth, (req: AuthedRequest, res) => {
  const { name, email } = req.body || {};
  const user = req.user!;

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
  user.updated_at = new Date().toISOString();
  db.save();
  res.json({ user: userWithExtras(getUserById(user.id)!) });
});

authRouter.put("/api/auth/password", requireAuth, (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = req.user!;

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

authRouter.put("/api/auth/avatar", requireAuth, (req: AuthedRequest, res) => {
  const { avatar, banner } = req.body || {};
  const MAX_AVATAR_BYTES = 600_000;
  if (typeof avatar === "string" && avatar.length > MAX_AVATAR_BYTES) {
    return res.status(400).json({ error: "Profile image is too large. Please use a photo under 500 KB." });
  }
  if (typeof banner === "string" && banner.length > MAX_AVATAR_BYTES) {
    return res.status(400).json({ error: "Banner image is too large." });
  }
  const user = req.user!;
  user.avatar = avatar ?? user.avatar;
  user.banner = banner ?? user.banner;
  user.updated_at = new Date().toISOString();
  db.save();
  res.json({ user: userWithExtras(getUserById(user.id)!) });
});

authRouter.put("/api/auth/preferences", requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  let current = {};
  try {
    current = JSON.parse(user.preferences || "{}");
  } catch {
    /* ignore malformed existing prefs */
  }
  const merged = { ...current, ...(req.body || {}) };
  user.preferences = JSON.stringify(merged);
  user.updated_at = new Date().toISOString();
  db.save();
  res.json({ user: userWithExtras(getUserById(user.id)!) });
});

authRouter.delete("/api/auth/account", requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  db.data.users = db.data.users.filter((u) => u.id !== userId);
  db.data.watchlist = db.data.watchlist.filter((w) => w.user_id !== userId);
  db.data.my_list = (db.data.my_list || []).filter((w) => w.user_id !== userId);
  db.data.downloads = (db.data.downloads || []).filter((d) => d.user_id !== userId);
  db.data.favorites = db.data.favorites.filter((f) => f.user_id !== userId);
  db.data.watch_history = db.data.watch_history.filter((h) => h.user_id !== userId);
  db.data.notifications = db.data.notifications.filter((n) => n.user_id !== userId);
  db.save();
  clearSessionCookie(res);
  res.json({ ok: true });
});

/** Wipes all local user activity — history, lists, favorites, downloads, notifications. */
authRouter.post("/api/auth/clear-cache", requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  db.data.my_list = (db.data.my_list || []).filter((w) => w.user_id !== userId);
  db.data.downloads = (db.data.downloads || []).filter((d) => d.user_id !== userId);
  db.data.favorites = db.data.favorites.filter((f) => f.user_id !== userId);
  db.data.watch_history = db.data.watch_history.filter((h) => h.user_id !== userId);
  db.data.notifications = db.data.notifications.filter((n) => n.user_id !== userId);
  db.data.watchlist = db.data.watchlist.filter((w) => w.user_id !== userId);
  db.save();
  res.json({ ok: true, user: userWithExtras(getUserById(userId)!) });
});

// ---------------------------------------------------------------------------
// COMMENTS / REVIEWS — public read of approved comments, authed create.
// New comments start "pending" until an admin approves them.
// ---------------------------------------------------------------------------

authRouter.get("/api/comments/:movieId", (req, res) => {
  const movieId = Number(req.params.movieId);
  const comments = db.data.comments
    .filter((c) => c.movie_id === movieId && c.status === "approved")
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  res.json({ comments });
});

authRouter.post("/api/comments", requireAuth, (req: AuthedRequest, res) => {
  const { movieId, movieTitle, text, rating } = req.body || {};
  if (!movieId || !text || !String(text).trim()) {
    res.status(400).json({ error: "movieId and text are required." });
    return;
  }
  const comment = {
    id: crypto.randomUUID(),
    movie_id: Number(movieId),
    movie_title: movieTitle || null,
    user_id: req.user!.id,
    user_name: req.user!.name,
    text: String(text).trim().slice(0, 2000),
    rating: rating != null ? Number(rating) : null,
    status: "pending" as const,
    created_at: new Date().toISOString(),
  };
  db.data.comments.push(comment);
  db.save();
  res.status(201).json({ comment });
});

// ---------------------------------------------------------------------------
// PUBLIC CATEGORY VISIBILITY — read-only, no auth required. Lets every
// visitor's navbar respect genres the admin has hidden site-wide.
// ---------------------------------------------------------------------------

authRouter.get("/api/categories/hidden", (_req, res) => {
  const hiddenIds = db.data.category_overrides.filter((c) => c.hidden).map((c) => c.genre_id);
  res.json({ hiddenIds });
});

authRouter.get("/api/categories/public", (_req, res) => {
  const overrides = db.data.category_overrides;
  res.json({
    hiddenIds: overrides.filter((c) => c.hidden).map((c) => c.genre_id),
    labels: Object.fromEntries(
      overrides.filter((c) => c.label).map((c) => [String(c.genre_id), c.label as string])
    ),
  });
});

// ---------------------------------------------------------------------------
// CUSTOM CONTENT (CMS) — public, read-only. Shaped to drop straight into the
// same Movie[] arrays the homepage already renders with MovieCard, so admin-
// authored titles show up right alongside TMDB's catalog with no special
// casing on the frontend.
// ---------------------------------------------------------------------------

authRouter.get("/api/content/custom", (_req, res) => {
  const movies = db.data.custom_content.map((c) => ({
    id: c.numeric_id,
    title: c.title,
    overview: c.overview,
    poster_path: c.poster_url,
    backdrop_path: c.backdrop_url,
    vote_average: c.rating,
    release_date: c.release_date || undefined,
    genre_ids: [],
    genres: c.genre_names.map((name, i) => ({ id: i, name })),
    media_type: c.media_type,
    isCustom: true,
    trailerYoutubeKey: c.trailer_youtube_key || undefined,
    featured: c.featured,
  }));
  res.json({ movies });
});

// ---------------------------------------------------------------------------
// MY LIST (manual save-for-later)
// ---------------------------------------------------------------------------

authRouter.get("/api/my-list", requireAuth, (req: AuthedRequest, res) => {
  res.json({ movieIds: getUserExtras(req.user!.id).myList });
});

authRouter.post("/api/my-list", requireAuth, (req: AuthedRequest, res) => {
  const { movieId } = req.body || {};
  if (!movieId) {
    res.status(400).json({ error: "movieId is required." });
    return;
  }
  const userId = req.user!.id;
  const used = computeListStorageUsed(userId);
  if (used + DEFAULT_ITEM_BYTES > LIST_STORAGE_LIMIT_BYTES) {
    res.status(413).json({ error: "List storage full (2GB limit). Remove items from My List, Favorites, or Watchlist to free space." });
    return;
  }
  const exists = (db.data.my_list || []).some((w) => w.user_id === userId && w.movie_id === movieId);
  if (!exists) {
    if (!db.data.my_list) db.data.my_list = [];
    db.data.my_list.push({
      user_id: userId,
      movie_id: movieId,
      added_at: new Date().toISOString(),
      estimated_bytes: DEFAULT_ITEM_BYTES,
    });
    db.save();
  }
  res.status(201).json({ ok: true });
});

authRouter.delete("/api/my-list/:movieId", requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const movieId = Number(req.params.movieId);
  db.data.my_list = (db.data.my_list || []).filter((w) => !(w.user_id === userId && w.movie_id === movieId));
  db.save();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// WATCHLIST (continue watching — derived from history, read-only via API)
// ---------------------------------------------------------------------------

authRouter.get("/api/watchlist", requireAuth, (req: AuthedRequest, res) => {
  res.json({ movieIds: getUserExtras(req.user!.id).watchlist });
});

authRouter.post("/api/watchlist", requireAuth, (req: AuthedRequest, res) => {
  // Legacy endpoint — redirects to my-list for manual saves
  const { movieId } = req.body || {};
  if (!movieId) {
    res.status(400).json({ error: "movieId is required." });
    return;
  }
  req.body = { movieId };
  const userId = req.user!.id;
  const used = computeListStorageUsed(userId);
  if (used + DEFAULT_ITEM_BYTES > LIST_STORAGE_LIMIT_BYTES) {
    res.status(413).json({ error: "List storage full (2GB limit). Remove items to free space." });
    return;
  }
  if (!db.data.my_list) db.data.my_list = [];
  const exists = db.data.my_list.some((w) => w.user_id === userId && w.movie_id === movieId);
  if (!exists) {
    db.data.my_list.push({
      user_id: userId,
      movie_id: movieId,
      added_at: new Date().toISOString(),
      estimated_bytes: DEFAULT_ITEM_BYTES,
    });
    db.save();
  }
  res.status(201).json({ ok: true });
});

authRouter.delete("/api/watchlist/:movieId", requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const movieId = Number(req.params.movieId);
  db.data.my_list = (db.data.my_list || []).filter((w) => !(w.user_id === userId && w.movie_id === movieId));
  db.save();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// DOWNLOADS
// ---------------------------------------------------------------------------

authRouter.get("/api/downloads", requireAuth, (req: AuthedRequest, res) => {
  const extras = getUserExtras(req.user!.id);
  res.json({
    downloads: extras.downloads,
    storageUsed: extras.downloadStorageUsed,
    storageLimit: DOWNLOAD_STORAGE_LIMIT_BYTES,
  });
});

authRouter.post("/api/downloads", requireAuth, (req: AuthedRequest, res) => {
  const { movieId, title, poster, sizeBytes, mediaType } = req.body || {};
  if (!movieId) {
    res.status(400).json({ error: "movieId is required." });
    return;
  }
  const userId = req.user!.id;
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
  if (!db.data.downloads) db.data.downloads = [];
  const exists = db.data.downloads.some((d) => d.user_id === userId && d.movie_id === movieId);
  if (!exists) {
    db.data.downloads.push({
      user_id: userId,
      movie_id: movieId,
      title: title || "Untitled",
      poster: poster || null,
      size_bytes: size,
      added_at: new Date().toISOString(),
      media_type: mediaType === "tv" ? "tv" : "movie",
    });
    db.save();
  }
  res.status(201).json({
    ok: true,
    storageUsed: getUserExtras(userId).downloadStorageUsed,
    storageLimit: DOWNLOAD_STORAGE_LIMIT_BYTES,
    downloads: getUserExtras(userId).downloads,
  });
});

authRouter.delete("/api/downloads/:movieId", requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const movieId = Number(req.params.movieId);
  db.data.downloads = (db.data.downloads || []).filter((d) => !(d.user_id === userId && d.movie_id === movieId));
  db.save();
  res.json({
    ok: true,
    storageUsed: getUserExtras(userId).downloadStorageUsed,
    storageLimit: DOWNLOAD_STORAGE_LIMIT_BYTES,
    downloads: getUserExtras(userId).downloads,
  });
});

authRouter.get("/api/config/public", (_req, res) => {
  const settings = db.data.site_settings;
  res.json({
    tmdbApiKey: settings.apiKeys?.tmdb || process.env.TMDB_API_KEY || "",
    siteName: settings.siteName,
    heroTagline: settings.heroTagline,
    maintenanceMode: settings.maintenanceMode,
    featuredMovieIds: settings.featuredMovieIds || [],
    trendingOverrideIds: settings.trendingOverrideIds || [],
    hiddenMovieIds: settings.hiddenMovieIds || [],
    homepageSections: settings.homepageSections || [],
    contentPages: settings.contentPages || {},
  });
});

/** Active ads for the public website — no auth required. */
authRouter.get("/api/ads/public", (_req, res) => {
  const ads = db.data.ads
    .filter((a) => a.active)
    .map((a) => ({
      id: a.id,
      title: a.title,
      image_url: a.image_url,
      target_url: a.target_url,
      placement: a.placement,
    }));
  res.json({ ads });
});

// ---------------------------------------------------------------------------
// FAVORITES
// ---------------------------------------------------------------------------

authRouter.get("/api/favorites", requireAuth, (req: AuthedRequest, res) => {
  res.json({ movieIds: getUserExtras(req.user!.id).favorites });
});

authRouter.post("/api/favorites", requireAuth, (req: AuthedRequest, res) => {
  const { movieId } = req.body || {};
  if (!movieId) {
    res.status(400).json({ error: "movieId is required." });
    return;
  }
  const userId = req.user!.id;
  const used = computeListStorageUsed(userId);
  if (used + DEFAULT_ITEM_BYTES > LIST_STORAGE_LIMIT_BYTES) {
    res.status(413).json({ error: "List storage full (2GB limit). Remove items to free space." });
    return;
  }
  const exists = db.data.favorites.some((f) => f.user_id === userId && f.movie_id === movieId);
  if (!exists) {
    db.data.favorites.push({ user_id: userId, movie_id: movieId, added_at: new Date().toISOString() });
    db.save();
  }
  res.status(201).json({ ok: true });
});

authRouter.delete("/api/favorites/:movieId", requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const movieId = Number(req.params.movieId);
  db.data.favorites = db.data.favorites.filter((f) => !(f.user_id === userId && f.movie_id === movieId));
  db.save();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// NOTIFICATIONS — protected: an unauthenticated request gets a clear 401
// prompting sign-in, per the "notifications require login" requirement.
// ---------------------------------------------------------------------------

authRouter.get("/api/notifications", requireAuth, (req: AuthedRequest, res) => {
  const notifications = db.data.notifications
    .filter((n) => n.user_id === req.user!.id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 50);
  res.json({ notifications });
});

authRouter.post("/api/notifications", requireAuth, (req: AuthedRequest, res) => {
  const { type, title, message } = req.body || {};
  if (!type || !title || !message) {
    res.status(400).json({ error: "type, title, and message are required." });
    return;
  }
  const id = crypto.randomUUID();
  db.data.notifications.push({
    id,
    user_id: req.user!.id,
    type,
    title,
    message,
    read: 0,
    created_at: new Date().toISOString(),
  });
  db.save();
  res.status(201).json({ id });
});

authRouter.put("/api/notifications/:id/read", requireAuth, (req: AuthedRequest, res) => {
  const n = db.data.notifications.find((n) => n.id === req.params.id && n.user_id === req.user!.id);
  if (n) {
    n.read = 1;
    db.save();
  }
  res.json({ ok: true });
});

authRouter.put("/api/notifications/read-all", requireAuth, (req: AuthedRequest, res) => {
  db.data.notifications.forEach((n) => {
    if (n.user_id === req.user!.id) n.read = 1;
  });
  db.save();
  res.json({ ok: true });
});

authRouter.delete("/api/notifications", requireAuth, (req: AuthedRequest, res) => {
  db.data.notifications = db.data.notifications.filter((n) => n.user_id !== req.user!.id);
  db.save();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// WATCH HISTORY
// ---------------------------------------------------------------------------

authRouter.get("/api/watch-history", requireAuth, (req: AuthedRequest, res) => {
  res.json({ history: getUserExtras(req.user!.id).watchHistory });
});

authRouter.post("/api/watch-history", requireAuth, (req: AuthedRequest, res) => {
  const { movieId, title, poster, mediaType, duration, season, episode } = req.body || {};
  if (!movieId) {
    res.status(400).json({ error: "movieId is required." });
    return;
  }
  const userId = req.user!.id;
  const existing = db.data.watch_history.find((h) => h.user_id === userId && h.movie_id === movieId);
  if (existing) {
    existing.watched_at = new Date().toISOString();
  } else {
    db.data.watch_history.push({
      user_id: userId,
      movie_id: movieId,
      title: title || null,
      poster: poster || null,
      media_type: mediaType || null,
      duration: duration || 0,
      season: season ?? null,
      episode: episode ?? null,
      progress: 0,
      watched_at: new Date().toISOString(),
    });
  }
  db.save();
  res.status(201).json({ ok: true });
});

authRouter.put("/api/watch-history/:movieId/progress", requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const movieId = Number(req.params.movieId);
  const { progress } = req.body || {};
  const existing = db.data.watch_history.find((h) => h.user_id === userId && h.movie_id === movieId);
  if (existing) {
    existing.progress = progress ?? 0;
    db.save();
  }
  res.json({ ok: true });
});

authRouter.delete("/api/watch-history", requireAuth, (req: AuthedRequest, res) => {
  db.data.watch_history = db.data.watch_history.filter((h) => h.user_id !== req.user!.id);
  db.save();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// LIVE CHAT — "Popular" is one shared global feed (readable by anyone,
// postable only when signed in) with threaded replies and likes. "Inbox" is
// private 1-to-1 messaging between any two signed-in users. Both are
// polled by the client rather than pushed over a socket — simple, and
// plenty responsive at this app's scale.
// ---------------------------------------------------------------------------

function toPublicChatMessage(m: (typeof db.data.chat_messages)[number], viewerId?: string) {
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
    mediaType: m.media_type || null,
  };
}

function toPublicDirectMessage(m: (typeof db.data.direct_messages)[number], viewerId: string) {
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
    mediaType: m.media_type || null,
  };
}

// A base64 data URL of roughly this length keeps chat snappy on the
// file-backed JSON store. ~2.5MB decoded, generous for a photo or a short
// voice note without letting one message balloon the whole database.
const MAX_MEDIA_DATA_URL_LENGTH = 3_500_000;

// Anyone (including guests) can read the global feed — only posting requires
// being signed in. requireAuth isn't used here; we manually read the cookie
// so a logged-in viewer's own likes still show as "liked" without forcing
// a login wall just to look at Popular.
authRouter.get("/api/chat/global", (req: AuthedRequest, res) => {
  const viewerId = getOptionalUserId(req);
  const messages = db.data.chat_messages
    .slice(-500)
    .map((m) => toPublicChatMessage(m, viewerId));
  res.json({ messages });
});

authRouter.post("/api/chat/global", requireAuth, (req: AuthedRequest, res) => {
  const { text, parentId, mediaUrl, mediaType } = req.body || {};
  const trimmed = String(text || "").trim();

  // The global "Popular" feed accepts images but never voice notes — voice
  // messages are an Inbox-only feature.
  if (mediaType && mediaType !== "image") {
    res.status(400).json({ error: "Voice messages can only be sent in your Inbox." });
    return;
  }
  if (!trimmed && !mediaUrl) {
    res.status(400).json({ error: "Message text or an image is required." });
    return;
  }
  if (trimmed.length > 1000) {
    res.status(400).json({ error: "Messages must be 1000 characters or fewer." });
    return;
  }
  if (mediaUrl && (typeof mediaUrl !== "string" || mediaUrl.length > MAX_MEDIA_DATA_URL_LENGTH)) {
    res.status(400).json({ error: "That image is too large to send." });
    return;
  }
  if (parentId && !db.data.chat_messages.some((m) => m.id === parentId)) {
    res.status(404).json({ error: "The message you're replying to no longer exists." });
    return;
  }

  const message = {
    id: crypto.randomUUID(),
    user_id: req.user!.id,
    user_name: req.user!.name,
    user_avatar: req.user!.avatar,
    text: trimmed,
    parent_id: parentId || null,
    liked_by: [] as string[],
    created_at: new Date().toISOString(),
    media_url: mediaUrl ? String(mediaUrl) : null,
    media_type: mediaUrl ? "image" as const : null,
  };
  db.data.chat_messages.push(message);
  db.save();
  res.status(201).json({ message: toPublicChatMessage(message, req.user!.id) });
});

authRouter.post("/api/chat/global/:id/like", requireAuth, (req: AuthedRequest, res) => {
  const message = db.data.chat_messages.find((m) => m.id === req.params.id);
  if (!message) {
    res.status(404).json({ error: "Message not found." });
    return;
  }
  const userId = req.user!.id;
  const idx = message.liked_by.indexOf(userId);
  if (idx === -1) message.liked_by.push(userId);
  else message.liked_by.splice(idx, 1);
  db.save();
  res.json({ message: toPublicChatMessage(message, userId) });
});

authRouter.delete("/api/chat/global/:id", requireAuth, (req: AuthedRequest, res) => {
  const message = db.data.chat_messages.find((m) => m.id === req.params.id);
  if (!message) {
    res.status(404).json({ error: "Message not found." });
    return;
  }
  if (message.user_id !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ error: "You can only delete your own messages." });
    return;
  }
  db.data.chat_messages = db.data.chat_messages.filter((m) => m.id !== req.params.id && m.parent_id !== req.params.id);
  db.save();
  res.json({ ok: true });
});

// Directory of people you can DM — every active account except yourself.
// Deliberately excludes email/status/role: chat only needs a name + avatar.
authRouter.get("/api/chat/directory", requireAuth, (req: AuthedRequest, res) => {
  const people = db.data.users
    .filter((u) => u.id !== req.user!.id && u.status === "active")
    .map((u) => ({ id: u.id, name: u.name, avatar: u.avatar }));
  res.json({ people });
});

// One row per conversation the signed-in user is part of, newest first,
// with the other participant's info, the last message, and an unread count.
authRouter.get("/api/chat/conversations", requireAuth, (req: AuthedRequest, res) => {
  const myId = req.user!.id;
  const related = db.data.direct_messages.filter((m) => m.from_user_id === myId || m.to_user_id === myId);

  const byPartner = new Map<string, DbDirectMessage[]>();
  for (const m of related) {
    const partnerId = m.from_user_id === myId ? m.to_user_id : m.from_user_id;
    if (!byPartner.has(partnerId)) byPartner.set(partnerId, []);
    byPartner.get(partnerId)!.push(m);
  }

  const conversations = Array.from(byPartner.entries())
    .map(([partnerId, msgs]) => {
      const partner = getUserById(partnerId);
      const sorted = msgs.slice().sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
      const last = sorted[sorted.length - 1];
      const unreadCount = sorted.filter((m) => m.to_user_id === myId && !m.read).length;
      return {
        userId: partnerId,
        userName: partner?.name || "Deleted user",
        userAvatar: partner?.avatar || "",
        lastMessage: last.text,
        lastMessageAt: last.created_at,
        unreadCount,
      };
    })
    .sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1));

  res.json({ conversations });
});

authRouter.get("/api/chat/conversations/:userId", requireAuth, (req: AuthedRequest, res) => {
  const myId = req.user!.id;
  const partnerId = req.params.userId;
  if (!getUserById(partnerId)) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const thread = db.data.direct_messages
    .filter(
      (m) =>
        (m.from_user_id === myId && m.to_user_id === partnerId) ||
        (m.from_user_id === partnerId && m.to_user_id === myId)
    )
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

  // Mark anything sent to me as read now that I've opened the thread.
  let changed = false;
  for (const m of thread) {
    if (m.to_user_id === myId && !m.read) {
      m.read = true;
      changed = true;
    }
  }
  if (changed) db.save();

  res.json({ messages: thread.map((m) => toPublicDirectMessage(m, myId)) });
});

authRouter.post("/api/chat/conversations/:userId", requireAuth, (req: AuthedRequest, res) => {
  const myId = req.user!.id;
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
  if (trimmed.length > 2000) {
    res.status(400).json({ error: "Messages must be 2000 characters or fewer." });
    return;
  }
  if (mediaUrl && (typeof mediaUrl !== "string" || mediaUrl.length > MAX_MEDIA_DATA_URL_LENGTH)) {
    res.status(400).json({ error: "That attachment is too large to send." });
    return;
  }

  const message = {
    id: crypto.randomUUID(),
    from_user_id: myId,
    to_user_id: partnerId,
    text: trimmed,
    liked_by: [] as string[],
    read: false,
    created_at: new Date().toISOString(),
    media_url: mediaUrl ? String(mediaUrl) : null,
    media_type: mediaUrl ? ((mediaType === "audio" ? "audio" : "image") as "audio" | "image") : null,
  };
  db.data.direct_messages.push(message);
  db.save();

  db.data.notifications.push({
    id: crypto.randomUUID(),
    user_id: partnerId,
    type: "message",
    title: `New message from ${req.user!.name}`,
    message: trimmed ? trimmed.slice(0, 120) : (mediaType === "audio" ? "🎤 Voice message" : "📷 Image"),
    read: 0,
    created_at: new Date().toISOString(),
  });
  db.save();

  res.status(201).json({ message: toPublicDirectMessage(message, myId) });
});

authRouter.post("/api/chat/dm/:id/like", requireAuth, (req: AuthedRequest, res) => {
  const message = db.data.direct_messages.find((m) => m.id === req.params.id);
  if (!message) {
    res.status(404).json({ error: "Message not found." });
    return;
  }
  const myId = req.user!.id;
  if (message.from_user_id !== myId && message.to_user_id !== myId) {
    res.status(403).json({ error: "You don't have access to this conversation." });
    return;
  }
  const idx = message.liked_by.indexOf(myId);
  if (idx === -1) message.liked_by.push(myId);
  else message.liked_by.splice(idx, 1);
  db.save();
  res.json({ message: toPublicDirectMessage(message, myId) });
});
