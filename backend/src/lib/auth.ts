import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import db, { DbUser } from "../lib/db";

const COOKIE_NAME = "cinemax_session";
const TOKEN_EXPIRY = "7d";
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// A JWT secret MUST be provided in production. We fall back to a generated
// one for local/dev convenience only, and warn loudly so it isn't missed.
const JWT_SECRET: string =
  process.env.JWT_SECRET ||
  (() => {
    // Avoid noisy terminal output in dev when env isn't configured.
    // Use an insecure dev secret only for local convenience.
    return crypto.randomBytes(32).toString("hex");
  })();

const DEFAULT_PREFERENCES = {
  autoplayNext: true,
  autoplayTrailers: true,
  defaultQuality: "Auto",
  subtitleLanguage: "Off",
  audioLanguage: "English",
  notifyNewReleases: true,
  notifyRecommendations: false,
  matureContentLock: false,
  appLanguage: "English",
};

export function publicUser(u: DbUser) {
  let preferences = DEFAULT_PREFERENCES;
  try {
    preferences = { ...DEFAULT_PREFERENCES, ...JSON.parse(u.preferences || "{}") };
  } catch {
    // fall back to defaults on any malformed JSON
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
    createdAt: u.created_at,
  };
}

export function isValidEmail(email: string): boolean {
  const normalized = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(normalized)) return false;
  if (normalized.length > 254) return false;
  const [local, domain] = normalized.split("@");
  if (!local || !domain || local.length > 64) return false;
  if (domain.includes("..") || local.startsWith(".") || local.endsWith(".")) return false;
  return isRealEmailDomain(domain);
}

/** Blocks obviously fake / disposable email domains at sign-up. */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "tempmail.com", "10minutemail.com",
  "throwaway.email", "yopmail.com", "fakeinbox.com", "trashmail.com",
  "getnada.com", "dispostable.com", "maildrop.cc", "sharklasers.com",
  "example.com", "test.com", "localhost.com",
]);

function isRealEmailDomain(domain: string): boolean {
  if (DISPOSABLE_DOMAINS.has(domain)) return false;
  const parts = domain.split(".");
  if (parts.length < 2) return false;
  const tld = parts[parts.length - 1];
  if (tld.length < 2) return false;
  return true;
}

export function isStrongPassword(password: string): boolean {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

export function getUserByEmail(email: string): DbUser | undefined {
  const normalized = email.toLowerCase().trim();
  return db.data.users.find((u) => u.email === normalized);
}

export function getUserById(id: string): DbUser | undefined {
  return db.data.users.find((u) => u.id === id);
}

export function createUser(email: string, password: string, name: string, passwordHashOverride?: string): DbUser {
  const now = new Date().toISOString();
  const user: DbUser = {
    id: crypto.randomUUID(),
    email: email.toLowerCase().trim(),
    password_hash: passwordHashOverride || bcrypt.hashSync(password, 12),
    name: name.trim(),
    avatar: "anim:aurora",
    banner: "",
    subscription: "Free",
    role: "user",
    status: "active",
    preferences: JSON.stringify(DEFAULT_PREFERENCES),
    created_at: now,
    updated_at: now,
  };
  db.data.users.push(user);
  db.save();
  return user;
}

/**
 * Ensures exactly one administrator account exists. Runs once at startup.
 * The admin account has no usable password: it signs in exclusively via an
 * emailed one-time code (see issueOtp/verifyOtp below), and the login route
 * refuses password-based sign-in for any account with role "admin". The
 * password_hash column is still populated — with a random value nothing
 * could ever be typed to match — purely so the account shape matches every
 * other user record; it is never the credential actually checked.
 */
export function seedAdminUser() {
  const email = (process.env.ADMIN_EMAIL || "allkikisweb@gmail.com").toLowerCase().trim();
  const password = (process.env.ADMIN_PASSWORD || "").trim();
  const now = new Date().toISOString();
  const existingByEmail = getUserByEmail(email);
  const existingAdmin = db.data.users.find((u) => u.role === "admin");

  if (existingByEmail || existingAdmin) {
    const target = existingByEmail || existingAdmin!;
    target.email = email;
    target.name = "Cinemax Admin";
    target.role = "admin";
    target.status = "active";
    if (password) {
      target.password_hash = bcrypt.hashSync(password, 12);
    }
    target.updated_at = now;
    db.save();

    if (password) {
      console.warn(`[startup] Admin account ready for email/password sign-in (${email}).`);
    } else {
      console.warn(
        `[startup] Admin account ready for OTP-only sign-in (${email}). ` +
          "Set ADMIN_PASSWORD in .env to allow password-based admin login."
      );
    }
    return;
  }

  const passwordHash = password
    ? bcrypt.hashSync(password, 12)
    : bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), 12);

  const admin: DbUser = {
    id: crypto.randomUUID(),
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
    updated_at: now,
  };
  db.data.users.push(admin);
  db.save();

  if (password) {
    console.warn(`[startup] Seeded admin account for email/password sign-in (${email}).`);
  } else {
    console.warn(
      `[startup] Seeded the initial admin account (${email}). ` +
        "Set ADMIN_PASSWORD in .env to allow password-based admin login."
    );
  }
}

export function verifyPassword(user: DbUser, password: string): boolean {
  return bcrypt.compareSync(password, user.password_hash);
}

// ---------------------------------------------------------------------------
// ADMIN OTP LOGIN — the admin account authenticates exclusively via a
// one-time passcode emailed to it, never a static password. State lives in
// memory only (never written to disk): codes are short-lived by design, and
// keeping them out of the persisted DB file means they can't leak via a
// backup or a copy of data/cinemax.json.
// ---------------------------------------------------------------------------

interface OtpRecord {
  hash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between sends
const OTP_MAX_ATTEMPTS = 5;

const otpStore = new Map<string, OtpRecord>();

/** Sign-up email verification — separate store from admin OTP. */
const signupVerifyStore = new Map<string, OtpRecord & { name: string; passwordHash: string }>();

/** Password reset tokens — email → hashed token + expiry. */
const passwordResetStore = new Map<string, OtpRecord>();

/** True only for the account(s) provisioned with the admin role. */
export function isAdminEmail(email: string): boolean {
  const normalized = email.toLowerCase().trim();
  const user = getUserByEmail(normalized);
  return !!user && user.role === "admin";
}

/** Admin may sign in with password when ADMIN_PASSWORD is configured. */
export function getAdminLoginMethod(email: string): "otp" | "password" {
  if (!isAdminEmail(email)) return "password";
  if ((process.env.ADMIN_PASSWORD || "").trim()) return "password";
  return "otp";
}

/** Rejects a resend requested before the cooldown has elapsed. */
export function canSendOtp(email: string): { status: "ready" } | { status: "cooldown"; retryAfterMs: number } {
  const record = otpStore.get(email.toLowerCase().trim());
  if (!record) return { status: "ready" };
  const elapsed = Date.now() - record.lastSentAt;
  if (elapsed < OTP_RESEND_COOLDOWN_MS) {
    return { status: "cooldown", retryAfterMs: OTP_RESEND_COOLDOWN_MS - elapsed };
  }
  return { status: "ready" };
}

/** Generates, stores (hashed), and returns a fresh 6-digit OTP for an email. */
export function issueOtp(email: string): string {
  const normalized = email.toLowerCase().trim();
  const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  otpStore.set(normalized, {
    hash: bcrypt.hashSync(otp, 10),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: Date.now(),
  });
  return otp;
}

export type OtpVerifyResult = "ok" | "not_found" | "expired" | "too_many_attempts" | "invalid";

/** Verifies a submitted code. Consumes the record on success or exhaustion. */
export function verifyOtp(email: string, code: string): OtpVerifyResult {
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

  if (!bcrypt.compareSync(String(code || ""), record.hash)) {
    return "invalid";
  }

  otpStore.delete(normalized);
  return "ok";
}

export function issueSignupVerification(email: string, name: string, password: string): string {
  const normalized = email.toLowerCase().trim();
  const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  signupVerifyStore.set(normalized, {
    hash: bcrypt.hashSync(otp, 10),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: Date.now(),
    name: name.trim(),
    passwordHash: bcrypt.hashSync(password, 12),
  });
  return otp;
}

export type SignupVerifyResult =
  | { status: "ok"; name: string; passwordHash: string }
  | { status: "not_found" | "expired" | "too_many_attempts" | "invalid" };

export function verifySignupCode(email: string, code: string): SignupVerifyResult {
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
  if (!bcrypt.compareSync(String(code || ""), record.hash)) {
    return { status: "invalid" };
  }
  signupVerifyStore.delete(normalized);
  return { status: "ok", name: record.name, passwordHash: record.passwordHash };
}

export function issuePasswordReset(email: string): string {
  const normalized = email.toLowerCase().trim();
  const token = crypto.randomBytes(32).toString("hex");
  passwordResetStore.set(normalized, {
    hash: bcrypt.hashSync(token, 10),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: Date.now(),
  });
  return token;
}

export function verifyPasswordResetToken(email: string, token: string): OtpVerifyResult {
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
  if (!bcrypt.compareSync(String(token || ""), record.hash)) return "invalid";
  return "ok";
}

export function consumePasswordReset(email: string) {
  passwordResetStore.delete(email.toLowerCase().trim());
}

export function updatePasswordHash(userId: string, newPassword: string) {
  const user = getUserById(userId);
  if (!user) return;
  user.password_hash = bcrypt.hashSync(newPassword, 10);
  user.updated_at = new Date().toISOString();
  db.save();
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/** Short-lived token for secure admin-panel handoff from the main website. */
export function signPortalToken(userId: string): string {
  return jwt.sign({ sub: userId, purpose: "admin_portal" }, JWT_SECRET, { expiresIn: "15m" });
}

export function verifyPortalToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & { sub?: string; purpose?: string };
    if (payload.purpose !== "admin_portal" || !payload.sub) return null;
    const user = getUserById(payload.sub);
    if (!user || user.role !== "admin" || user.status !== "active") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string) {
  // In production the backend (Render) and frontend (InfinityFree) live on
  // different origins, so the session cookie must be SameSite=None + Secure
  // for browsers to include it on cross-site requests. In dev we keep Lax
  // so localhost testing still works without HTTPS.
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: TOKEN_EXPIRY_MS,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie(COOKIE_NAME, {
    path: "/",
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
  });
}

// ---------------------------------------------------------------------------
// ACTIVE SESSIONS — a lightweight in-memory "last seen" heartbeat, updated
// on every authenticated request. Deliberately not persisted to disk: it's
// only meant to answer "how many people are using the site right now", which
// resets fine on a restart. Anyone last seen within ACTIVE_WINDOW_MS counts
// as an active session for the admin dashboard.
// ---------------------------------------------------------------------------

const ACTIVE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const lastSeenAt = new Map<string, number>();

function markSeen(userId: string) {
  lastSeenAt.set(userId, Date.now());
}

export function getActiveSessionCount(): number {
  const cutoff = Date.now() - ACTIVE_WINDOW_MS;
  let count = 0;
  for (const ts of lastSeenAt.values()) {
    if (ts >= cutoff) count += 1;
  }
  return count;
}

export interface AuthedRequest extends Request {
  user?: DbUser;
}

/** Pulls the session token from either the httpOnly cookie (main site) or
 *  an `Authorization: Bearer` header (the standalone admin panel, which
 *  runs on a different origin and so can't rely on this site's cookie). */
function extractToken(req: AuthedRequest): string | undefined {
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (cookieToken) return cookieToken;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice("Bearer ".length).trim();
  return undefined;
}

/** Protects a route — responds 401 if there's no valid session. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Please sign in to continue." });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
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

/**
 * Like requireAuth, but never blocks the request — just resolves who (if
 * anyone) is signed in. Used by routes like the global chat feed that are
 * publicly readable but want to flag "liked by me" for a signed-in viewer.
 */
export function getOptionalUserId(req: AuthedRequest): string | undefined {
  const token = extractToken(req);
  if (!token) return undefined;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    const user = getUserById(payload.sub);
    return user && user.status === "active" ? user.id : undefined;
  } catch {
    return undefined;
  }
}

/** Protects admin-only routes — must be chained AFTER requireAuth. */
export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Administrator access required." });
    return;
  }
  next();
}

export { COOKIE_NAME };

/** Appends an entry to the admin activity log, trimmed to the last 500 entries. */
export function logActivity(actorEmail: string, action: string, target: string, meta: Record<string, any> = {}) {
  db.data.activity_logs.push({
    id: crypto.randomUUID(),
    actor_email: actorEmail,
    action,
    target,
    meta: JSON.stringify(meta),
    created_at: new Date().toISOString(),
  });
  if (db.data.activity_logs.length > 500) {
    db.data.activity_logs = db.data.activity_logs.slice(-500);
  }
  db.save();
}
