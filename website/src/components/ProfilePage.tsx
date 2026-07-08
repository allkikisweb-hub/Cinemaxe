import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import {
  Check,
  User,
  Lock,
  Sliders,
  ShieldAlert,
  Mail,
  Eye,
  EyeOff,
  Trash2,
  History,
  Save,
  Sparkles,
  LogOut,
  ExternalLink,
  ShieldCheck,
  Loader2,
  Upload,
  Sun,
  Moon,
  Bell,
  Zap,
  Globe,
} from "lucide-react";
import { formatBytes } from "../utils/localDownloads";
import { AvatarRenderer, ANIMATED_AVATARS, ANIM_PREFIX, CARTOON_AVATARS, CARTOON_PREFIX } from "./AnimatedAvatar";
import { APP_LANGUAGES } from "../i18n/translations";

type SettingsTab = "profile" | "security" | "preferences" | "danger";

async function resizeProfilePhoto(file: File): Promise<string> {
  const maxBytes = 480_000;
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  if (raw.length <= maxBytes) return raw;

  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = rej;
    img.src = raw;
  });

  const canvas = document.createElement("canvas");
  let w = img.width;
  let h = img.height;
  const maxDim = 256;
  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = (h / w) * maxDim;
      w = maxDim;
    } else {
      w = (w / h) * maxDim;
      h = maxDim;
    }
  }
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);

  let quality = 0.85;
  let result = canvas.toDataURL("image/jpeg", quality);
  while (result.length > maxBytes && quality > 0.35) {
    quality -= 0.08;
    result = canvas.toDataURL("image/jpeg", quality);
  }
  return result;
}

const inputClass =
  "w-full surface-input rounded-xl px-4 py-3 text-xs placeholder:text-neutral-600 transition-colors focus:outline-none";
const labelClass = "text-[10px] font-bold text-neutral-400 uppercase tracking-wider";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`settings-toggle ${checked ? "settings-toggle-on" : "settings-toggle-off"}`}
    >
      <span className={`settings-toggle-knob ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

function SettingsSection({ title, description, icon: Icon, children }: { title: string; description?: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="settings-section">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-[#39FF14]" />}
          <h3 className="font-sans font-bold text-base">{title}</h3>
        </div>
        {description && <p className="text-xs text-neutral-500 mt-1">{description}</p>}
      </div>
      <div className="settings-section-body">{children}</div>
    </div>
  );
}

function SettingsRow({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="text-xs text-neutral-500 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export const ProfilePage: React.FC = () => {
  const {
    user,
    isGuest,
    updateUserProfile,
    updateAccountDetails,
    changePassword,
    updatePreferences,
    clearWatchHistory,
    clearAllCache,
    deleteAccount,
    setAppLanguage,
    downloadStorageUsed,
    downloadStorageLimit,
    setCurrentView,
    logoutUser,
    requireSignInPrompt,
    openForgotPasswordModal,
    t,
    theme,
    toggleTheme,
  } = useApp();

  const [portalBusy, setPortalBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  const TABS: Array<{ id: SettingsTab; labelKey: string; icon: React.ElementType }> = [
    { id: "profile", labelKey: "profile", icon: User },
    { id: "security", labelKey: "security", icon: Lock },
    { id: "preferences", labelKey: "preferences", icon: Sliders },
    { id: "danger", labelKey: "dangerZone", icon: ShieldAlert },
  ];

  const [tab, setTab] = useState<SettingsTab>("profile");

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmCache, setConfirmCache] = useState(false);

  if (!user || isGuest) {
    return (
      <div id="no-profile-fallback" className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 bg-transparent">
        <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-500 mb-4">
          <User className="h-8 w-8" />
        </div>
        <h3 className="font-sans font-bold text-xl text-neutral-200">
          {isGuest ? "Sign in to manage your account" : "You are logged out"}
        </h3>
        <p className="text-sm text-neutral-500 max-w-sm mt-2 mb-6">
          {isGuest
            ? "You're browsing as a guest. Create an account or sign in to unlock your profile, avatars, and preferences."
            : "Log in to manage your account settings!"}
        </p>
        <button
          id="fallback-login-btn"
          onClick={() => (isGuest ? requireSignInPrompt() : setCurrentView("home"))}
          className="neon-btn font-semibold px-6 py-2.5 rounded-xl transition-all cursor-pointer"
        >
          {isGuest ? "Sign In" : "Return Home"}
        </button>
        {isGuest && (
          <button
            type="button"
            onClick={() => openForgotPasswordModal()}
            className="btn-forgot font-semibold px-6 py-2.5 rounded-xl transition-all cursor-pointer mt-3"
          >
            Forgot Password
          </button>
        )}
      </div>
    );
  }

  const handleSelectAvatar = (url: string) => updateUserProfile(user.name, url, user.banner);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadMsg({ type: "error", text: "Please choose a valid image file." });
      return;
    }
    setUploadBusy(true);
    setUploadMsg(null);
    try {
      const dataUrl = await resizeProfilePhoto(file);
      updateUserProfile(user.name, dataUrl, user.banner);
      setUploadMsg({ type: "ok", text: "Profile photo updated." });
      setTimeout(() => setUploadMsg(null), 3500);
    } catch {
      setUploadMsg({ type: "error", text: "Could not process that image. Try a smaller photo." });
    } finally {
      setUploadBusy(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await updateAccountDetails(name, email);
    setProfileMsg(result.ok ? { type: "ok", text: "Profile updated successfully." } : { type: "error", text: result.error || "Something went wrong." });
    setTimeout(() => setProfileMsg(null), 3500);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: "error", text: "New passwords do not match." });
      return;
    }
    setPwBusy(true);
    const result = await changePassword(currentPassword, newPassword);
    setPwBusy(false);
    if (result.ok) {
      setPwMsg({ type: "ok", text: "Password changed successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setPwMsg({ type: "error", text: result.error || "Something went wrong." });
    }
  };

  const handleOpenAdminPortal = async () => {
    setPortalBusy(true);
    try {
      const res = await fetch("/api/auth/admin-portal-url", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not open admin panel.");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      alert(err?.message || "Could not open admin panel.");
    } finally {
      setPortalBusy(false);
    }
  };

  const prefs = user.preferences;

  return (
    <div id="settings-page-container" className="settings-page max-w-5xl mx-auto py-10 px-4 sm:px-6 pb-24">
      <div className="space-y-2 mb-8">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl logo-mark font-black text-2xl mb-1">
          <Sliders className="h-6 w-6" />
        </div>
        <h1 className="font-sans text-3xl font-black tracking-tight">{t("accountSettings")}</h1>
        <p className="text-neutral-500 text-sm max-w-md">{t("preferences")} · {t("security")} · {t("profile")}</p>
        {user.role === "admin" && (
          <div className="mt-4 max-w-lg rounded-2xl accent-chip p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <ShieldCheck className="h-5 w-5 text-[#22c55e] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-white">Administrator Access</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Opens a secure, time-limited link to the Admin Panel — no password needed while signed in.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenAdminPortal}
              disabled={portalBusy}
              className="neon-btn inline-flex items-center justify-center gap-2 font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wide cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              {portalBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Admin Panel
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
        <nav className="settings-nav flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
          {TABS.map((tabItem) => {
            const Icon = tabItem.icon;
            const active = tab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                id={`settings-tab-${tabItem.id}`}
                onClick={() => setTab(tabItem.id)}
                className={`settings-nav-item ${active ? "settings-nav-item-active" : ""}`}
              >
                <Icon className="h-4 w-4" />
                {t(tabItem.labelKey)}
              </button>
            );
          })}
        </nav>

        <div className="settings-panel rounded-3xl p-6 md:p-8">
          {tab === "profile" && (
            <div className="space-y-8">
              {/* Live preview header card */}
              <div className="flex items-center gap-5 p-5 rounded-2xl bg-gradient-to-r from-white/[0.06] to-transparent border border-white/10">
                <AvatarRenderer value={user.avatar} size={72} initials={user.name?.[0]?.toUpperCase() || "C"} />
                <div className="min-w-0 flex-1">
                  <p className="font-sans font-bold text-lg text-white truncate">{user.name}</p>
                  <p className="text-xs text-neutral-500 truncate">{user.email}</p>
                  <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold uppercase tracking-wider bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/20 px-2 py-0.5 rounded-full">
                    {user.subscription}
                  </span>
                </div>
                <button
                  id="logout-btn"
                  onClick={() => logoutUser()}
                  className="flex-shrink-0 flex items-center gap-2 bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/30 text-neutral-300 hover:text-rose-400 text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Log Out</span>
                </button>
              </div>

              <SettingsSection title={t("uploadPhoto")} description="Use your own photo — JPG or PNG, automatically optimized." icon={Upload}>
                <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handlePhotoUpload} />
                <div className="flex flex-wrap items-center gap-4">
                  <AvatarRenderer value={user.avatar} size={80} initials={user.name?.[0]?.toUpperCase() || "C"} />
                  <button
                    type="button"
                    disabled={uploadBusy}
                    onClick={() => photoInputRef.current?.click()}
                    className="btn-secondary inline-flex items-center gap-2 font-bold px-5 py-3 rounded-xl text-xs uppercase tracking-wide cursor-pointer disabled:opacity-60"
                  >
                    {uploadBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {t("uploadPhoto")}
                  </button>
                </div>
                {uploadMsg && (
                  <div className={`mt-3 rounded-xl p-3 text-xs font-semibold ${uploadMsg.type === "ok" ? "accent-chip" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                    {uploadMsg.text}
                  </div>
                )}
              </SettingsSection>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-[#39FF14]" />
                  <h2 className="font-sans font-bold text-lg">{t("animatedAvatars")}</h2>
                </div>
                <p className="text-xs text-neutral-500 mb-4">Modern, motion-designed avatars — pick one and it animates live everywhere on Cinemax.</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                  {ANIMATED_AVATARS.map((anim) => {
                    const value = `${ANIM_PREFIX}${anim.id}`;
                    const isActive = user.avatar === value;
                    return (
                      <button
                        key={anim.id}
                        type="button"
                        onClick={() => handleSelectAvatar(value)}
                        title={anim.label}
                        className={`relative flex flex-col items-center gap-1.5 p-2 rounded-2xl cursor-pointer transition-all duration-300 ${
                          isActive ? "bg-[#39FF14]/10 ring-2 ring-[#39FF14] shadow-[0_0_20px_rgba(57,255,20,0.35)]" : "hover:bg-white/5 ring-1 ring-white/10"
                        }`}
                      >
                        <AvatarRenderer value={value} size={56} initials={user.name?.[0]?.toUpperCase() || "C"} />
                        <span className="text-[9px] font-semibold text-neutral-400 text-center leading-tight">{anim.label}</span>
                        {isActive && (
                          <div className="absolute top-1 right-1 bg-[#39FF14] text-black rounded-full p-0.5 shadow-lg">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h2 className="font-sans font-bold text-lg mb-1">{t("cartoonAvatars")}</h2>
                <p className="text-xs text-neutral-500 mb-4">Original, hand-designed character avatars — pick a face that fits your vibe.</p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                  {CARTOON_AVATARS.map((cartoon) => {
                    const value = `${CARTOON_PREFIX}${cartoon.id}`;
                    const isActive = user.avatar === value;
                    return (
                      <button
                        key={cartoon.id}
                        type="button"
                        onClick={() => handleSelectAvatar(value)}
                        title={cartoon.label}
                        className={`relative flex flex-col items-center gap-1.5 p-2 rounded-2xl cursor-pointer transition-all duration-300 transform hover:scale-105 ${
                          isActive ? "bg-[#39FF14]/10 ring-2 ring-[#39FF14] shadow-[0_0_20px_rgba(57,255,20,0.35)]" : "hover:bg-white/5 ring-1 ring-white/10"
                        }`}
                      >
                        <AvatarRenderer value={value} size={64} />
                        <span className="text-[9px] font-semibold text-neutral-400 text-center leading-tight">{cartoon.label}</span>
                        {isActive && (
                          <div className="absolute top-1 right-1 bg-[#39FF14] text-black rounded-full p-0.5 shadow-lg">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <form id="profile-details-form" onSubmit={handleSaveProfile} className="space-y-4 max-w-md">
                <h2 className="font-sans font-bold text-lg">{t("profileDetails")}</h2>
                <div className="space-y-1">
                  <label className={labelClass}>Display Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} pl-11`} placeholder="Your name" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} pl-11`} placeholder="you@example.com" />
                  </div>
                </div>

                {profileMsg && (
                  <div className={`rounded-xl p-3 text-xs font-semibold ${profileMsg.type === "ok" ? "bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                    {profileMsg.text}
                  </div>
                )}

                <button id="save-profile-btn" type="submit" className="neon-btn flex items-center gap-2 font-extrabold px-6 py-3 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer">
                  <Save className="h-4 w-4" />
                  {t("saveChanges")}
                </button>
              </form>
            </div>
          )}

          {tab === "security" && (
            <div className="max-w-md space-y-6">
              <div>
                <h2 className="font-sans font-bold text-lg text-white mb-1">Change Password</h2>
                <p className="text-xs text-neutral-500">
                  Enter your current password and choose a new one.
                </p>
                <button
                  type="button"
                  onClick={() => openForgotPasswordModal()}
                  className="btn-forgot mt-3 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide cursor-pointer"
                >
                  Forgot Password
                </button>
              </div>
              <form id="change-password-form" onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-1">
                  <label className={labelClass}>Current Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input
                      type={showPw ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className={`${inputClass} pl-11 pr-11`}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input
                      type={showPw ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`${inputClass} pl-11 pr-11`}
                      placeholder="At least 6 characters"
                      required
                      minLength={6}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white cursor-pointer">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Confirm New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    <input
                      type={showPw ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`${inputClass} pl-11`}
                      placeholder="Repeat new password"
                      required
                    />
                  </div>
                </div>

                {pwMsg && (
                  <div className={`rounded-xl p-3 text-xs font-semibold ${pwMsg.type === "ok" ? "bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                    {pwMsg.text}
                  </div>
                )}

                <button id="change-password-btn" type="submit" disabled={pwBusy} className="neon-btn flex items-center gap-2 font-extrabold px-6 py-3 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50">
                  <Lock className="h-4 w-4" />
                  {pwBusy ? "Updating..." : "Update Password"}
                </button>
              </form>
            </div>
          )}

          {tab === "preferences" && (
            <div className="space-y-8">
              <SettingsSection title={t("theme")} description="Switch between dark and light mode." icon={theme === "light" ? Sun : Moon}>
                <SettingsRow title={theme === "light" ? t("lightMode") : t("darkMode")} description="Applies instantly across the entire site.">
                  <Toggle checked={theme === "light"} onChange={() => toggleTheme()} />
                </SettingsRow>
              </SettingsSection>

              <SettingsSection title={t("language")} description="Interface language — 12 languages supported." icon={Globe}>
                <SettingsRow title={t("language")}>
                  <select
                    value={prefs.appLanguage}
                    onChange={(e) => setAppLanguage(e.target.value as any)}
                    className="settings-select"
                  >
                    {APP_LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                </SettingsRow>
              </SettingsSection>

              <SettingsSection title="Playback" description={t("preferences")} icon={Zap}>
                <SettingsRow title={t("autoplayNext")} description="Automatically continue to the next episode.">
                  <Toggle checked={prefs.autoplayNext} onChange={(v) => updatePreferences({ autoplayNext: v })} />
                </SettingsRow>
                <SettingsRow title={t("autoplayTrailers")} description="Play trailers automatically on hover/preview.">
                  <Toggle checked={prefs.autoplayTrailers} onChange={(v) => updatePreferences({ autoplayTrailers: v })} />
                </SettingsRow>
                <SettingsRow title={t("defaultQuality")}>
                  <select
                    value={prefs.defaultQuality}
                    onChange={(e) => updatePreferences({ defaultQuality: e.target.value as any })}
                    className="settings-select"
                  >
                    <option>Auto</option>
                    <option>4K</option>
                    <option>1080p</option>
                    <option>720p</option>
                  </select>
                </SettingsRow>
                <SettingsRow title={t("subtitleLanguage")}>
                  <select
                    value={prefs.subtitleLanguage}
                    onChange={(e) => updatePreferences({ subtitleLanguage: e.target.value })}
                    className="settings-select"
                  >
                    {["Off", "English", "Spanish", "French", "German", "Japanese", "Korean", "Kinyarwanda", "Arabic", "Chinese"].map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </SettingsRow>
                <SettingsRow title={t("dataSaver")} description="Lower default quality and reduce background data usage.">
                  <Toggle checked={prefs.dataSaver} onChange={(v) => updatePreferences({ dataSaver: v })} />
                </SettingsRow>
                <SettingsRow title={t("reducedMotion")} description="Minimize animations across the interface.">
                  <Toggle checked={prefs.reducedMotion} onChange={(v) => updatePreferences({ reducedMotion: v })} />
                </SettingsRow>
                <SettingsRow title="Compact Layout" description="Tighter spacing on lists and cards.">
                  <Toggle checked={prefs.compactLayout} onChange={(v) => updatePreferences({ compactLayout: v })} />
                </SettingsRow>
              </SettingsSection>

              <SettingsSection title={t("notifications")} icon={Bell}>
                <SettingsRow title={t("notifyNewReleases")} description="Get notified when new titles are added.">
                  <Toggle checked={prefs.notifyNewReleases} onChange={(v) => updatePreferences({ notifyNewReleases: v })} />
                </SettingsRow>
                <SettingsRow title={t("notifyRecommendations")} description="Occasional personalized picks based on your history.">
                  <Toggle checked={prefs.notifyRecommendations} onChange={(v) => updatePreferences({ notifyRecommendations: v })} />
                </SettingsRow>
                <SettingsRow title="Weekly Email Digest" description="A summary of new releases and your watchlist.">
                  <Toggle checked={prefs.emailDigest} onChange={(v) => updatePreferences({ emailDigest: v })} />
                </SettingsRow>
              </SettingsSection>

              <SettingsSection title="Privacy & Storage">
                <SettingsRow title={t("showProfileOnline")} description="Let others see when you're active in Live Chat.">
                  <Toggle checked={prefs.showProfileOnline} onChange={(v) => updatePreferences({ showProfileOnline: v })} />
                </SettingsRow>
                <SettingsRow title={t("matureContentLock")} description="Hide mature-rated titles across the app.">
                  <Toggle checked={prefs.matureContentLock} onChange={(v) => updatePreferences({ matureContentLock: v })} />
                </SettingsRow>
                <SettingsRow title={t("downloadStorage")} description={`${formatBytes(downloadStorageUsed ?? user.downloadStorageUsed ?? 0)} / 2 GB used.`}>
                  <button
                    type="button"
                    onClick={() => setCurrentView("downloads")}
                    className="text-[10px] font-bold text-[#39FF14] hover:underline cursor-pointer"
                  >
                    Manage
                  </button>
                </SettingsRow>
                {(downloadStorageUsed ?? user.downloadStorageUsed ?? 0) >= (downloadStorageLimit ?? user.downloadStorageLimit ?? 2147483648) && (
                  <p className="text-xs font-semibold text-rose-400 mt-2">{t("storageFull")}</p>
                )}
              </SettingsSection>
            </div>
          )}

          {tab === "danger" && (
            <div className="max-w-md space-y-6">
              <h2 className="font-sans font-bold text-lg text-white">Danger Zone</h2>

              <div className="rounded-2xl border border-white/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-white font-semibold text-sm">
                  <Trash2 className="h-4 w-4 text-neutral-400" />
                  Clear Cache
                </div>
                <p className="text-xs text-neutral-500">Wipes all lists, favorites, history, downloads, notifications, and local preferences.</p>
                {confirmCache ? (
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        await clearAllCache();
                        setConfirmCache(false);
                      }}
                      className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
                    >
                      Confirm Clear Everything
                    </button>
                    <button onClick={() => setConfirmCache(false)} className="bg-white/5 hover:bg-white/10 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmCache(true)} className="bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer">
                    Clear Cache
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-white font-semibold text-sm">
                  <History className="h-4 w-4 text-neutral-400" />
                  Clear Watch History
                </div>
                <p className="text-xs text-neutral-500">Removes all items from your continue-watching list. This can't be undone.</p>
                {confirmClear ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        clearWatchHistory();
                        setConfirmClear(false);
                      }}
                      className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
                    >
                      Confirm Clear
                    </button>
                    <button onClick={() => setConfirmClear(false)} className="bg-white/5 hover:bg-white/10 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmClear(true)} className="bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer">
                    Clear History
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                  <Trash2 className="h-4 w-4" />
                  Delete Account
                </div>
                <p className="text-xs text-neutral-500">Permanently signs you out and erases your local Cinemax profile, favorites, and watch history from this device.</p>
                {confirmDelete ? (
                  <div className="flex gap-2">
                    <button
                      id="confirm-delete-account-btn"
                      onClick={deleteAccount}
                      className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
                    >
                      Yes, Delete Everything
                    </button>
                    <button onClick={() => setConfirmDelete(false)} className="bg-white/5 hover:bg-white/10 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    id="delete-account-btn"
                    onClick={() => setConfirmDelete(true)}
                    className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
                  >
                    Delete My Account
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
