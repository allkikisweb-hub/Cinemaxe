import React, { useState, useEffect, useRef, useCallback } from "react";
import { AppProvider, useApp } from "./context/AppContext";
import { Sidebar } from "./components/Sidebar";
import { MovieCard } from "./components/MovieCard";
import { WatchChoiceModal } from "./components/WatchChoiceModal";
import { PlayerPage } from "./components/PlayerPage";
import { ProfilePage } from "./components/ProfilePage";
import { DownloadsPage } from "./components/DownloadsPage";
import { HelpDeskPage } from "./components/HelpDeskPage";
import { AdminRedirect } from "./components/AdminRedirect";
import { AdBanner } from "./components/AdBanner";
import { MaintenanceScreen } from "./components/MaintenanceScreen";
import { AuthModal } from "./components/AuthModal";
import { PipPlayer } from "./components/PipPlayer";
import { AvatarRenderer } from "./components/AnimatedAvatar";
import { NotificationCenter } from "./components/NotificationCenter";
import { LandingPage } from "./components/LandingPage";
import { CinemaxLogo } from "./components/CinemaxLogo";
import { AboutPage } from "./components/AboutPage";
import { MoviesPage } from "./components/MoviesPage";
import { TVShowsPage } from "./components/TVShowsPage";
import { ShortsPage } from "./components/ShortsPage";
import { HomeAIAssistant } from "./components/HomeAIAssistant";
import { MovieDetailsModal } from "./components/MovieDetailsModal";
import { Footer } from "./components/Footer";
import { LiveChat } from "./components/LiveChat";
import { AdminDestinationModal } from "./components/AdminDestinationModal";
import { tmdb, getImageUrl, isTvShow, prepareForPlayback } from "./utils/tmdb";
import {
  filterHiddenMovies,
  applyTrendingOverride,
  loadFeaturedMovies,
  fetchPublicAds,
  PublicAd,
} from "./utils/siteConfig";
import { Movie } from "./types";
import { 
  Search, 
  Bell, 
  Menu, 
  Star, 
  Play, 
  Info, 
  Bookmark, 
  Heart, 
  History as HistoryIcon,
  Download,
  Tv,
  ChevronRight,
  ListPlus,
  Lock,
  Tag
} from "lucide-react";

// Pre-configured "Supergirl" Featured Hero Movie matching references
const SUPERGIRL_HERO: Movie = {
  id: 502356,
  title: "Supergirl",
  overview: "Kara Zor-El faces new challenges as she embraces her destiny in a world that needs a hero.",
  poster_path: "/subfash_supergirl_poster.jpg", // TMDB path or fallback
  backdrop_path: "/z993883u82.jpg", // fallback background
  vote_average: 8.2,
  release_date: "2023-06-16",
  genres: [{ id: 28, name: "Action" }, { id: 878, name: "Sci-Fi" }],
  runtime: 124,
};

// SUPERGIRL_HERO's backdrop_path isn't a real TMDB fragment, so it needs its
// own fallback image whenever it's the one showing in the rotating hero.
const HERO_FALLBACK_BACKDROP = "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1400&auto=format&fit=crop";

const CinemaxDashboard: React.FC = () => {
  const { 
    currentView, 
    setCurrentView, 
    selectedMovie, 
    setSelectedMovie, 
    playerMode, 
    setPlayerMode,
    searchQuery, 
    setSearchQuery, 
    user,
    activeGenre,
    setActiveGenre,
    activeGenreName,
    setActiveGenreName,
    rememberChoice,
    defaultWatchChoice,
    addToWatchlist,
    user: currentUser,
    unreadCount,
    authLoading,
    requireSignInPrompt,
    enterAsGuest,
    isGuest,
    authModalOpen,
    authModalMode,
    authModalInitialStep,
    openAuthModal,
    openForgotPasswordModal,
    closeAuthModal,
    t,
    adminDestinationOpen,
    goToAdminPanel,
    dismissAdminToWebsite,
    siteConfig,
  } = useApp();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [allGenres, setAllGenres] = useState<Array<{ id: number; name: string }>>([]);
  const [choiceModalOpen, setChoiceModalOpen] = useState(false);
  const [modalTargetMovie, setModalTargetMovie] = useState<Movie | null>(null);

  // Hero banner rotation — cycles the homepage hero through a handful of
  // featured titles every 3 seconds.
  const [heroIndex, setHeroIndex] = useState(0);

  // "More Info" details modal — a distinct, fuller view of a title, separate
  // from actually starting playback.
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsModalMovie, setDetailsModalMovie] = useState<Movie | null>(null);

  // Splash screen states
  const [showSplash, setShowSplash] = useState(true);
  const [fadeSplash, setFadeSplash] = useState(false);

  // TMDB Lists state
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [trendingTV, setTrendingTV] = useState<Movie[]>([]);
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);
  const [topRated, setTopRated] = useState<Movie[]>([]);
  const [upcoming, setUpcoming] = useState<Movie[]>([]);
  const [nowPlaying, setNowPlaying] = useState<Movie[]>([]);
  const [customContent, setCustomContent] = useState<Movie[]>([]);
  const [featuredHeroMovies, setFeaturedHeroMovies] = useState<Movie[]>([]);
  const [publicAds, setPublicAds] = useState<PublicAd[]>([]);

  // Search/Filters results state
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [genreFilteredMovies, setGenreFilteredMovies] = useState<Movie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const [searchNextPage, setSearchNextPage] = useState(4);
  const searchSentinelRef = useRef<HTMLDivElement>(null);
  const [preparingPlayKey, setPreparingPlayKey] = useState<string | null>(null);

  // (Live TV feature replaced by Shorts — see ShortsPage.tsx)

  // Load all lists — honors admin catalog curation (hidden IDs, trending override, featured hero)
  useEffect(() => {
    const loadAllLists = async () => {
      try {
        const hiddenIds = siteConfig.hiddenMovieIds || [];
        const trendingOverride = siteConfig.trendingOverrideIds || [];
        const featuredIds = siteConfig.featuredMovieIds || [];

        const [trendingM, trendingT, popular, top, up, now] = await Promise.all([
          tmdb.getTrendingMovies(),
          tmdb.getTrendingTVShows(),
          tmdb.getPopularMovies(),
          tmdb.getTopRatedMovies(),
          tmdb.getUpcomingMovies(),
          tmdb.getNowPlayingMovies(),
        ]);

        const applyHidden = (list: Movie[]) => filterHiddenMovies(list, hiddenIds);
        let curatedTrending = applyHidden(trendingM);
        if (trendingOverride.length) {
          curatedTrending = await applyTrendingOverride(curatedTrending, trendingOverride);
        }

        setTrendingMovies(curatedTrending);
        setTrendingTV(applyHidden(trendingT));
        setPopularMovies(applyHidden(popular));
        setTopRated(applyHidden(top));
        setUpcoming(applyHidden(up));
        setNowPlaying(applyHidden(now));

        if (featuredIds.length) {
          setFeaturedHeroMovies(await loadFeaturedMovies(featuredIds));
        } else {
          setFeaturedHeroMovies([]);
        }

        try {
          const customRes = await fetch("/api/content/custom");
          if (customRes.ok) {
            const { movies } = await customRes.json();
            setCustomContent(movies || []);
          }
        } catch {
          /* optional */
        }

        try {
          setPublicAds(await fetchPublicAds());
        } catch {
          setPublicAds([]);
        }

        const genreList = await tmdb.getGenres("movie");
        try {
          const catRes = await fetch("/api/categories/public");
          if (catRes.ok) {
            const { hiddenIds: hiddenGenreIds, labels } = await catRes.json();
            const hiddenSet = new Set(hiddenGenreIds);
            setAllGenres(
              genreList
                .filter((g: { id: number }) => !hiddenSet.has(g.id))
                .map((g: { id: number; name: string }) => ({
                  id: g.id,
                  name: labels?.[String(g.id)] || g.name,
                }))
            );
          } else {
            setAllGenres(genreList);
          }
        } catch {
          setAllGenres(genreList);
        }
      } catch (err) {
        console.error("Failed to load TMDB lists on app startup:", err);
      }
    };
    loadAllLists();
  }, [siteConfig.hiddenMovieIds, siteConfig.trendingOverrideIds, siteConfig.featuredMovieIds]);

  // One-time movie-focused splash screen timer
  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFadeSplash(true);
    }, 1800);

    const unmountTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  // Hero rotation — admin-featured titles, or curated Supergirl + trending fallback
  const heroMovies =
    featuredHeroMovies.length > 0
      ? featuredHeroMovies
      : trendingMovies.length > 0
        ? [SUPERGIRL_HERO, ...trendingMovies.slice(0, 4)]
        : [SUPERGIRL_HERO];
  const heroMovie = heroMovies[heroIndex % heroMovies.length];

  useEffect(() => {
    if (heroMovies.length < 2) return;
    const t = setInterval(() => setHeroIndex((i) => (i + 1) % heroMovies.length), 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroMovies.length]);

  // Unified search — movies + TV + multi index, ranked and paginated
  useEffect(() => {
    if (searchQuery.trim().length <= 1) {
      setSearchResults([]);
      setSearchHasMore(false);
      setSearchNextPage(4);
      return;
    }

    setIsSearching(true);
    const q = searchQuery.trim();
    const delayDebounce = setTimeout(async () => {
      try {
        const [tmdbBatch, customMatches] = await Promise.all([
          tmdb.searchEverything(q, { startPage: 1, pageCount: 3 }),
          tmdb.searchCustomContent(q),
        ]);
        const seen = new Set<string>();
        const combined: Movie[] = [];
        for (const item of [...customMatches, ...tmdbBatch.results]) {
          const key = `${item.media_type || (item.title ? "movie" : "tv")}:${item.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          combined.push(item);
        }
        setSearchResults(combined);
        setSearchHasMore(tmdbBatch.hasMore);
        setSearchNextPage(4);
      } catch (err) {
        console.error("Advanced search query error:", err);
        setSearchResults([]);
        setSearchHasMore(false);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const loadMoreSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (q.length <= 1 || searchLoadingMore || !searchHasMore) return;
    setSearchLoadingMore(true);
    try {
      const batch = await tmdb.searchEverything(q, { startPage: searchNextPage, pageCount: 2 });
      setSearchResults((prev) => {
        const seen = new Set(prev.map((m) => `${m.media_type || (m.title ? "movie" : "tv")}:${m.id}`));
        const added = batch.results.filter((m) => {
          const key = `${m.media_type || (m.title ? "movie" : "tv")}:${m.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return [...prev, ...added];
      });
      setSearchHasMore(batch.hasMore);
      setSearchNextPage((p) => p + 2);
    } catch (err) {
      console.error("Search pagination error:", err);
    } finally {
      setSearchLoadingMore(false);
    }
  }, [searchQuery, searchLoadingMore, searchHasMore, searchNextPage]);

  useEffect(() => {
    const el = searchSentinelRef.current;
    if (!el || searchQuery.trim().length <= 1) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreSearch();
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [searchQuery, loadMoreSearch, searchHasMore]);

  // Handle genre/category filter changes (upgraded to support all 29 categories!)
  useEffect(() => {
    if (activeGenre !== null) {
      const loadGenreMovies = async () => {
        try {
          const allPool = [
            ...trendingMovies,
            ...popularMovies,
            ...topRated,
            ...upcoming,
            ...nowPlaying,
            ...trendingTV
          ];
          
          // Remove duplicates
          const uniquePool = Array.from(new Map(allPool.map(item => [item.id, item])).values());
          
          let filtered: Movie[] = [];
          if (typeof activeGenre === "number") {
            filtered = uniquePool.filter(m => m.genre_ids?.includes(activeGenre));
          } else {
            // String-based custom category matches
            switch (activeGenre) {
              case "trending":
                filtered = [...trendingMovies];
                break;
              case "popular":
                filtered = [...popularMovies];
                break;
              case "top_rated":
                filtered = [...topRated];
                break;
              case "upcoming":
                filtered = [...upcoming];
                break;
              case "now_playing":
                filtered = [...nowPlaying];
                break;
              case "superhero":
                const keywords = ["super", "man", "spider", "bat", "captain", "avenger", "hero", "knight", "girl", "marvel", "dc", "justice"];
                filtered = uniquePool.filter(m => {
                  const title = (m.title || m.name || "").toLowerCase();
                  return keywords.some(kw => title.includes(kw));
                });
                break;
              case "anime":
                filtered = uniquePool.filter(m => 
                  m.genre_ids?.includes(16) || 
                  (m.title || m.name || "").toLowerCase().includes("anime") ||
                  (m.title || m.name || "").toLowerCase().includes("demon")
                );
                break;
              case "kids":
                filtered = uniquePool.filter(m => m.genre_ids?.includes(10751) || m.genre_ids?.includes(16));
                break;
              case "classic":
                filtered = uniquePool.filter(m => {
                  const date = m.release_date || m.first_air_date || "";
                  const year = parseInt(date.substring(0, 4));
                  return !isNaN(year) && year < 2018;
                });
                break;
              case "award":
                filtered = uniquePool.filter(m => m.vote_average >= 8.0);
                break;
              case "latest":
                filtered = uniquePool.filter(m => {
                  const date = m.release_date || m.first_air_date || "";
                  const year = parseInt(date.substring(0, 4));
                  return !isNaN(year) && year >= 2023;
                });
                break;
              default:
                filtered = uniquePool;
            }
          }
          setGenreFilteredMovies(filtered);
        } catch (err) {
          console.error("Error filtering by genre:", err);
        }
      };
      loadGenreMovies();
    } else {
      setGenreFilteredMovies([]);
    }
  }, [activeGenre, trendingMovies, popularMovies, topRated, upcoming, nowPlaying, trendingTV]);

  const handleMovieClick = async (movie: Movie) => {
    const playKey = `${movie.media_type || (isTvShow(movie) ? "tv" : "movie")}:${movie.id}`;
    setPreparingPlayKey(playKey);
    try {
      const ready = await prepareForPlayback(movie);
      if (rememberChoice && defaultWatchChoice) {
        setSelectedMovie(ready);
        setPlayerMode(defaultWatchChoice);
        setCurrentView("player");
      } else {
        setModalTargetMovie(ready);
        setChoiceModalOpen(true);
      }
    } catch (err) {
      console.error("Failed to prepare title for playback:", err);
      const fallback: Movie = {
        ...movie,
        media_type: movie.media_type ?? (isTvShow(movie) ? "tv" : "movie"),
      };
      setModalTargetMovie(fallback);
      setChoiceModalOpen(true);
    } finally {
      setPreparingPlayKey(null);
    }
  };

  const handlePlayFullMovie = async (movie: Movie) => {
    const playKey = `${movie.media_type || (isTvShow(movie) ? "tv" : "movie")}:${movie.id}`;
    setPreparingPlayKey(playKey);
    try {
      const ready = await prepareForPlayback(movie);
      setSelectedMovie(ready);
      setPlayerMode("full");
      setChoiceModalOpen(false);
      setCurrentView("player");
    } catch (err) {
      console.error("Failed to prepare full movie stream:", err);
      setSelectedMovie({
        ...movie,
        media_type: movie.media_type ?? (isTvShow(movie) ? "tv" : "movie"),
      });
      setPlayerMode("full");
      setChoiceModalOpen(false);
      setCurrentView("player");
    } finally {
      setPreparingPlayKey(null);
    }
  };

  const handleChoiceSelected = (choice: "full" | "trailer") => {
    if (!modalTargetMovie) return;
    setSelectedMovie(modalTargetMovie);
    setPlayerMode(choice);
    setChoiceModalOpen(false);
    setCurrentView("player");
  };

  // Check Watchlisted items for "My List" view
  const getMyListMovies = () => {
    if (!user) return [];
    const ids = user.myList || user.watchlist || [];
    const all = [...trendingMovies, ...trendingTV, ...popularMovies, ...topRated];
    const matched = all.filter(m => ids.includes(m.id));
    return Array.from(new Map(matched.map(item => [item.id, item])).values());
  };

  const getContinueWatchingMovies = () => {
    if (!user?.watchHistory) return [];
    const inProgress = user.watchHistory.filter(h => h.progress > 0 && h.progress < 100);
    const all = [...trendingMovies, ...trendingTV, ...popularMovies, ...topRated];
    return inProgress.map(h => {
      const found = all.find(m => m.id === h.id);
      return found ? { ...found, _progress: h.progress, _season: h.season, _episode: h.episode } : null;
    }).filter(Boolean) as (Movie & { _progress?: number; _season?: number; _episode?: number })[];
  };

  // Reusable "sign in required" placeholder for guest-restricted views
  const renderGuestLock = (label: string) => (
    <div className="text-center py-24 text-neutral-500 space-y-4">
      <div className="h-14 w-14 rounded-2xl surface-elevated flex items-center justify-center mx-auto text-neutral-400">
        <Lock className="h-6 w-6" />
      </div>
      <h3 className="font-sans font-bold text-lg text-neutral-300">Sign in to view {label}</h3>
      <p className="text-xs max-w-sm mx-auto">You're browsing as a guest. Create a free account or sign in to unlock this.</p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={() => requireSignInPrompt()}
          className="neon-btn inline-flex items-center gap-2 font-bold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wide transition-all cursor-pointer"
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => openForgotPasswordModal()}
          className="btn-forgot inline-flex items-center gap-2 font-bold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wide cursor-pointer"
        >
          Forgot Password
        </button>
      </div>
    </div>
  );

  // Helper for rendering horizontal row shelfs
  const renderRowShelf = (title: string, movies: Movie[], hasRank = false, seeAllTarget?: { view: "movies" | "tv"; genre?: string | number | null; genreLabel?: string }) => {
    if (movies.length === 0) return null;
    return (
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-5 w-1 bg-[#22c55e] rounded-full" />
            <h3 className="font-sans font-extrabold text-lg tracking-tight text-white">
              {title}
            </h3>
          </div>
          <button
            onClick={() => {
              if (seeAllTarget) {
                setActiveGenre(seeAllTarget.genre ?? null);
                setActiveGenreName(seeAllTarget.genreLabel ?? title);
                setCurrentView(seeAllTarget.view);
              } else {
                setCurrentView("movies");
              }
            }}
            className="flex items-center gap-1 text-xs font-semibold text-[#39FF14] hover:text-[#31dd11] transition-colors cursor-pointer"
          >
            <span>See All</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-neutral-900 scrollbar-track-transparent">
          {movies.map((movie, index) => (
            <div key={movie.id} className="flex-none w-[130px] sm:w-[150px]">
              <MovieCard
                movie={movie}
                rank={hasRank ? index + 1 : undefined}
                onClick={() => handleMovieClick(movie)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const splashScreen = (
    <div
      id="splash-loader-screen"
      className={`fixed inset-0 z-[10000] bg-[#050505] on-dark-bg flex flex-col items-center justify-center transition-opacity duration-500 ease-out ${fadeSplash ? "opacity-0 pointer-events-none" : "opacity-100"}`}
    >
      <div className="flex flex-col items-center gap-6 max-w-sm px-6 text-center">
        <div className="h-20 w-20 rounded-3xl logo-mark flex items-center justify-center">
          <svg
            className="h-10 w-10 text-black"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H2Z" />
            <path d="M2 7h20" />
            <path d="m14 2-4 5" />
            <path d="m8 2-4 5" />
            <path d="m20 2-4 5" />
            <path d="M10 11H7v7h3V11Z" />
            <path d="M17 11h-3v7h3V11Z" />
          </svg>
        </div>

        <div className="space-y-1.5">
          <span className="text-2xl font-black tracking-tighter flex items-center justify-center select-none font-sans">
            <span className="brand-cinema">CINEMA</span><span className="brand-x">X</span>
          </span>
          <p className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase font-black">
            STRICTLY MOVIES & SERIES ONLY
          </p>
        </div>
      </div>
    </div>
  );

  // Minimal branded header shown above Help/About when browsed pre-login,
  // so those pages don't feel orphaned on a blank background. Clicking the
  // logo returns to the marketing landing page.
  const publicPageHeader = (
    <header className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-6">
      <button
        id="public-page-logo-home-btn"
        onClick={() => setCurrentView("home")}
        className="flex items-center gap-2 cursor-pointer"
      >
        <CinemaxLogo compact />
      </button>
      <button
        id="public-page-signin-btn"
        onClick={() => openAuthModal("signin")}
        className="text-xs font-bold px-5 py-2.5 rounded-xl border border-white/15 text-white hover:border-[#39FF14]/50 hover:text-[#39FF14] transition-all cursor-pointer"
      >
        Sign In
      </button>
    </header>
  );

  // Splash always shows first (brand moment + gives the session check time to
  // resolve). Only once it's done do we know whether to show the marketing
  // landing page (unauthenticated) or the real dashboard (authenticated).
  if (showSplash || authLoading) {
    return splashScreen;
  }

  const inMaintenance = siteConfig.maintenanceMode && currentUser?.role !== "admin";
  if (inMaintenance) {
    return (
      <MaintenanceScreen
        siteName={siteConfig.siteName}
        heroTagline={siteConfig.heroTagline}
      />
    );
  }

  const homepageAdsTop = publicAds.filter((a) => a.placement === "homepage_top");
  const homepageAdsMid = publicAds.filter((a) => a.placement === "homepage_mid");

  const homepageSectionData: Record<
    string,
    { movies: Movie[]; hasRank?: boolean; seeAll?: { view: "movies" | "tv"; genre?: string | number | null; genreLabel?: string } }
  > = {
    trending: { movies: trendingMovies, hasRank: true, seeAll: { view: "movies", genre: "trending", genreLabel: "Trending Now" } },
    tv: { movies: trendingTV, seeAll: { view: "tv" } },
    popular: { movies: popularMovies, seeAll: { view: "movies", genre: "popular", genreLabel: "Popular Movies" } },
    top_rated: { movies: topRated, seeAll: { view: "movies", genre: "top_rated", genreLabel: "Top Rated Cinema Hits" } },
    upcoming: { movies: upcoming, seeAll: { view: "movies", genre: "upcoming", genreLabel: "Upcoming Blockbusters" } },
    now_playing: { movies: nowPlaying, seeAll: { view: "movies", genre: "now_playing", genreLabel: "Now Playing in Theaters" } },
  };

  if (!currentUser) {
    // The footer's Help/About links work even before signing in — they
    // reuse the same currentView state the authenticated app uses, so once
    // someone does sign in, they land right back on the page they were
    // reading instead of being reset to the dashboard.
    if (currentView === "help") {
      return (
        <div id="public-help-page" className="min-h-screen bg-[#050505] text-white">
          {publicPageHeader}
          <HelpDeskPage />
          <Footer />
          <AuthModal isOpen={authModalOpen} onClose={closeAuthModal} defaultMode={authModalMode} initialStep={authModalInitialStep} />
        </div>
      );
    }
    if (currentView === "about") {
      return (
        <div id="public-about-page" className="min-h-screen bg-[#050505] text-white">
          {publicPageHeader}
          <AboutPage />
          <Footer />
          <AuthModal isOpen={authModalOpen} onClose={closeAuthModal} defaultMode={authModalMode} initialStep={authModalInitialStep} />
        </div>
      );
    }
    return (
      <>
        <LandingPage />
        <AuthModal isOpen={authModalOpen} onClose={closeAuthModal} defaultMode={authModalMode} />
      </>
    );
  }

  return (
    <div id="dashboard-wrapper" className="min-h-screen bg-[#050505] text-neutral-200 relative overflow-hidden">
      
      {/* Background Radial Glow Gradient from theme */}
      <div className="bg-gradient-radial-overlay" />

      {/* Left Sidebar Menu */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main Content Area Container */}
      <div id="main-content-panel" className="lg:pl-64 flex flex-col min-h-screen">
        
        {/* Top Header Navbar with frosted blur */}
        <header id="top-navbar" className="h-20 glass-navbar sticky top-0 z-40 px-4 lg:px-8 flex items-center justify-between gap-4">
          
          {/* Mobile Hamburguer & Search bar */}
          <div className="flex items-center gap-4 flex-1 max-w-lg">
            <button
              id="mobile-menu-trigger"
              aria-label="Open navigation menu"
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl border border-white/5 text-neutral-400 hover:bg-white/5 hover:text-white lg:hidden cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Instant Search input */}
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" aria-hidden="true" />
              <input
                id="header-search-input"
                type="text"
                aria-label="Search movies, TV shows, and actors"
                placeholder="Search movies, TV shows, actors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-12 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#39FF14]/50 transition-colors"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 bg-[#050505] border border-white/10 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold text-neutral-500 select-none">
                Ctrl K
              </div>
            </div>
          </div>

          {/* Center Navigation: Movies / TV Shows / All Categories */}
          <nav className="hidden xl:flex items-center gap-1 flex-shrink-0">
            <button
              id="nav-movies-btn"
              onClick={() => { setActiveGenre(null); setActiveGenreName(null); setCurrentView("movies"); }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === "movies" ? "bg-[#39FF14]/10 text-[#39FF14]" : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {t("movies")}
            </button>
            <button
              id="nav-tv-btn"
              onClick={() => setCurrentView("tv")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === "tv" ? "bg-[#39FF14]/10 text-[#39FF14]" : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {t("tvShows")}
            </button>
            <div className="relative">
              <button
                id="nav-categories-btn"
                onClick={() => setCategoriesOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  categoriesOpen ? "bg-[#39FF14]/10 text-[#39FF14]" : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Tag className="h-3.5 w-3.5" />
                {t("allCategories")}
                <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-300 ${categoriesOpen ? "rotate-90" : ""}`} />
              </button>
              {categoriesOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCategoriesOpen(false)} />

                  {/* Notification-style premium dropdown panel */}
                  <div
                    id="all-categories-dropdown"
                    className="absolute left-0 top-full mt-3 z-50 w-80 animate-dropdown-pop"
                  >
                    {/* Little caret connecting the panel to the trigger button */}
                    <div className="absolute -top-1.5 left-6 h-3 w-3 rotate-45 bg-[#0c0c0c] border-l border-t border-[#39FF14]/20" />

                    <div className="relative rounded-2xl border border-neutral-800 surface-panel overflow-hidden">
                      {/* Header row */}
                      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-gradient-to-r from-[#39FF14]/10 to-transparent">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-[#39FF14]/15 border border-[#39FF14]/30 flex items-center justify-center text-[#39FF14]">
                            <Tag className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs font-black text-white uppercase tracking-wider">{t("browseCategories")}</span>
                        </div>
                        <span className="text-[10px] font-bold text-[#39FF14] bg-[#39FF14]/10 border border-[#39FF14]/20 px-2 py-0.5 rounded-full">
                          {allGenres.length}
                        </span>
                      </div>

                      {/* Genre grid */}
                      <div className="max-h-80 overflow-y-auto p-2 grid grid-cols-2 gap-1.5 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
                        {allGenres.map((g) => {
                          const isActive = activeGenre === g.id;
                          return (
                            <button
                              key={g.id}
                              onClick={() => {
                                setActiveGenre(g.id);
                                setActiveGenreName(t(`genre.${g.name}`));
                                setCurrentView("movies");
                                setCategoriesOpen(false);
                              }}
                              className={`group relative flex items-center gap-2 text-left px-3 py-2.5 rounded-xl text-[11px] font-semibold transition-all duration-200 cursor-pointer overflow-hidden ${
                                isActive
                                  ? "accent-chip"
                                  : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 transition-all duration-200 ${
                                isActive ? "bg-[#39FF14]" : "bg-neutral-700 group-hover:bg-neutral-600"
                              }`} />
                              <span className="truncate">{t(`genre.${g.name}`)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </nav>

          {/* Right Header Navigation widgets */}
          <div className="flex items-center gap-4">
            {/* Install APK — direct download of the Cinemax Android app */}
            <a
              id="install-apk-btn"
              href="/app/cinemax.apk"
              download="cinemax.apk"
              className="hidden md:flex items-center gap-2 bg-[#39FF14]/10 border border-[#39FF14]/20 text-[#39FF14] px-4 py-2 rounded-2xl text-xs font-bold hover:bg-[#39FF14]/20 transition-all cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Install APK</span>
            </a>

            {/* Notification bell — locked for guests */}
            <div className="relative">
              <button
                id="notification-bell-btn"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
                onClick={() => (currentUser && !isGuest ? setNotifOpen((v) => !v) : requireSignInPrompt())}
                className="p-2.5 rounded-2xl border border-white/10 hover:border-[#39FF14]/20 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-all relative cursor-pointer"
              >
                {isGuest ? <Lock className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                {!isGuest && unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 px-0.5 items-center justify-center rounded-full bg-[#39FF14] text-black text-[9px] font-black">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {!isGuest && <NotificationCenter isOpen={notifOpen} onClose={() => setNotifOpen(false)} />}
            </div>

            {/* Profile circular menu — locked for guests */}
            {currentUser && !isGuest ? (
              <button
                id="header-profile-menu-avatar"
                aria-label={`Open account settings for ${currentUser.name}`}
                onClick={() => setCurrentView("profile")}
                className="rounded-full border border-white/15 overflow-hidden cursor-pointer hover:border-[#39FF14] transition-colors"
              >
                <AvatarRenderer value={currentUser.avatar} size={40} initials={currentUser.name?.[0]?.toUpperCase() || "C"} />
              </button>
            ) : (
              <button
                id="header-login-btn"
                onClick={() => requireSignInPrompt()}
                title="Sign in to access your profile"
                className="neon-btn text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <Lock className="h-3.5 w-3.5" />
                Sign In
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Display Rendering Area */}
        <main id="dashboard-main-content" className="flex-1">

          {/* Player always takes priority — search overlay was blocking playback */}
          {currentView === "player" ? (
            <div className="player-enter">
              <PlayerPage />
            </div>
          ) : searchQuery.trim().length > 1 ? (
            <div id="search-results-panel" className="p-4 lg:p-8 space-y-6 search-panel-enter">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-sans font-bold text-xl text-white">
                    Search Results for: <span className="text-[#39FF14]">"{searchQuery}"</span>
                  </h2>
                  {!isSearching && searchResults.length > 0 && (
                    <p className="text-xs text-neutral-500 mt-1">
                      {searchResults.length} titles · movies & TV · scroll for more
                    </p>
                  )}
                </div>
                <button
                  id="clear-search-btn"
                  onClick={() => setSearchQuery("")}
                  className="text-xs text-neutral-500 hover:text-white cursor-pointer"
                >
                  Clear Search
                </button>
              </div>

              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-neutral-400">
                  <div className="w-full max-w-md h-2 rounded-full overflow-hidden search-shimmer" />
                  <span className="text-xs font-mono font-bold tracking-widest text-[#39FF14] uppercase animate-pulse-soft">
                    Searching movies, TV shows & Cinemax catalog…
                  </span>
                </div>
              ) : searchResults.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {searchResults.map((movie, index) => {
                      const cardKey = `${movie.media_type || (isTvShow(movie) ? "tv" : "movie")}:${movie.id}`;
                      const isPreparing = preparingPlayKey === cardKey;
                      return (
                        <div
                          key={cardKey}
                          className="search-card-enter"
                          style={{ animationDelay: `${Math.min(index, 24) * 35}ms` }}
                        >
                          <MovieCard
                            movie={movie}
                            isPreparing={isPreparing}
                            onClick={() => handleMovieClick(movie)}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div ref={searchSentinelRef} className="h-8 flex items-center justify-center py-8">
                    {searchLoadingMore && (
                      <span className="text-xs font-mono text-[#39FF14] animate-pulse">Loading more titles…</span>
                    )}
                    {!searchLoadingMore && searchHasMore && (
                      <button
                        type="button"
                        onClick={loadMoreSearch}
                        className="neon-btn text-xs font-bold px-6 py-2.5 rounded-xl uppercase tracking-wide cursor-pointer"
                      >
                        Load more
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-20 text-neutral-500">
                  <p>No results found. Try a different spelling or shorter keywords.</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* VIEW: HOME DISCOVERY */}
              {currentView === "home" && (
                <div id="home-view" className="pb-12 space-y-8">
                  {homepageAdsTop.length > 0 && (
                    <div className="px-4 lg:px-8 pt-4 space-y-3">
                      {homepageAdsTop.map((ad) => (
                        <AdBanner key={ad.id} ad={ad} />
                      ))}
                    </div>
                  )}
                  {/* Featured Hero Banner — rotates through a handful of
                      featured titles every 3 seconds. */}
                  <div 
                    id="hero-banner" 
                    className="relative w-full h-[480px] flex items-end p-6 lg:p-12 overflow-hidden bg-black"
                  >
                    {/* Backdrop */}
                    <img 
                      id="hero-backdrop"
                      key={heroMovie.id}
                      src={heroMovie.id === SUPERGIRL_HERO.id ? HERO_FALLBACK_BACKDROP : getImageUrl(heroMovie.backdrop_path, "original")}
                      alt={`${heroMovie.title || heroMovie.name} Hero Background`}
                      className="absolute inset-0 w-full h-full object-cover opacity-65 blur-[1px] transition-opacity duration-700"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />

                    {/* Rotation progress dots */}
                    {heroMovies.length > 1 && (
                      <div className="absolute top-6 right-6 lg:right-12 z-10 flex items-center gap-1.5">
                        {heroMovies.map((_, i) => (
                          <span
                            key={i}
                            className={`h-1 rounded-full transition-all duration-300 ${
                              i === heroIndex % heroMovies.length ? "w-6 bg-[#39FF14]" : "w-1.5 bg-white/25"
                            }`}
                          />
                        ))}
                      </div>
                    )}

                    {/* Meta/Descriptions */}
                    <div key={`meta-${heroMovie.id}`} className="relative max-w-2xl space-y-4 z-10 animate-fade-in">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded bg-[#39FF14] text-black px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest">
                          Trending Now
                        </span>
                        <div className="flex items-center gap-1 text-xs text-amber-400">
                          <Star className="h-3.5 w-3.5 fill-amber-400" />
                          <span className="font-bold">{heroMovie.vote_average != null ? heroMovie.vote_average.toFixed(1) : "N/A"}</span>
                        </div>
                        {(heroMovie.release_date || heroMovie.first_air_date) && (
                          <span className="text-neutral-400 text-xs">• {(heroMovie.release_date || heroMovie.first_air_date || "").slice(0, 4)}</span>
                        )}
                        {heroMovie.runtime && (
                          <span className="text-neutral-400 text-xs">• {Math.floor(heroMovie.runtime / 60)}h {heroMovie.runtime % 60}m</span>
                        )}
                        <span className="rounded border border-neutral-700 px-1.5 py-0.5 text-[9px] text-neutral-300 font-bold">
                          {heroMovie.title ? "Movie" : "Series"}
                        </span>
                      </div>

                      <h1 className="font-sans text-4xl lg:text-5xl font-black text-white tracking-tight uppercase line-clamp-2">
                        {heroMovie.title || heroMovie.name}
                      </h1>

                      <p className="text-sm text-neutral-300 leading-relaxed line-clamp-3">
                        {heroMovie.overview}
                      </p>

                      <div className="flex items-center gap-4 pt-2">
                        <button
                          id="hero-play-btn"
                          onClick={() => handlePlayFullMovie(heroMovie)}
                          className="flex items-center gap-2 neon-btn font-extrabold px-6 py-3 rounded-2xl transition-all cursor-pointer"
                        >
                          <Play className="h-5 w-5 fill-black" />
                          <span>Play Now</span>
                        </button>
                        <button
                          id="hero-more-info-btn"
                          onClick={() => {
                            setDetailsModalMovie(heroMovie);
                            setDetailsModalOpen(true);
                          }}
                          className="flex items-center gap-2 btn-secondary font-semibold px-6 py-3 rounded-2xl transition-all cursor-pointer"
                        >
                          <Info className="h-5 w-5" />
                          <span>More Info</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Curated Row shelves — visibility controlled from Admin Panel */}
                  <div id="curated-shelves" className="px-4 lg:px-8 space-y-10">
                    {customContent.length > 0 && renderRowShelf("Cinemax Originals", customContent, false)}
                    {(siteConfig.homepageSections || [])
                      .filter((s) => s.visible)
                      .map((section, idx) => {
                        const data = homepageSectionData[section.id];
                        if (!data) return null;
                        const shelf = renderRowShelf(section.label, data.movies, data.hasRank, data.seeAll);
                        if (!shelf) return null;
                        const showMidAds = idx === 1 && homepageAdsMid.length > 0;
                        return (
                          <React.Fragment key={section.id}>
                            {shelf}
                            {showMidAds && (
                              <div className="space-y-3">
                                {homepageAdsMid.map((ad) => (
                                  <AdBanner key={ad.id} ad={ad} />
                                ))}
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                  </div>

                  {/* Up Next + Live Chat */}
<div id="home-up-next-section" className="px-4 lg:px-8 space-y-8 pt-4">
                    <section className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="font-sans font-bold text-xl lg:text-2xl tracking-tight">{t("upNext")}</h2>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{t("trendingNow")}</span>
                      </div>
                      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                        {(trendingMovies.length > 0 ? trendingMovies : popularMovies).slice(0, 12).map((movie) => (
<div key={movie.id} className="flex-shrink-0 w-[110px] sm:w-[130px]">
                            <MovieCard movie={movie} onClick={() => handleMovieClick(movie)} />
                          </div>
                        ))}
                      </div>
                    </section>

                    <section id="home-live-chat" className="max-w-3xl">
                      <LiveChat variant="home" />
                    </section>
                  </div>
                </div>
              )}

              {/* VIEW: MOVIES GRID */}
              {currentView === "movies" && (
                <MoviesPage
                  key={`movies-${String(activeGenre)}`}
                  onMovieClick={handleMovieClick}
                  initialGenre={activeGenre}
                  initialGenreLabel={activeGenreName}
                />
              )}

              {/* VIEW: TV SHOWS GRID */}
              {currentView === "tv" && <TVShowsPage onShowClick={handleMovieClick} />}

              {/* VIEW: MY LIST / WATCHLIST */}
              {currentView === "mylist" && (
                <div id="mylist-view" className="p-4 lg:p-8 space-y-6">
                  <div className="flex items-center gap-2">
                    <ListPlus className="h-5 w-5 text-[#22c55e]" />
                    <h2 className="font-sans font-bold text-xl text-white">My List — Saved for Later</h2>
                  </div>
                  {isGuest ? renderGuestLock("My List") : getMyListMovies().length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                      {getMyListMovies().map(movie => (
                        <MovieCard key={movie.id} movie={movie} onClick={() => handleMovieClick(movie)} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-24 text-neutral-500 space-y-3">
                      <ListPlus className="h-12 w-12 text-neutral-700 mx-auto" />
                      <h3 className="font-sans font-bold text-lg text-neutral-400">My List is Empty</h3>
                      <p className="text-xs max-w-sm mx-auto">Save titles you want to watch later from any movie card or player page.</p>
                    </div>
                  )}
                </div>
              )}

              {currentView === "watchlist" && (
                <div id="watchlist-view" className="p-4 lg:p-8 space-y-6">
                  <div className="flex items-center gap-2">
                    <Bookmark className="h-5 w-5 text-[#22c55e]" />
                    <h2 className="font-sans font-bold text-xl text-white">Watchlist — Continue Watching</h2>
                  </div>
                  {isGuest ? renderGuestLock("your watchlist") : getContinueWatchingMovies().length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {getContinueWatchingMovies().map(movie => (
                        <div
                          key={movie.id}
                          onClick={() => handleMovieClick(movie)}
                          className="flex gap-4 p-4 rounded-3xl solid-card hover:border-[#22c55e]/30 transition-all cursor-pointer"
                        >
                          <img src={getImageUrl(movie.poster_path)} alt={movie.title || movie.name} className="h-24 w-20 rounded-xl object-cover" referrerPolicy="no-referrer" />
                          <div className="flex-1">
                            <h4 className="font-bold text-sm text-white">{movie.title || movie.name}</h4>
                            <p className="text-[10px] text-neutral-500 mt-1">Resume at {movie._progress}%</p>
                            <div className="w-full bg-neutral-900 h-1 rounded-full mt-2">
                              <div className="bg-[#22c55e] h-full rounded-full" style={{ width: `${movie._progress || 0}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-24 text-neutral-500 space-y-3">
                      <Bookmark className="h-12 w-12 text-neutral-700 mx-auto" />
                      <h3 className="font-sans font-bold text-lg text-neutral-400">Nothing in Progress</h3>
                      <p className="text-xs max-w-sm mx-auto">Start watching a movie or series — it will appear here so you can resume where you left off.</p>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW: HISTORY */}
              {currentView === "history" && (
                <div id="history-view" className="p-4 lg:p-8 space-y-6">
                  <div className="flex items-center gap-2">
                    <HistoryIcon className="h-5 w-5 text-[#39FF14]" />
                    <h2 className="font-sans font-bold text-xl text-white">
                      Continue Watching History
                    </h2>
                  </div>

                  {user && user.watchHistory && user.watchHistory.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {user.watchHistory.map((hist, idx) => (
                        <div 
                          key={idx} 
                          onClick={async () => {
                            const fullMovie = hist.type === "movie" 
                              ? await tmdb.getMovieDetails(hist.id)
                              : await tmdb.getTVDetails(hist.id);
                            setSelectedMovie(fullMovie);
                            setPlayerMode("full");
                            setCurrentView("player");
                          }}
                          className="flex gap-4 p-4 rounded-3xl glass-card hover:border-[#39FF14]/30 transition-all cursor-pointer group"
                        >
                          <img 
                            src={getImageUrl(hist.poster)} 
                            alt={hist.title}
                            className="h-24 w-20 rounded-xl object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex-1 flex flex-col justify-between py-1">
                            <div>
                              <div className="flex items-center justify-between">
                                <h4 className="font-sans font-bold text-sm text-white group-hover:text-[#39FF14] transition-colors">
                                  {hist.title}
                                </h4>
                                <span className="text-[10px] text-neutral-500 font-extrabold uppercase">
                                  {hist.type === "movie" ? "Movie" : "TV Series"}
                                </span>
                              </div>
                              <p className="text-[10px] text-neutral-600 font-mono mt-1">
                                Last Streamed: {new Date(hist.watchedAt).toLocaleDateString()}
                              </p>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px] text-neutral-400 font-medium">
                                <span>Progress: {hist.progress}%</span>
                                <span>{Math.round((hist.progress / 100) * hist.duration)}m watched</span>
                              </div>
                              <div className="w-full bg-[#050505] h-1 rounded-full overflow-hidden">
                                <div className="bg-[#39FF14] h-full rounded-full" style={{ width: `${hist.progress}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-24 text-neutral-500 space-y-3">
                      <HistoryIcon className="h-12 w-12 text-neutral-700 mx-auto" />
                      <h3 className="font-sans font-bold text-lg text-neutral-400">No History Saved</h3>
                      <p className="text-xs max-w-sm mx-auto">Start streaming your favorite titles, and we will track your progress right here!</p>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW: FAVORITES */}
              {currentView === "favorites" && (
                <div id="favorites-view" className="p-4 lg:p-8 space-y-6">
                  <div className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-[#39FF14]" />
                    <h2 className="font-sans font-bold text-xl text-white">
                      My Favorites Collection
                    </h2>
                  </div>

                  {isGuest ? renderGuestLock("your favorites") : user && user.favorites && user.favorites.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                      {[...trendingMovies, ...popularMovies, ...topRated]
                        .filter(m => user.favorites.includes(m.id))
                        .map(movie => (
                          <MovieCard key={movie.id} movie={movie} onClick={() => handleMovieClick(movie)} />
                        ))
                      }
                    </div>
                  ) : (
                    <div className="text-center py-24 text-neutral-500 space-y-3">
                      <Heart className="h-12 w-12 text-neutral-700 mx-auto" />
                      <h3 className="font-sans font-bold text-lg text-neutral-400">Favorites empty</h3>
                      <p className="text-xs max-w-sm mx-auto">Add items to your favorites within the streaming player details tab!</p>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW: DOWNLOADS */}
              {currentView === "downloads" && <DownloadsPage />}

              {/* VIEW: SHORTS — vertical autoplay trailer feed */}
              {currentView === "shorts" && (
                <div id="shorts-view" className="lg:p-4">
                  <ShortsPage onWatch={handleMovieClick} />
                </div>
              )}

              {/* VIEW: PREMIUM PLAYER (FULL / TRAILER) */}
              {/* VIEW: PREMIUM PLAYER (FULL / TRAILER) — rendered at main level when active */}

              {/* VIEW: PROFILE */}
              {currentView === "profile" && <ProfilePage />}
              {currentView === "help" && <HelpDeskPage />}
              {currentView === "about" && <AboutPage />}
              {currentView === "admin" && <AdminRedirect />}

            </>
          )}

        </main>


        {currentView !== "player" && currentView !== "shorts" && currentView !== "help" && currentView !== "about" && <Footer />}
      </div>

      {/* POPUP WATCH DECIDER MODAL */}
      <WatchChoiceModal
        movie={modalTargetMovie}
        isOpen={choiceModalOpen}
        onClose={() => setChoiceModalOpen(false)}
        onChoose={handleChoiceSelected}
      />

      {/* REGISTRATION / LOGIN AUTH DIALOG */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={closeAuthModal}
        defaultMode={authModalMode}
        initialStep={authModalInitialStep}
      />

      {/* FLOATING PICTURE IN PICTURE STREAMING CONTAINER */}
      <PipPlayer />

      {/* AI ASSISTANT — available on every page, not just Home. Only ever
          appears via its own floating "Ask AI" launcher button; it stays
          fully closed/hidden otherwise. */}
      <HomeAIAssistant onSelectMovie={handlePlayFullMovie} />

      {/* MOVIE DETAILS MODAL — powers the Hero's "More Info" button with a
          full detail view, distinct from "Play Now" which jumps straight
          into playback. */}
      <MovieDetailsModal
        movie={detailsModalMovie}
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        onPlay={(m) => {
          setDetailsModalOpen(false);
          handleMovieClick(m);
        }}
      />

      <AdminDestinationModal
        isOpen={adminDestinationOpen}
        onAdmin={goToAdminPanel}
        onWebsite={dismissAdminToWebsite}
      />

    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <CinemaxDashboard />
    </AppProvider>
  );
}
