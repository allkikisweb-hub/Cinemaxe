import React, { useState } from "react";
import {
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Sparkles,
  Mail,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";

import { useApp } from "../context/AppContext";

type ViteImportMeta = ImportMeta & {
  env?: Record<string, string | undefined>;
};

const ADMIN_PANEL_URL =
  ((import.meta as ViteImportMeta).env?.VITE_ADMIN_PANEL_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:5174";

/**
 * Cinemax site-wide footer.
 *
 * Rebuilt for a cleaner, more premium finish:
 *  - Uses only branding assets that actually ship in /public/branding
 *  - "Powered by AI" chip that highlights the All Kiki's assistant
 *  - Newsletter row + refined socials + admin portal trigger
 */
export const Footer: React.FC = () => {
  const { openAuthModal, setCurrentView, user } = useApp();
  const [adminRedirecting, setAdminRedirecting] = useState(false);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const redirectToAdminPanel = async () => {
    setAdminRedirecting(true);
    try {
      if (user?.role === "admin") {
        const res = await fetch("/api/auth/admin-portal-url", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.url) {
          window.location.href = data.url;
          return;
        }
      }
      window.location.href = ADMIN_PANEL_URL;
    } catch {
      window.location.href = ADMIN_PANEL_URL;
    } finally {
      setAdminRedirecting(false);
    }
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
    setEmail("");
    setTimeout(() => setSubscribed(false), 3500);
  };

  return (
    <footer
      id="site-footer"
      className="relative z-10 mt-24 border-t border-white/5 bg-gradient-to-b from-neutral-950 via-black to-black"
    >
      {/* Soft neon top accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#39FF14]/60 to-transparent"
      />

      <div className="mx-auto max-w-6xl px-6 sm:px-12 py-16">
        {/* ── Top row: brand + newsletter ─────────────────────────────── */}
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr] mb-14">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <img
                src="/branding/cinemax-logo-mark.svg"
                alt="Cinemax mark"
                className="h-12 w-12 rounded-2xl border border-[#39FF14]/30 bg-black/40 p-1.5 shadow-[0_0_24px_rgba(57,255,20,0.18)]"
              />
              <div className="leading-tight">
                <span className="block text-xl font-black tracking-tighter text-white">CINEMAX</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#39FF14]">
                  Stream · Discover · Chill
                </span>
              </div>
            </div>

            <p className="max-w-md text-sm leading-relaxed text-neutral-400">
              Your personal movie &amp; TV companion — AI-powered discovery, a watchlist
              that remembers where you left off, and fresh trending titles every day.
            </p>

            <div className="inline-flex items-center gap-2 rounded-full border border-[#39FF14]/25 bg-[#39FF14]/10 px-3 py-1.5 text-xs font-semibold text-[#39FF14]">
              <Sparkles className="h-3.5 w-3.5" />
              Powered by <span className="text-white">All Kiki&apos;s AI</span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              {[
                { icon: Facebook, label: "Facebook" },
                { icon: Twitter, label: "Twitter / X" },
                { icon: Instagram, label: "Instagram" },
                { icon: Youtube, label: "YouTube" },
              ].map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="group flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-neutral-400 transition-all hover:-translate-y-0.5 hover:border-[#39FF14]/40 hover:bg-[#39FF14]/10 hover:text-[#39FF14]"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Newsletter */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur">
            <h4 className="text-sm font-black uppercase tracking-widest text-white">
              Get weekly picks
            </h4>
            <p className="mt-2 text-xs text-neutral-500">
              A short email every Friday with what&apos;s trending, hidden gems, and what
              All Kiki&apos;s thinks you should watch next.
            </p>

            <form onSubmit={handleSubscribe} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@cinema.night"
                  className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-9 pr-3 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-[#39FF14]/50 focus:ring-1 focus:ring-[#39FF14]/30"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#39FF14] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-black transition hover:bg-[#39FF14]/90 active:scale-[0.98]"
              >
                Subscribe <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </form>
            {subscribed && (
              <p className="mt-3 text-xs text-[#39FF14]">✓ You&apos;re on the list. Talk Friday.</p>
            )}
          </div>
        </div>

        {/* ── Link columns ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          <FooterCol title="Explore">
            <FooterLink onClick={() => setCurrentView("movies")}>Movies</FooterLink>
            <FooterLink onClick={() => setCurrentView("tv")}>TV Shows</FooterLink>
            <FooterLink onClick={() => setCurrentView("shorts")}>Shorts</FooterLink>
            <FooterLink onClick={() => setCurrentView("mylist")}>My List</FooterLink>
          </FooterCol>

          <FooterCol title="Account">
            <FooterLink onClick={() => (user ? setCurrentView("profile") : openAuthModal("signin"))}>
              {user ? "Profile" : "Sign in"}
            </FooterLink>
            <FooterLink onClick={() => setCurrentView("downloads")}>Downloads</FooterLink>
            <FooterLink onClick={() => setCurrentView("watchlist")}>Watchlist</FooterLink>
            <FooterLink onClick={() => setCurrentView("history")}>History</FooterLink>
          </FooterCol>

          <FooterCol title="Company">
            <FooterLink id="footer-about-link" onClick={() => setCurrentView("about")}>
              About Us
            </FooterLink>
            <FooterLink id="footer-help-link" onClick={() => setCurrentView("help")}>
              Help Desk
            </FooterLink>
            <FooterLink onClick={() => setCurrentView("help")}>Contact</FooterLink>
            <FooterLink href="#">Careers</FooterLink>
          </FooterCol>

          <FooterCol title="Legal">
            <FooterLink href="#">Terms of Service</FooterLink>
            <FooterLink href="#">Privacy Policy</FooterLink>
            <FooterLink href="#">Cookie Policy</FooterLink>
            <FooterLink href="#">DMCA</FooterLink>
          </FooterCol>
        </div>
      </div>

      {/* ── Bottom bar ────────────────────────────────────────────────── */}
      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-[11px] text-neutral-600 sm:flex-row sm:px-12">
          <span>
            <button
              id="site-footer-copyright-trigger"
              type="button"
              onClick={() => openAuthModal("signin")}
              className="cursor-text select-text hover:text-neutral-500 focus:outline-none"
              tabIndex={-1}
            >
              ©
            </button>{" "}
            {new Date().getFullYear()} Cinemax. Built for movie &amp; TV lovers, everywhere.
          </span>

          <button
            type="button"
            onClick={redirectToAdminPanel}
            disabled={adminRedirecting}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 transition hover:border-[#39FF14]/40 hover:text-[#39FF14] disabled:opacity-50"
          >
            <ShieldCheck className="h-3 w-3" />
            {adminRedirecting ? "Opening…" : "Admin Portal"}
          </button>
        </div>
      </div>
    </footer>
  );
};

/* ── Small helpers kept in-file so the footer stays a single component ── */

const FooterCol: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <h4 className="text-xs font-black uppercase tracking-widest text-white">{title}</h4>
    <ul className="space-y-2.5 text-xs text-neutral-500">{children}</ul>
  </div>
);

const FooterLink: React.FC<{
  id?: string;
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}> = ({ id, href, onClick, children }) => {
  const className =
    "text-left transition-colors hover:text-[#39FF14] focus:outline-none focus:text-[#39FF14]";
  if (href) {
    return (
      <li>
        <a id={id} href={href} className={className}>
          {children}
        </a>
      </li>
    );
  }
  return (
    <li>
      <button id={id} type="button" onClick={onClick} className={`${className} cursor-pointer`}>
        {children}
      </button>
    </li>
  );
};
