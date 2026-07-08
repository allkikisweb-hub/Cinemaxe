import React, { useState, useEffect, useRef, useMemo } from "react";
import { tmdb } from "../utils/tmdb";
import { useInfiniteDiscover, DiscoverPage } from "../utils/useInfiniteDiscover";
import { Movie } from "../types";
import { MovieCard } from "./MovieCard";
import { Tv, ChevronRight, Loader2, SlidersHorizontal } from "lucide-react";
import { useApp } from "../context/AppContext";

interface TVShowsPageProps {
  onShowClick: (show: Movie) => void;
}

interface Collection {
  id: string;
  label: string;
  fetch: (page: number) => Promise<DiscoverPage>;
}

const CURATED: Collection[] = [
  { id: "trending", label: "Trending Now", fetch: async (page) => ({ results: await tmdb.getTrendingTVShows(page), totalPages: 500 }) },
  { id: "popular", label: "Popular", fetch: async (page) => ({ results: await tmdb.getPopularTVShows(page), totalPages: 500 }) },
  { id: "top_rated", label: "Top Rated", fetch: async (page) => ({ results: await tmdb.getTopRatedTVShows(page), totalPages: 500 }) },
  { id: "airing_today", label: "Airing Today", fetch: async (page) => ({ results: await tmdb.getAiringTodayTVShows(page), totalPages: 500 }) },
  { id: "on_the_air", label: "Featured / On The Air", fetch: async (page) => ({ results: await tmdb.getOnTheAirTVShows(page), totalPages: 500 }) },
];

const SkeletonCard: React.FC = () => (
  <div className="flex-none w-32 sm:w-36 md:w-40 rounded-2xl overflow-hidden bg-white/5 border border-white/5 animate-pulse">
    <div className="aspect-[2/3] bg-white/5" />
    <div className="p-3 space-y-2">
      <div className="h-3 bg-white/10 rounded w-3/4" />
      <div className="h-2.5 bg-white/5 rounded w-1/2" />
    </div>
  </div>
);

const PreviewRow: React.FC<{
  title: string;
  shows: Movie[];
  loading: boolean;
  onSeeAll: () => void;
  onShowClick: (m: Movie) => void;
  seeAllLabel?: string;
}> = ({ title, shows, loading, onSeeAll, onShowClick, seeAllLabel = "See All" }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <h3 className="font-sans font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
        <span className="h-4 w-1 bg-[#39FF14] rounded-full" />
        {title}
      </h3>
      <button
        onClick={onSeeAll}
        className="flex items-center gap-1 text-[11px] font-semibold text-[#39FF14] hover:text-[#31dd11] transition-colors cursor-pointer"
      >
        {seeAllLabel} <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-neutral-900 scrollbar-track-transparent">
      {loading && shows.length === 0
        ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        : shows.slice(0, 14).map((m) => (
            <div key={m.id} className="w-32 flex-none sm:w-36 md:w-40">
              <MovieCard movie={m} onClick={() => onShowClick(m)} />
            </div>
          ))}
    </div>
  </div>
);

export const TVShowsPage: React.FC<TVShowsPageProps> = ({ onShowClick }) => {
  const { t } = useApp();
  const [genres, setGenres] = useState<Array<{ id: number; name: string }>>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<string>("");

  const [rowData, setRowData] = useState<Record<string, Movie[]>>({});
  const [rowLoading, setRowLoading] = useState(true);

  useEffect(() => {
    tmdb.getGenres("tv").then(setGenres).catch(() => setGenres([]));
  }, []);

  useEffect(() => {
    if (activeId !== null) return;
    let cancelled = false;
    setRowLoading(true);
    (async () => {
      const entries = await Promise.all(
        CURATED.map(async (c) => {
          const { results } = await c.fetch(1).catch(() => ({ results: [], totalPages: 1 }));
          return [c.id, results] as const;
        })
      );
      if (cancelled) return;
      setRowData(Object.fromEntries(entries));
      setRowLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const activeFetcher = useMemo(() => {
    if (activeId === null) return null;
    const curated = CURATED.find((c) => c.id === activeId);
    if (curated) return curated.fetch;
    const genreId = Number(activeId.replace("genre-", ""));
    return (page: number) => tmdb.discoverTVByGenre(genreId, page);
  }, [activeId]);

  const { items, loading, initialLoading, hasMore, loadMore } = useInfiniteDiscover(
    activeFetcher || (async () => ({ results: [], totalPages: 1 })),
    activeId || "none"
  );

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeId === null) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeId, loadMore]);

  const selectCollection = (id: string, label: string) => {
    setActiveId(id);
    setActiveLabel(label);
  };

  const collectionLabel = (collection: Collection) => t(`collection.${collection.id}`);
  const genreLabel = (name: string) => t(`genre.${name}`);

  return (
    <div id="tv-shows-page" className="p-4 lg:p-8 space-y-8">
      <div className="flex items-center gap-2">
        <Tv className="h-5 w-5 text-[#39FF14]" />
        <h1 className="font-sans font-black text-2xl text-white">
          {activeId === null ? t("exploreTvShows") : activeLabel}
        </h1>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-neutral-900 scrollbar-track-transparent">
        <button
          onClick={() => setActiveId(null)}
          className={`flex-none flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full border transition-all cursor-pointer ${
            activeId === null ? "bg-[#39FF14] text-black border-[#39FF14]" : "bg-white/5 text-neutral-300 border-white/10 hover:border-white/30"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" /> {t("browse")}
        </button>
        {CURATED.map((c) => (
          <button
            key={c.id}
            onClick={() => selectCollection(c.id, collectionLabel(c))}
            className={`flex-none text-xs font-bold px-4 py-2 rounded-full border transition-all cursor-pointer ${
              activeId === c.id ? "bg-[#39FF14] text-black border-[#39FF14]" : "bg-white/5 text-neutral-300 border-white/10 hover:border-white/30"
            }`}
          >
            {collectionLabel(c)}
          </button>
        ))}
        {genres.map((g) => (
          <button
            key={g.id}
            onClick={() => selectCollection(`genre-${g.id}`, genreLabel(g.name))}
            className={`flex-none text-xs font-bold px-4 py-2 rounded-full border transition-all cursor-pointer ${
              activeId === `genre-${g.id}` ? "bg-[#39FF14] text-black border-[#39FF14]" : "bg-white/5 text-neutral-300 border-white/10 hover:border-white/30"
            }`}
          >
            {genreLabel(g.name)}
          </button>
        ))}
      </div>

      {activeId === null ? (
        <div className="space-y-10">
          {CURATED.map((c) => (
            <PreviewRow
              key={c.id}
              title={collectionLabel(c)}
              shows={rowData[c.id] || []}
              loading={rowLoading}
              onSeeAll={() => selectCollection(c.id, collectionLabel(c))}
              onShowClick={onShowClick}
              seeAllLabel={t("seeAll")}
            />
          ))}

          {genres.map((g) => (
            <GenreRow key={g.id} genreId={g.id} name={genreLabel(g.name)} onSeeAll={() => selectCollection(`genre-${g.id}`, genreLabel(g.name))} onShowClick={onShowClick} seeAllLabel={t("seeAll")} />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {initialLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-24 text-neutral-500">
              <p>No shows found for this category right now.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {items.map((show) => (
                  <MovieCard key={show.id} movie={show} onClick={() => onShowClick(show)} />
                ))}
              </div>

              <div ref={sentinelRef} className="flex justify-center py-6">
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <Loader2 className="h-4 w-4 animate-spin text-[#39FF14]" />
                    Loading more titles...
                  </div>
                )}
                {!hasMore && !loading && (
                  <p className="text-xs text-neutral-600">You've reached the end of this collection.</p>
                )}
                {hasMore && !loading && (
                  <button
                    onClick={loadMore}
                    className="text-xs font-bold px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                  >
                    Load More
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const GenreRow: React.FC<{ genreId: number; name: string; onSeeAll: () => void; onShowClick: (m: Movie) => void; seeAllLabel: string }> = ({
  genreId,
  name,
  onSeeAll,
  onShowClick,
  seeAllLabel,
}) => {
  const [shows, setShows] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const rowRef = useRef<HTMLDivElement>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const el = rowRef.current;
    if (!el || hasLoaded) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setHasLoaded(true);
          tmdb
            .discoverTVByGenre(genreId, 1)
            .then(({ results }) => setShows(results))
            .catch(() => setShows([]))
            .finally(() => setLoading(false));
          observer.disconnect();
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [genreId, hasLoaded]);

  return (
    <div ref={rowRef}>
      <PreviewRow title={name} shows={shows} loading={loading} onSeeAll={onSeeAll} onShowClick={onShowClick} seeAllLabel={seeAllLabel} />
    </div>
  );
};
