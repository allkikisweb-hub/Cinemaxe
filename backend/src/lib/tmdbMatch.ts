/** Server-side TMDB helpers for visual search matching (no client round-trips). */

import db from "./db";

const TMDB_BASE = "https://api.themoviedb.org/3";

export interface TmdbMovieHit {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: "movie" | "tv";
}

function getTmdbKey(): string {
  const fromDb = db.data.site_settings?.apiKeys?.tmdb;
  return (fromDb || process.env.TMDB_API_KEY || "8e887749d8a5b7a31b807aadd903d25a").trim();
}

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ api_key: getTmdbKey(), ...params });
  const res = await fetch(`${TMDB_BASE}${path}?${qs}`);
  if (!res.ok) throw new Error(`TMDB ${path} failed (${res.status})`);
  return res.json() as Promise<T>;
}

function normalizeHit(m: any, mediaType?: "movie" | "tv"): TmdbMovieHit | null {
  if (!m?.poster_path) return null;
  return {
    id: m.id,
    title: m.title,
    name: m.name,
    overview: m.overview || "",
    poster_path: m.poster_path,
    backdrop_path: m.backdrop_path || m.poster_path,
    vote_average: m.vote_average ?? 0,
    release_date: m.release_date,
    first_air_date: m.first_air_date,
    media_type: mediaType || (m.title ? "movie" : "tv"),
  };
}

export async function searchExactTitle(title: string, year?: string | null): Promise<TmdbMovieHit[]> {
  if (!title?.trim()) return [];
  const data = await tmdbFetch<{ results: any[] }>("/search/multi", {
    query: title.trim(),
    include_adult: "false",
  });
  const hits: TmdbMovieHit[] = [];
  for (const r of data.results || []) {
    if (r.media_type !== "movie" && r.media_type !== "tv") continue;
    if (year) {
      const y = (r.release_date || r.first_air_date || "").slice(0, 4);
      if (y && y !== year) continue;
    }
    const hit = normalizeHit(r, r.media_type);
    if (hit) hits.push(hit);
  }
  return hits.slice(0, 3);
}

export async function getSimilar(id: number, mediaType: "movie" | "tv"): Promise<TmdbMovieHit[]> {
  const path = mediaType === "tv" ? `/tv/${id}/similar` : `/movie/${id}/similar`;
  const data = await tmdbFetch<{ results: any[] }>(path);
  return (data.results || [])
    .map((m) => normalizeHit(m, mediaType))
    .filter(Boolean) as TmdbMovieHit[];
}

export async function discoverByGenreNames(genreNames: string[]): Promise<TmdbMovieHit[]> {
  if (!genreNames?.length) return [];
  const allGenres = await tmdbFetch<{ genres: Array<{ id: number; name: string }> }>("/genre/movie/list");
  const matchedIds = allGenres.genres
    .filter((g) => genreNames.some((n) => g.name.toLowerCase() === n.toLowerCase()))
    .map((g) => g.id);
  if (!matchedIds.length) return [];
  const data = await tmdbFetch<{ results: any[] }>("/discover/movie", {
    with_genres: matchedIds.join(","),
    sort_by: "popularity.desc",
  });
  return (data.results || []).map((m) => normalizeHit(m, "movie")).filter(Boolean) as TmdbMovieHit[];
}

export async function searchByKeywords(keywords: string[]): Promise<TmdbMovieHit[]> {
  if (!keywords?.length) return [];
  const seen = new Set<number>();
  const merged: TmdbMovieHit[] = [];
  const batch = keywords.slice(0, 5);
  const results = await Promise.all(
    batch.map((kw) =>
      tmdbFetch<{ results: any[] }>("/search/movie", { query: kw }).catch(() => ({ results: [] }))
    )
  );
  for (const data of results) {
    for (const m of data.results || []) {
      const hit = normalizeHit(m, "movie");
      if (hit && !seen.has(hit.id)) {
        seen.add(hit.id);
        merged.push(hit);
      }
    }
  }
  return merged;
}

export interface VisualAnalysis {
  description?: string;
  genres?: string[];
  keywords?: string[];
  moodTags?: string[];
  exactTitle?: string | null;
  exactYear?: string | null;
  isKnownPoster?: boolean;
}

/** Merge TMDB results from analysis fields into a ranked deduped list (max 12). */
export async function matchMoviesFromAnalysis(analysis: VisualAnalysis): Promise<TmdbMovieHit[]> {
  const seen = new Set<number>();
  const merged: TmdbMovieHit[] = [];

  const push = (list: TmdbMovieHit[]) => {
    for (const m of list) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        merged.push(m);
      }
    }
  };

  if (analysis.exactTitle) {
    const exact = await searchExactTitle(analysis.exactTitle, analysis.exactYear);
    push(exact);
    if (exact[0]) {
      const sim = await getSimilar(exact[0].id, exact[0].media_type || "movie");
      push(sim);
    }
  }

  const moodAsKeywords = [...(analysis.keywords || []), ...(analysis.moodTags || [])];
  const [byKeyword, byGenre] = await Promise.all([
    searchByKeywords(moodAsKeywords),
    discoverByGenreNames(analysis.genres || []),
  ]);
  push(byKeyword);
  push(byGenre);

  return merged.slice(0, 12);
}
