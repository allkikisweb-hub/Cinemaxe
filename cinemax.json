import { Router } from "express";
import crypto from "crypto";
import db, { DbCustomContent } from "../lib/db";
import {
  publicUser,
  getUserById,
  getUserByEmail,
  createUser,
  isValidEmail,
  requireAuth,
  requireAdmin,
  logActivity,
  AuthedRequest,
  getActiveSessionCount,
} from "../lib/auth";

export const adminRouter = Router();

// Every route below requires a signed-in session AND the admin role.
// Scoped to /api/admin specifically — NOT a bare `.use(requireAuth, requireAdmin)`.
// A path-less middleware here would match every request that reaches this
// router, including the site's own homepage ("/"), which is exactly what
// caused visiting localhost:3000 directly to show a raw 401 JSON error
// instead of the actual site. Scoping it makes correctness independent of
// where adminRouter happens to be mounted relative to other middleware.
adminRouter.use("/api/admin", requireAuth, requireAdmin);

// ---------------------------------------------------------------------------
// ANALYTICS / OVERVIEW
// ---------------------------------------------------------------------------

adminRouter.get("/api/admin/stats", (_req, res) => {
  const users = db.data.users;
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const signupsLast7d = users.filter((u) => new Date(u.created_at).getTime() >= sevenDaysAgo).length;
  const signupsLast30d = users.filter((u) => new Date(u.created_at).getTime() >= thirtyDaysAgo).length;

  // Daily signup counts for the last 14 days, for a simple sparkline/chart.
  const dailySignups: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(now - i * 24 * 60 * 60 * 1000);
    const dayKey = day.toISOString().slice(0, 10);
    const count = users.filter((u) => u.created_at.slice(0, 10) === dayKey).length;
    dailySignups.push({ date: dayKey, count });
  }

  // Most-watched titles by watch_history frequency
  const watchCounts = new Map<number, { movieId: number; title: string | null; poster: string | null; count: number }>();
  db.data.watch_history.forEach((h) => {
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
    totalWatchlistEntries: db.data.watchlist.length,
    totalFavoriteEntries: db.data.favorites.length,
    totalWatchHistoryEntries: db.data.watch_history.length,
    totalComments: db.data.comments.length,
    pendingComments: db.data.comments.filter((c) => c.status === "pending").length,
    totalNotifications: db.data.notifications.length,
    totalAds: db.data.ads.length,
    activeAds: db.data.ads.filter((a) => a.active).length,
    totalDownloads: (db.data.downloads || []).length,
    openInquiries: (db.data.support_inquiries || []).filter((i) => i.status === "open").length,
    totalInquiries: (db.data.support_inquiries || []).length,
    topWatched,
  });
});

// ---------------------------------------------------------------------------
// USER MANAGEMENT
// ---------------------------------------------------------------------------

adminRouter.post("/api/admin/users", (req: AuthedRequest, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !String(name).trim()) { res.status(400).json({ error: "Name is required." }); return; }
  if (!email || !isValidEmail(email)) { res.status(400).json({ error: "A valid email is required." }); return; }
  if (!password || String(password).length < 8) { res.status(400).json({ error: "Password must be at least 8 characters." }); return; }
  if (getUserByEmail(email)) { res.status(409).json({ error: "An account with that email already exists." }); return; }

  // Goes through the same createUser() the public signup flow uses, so the
  // resulting account is a fully real, normally-registered user — not a
  // special admin-only record — and can sign in on the website immediately.
  const user = createUser(email, password, name);
  logActivity(req.user!.email, "user.create", user.email);
  res.status(201).json({ user: publicUser(user) });
});

adminRouter.get("/api/admin/users", (req, res) => {
  const { search, status, role, page = "1", pageSize = "25" } = req.query as Record<string, string>;
  let list = db.data.users;

  if (search) {
    const q = search.toLowerCase();
    list = list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }
  if (status) list = list.filter((u) => u.status === status);
  if (role) list = list.filter((u) => u.role === role);

  list = [...list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

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
      favoritesCount: db.data.favorites.filter((f) => f.user_id === u.id).length,
      watchlistCount: db.data.watchlist.filter((w) => w.user_id === u.id).length,
    })),
  });
});

adminRouter.put("/api/admin/users/:id", (req: AuthedRequest, res) => {
  const target = getUserById(req.params.id);
  if (!target) { res.status(404).json({ error: "User not found." }); return; }
  const { name, email } = req.body || {};
  if (name) target.name = String(name).trim();
  if (email) target.email = String(email).toLowerCase().trim();
  target.updated_at = new Date().toISOString();
  db.save();
  logActivity(req.user!.email, "user.update", target.email, { name, email });
  res.json({ user: publicUser(target) });
});

adminRouter.put("/api/admin/users/:id/status", (req: AuthedRequest, res) => {
  const target = getUserById(req.params.id);
  if (!target) { res.status(404).json({ error: "User not found." }); return; }
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
  target.updated_at = new Date().toISOString();
  db.save();
  logActivity(req.user!.email, `user.${status}`, target.email);
  res.json({ user: publicUser(target) });
});

adminRouter.put("/api/admin/users/:id/role", (req: AuthedRequest, res) => {
  const target = getUserById(req.params.id);
  if (!target) { res.status(404).json({ error: "User not found." }); return; }
  const { role } = req.body || {};
  if (!["user", "admin"].includes(role)) {
    res.status(400).json({ error: "role must be user or admin." });
    return;
  }
  target.role = role;
  target.updated_at = new Date().toISOString();
  db.save();
  logActivity(req.user!.email, "user.role_change", target.email, { role });
  res.json({ user: publicUser(target) });
});

adminRouter.delete("/api/admin/users/:id", (req: AuthedRequest, res) => {
  const target = getUserById(req.params.id);
  if (!target) { res.status(404).json({ error: "User not found." }); return; }
  if (target.role === "admin") {
    res.status(400).json({ error: "Administrator accounts cannot be deleted from here." });
    return;
  }
  const userId = target.id;
  db.data.users = db.data.users.filter((u) => u.id !== userId);
  db.data.watchlist = db.data.watchlist.filter((w) => w.user_id !== userId);
  db.data.favorites = db.data.favorites.filter((f) => f.user_id !== userId);
  db.data.watch_history = db.data.watch_history.filter((h) => h.user_id !== userId);
  db.data.notifications = db.data.notifications.filter((n) => n.user_id !== userId);
  db.data.downloads = (db.data.downloads || []).filter((d) => d.user_id !== userId);
  db.data.my_list = (db.data.my_list || []).filter((m) => m.user_id !== userId);
  db.save();
  logActivity(req.user!.email, "user.delete", target.email);
  res.json({ ok: true });
});

adminRouter.put("/api/admin/users/:id/subscription", (req: AuthedRequest, res) => {
  const target = getUserById(req.params.id);
  if (!target) { res.status(404).json({ error: "User not found." }); return; }
  const { subscription } = req.body || {};
  const allowed = ["Free", "Basic", "Standard", "Premium"];
  if (!allowed.includes(subscription)) {
    res.status(400).json({ error: `subscription must be one of: ${allowed.join(", ")}.` });
    return;
  }
  target.subscription = subscription;
  target.updated_at = new Date().toISOString();
  db.save();
  logActivity(req.user!.email, "user.subscription", target.email, { subscription });
  res.json({ user: publicUser(target) });
});

adminRouter.get("/api/admin/users/:id/data", (req: AuthedRequest, res) => {
  const target = getUserById(req.params.id);
  if (!target) { res.status(404).json({ error: "User not found." }); return; }
  const userId = target.id;
  res.json({
    user: publicUser(target),
    favorites: db.data.favorites.filter((f) => f.user_id === userId).length,
    watchlist: db.data.watchlist.filter((w) => w.user_id === userId).length,
    myList: (db.data.my_list || []).filter((m) => m.user_id === userId).length,
    watchHistory: db.data.watch_history.filter((h) => h.user_id === userId).length,
    downloads: (db.data.downloads || []).filter((d) => d.user_id === userId).length,
    notifications: db.data.notifications.filter((n) => n.user_id === userId).length,
    comments: db.data.comments.filter((c) => c.user_id === userId).length,
  });
});

adminRouter.delete("/api/admin/users/:id/data/:kind", (req: AuthedRequest, res) => {
  const target = getUserById(req.params.id);
  if (!target) { res.status(404).json({ error: "User not found." }); return; }
  const userId = target.id;
  const kind = req.params.kind;
  switch (kind) {
    case "watch_history":
      db.data.watch_history = db.data.watch_history.filter((h) => h.user_id !== userId);
      break;
    case "favorites":
      db.data.favorites = db.data.favorites.filter((f) => f.user_id !== userId);
      break;
    case "watchlist":
      db.data.watchlist = db.data.watchlist.filter((w) => w.user_id !== userId);
      break;
    case "my_list":
      db.data.my_list = (db.data.my_list || []).filter((m) => m.user_id !== userId);
      break;
    case "downloads":
      db.data.downloads = (db.data.downloads || []).filter((d) => d.user_id !== userId);
      break;
    case "notifications":
      db.data.notifications = db.data.notifications.filter((n) => n.user_id !== userId);
      break;
    default:
      res.status(400).json({ error: "kind must be watch_history, favorites, watchlist, my_list, downloads, or notifications." });
      return;
  }
  db.save();
  logActivity(req.user!.email, `user.clear_${kind}`, target.email);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// COMMENTS / REVIEWS MODERATION
// ---------------------------------------------------------------------------

adminRouter.get("/api/admin/comments", (req, res) => {
  const { status } = req.query as Record<string, string>;
  let list = db.data.comments;
  if (status) list = list.filter((c) => c.status === status);
  list = [...list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  res.json({ comments: list });
});

adminRouter.put("/api/admin/comments/:id/status", (req: AuthedRequest, res) => {
  const comment = db.data.comments.find((c) => c.id === req.params.id);
  if (!comment) { res.status(404).json({ error: "Comment not found." }); return; }
  const { status } = req.body || {};
  if (!["pending", "approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "status must be pending, approved, or rejected." });
    return;
  }
  comment.status = status;
  db.save();
  logActivity(req.user!.email, `comment.${status}`, comment.id);
  res.json({ comment });
});

adminRouter.delete("/api/admin/comments/:id", (req: AuthedRequest, res) => {
  const comment = db.data.comments.find((c) => c.id === req.params.id);
  db.data.comments = db.data.comments.filter((c) => c.id !== req.params.id);
  db.save();
  if (comment) logActivity(req.user!.email, "comment.delete", comment.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// LIVE CHAT MODERATION — the global "Popular" feed only. Private inbox
// messages between members stay private and are intentionally not exposed
// here, even to admins.
// ---------------------------------------------------------------------------

adminRouter.get("/api/admin/chat", (req, res) => {
  const { search } = req.query as Record<string, string>;
  let list = [...db.data.chat_messages].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
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
      createdAt: m.created_at,
    })),
  });
});

adminRouter.delete("/api/admin/chat/:id", (req: AuthedRequest, res) => {
  const message = db.data.chat_messages.find((m) => m.id === req.params.id);
  // Deleting a message also drops any replies threaded under it, so the
  // feed doesn't show orphaned "replying to a deleted message" bubbles.
  db.data.chat_messages = db.data.chat_messages.filter((m) => m.id !== req.params.id && m.parent_id !== req.params.id);
  db.save();
  if (message) logActivity(req.user!.email, "chat.delete", message.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// ADVERTISEMENT MANAGEMENT
// ---------------------------------------------------------------------------

adminRouter.get("/api/admin/ads", (_req, res) => {
  res.json({ ads: db.data.ads });
});

adminRouter.post("/api/admin/ads", (req: AuthedRequest, res) => {
  const { title, imageUrl, targetUrl, placement } = req.body || {};
  if (!title || !imageUrl || !targetUrl) {
    res.status(400).json({ error: "title, imageUrl, and targetUrl are required." });
    return;
  }
  const ad = {
    id: crypto.randomUUID(),
    title,
    image_url: imageUrl,
    target_url: targetUrl,
    placement: placement || "homepage_top",
    active: true,
    created_at: new Date().toISOString(),
  };
  db.data.ads.push(ad);
  db.save();
  logActivity(req.user!.email, "ad.create", title);
  res.status(201).json({ ad });
});

adminRouter.put("/api/admin/ads/:id", (req: AuthedRequest, res) => {
  const ad = db.data.ads.find((a) => a.id === req.params.id);
  if (!ad) { res.status(404).json({ error: "Ad not found." }); return; }
  const { title, imageUrl, targetUrl, placement, active } = req.body || {};
  if (title !== undefined) ad.title = title;
  if (imageUrl !== undefined) ad.image_url = imageUrl;
  if (targetUrl !== undefined) ad.target_url = targetUrl;
  if (placement !== undefined) ad.placement = placement;
  if (active !== undefined) ad.active = active;
  db.save();
  logActivity(req.user!.email, "ad.update", ad.title);
  res.json({ ad });
});

adminRouter.delete("/api/admin/ads/:id", (req: AuthedRequest, res) => {
  const ad = db.data.ads.find((a) => a.id === req.params.id);
  db.data.ads = db.data.ads.filter((a) => a.id !== req.params.id);
  db.save();
  if (ad) logActivity(req.user!.email, "ad.delete", ad.title);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// NOTIFICATION MANAGEMENT (site-wide broadcasts)
// ---------------------------------------------------------------------------

adminRouter.post("/api/admin/notifications/broadcast", (req: AuthedRequest, res) => {
  const { title, message, type } = req.body || {};
  if (!title || !message) {
    res.status(400).json({ error: "title and message are required." });
    return;
  }
  const createdAt = new Date().toISOString();
  db.data.users.forEach((u) => {
    db.data.notifications.push({
      id: crypto.randomUUID(),
      user_id: u.id,
      type: type || "announcement",
      title,
      message,
      read: 0,
      created_at: createdAt,
    });
  });
  db.save();
  logActivity(req.user!.email, "notification.broadcast", title, { recipients: db.data.users.length });
  res.status(201).json({ ok: true, recipients: db.data.users.length });
});

adminRouter.post("/api/admin/notifications/user", (req: AuthedRequest, res) => {
  const { userId, title, message, type } = req.body || {};
  if (!userId || !title || !message) {
    res.status(400).json({ error: "userId, title, and message are required." });
    return;
  }
  const target = getUserById(userId);
  if (!target) { res.status(404).json({ error: "User not found." }); return; }
  db.data.notifications.push({
    id: crypto.randomUUID(),
    user_id: target.id,
    type: type || "announcement",
    title,
    message,
    read: 0,
    created_at: new Date().toISOString(),
  });
  db.save();
  logActivity(req.user!.email, "notification.user", target.email, { title });
  res.status(201).json({ ok: true });
});

// ---------------------------------------------------------------------------
// CATEGORY / GENRE MANAGEMENT
// ---------------------------------------------------------------------------

adminRouter.get("/api/admin/categories", (_req, res) => {
  res.json({ overrides: db.data.category_overrides });
});

adminRouter.put("/api/admin/categories/:genreId", (req: AuthedRequest, res) => {
  const genreId = Number(req.params.genreId);
  const { label, hidden } = req.body || {};
  let override = db.data.category_overrides.find((c) => c.genre_id === genreId);
  if (!override) {
    override = { genre_id: genreId, label: null, hidden: false };
    db.data.category_overrides.push(override);
  }
  if (label !== undefined) override.label = label;
  if (hidden !== undefined) override.hidden = hidden;
  db.save();
  logActivity(req.user!.email, "category.update", String(genreId), { label, hidden });
  res.json({ override });
});

// ---------------------------------------------------------------------------
// SITE SETTINGS (homepage customization, AI settings, general config)
// ---------------------------------------------------------------------------

adminRouter.get("/api/admin/settings", (_req, res) => {
  res.json({ settings: db.data.site_settings });
});

adminRouter.put("/api/admin/settings", (req: AuthedRequest, res) => {
  db.data.site_settings = { ...db.data.site_settings, ...(req.body || {}) };
  db.save();
  logActivity(req.user!.email, "settings.update", "site_settings", req.body || {});
  res.json({ settings: db.data.site_settings });
});

// ---------------------------------------------------------------------------
// ACTIVITY / SECURITY LOGS
// ---------------------------------------------------------------------------

adminRouter.get("/api/admin/logs", (req, res) => {
  const { limit = "100" } = req.query as Record<string, string>;
  const n = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));
  const logs = [...db.data.activity_logs].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, n);
  res.json({ logs });
});

// ---------------------------------------------------------------------------
// CONTENT MANAGEMENT (CMS) — admin-authored movies/shows/trailers that live
// alongside TMDB's catalog. Each entry gets a unique negative numeric id so
// it can be merged into the same Movie[] arrays the rest of the frontend
// already uses without ever colliding with a real (always positive) TMDB id.
// ---------------------------------------------------------------------------

adminRouter.get("/api/admin/content", (_req, res) => {
  const items = [...db.data.custom_content].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  res.json({ items });
});

adminRouter.post("/api/admin/content", (req: AuthedRequest, res) => {
  const { title, overview, posterUrl, backdropUrl, trailerYoutubeKey, mediaType, genreNames, releaseDate, rating, featured } =
    req.body || {};

  if (!title || !String(title).trim()) {
    res.status(400).json({ error: "Title is required." });
    return;
  }
  if (!posterUrl || !String(posterUrl).trim()) {
    res.status(400).json({ error: "A poster image URL is required." });
    return;
  }

  const now = new Date().toISOString();
  const item: DbCustomContent = {
    id: crypto.randomUUID(),
    numeric_id: db.nextCustomContentId(),
    title: String(title).trim().slice(0, 200),
    overview: String(overview || "").trim().slice(0, 2000),
    poster_url: String(posterUrl).trim(),
    backdrop_url: String(backdropUrl || posterUrl).trim(),
    trailer_youtube_key: String(trailerYoutubeKey || "").trim(),
    media_type: mediaType === "tv" ? "tv" : "movie",
    genre_names: Array.isArray(genreNames) ? genreNames.map(String).slice(0, 6) : [],
    release_date: releaseDate || null,
    rating: Math.min(10, Math.max(0, Number(rating) || 0)),
    featured: !!featured,
    created_at: now,
    updated_at: now,
  };
  db.data.custom_content.push(item);
  db.save();
  logActivity(req.user!.email, "content.create", item.title, { id: item.id });
  res.status(201).json({ item });
});

adminRouter.put("/api/admin/content/:id", (req: AuthedRequest, res) => {
  const item = db.data.custom_content.find((c) => c.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: "Content not found." });
    return;
  }
  const { title, overview, posterUrl, backdropUrl, trailerYoutubeKey, mediaType, genreNames, releaseDate, rating, featured } =
    req.body || {};

  if (title !== undefined) item.title = String(title).trim().slice(0, 200);
  if (overview !== undefined) item.overview = String(overview).trim().slice(0, 2000);
  if (posterUrl !== undefined) item.poster_url = String(posterUrl).trim();
  if (backdropUrl !== undefined) item.backdrop_url = String(backdropUrl).trim();
  if (trailerYoutubeKey !== undefined) item.trailer_youtube_key = String(trailerYoutubeKey).trim();
  if (mediaType !== undefined) item.media_type = mediaType === "tv" ? "tv" : "movie";
  if (genreNames !== undefined) item.genre_names = Array.isArray(genreNames) ? genreNames.map(String).slice(0, 6) : [];
  if (releaseDate !== undefined) item.release_date = releaseDate || null;
  if (rating !== undefined) item.rating = Math.min(10, Math.max(0, Number(rating) || 0));
  if (featured !== undefined) item.featured = !!featured;
  item.updated_at = new Date().toISOString();

  db.save();
  logActivity(req.user!.email, "content.update", item.title, { id: item.id });
  res.json({ item });
});

adminRouter.delete("/api/admin/content/:id", (req: AuthedRequest, res) => {
  const item = db.data.custom_content.find((c) => c.id === req.params.id);
  db.data.custom_content = db.data.custom_content.filter((c) => c.id !== req.params.id);
  db.save();
  if (item) logActivity(req.user!.email, "content.delete", item.title, { id: item.id });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Help Desk support inquiries (submitted from the website contact form)
// ---------------------------------------------------------------------------

adminRouter.get("/api/admin/inquiries", (req, res) => {
  const status = String(req.query.status || "").trim();
  let items = [...(db.data.support_inquiries || [])].sort(
    (a, b) => (a.created_at < b.created_at ? 1 : -1)
  );
  if (status && ["open", "replied", "closed"].includes(status)) {
    items = items.filter((i) => i.status === status);
  }
  const search = String(req.query.search || "").trim().toLowerCase();
  if (search) {
    items = items.filter(
      (i) =>
        i.subject.toLowerCase().includes(search) ||
        i.message.toLowerCase().includes(search) ||
        i.user_email.toLowerCase().includes(search) ||
        i.user_name.toLowerCase().includes(search)
    );
  }
  res.json({ inquiries: items });
});

adminRouter.put("/api/admin/inquiries/:id", (req: AuthedRequest, res) => {
  const item = (db.data.support_inquiries || []).find((i) => i.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: "Inquiry not found." });
    return;
  }
  const { status, adminReply } = req.body || {};
  if (status !== undefined) {
    if (!["open", "replied", "closed"].includes(status)) {
      res.status(400).json({ error: "Invalid status." });
      return;
    }
    item.status = status;
  }
  if (adminReply !== undefined) {
    item.admin_reply = String(adminReply || "").trim() || null;
    if (item.admin_reply && item.status === "open") item.status = "replied";
  }
  item.updated_at = new Date().toISOString();
  db.save();
  logActivity(req.user!.email, "inquiry.update", item.subject, { id: item.id, status: item.status });
  res.json({ inquiry: item });
});

adminRouter.delete("/api/admin/inquiries/:id", (req: AuthedRequest, res) => {
  const item = (db.data.support_inquiries || []).find((i) => i.id === req.params.id);
  db.data.support_inquiries = (db.data.support_inquiries || []).filter((i) => i.id !== req.params.id);
  db.save();
  if (item) logActivity(req.user!.email, "inquiry.delete", item.subject, { id: item.id });
  res.json({ ok: true });
});
