import React, { useEffect, useRef, useState, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { tmdb, getImageUrl } from "../utils/tmdb";
import { Movie } from "../types";
import { Heart, Volume2, VolumeX, Play, Info, Loader2, Clapperboard, ChevronUp } from "lucide-react";

interface ShortClip {
  movie: Movie;
  videoKey: string;
}

interface ShortsPageProps {
  onWatch: (movie: Movie) => void;
}

/**
 * "Shorts" — a TikTok/Reels-style vertical feed of autoplaying movie
 * trailers. Each slide snap-scrolls to fill the viewport; only the active
 * slide (plus its immediate neighbors) actually mounts a live YouTube
 * player, so scrolling stays smooth even with a long feed.
 */
export const ShortsPage: React.FC<ShortsPageProps> = ({ onWatch }) => {
  const { user, likeMovie, unlikeMovie, requireSignInPrompt } = useApp();

  const [clips, setClips] = useState<ShortClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [pageParam, setPageParam] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const loadingMoreRef = useRef(false);

  const favoriteIds = new Set(user?.favorites || []);

  // Pulls a page of trending movies + TV, resolves each one's YouTube
  // trailer key in parallel, and appends any that actually have a trailer.
  const loadMoreClips = useCallback(async () => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    try {
      const [movies, shows] = await Promise.all([
        tmdb.getTrendingMovies(pageParam),
        tmdb.getPopularMovies(pageParam),
      ]);
      const pool = [...movies, ...shows].filter((m) => m.backdrop_path);

      const withVideos = await Promise.all(
        pool.map(async (movie) => {
          try {
            const videos = await tmdb.getMovieVideos(movie.id);
            const best = videos.find((v) => v.type === "Trailer") || videos[0];
            return best ? { movie, videoKey: best.key } : null;
          } catch {
            return null;
          }
        })
      );

      const newClips = withVideos.filter((c): c is ShortClip => c !== null);
      setClips((prev) => {
        const seen = new Set(prev.map((c) => c.movie.id));
        return [...prev, ...newClips.filter((c) => !seen.has(c.movie.id))];
      });
      setPageParam((p) => p + 1);
    } catch (err) {
      console.error("Failed to load Shorts feed:", err);
    } finally {
      loadingMoreRef.current = false;
      setLoading(false);
    }
  }, [pageParam]);

  useEffect(() => {
    loadMoreClips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tracks which slide is centered in the viewport using IntersectionObserver
  // so we know which single player should actually be "live".
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(idx)) setActiveIndex(idx);
          }
        }
      },
      { root: container, threshold: [0.6] }
    );

    itemRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [clips.length]);

  // Infinite scroll: once the person nears the end of the loaded feed, fetch more.
  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const nearEnd = container.scrollTop + container.clientHeight >= container.scrollHeight - window.innerHeight * 1.5;
    if (nearEnd) loadMoreClips();
  };

  const toggleFavorite = (movieId: number) => {
    if (!user) {
      requireSignInPrompt();
      return;
    }
    if (favoriteIds.has(movieId)) unlikeMovie(movieId);
    else likeMovie(movieId);
  };

  if (loading && clips.length === 0) {
    return (
      <div id="shorts-loading" className="flex flex-col items-center justify-center h-[70vh] gap-3 text-neutral-500">
        <Loader2 className="h-8 w-8 animate-spin text-[#39FF14]" />
        <p className="text-xs font-semibold uppercase tracking-widest">Loading Shorts...</p>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100dvh-4rem)] lg:h-[calc(100dvh-0px)] flex items-center justify-center bg-black lg:rounded-3xl overflow-hidden">
      {/* Ambient blurred backdrop fills the letterboxed space beside the narrow rail on wider screens */}
      {clips[activeIndex] && (
        <img
          src={getImageUrl(clips[activeIndex].movie.backdrop_path, "original")}
          alt=""
          aria-hidden="true"
          className="hidden sm:block absolute inset-0 w-full h-full object-cover opacity-25 blur-2xl scale-110"
          referrerPolicy="no-referrer"
        />
      )}
      <div className="hidden sm:block absolute inset-0 bg-black/50" />

      {/* Slim vertical rail — mirrors YouTube Shorts' narrow player width on anything wider than a phone */}
      <div
        id="shorts-page"
        ref={containerRef}
        onScroll={handleScroll}
        className="relative z-10 h-full w-full sm:w-[420px] sm:max-w-[420px] sm:my-4 sm:rounded-3xl overflow-y-scroll snap-y snap-mandatory scroll-smooth bg-black no-scrollbar sm:shadow-[0_0_60px_rgba(0,0,0,0.6)] sm:border sm:border-white/10"
        style={{ scrollbarWidth: "none" }}
      >
        {clips.map((clip, idx) => (
          <ShortSlide
            key={clip.movie.id}
            ref={(el) => (itemRefs.current[idx] = el)}
            index={idx}
            clip={clip}
            isActive={idx === activeIndex}
            isNeighbor={Math.abs(idx - activeIndex) <= 1}
            muted={muted}
            setMuted={setMuted}
            isFavorite={favoriteIds.has(clip.movie.id)}
            onToggleFavorite={() => toggleFavorite(clip.movie.id)}
            onWatch={() => onWatch(clip.movie)}
          />
        ))}

        {/* End-of-feed loader */}
        <div className="h-24 flex items-center justify-center text-neutral-600 text-xs snap-end">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading more shorts...
        </div>
      </div>
    </div>
  );
};

interface ShortSlideProps {
  index: number;
  clip: ShortClip;
  isActive: boolean;
  isNeighbor: boolean;
  muted: boolean;
  setMuted: (m: boolean) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onWatch: () => void;
}

const ShortSlide = React.forwardRef<HTMLDivElement, ShortSlideProps>(
  ({ index, clip, isActive, isNeighbor, muted, setMuted, isFavorite, onToggleFavorite, onWatch }, ref) => {
    const { movie, videoKey } = clip;
    const title = movie.title || movie.name || "Untitled";
    const [showTapHint, setShowTapHint] = useState(false);

    const embedSrc = `https://www.youtube.com/embed/${videoKey}?autoplay=1&mute=${muted ? 1 : 0}&loop=1&playlist=${videoKey}&controls=0&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3`;

    return (
      <div
        ref={ref}
        data-index={index}
        className="relative h-full w-full snap-start snap-always flex items-center justify-center overflow-hidden"
      >
        {/* Poster fallback / background while the player mounts */}
        <img
          src={getImageUrl(movie.backdrop_path, "original")}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover opacity-40 scale-105 blur-sm"
          referrerPolicy="no-referrer"
        />

        {isNeighbor && videoKey && (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Oversized iframe cropped to fill the vertical frame, like a native shorts player */}
            <iframe
              key={`${videoKey}-${isActive}`}
              src={isActive ? embedSrc : undefined}
              title={title}
              allow="autoplay; encrypted-media"
              className="pointer-events-none w-[300%] h-full"
              style={{ border: 0 }}
            />
          </div>
        )}

        {/* Tap-to-unmute affordance, shown once per active slide */}
        <button
          id={`shorts-mute-toggle-${index}`}
          onClick={() => {
            setMuted(!muted);
            setShowTapHint(true);
            setTimeout(() => setShowTapHint(false), 900);
          }}
          className="absolute inset-0 z-10 cursor-pointer"
          aria-label={muted ? "Unmute" : "Mute"}
        />

        {showTapHint && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="bg-black/60 rounded-full p-4 animate-ping-once">
              {muted ? <VolumeX className="h-8 w-8 text-white" /> : <Volume2 className="h-8 w-8 text-white" />}
            </div>
          </div>
        )}

        {/* Gradient overlays for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/40 pointer-events-none" />

        {/* Sound indicator, top right */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 pointer-events-none">
          <div className="bg-black/50 backdrop-blur-md rounded-full p-2 border border-white/10">
            {muted ? <VolumeX className="h-4 w-4 text-white" /> : <Volume2 className="h-4 w-4 text-white" />}
          </div>
        </div>

        {/* Right-side action rail */}
        <div className="absolute right-3 bottom-28 lg:bottom-16 z-20 flex flex-col items-center gap-5">
          <button
            id={`shorts-like-${index}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className="flex flex-col items-center gap-1 cursor-pointer group"
          >
            <div
              className={`h-12 w-12 rounded-full flex items-center justify-center border transition-all ${
                isFavorite
                  ? "bg-[#39FF14] border-[#39FF14] text-black scale-105"
                  : "bg-black/50 backdrop-blur-md border-white/15 text-white group-hover:scale-110"
              }`}
            >
              <Heart className={`h-5 w-5 ${isFavorite ? "fill-black" : ""}`} />
            </div>
            <span className="text-[10px] font-bold text-white drop-shadow">{isFavorite ? "Saved" : "Save"}</span>
          </button>

          <button
            id={`shorts-watch-${index}`}
            onClick={(e) => {
              e.stopPropagation();
              onWatch();
            }}
            className="flex flex-col items-center gap-1 cursor-pointer group"
          >
            <div className="h-12 w-12 rounded-full flex items-center justify-center bg-[#39FF14] text-black border border-[#39FF14] group-hover:scale-110 transition-all">
              <Play className="h-5 w-5 fill-black" />
            </div>
            <span className="text-[10px] font-bold text-white drop-shadow">Watch</span>
          </button>
        </div>

        {/* Bottom title/info bar */}
        <div className="absolute bottom-6 left-4 right-20 z-20 space-y-2 pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <Clapperboard className="h-4 w-4 text-[#39FF14]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#39FF14]">Shorts</span>
          </div>
          <h3 className="font-sans font-black text-lg text-white drop-shadow-lg line-clamp-1">{title}</h3>
          <p className="text-xs text-neutral-300 leading-relaxed line-clamp-2 drop-shadow max-w-md">{movie.overview}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onWatch();
            }}
            className="pointer-events-auto flex items-center gap-1.5 text-[11px] font-bold text-white/90 hover:text-[#39FF14] transition-colors"
          >
            <Info className="h-3.5 w-3.5" /> More details
          </button>
        </div>

        {/* Scroll hint on the very first slide */}
        {index === 0 && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 text-white/70 animate-bounce pointer-events-none">
            <ChevronUp className="h-4 w-4 rotate-180" />
            <span className="text-[9px] font-bold uppercase tracking-widest">Swipe up</span>
          </div>
        )}
      </div>
    );
  }
);
ShortSlide.displayName = "ShortSlide";
