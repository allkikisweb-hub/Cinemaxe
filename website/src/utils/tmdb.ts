import { Movie, CastMember, Review } from "../types";

const BASE_URL = "https://api.themoviedb.org/3";
const FALLBACK_API_KEY = "8e887749d8a5b7a31b807aadd903d25a";

/** True when a catalog item should play as a TV series (season/episode embed). */
export function isTvShow(item: Pick<Movie, "title" | "name" | "media_type">): boolean {
  if (item.media_type === "tv") return true;
  if (item.media_type === "movie") return false;
  return !item.title && !!item.name;
}

function normalizeSearchItem(raw: Movie & { media_type?: string }, fallbackType: "movie" | "tv"): Movie | null {
  if (!raw.poster_path || (!raw.title && !raw.name)) return null;
  const mt = raw.media_type as string | undefined;
  if (mt === "person") return null;
  const media_type =
    mt === "tv" || (!raw.title && raw.name)
      ? "tv"
      : mt === "movie" || raw.title
        ? "movie"
        : fallbackType;
  return { ...raw, media_type };
}

function searchResultKey(item: Movie): string {
  return `${item.media_type || (item.title ? "movie" : "tv")}:${item.id}`;
}

function scoreSearchResult(item: Movie, query: string): number {
  const q = query.toLowerCase().trim();
  const title = (item.title || item.name || "").toLowerCase();
  let score = (item.vote_average || 0) * 2;
  score += Math.log10((item.vote_count || 50) + 1) * 8;
  score += (item.popularity || 0) * 0.05;
  if (title === q) score += 200;
  else if (title.startsWith(q)) score += 80;
  else if (title.includes(q)) score += 40;
  const qWords = q.split(/\s+/).filter(Boolean);
  if (qWords.length > 1 && qWords.every((w) => title.includes(w))) score += 30;
  return score;
}

export interface SearchBatchResult {
  results: Movie[];
  totalPages: number;
  hasMore: boolean;
}

/** Fetches full TMDB details and resolves the correct movie vs TV type for streaming embeds. */
export async function prepareForPlayback(item: Movie): Promise<Movie> {
  if (item.isCustom || item.id <= 0) {
    return { ...item, media_type: item.media_type ?? "movie" };
  }

  const preferTv = isTvShow(item);
  const tryOrder: Array<"movie" | "tv"> = preferTv ? ["tv", "movie"] : ["movie", "tv"];

  for (const type of tryOrder) {
    try {
      const details = await fetchFromTMDB<Movie>(type === "tv" ? `/tv/${item.id}` : `/movie/${item.id}`);
      return {
        ...item,
        ...details,
        media_type: type,
        poster_path: details.poster_path || item.poster_path,
        backdrop_path: details.backdrop_path || item.backdrop_path,
      };
    } catch {
      /* try the other media type — search results can mislabel titles */
    }
  }

  return {
    ...item,
    media_type: item.media_type ?? (preferTv ? "tv" : "movie"),
  };
}

let runtimeApiKey = FALLBACK_API_KEY;

export function setTmdbApiKey(key: string) {
  if (key && key.trim()) runtimeApiKey = key.trim();
}

export function getTmdbApiKey() {
  return runtimeApiKey;
}

export async function initTmdbFromSiteConfig() {
  try {
    const res = await fetch("/api/config/public");
    if (!res.ok) return;
    const data = await res.json();
    if (data.tmdbApiKey) setTmdbApiKey(data.tmdbApiKey);
  } catch {
    /* use fallback key */
  }
}

export const getImageUrl = (path: string | null, size: "w500" | "original" = "w500") => {
  if (!path) return "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=500&auto=format&fit=crop";
  // Custom/CMS content stores full image URLs rather than TMDB path
  // fragments — pass those through untouched instead of double-prefixing.
  if (/^https?:\/\//i.test(path)) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

async function fetchFromTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const queryParams = new URLSearchParams({
    api_key: getTmdbApiKey(),
    ...params,
  });
  
  const url = `${BASE_URL}${endpoint}?${queryParams.toString()}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`TMDB API Error: ${response.statusText}`);
    }
    return await response.json() as T;
  } catch (error) {
    console.error(`Error fetching from endpoint ${endpoint}:`, error);
    throw error;
  }
}

export const tmdb = {
  // Movies
  getTrendingMovies: async (page = 1) => {
    const data = await fetchFromTMDB<{ results: Movie[]; total_pages: number }>("/trending/movie/week", { page: String(page) });
    return data.results;
  },
  getPopularMovies: async (page = 1) => {
    const data = await fetchFromTMDB<{ results: Movie[]; total_pages: number }>("/movie/popular", { page: String(page) });
    return data.results;
  },
  getTopRatedMovies: async (page = 1) => {
    const data = await fetchFromTMDB<{ results: Movie[]; total_pages: number }>("/movie/top_rated", { page: String(page) });
    return data.results;
  },
  getUpcomingMovies: async (page = 1) => {
    const data = await fetchFromTMDB<{ results: Movie[]; total_pages: number }>("/movie/upcoming", { page: String(page) });
    return data.results;
  },
  getNowPlayingMovies: async (page = 1) => {
    const data = await fetchFromTMDB<{ results: Movie[]; total_pages: number }>("/movie/now_playing", { page: String(page) });
    return data.results;
  },
  getMovieDetails: async (id: number) => {
    return await fetchFromTMDB<Movie>(`/movie/${id}`);
  },
  getMovieVideos: async (id: number) => {
    const data = await fetchFromTMDB<{ results: Array<{ key: string; name: string; type: string; site: string }> }>(
      `/movie/${id}/videos`
    );
    // Find YouTube trailer
    return data.results.filter(video => video.site === "YouTube" && (video.type === "Trailer" || video.type === "Teaser"));
  },
  getMovieCredits: async (id: number) => {
    const data = await fetchFromTMDB<{ cast: CastMember[] }>(`/movie/${id}/credits`);
    return data.cast.slice(0, 12);
  },
  getMovieReviews: async (id: number) => {
    const data = await fetchFromTMDB<{ results: Review[] }>(`/movie/${id}/reviews`);
    return data.results.slice(0, 5);
  },
  getSimilarMovies: async (id: number) => {
    const data = await fetchFromTMDB<{ results: Movie[] }>(`/movie/${id}/similar`);
    return data.results.slice(0, 10);
  },
  getMovieRecommendations: async (id: number) => {
    const data = await fetchFromTMDB<{ results: Movie[] }>(`/movie/${id}/recommendations`);
    return data.results.slice(0, 10);
  },

  // Generic paginated discover — powers infinite scroll for a single genre.
  discoverMoviesByGenre: async (genreId: number, page = 1, sortBy: string = "popularity.desc") => {
    const data = await fetchFromTMDB<{ results: Movie[]; total_pages: number }>("/discover/movie", {
      with_genres: String(genreId),
      sort_by: sortBy,
      page: String(page),
      "vote_count.gte": "20",
    });
    return { results: data.results.filter((m) => m.poster_path), totalPages: data.total_pages };
  },
  discoverTVByGenre: async (genreId: number, page = 1, sortBy: string = "popularity.desc") => {
    const data = await fetchFromTMDB<{ results: Movie[]; total_pages: number }>("/discover/tv", {
      with_genres: String(genreId),
      sort_by: sortBy,
      page: String(page),
      "vote_count.gte": "20",
    });
    return { results: data.results.filter((m) => m.poster_path), totalPages: data.total_pages };
  },

  // TV Shows
  getTrendingTVShows: async (page = 1) => {
    const data = await fetchFromTMDB<{ results: Movie[]; total_pages: number }>("/trending/tv/week", { page: String(page) });
    return data.results;
  },
  getPopularTVShows: async (page = 1) => {
    const data = await fetchFromTMDB<{ results: Movie[]; total_pages: number }>("/tv/popular", { page: String(page) });
    return data.results;
  },
  getTopRatedTVShows: async (page = 1) => {
    const data = await fetchFromTMDB<{ results: Movie[]; total_pages: number }>("/tv/top_rated", { page: String(page) });
    return data.results;
  },
  getAiringTodayTVShows: async (page = 1) => {
    const data = await fetchFromTMDB<{ results: Movie[]; total_pages: number }>("/tv/airing_today", { page: String(page) });
    return data.results;
  },
  getOnTheAirTVShows: async (page = 1) => {
    const data = await fetchFromTMDB<{ results: Movie[]; total_pages: number }>("/tv/on_the_air", { page: String(page) });
    return data.results;
  },
  getTVDetails: async (id: number) => {
    return await fetchFromTMDB<Movie>(`/tv/${id}`);
  },
  getTVSeason: async (id: number, season: number) => {
    const data = await fetchFromTMDB<{
      episodes: Array<{ episode_number: number; name: string; still_path: string | null; air_date: string }>;
      season_number: number;
    }>(`/tv/${id}/season/${season}`);
    return data.episodes || [];
  },
  searchMovies: async (query: string, page = 1) => {
    const data = await fetchFromTMDB<{ results: Movie[] }>("/search/movie", { query, page: String(page) });
    return data.results.filter((m) => m.poster_path);
  },
  searchTV: async (query: string, page = 1) => {
    const data = await fetchFromTMDB<{ results: Movie[] }>("/search/tv", { query, page: String(page) });
    return data.results.filter((m) => m.poster_path);
  },
  getTVVideos: async (id: number) => {
    const data = await fetchFromTMDB<{ results: Array<{ key: string; name: string; type: string; site: string }> }>(
      `/tv/${id}/videos`
    );
    return data.results.filter(video => video.site === "YouTube" && (video.type === "Trailer" || video.type === "Teaser"));
  },
  getTVCredits: async (id: number) => {
    const data = await fetchFromTMDB<{ cast: CastMember[] }>(`/tv/${id}/credits`);
    return data.cast.slice(0, 12);
  },
  getTVReviews: async (id: number) => {
    const data = await fetchFromTMDB<{ results: Review[] }>(`/tv/${id}/reviews`);
    return data.results.slice(0, 5);
  },
  getTVRecommendations: async (id: number) => {
    const data = await fetchFromTMDB<{ results: Movie[] }>(`/tv/${id}/recommendations`);
    return data.results.slice(0, 10);
  },

  // Search & Genres — unified engine across movies, TV, and multi index
  searchMulti: async (query: string, page = 1) => {
    const data = await fetchFromTMDB<{ results: Array<Movie & { media_type?: string }>; total_pages: number }>(
      "/search/multi",
      { query, page: String(page), include_adult: "false" }
    );
    return data.results
      .map((item) => normalizeSearchItem(item, item.media_type === "tv" ? "tv" : "movie"))
      .filter((item): item is Movie => item !== null);
  },

  /**
   * Deep search: queries movie, TV, and multi endpoints in parallel for each
   * page in the batch, merges/dedupes, and ranks by title match + popularity.
   */
  searchEverything: async (
    query: string,
    options: { startPage?: number; pageCount?: number } = {}
  ): Promise<SearchBatchResult> => {
    const startPage = options.startPage ?? 1;
    const pageCount = options.pageCount ?? 3;
    const pages = Array.from({ length: pageCount }, (_, i) => startPage + i);

    const empty = { results: [] as Movie[], total_pages: 0 };
    const requests = pages.flatMap((page) => [
      fetchFromTMDB<{ results: Movie[]; total_pages: number }>("/search/movie", {
        query,
        page: String(page),
        include_adult: "false",
      }).catch(() => empty),
      fetchFromTMDB<{ results: Movie[]; total_pages: number }>("/search/tv", {
        query,
        page: String(page),
        include_adult: "false",
      }).catch(() => empty),
      fetchFromTMDB<{ results: Array<Movie & { media_type?: string }>; total_pages: number }>(
        "/search/multi",
        { query, page: String(page), include_adult: "false" }
      ).catch(() => empty),
    ]);

    const batches = await Promise.all(requests);
    const seen = new Set<string>();
    const merged: Movie[] = [];

    batches.forEach((batch, idx) => {
      const endpointKind = idx % 3;
      const fallback: "movie" | "tv" = endpointKind === 1 ? "tv" : "movie";
      for (const raw of batch.results || []) {
        const item = normalizeSearchItem(raw as Movie & { media_type?: string }, fallback);
        if (!item) continue;
        // Movie/TV list endpoints never set media_type — force it from endpoint kind
        if (endpointKind === 0) item.media_type = "movie";
        if (endpointKind === 1) item.media_type = "tv";
        const key = searchResultKey(item);
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
      }
    });

    merged.sort((a, b) => scoreSearchResult(b, query) - scoreSearchResult(a, query));

    const maxTotalPages = Math.max(...batches.map((b) => b.total_pages || 0), 0);
    const lastPageFetched = startPage + pageCount - 1;

    return {
      results: merged,
      totalPages: maxTotalPages,
      hasMore: lastPageFetched < maxTotalPages,
    };
  },

  /** Match Cinemax Originals / custom CMS titles against a query string. */
  searchCustomContent: async (query: string): Promise<Movie[]> => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    try {
      const res = await fetch("/api/content/custom");
      if (!res.ok) return [];
      const { movies } = await res.json();
      return (movies || []).filter((m: Movie) => {
        const title = (m.title || m.name || "").toLowerCase();
        const overview = (m.overview || "").toLowerCase();
        return title.includes(q) || overview.includes(q);
      });
    } catch {
      return [];
    }
  },

  getGenres: async (type: "movie" | "tv" = "movie") => {
    const data = await fetchFromTMDB<{ genres: Array<{ id: number; name: string }> }>(`/genre/${type}/list`);
    return data.genres;
  },

  // Visual Search support: resolve human-readable genre names (from the AI vision
  // analysis) to TMDB genre IDs, then discover movies matching those genres,
  // sorted by popularity so results are recognizable and well-posterized.
  discoverByGenreNames: async (genreNames: string[]) => {
    if (!genreNames || genreNames.length === 0) return [];
    const allGenres = await fetchFromTMDB<{ genres: Array<{ id: number; name: string }> }>("/genre/movie/list");
    const matchedIds = allGenres.genres
      .filter((g) => genreNames.some((name) => g.name.toLowerCase() === name.toLowerCase()))
      .map((g) => g.id);
    if (matchedIds.length === 0) return [];
    const data = await fetchFromTMDB<{ results: Movie[] }>("/discover/movie", {
      with_genres: matchedIds.join(","),
      sort_by: "popularity.desc",
    });
    return data.results.filter((m) => m.poster_path);
  },

  // Runs multi-search across a batch of visual keywords and merges/dedupes results.
  searchByKeywords: async (keywords: string[]) => {
    if (!keywords || keywords.length === 0) return [];
    const batches = await Promise.all(
      keywords.slice(0, 4).map((kw) =>
        fetchFromTMDB<{ results: Movie[] }>("/search/movie", { query: kw }).catch(() => ({ results: [] as Movie[] }))
      )
    );
    const seen = new Set<number>();
    const merged: Movie[] = [];
    for (const batch of batches) {
      for (const m of batch.results) {
        if (m.poster_path && !seen.has(m.id)) {
          seen.add(m.id);
          merged.push(m);
        }
      }
    }
    return merged;
  },
};
