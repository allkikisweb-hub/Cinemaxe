import React, { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { 
  Home, 
  Film, 
  Tv, 
  Clapperboard, 
  ListPlus, 
  Bookmark, 
  History, 
  Heart, 
  Download, 
  Settings, 
  HelpCircle,
  Info,
  Menu,
  ChevronDown,
  LogOut,
  Lock,
  Sun,
  Moon,
  Globe,
} from "lucide-react";
import { AvatarRenderer } from "./AnimatedAvatar";
import { InstallAppButton } from "./InstallAppButton";
import { APP_LANGUAGES } from "../i18n/translations";
import { AdBanner } from "./AdBanner";
import { fetchPublicAds, PublicAd } from "../utils/siteConfig";
import { CinemaxLogo } from "./CinemaxLogo";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { 
    currentView, 
    setCurrentView, 
    activeGenre, 
    setActiveGenre, 
    setActiveGenreName,
    user,
    isGuest,
    requireSignInPrompt,
    logoutUser,
    theme,
    toggleTheme,
    t,
    appLanguage,
    setAppLanguage,
    siteConfig,
  } = useApp();

  const [sidebarAds, setSidebarAds] = useState<PublicAd[]>([]);

  useEffect(() => {
    fetchPublicAds().then((ads) => setSidebarAds(ads.filter((a) => a.placement === "sidebar")));
  }, []);

  const pageConfig = siteConfig.contentPages || {};

  const GUEST_LOCKED_VIEWS = new Set(["mylist", "watchlist", "favorites", "profile"]);

  const primaryNavigation = [
    { id: "home", labelKey: "home", icon: Home },
    { id: "movies", labelKey: "movies", icon: Film },
    { id: "tv", labelKey: "tvShows", icon: Tv },
    { id: "shorts", labelKey: "shorts", icon: Clapperboard, badge: "NEW" },
    { id: "mylist", labelKey: "myList", icon: ListPlus },
    { id: "watchlist", labelKey: "watchlist", icon: Bookmark },
    { id: "history", labelKey: "history", icon: History },
    { id: "favorites", labelKey: "favorites", icon: Heart },
    { id: "downloads", labelKey: "downloads", icon: Download },
  ];

  const visiblePrimaryNav = primaryNavigation.filter((item) => {
    const cfg = pageConfig[item.id];
    return cfg ? cfg.enabled !== false : true;
  });

  const genres = [
    { id: "trending", label: "Trending" },
    { id: "popular", label: "Popular" },
    { id: "top_rated", label: "Top Rated" },
    { id: "upcoming", label: "Upcoming" },
    { id: "now_playing", label: "Now Playing" },
    { id: 28, label: "Action" },
    { id: 12, label: "Adventure" },
    { id: 16, label: "Animation" },
    { id: 35, label: "Comedy" },
    { id: 80, label: "Crime" },
    { id: 99, label: "Documentary" },
    { id: 18, label: "Drama" },
    { id: 10751, label: "Family" },
    { id: 14, label: "Fantasy" },
    { id: 36, label: "History" },
    { id: 27, label: "Horror" },
    { id: 10402, label: "Music" },
    { id: 9648, label: "Mystery" },
    { id: 10749, label: "Romance" },
    { id: 878, label: "Sci-Fi" },
    { id: 53, label: "Thriller" },
    { id: 10752, label: "War" },
    { id: 37, label: "Western" },
    { id: "superhero", label: "Superhero" },
    { id: "anime", label: "Anime" },
    { id: "kids", label: "Kids" },
    { id: "classic", label: "Classic" },
    { id: "award", label: "Award Winners" },
    { id: "latest", label: "Latest Releases" },
  ];

  const handleNavClick = (viewId: string) => {
    if (isGuest && GUEST_LOCKED_VIEWS.has(viewId)) {
      requireSignInPrompt();
      setIsOpen(false);
      return;
    }
    setActiveGenre(null);
    setActiveGenreName(null);
    setCurrentView(viewId);
  };

  const handleGenreClick = (genreId: number | string, label: string) => {
    setActiveGenre(genreId);
    setActiveGenreName(label);
    setCurrentView("movies");
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          id="mobile-backdrop"
          className="fixed inset-0 z-40 bg-black lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        id="sidebar"
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col border-r border-neutral-800 surface-panel text-neutral-400 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo Section */}
        <div id="logo-section" className="flex h-20 items-center justify-between px-6 border-b border-white/5">
          <div 
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={() => handleNavClick("home")}
          >
            <CinemaxLogo compact />
          </div>
          <button 
            id="close-sidebar-btn"
            aria-label="Close navigation menu"
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-900 hover:text-white lg:hidden"
            onClick={() => setIsOpen(false)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Navigation Lists */}
        <div id="nav-scroll-area" className="flex-1 overflow-y-auto px-4 py-6 space-y-8 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
          {/* Main Views */}
          <div id="primary-nav-group" className="space-y-1">
            {visiblePrimaryNav.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id && activeGenre === null;
              const navLabel = pageConfig[item.id]?.label || t(item.labelKey);
              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  onClick={() => {
                    handleNavClick(item.id);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center gap-4 px-4 py-3 rounded-r-xl rounded-l-none font-sans text-sm font-medium transition-all duration-200 group -ml-4 pl-8 border-l-2 ${
                    isActive 
                      ? "bg-gradient-to-r from-[rgba(57,255,20,0.1)] to-transparent text-[#39FF14] border-l-[#39FF14] border-y-transparent border-r-transparent" 
                      : "hover:bg-white/5 hover:text-white border-l-transparent border-y-transparent border-r-transparent"
                  }`}
                >
                  <Icon className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? "text-[#39FF14]" : "text-neutral-500 group-hover:text-white"
                  }`} />
                  <span className="flex-1 text-left">{navLabel}</span>
                  {isGuest && GUEST_LOCKED_VIEWS.has(item.id) && (
                    <Lock className="h-3.5 w-3.5 text-neutral-600 flex-shrink-0" />
                  )}
                  {item.badge && (
                    <span className="rounded bg-[#39FF14] px-1.5 py-0.5 text-[10px] font-extrabold text-black uppercase tracking-wider">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Categories */}
          <div id="categories-group" className="space-y-3">
            <div className="flex items-center justify-between px-4 text-xs font-bold tracking-wider text-neutral-500 uppercase">
              <span>{t("categories")}</span>
              <ChevronDown className="h-3 w-3" />
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar pr-1">
              {genres.map((g) => {
                const isActive = activeGenre === g.id;
                return (
                  <button
                    key={g.id}
                    id={`genre-item-${g.id}`}
                    onClick={() => {
                      handleGenreClick(g.id, t(`genre.${g.label}`));
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center px-4 py-2 text-sm rounded-lg transition-all duration-150 ${
                      isActive 
                        ? "text-[#39FF14] font-semibold bg-white/5" 
                        : "text-neutral-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <span className={`mr-3 h-1.5 w-1.5 rounded-full transition-all duration-200 ${
                      isActive ? "bg-[#39FF14] scale-125" : "bg-neutral-700"
                    }`} />
                    {t(`genre.${g.label}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {sidebarAds.length > 0 && (
            <div className="space-y-2 px-1">
              {sidebarAds.map((ad) => (
                <AdBanner key={ad.id} ad={ad} variant="sidebar" />
              ))}
            </div>
          )}

          {/* Settings & Support */}
          <div id="support-group" className="space-y-1">
            <button
              id="nav-settings-btn"
              onClick={() => {
                handleNavClick("profile");
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-4 px-4 py-2.5 text-sm rounded-lg hover:text-white hover:bg-white/5 transition-colors"
            >
              <Settings className="h-4 w-4 text-neutral-500" />
              <span className="flex-1 text-left">{t("settings")}</span>
              {isGuest && <Lock className="h-3.5 w-3.5 text-neutral-600" />}
            </button>
            <button
              id="nav-support-btn"
              onClick={() => {
                setCurrentView("help");
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-4 px-4 py-2.5 text-sm rounded-lg hover:text-white hover:bg-white/5 transition-colors"
            >
              <HelpCircle className="h-4 w-4 text-neutral-500" />
              <span>{t("helpDesk")}</span>
            </button>
            <button
              id="nav-about-btn"
              onClick={() => {
                setCurrentView("about");
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-4 px-4 py-2.5 text-sm rounded-lg hover:text-white hover:bg-white/5 transition-colors"
            >
              <Info className="h-4 w-4 text-neutral-500" />
              <span>{t("aboutCinemax")}</span>
            </button>
            <button
              id="nav-theme-toggle-btn"
              onClick={toggleTheme}
              className="flex w-full items-center gap-4 px-4 py-2.5 text-sm rounded-lg hover:text-white hover:bg-white/5 transition-colors"
              title="Toggle dark / light mode"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-neutral-500" />
              ) : (
                <Moon className="h-4 w-4 text-neutral-500" />
              )}
              <span className="flex-1 text-left">{theme === "dark" ? t("lightMode") : t("darkMode")}</span>
            </button>
            <div className="flex w-full items-center gap-4 px-4 py-2.5 text-sm rounded-lg">
              <Globe className="h-4 w-4 text-neutral-500 flex-shrink-0" />
              <span className="flex-1 text-left text-neutral-400">{t("language")}</span>
              <select
                value={appLanguage}
                onChange={(e) => setAppLanguage(e.target.value as typeof appLanguage)}
                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-[#39FF14]/40 cursor-pointer max-w-[110px]"
                aria-label={t("language")}
              >
                {APP_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
            <InstallAppButton />
          </div>
        </div>

        {/* User Card Footer */}
        {user && (
          <div
            id="user-sidebar-footer"
            className="border-t border-white/5 bg-black/40 p-4 flex items-center gap-3"
          >
            <button
              onClick={() => handleNavClick("profile")}
              className="relative group/avatar flex-shrink-0 cursor-pointer"
              title="Account Settings"
            >
              <div className="rounded-2xl overflow-hidden border border-neutral-800 group-hover/avatar:border-[#39FF14] transition-colors duration-300">
                <AvatarRenderer value={user.avatar} size={44} initials={user.name?.[0]?.toUpperCase() || "C"} />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#39FF14]"></span>
              </span>
            </button>
            <button
              onClick={() => handleNavClick("profile")}
              className="min-w-0 flex-1 text-left cursor-pointer"
              title="Account Settings"
            >
              <p className="text-xs font-bold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-neutral-500 truncate">{user.email}</p>
            </button>
            <button
              id="sidebar-logout-btn"
              onClick={logoutUser}
              aria-label="Log out"
              title="Log out"
              className="flex-shrink-0 p-2 rounded-xl text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
