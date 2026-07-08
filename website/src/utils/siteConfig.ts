import { Movie } from "../types";
import { tmdb } from "./tmdb";

export interface HomepageSection {
  id: string;
  label: string;
  visible: boolean;
}

export interface ContentPageConfig {
  enabled: boolean;
  label: string;
}

export interface PublicSiteConfig {
  siteName: string;
  heroTagline: string;
  maintenanceMode: boolean;
  featuredMovieIds: number[];
  trendingOverrideIds: number[];
  hiddenMovieIds: number[];
  homepageSections: HomepageSection[];
  contentPages: Record<string, ContentPageConfig>;
  tmdbApiKey?: string;
}

export interface PublicAd {
  id: string;
  title: string;
  imageUrl: string;
  targetUrl: string;
  placement: string;
}

const DEFAULT_SECTIONS: HomepageSection[] = [
  { id: "trending", label: "Trending Now", visible: true },
  { id: "tv", label: "Popular TV Broadcast Series", visible: true },
  { id: "popular", label: "Popular Movies", visible: true },
  { id: "top_rated", label: "Top Rated Cinema Hits", visible: true },
  { id: "upcoming", label: "Upcoming Blockbusters", visible: true },
  { id: "now_playing", label: "Now Playing in Theaters", visible: true },
];

export const DEFAULT_PUBLIC_CONFIG: PublicSiteConfig = {
  siteName: "Cinemax",
  heroTagline: "Welcome to Cinemax! Enjoy new trend movies and TV shows.",
  maintenanceMode: false,
  featuredMovieIds: [],
  trendingOverrideIds: [],
  hiddenMovieIds: [],
  homepageSections: DEFAULT_SECTIONS,
  contentPages: {},
};

let cachedConfig: PublicSiteConfig | null = null;

export async function fetchPublicSiteConfig(force = false): Promise<PublicSiteConfig> {
  if (cachedConfig && !force) return cachedConfig;
  try {
    const res = await fetch("/api/config/public");
    if (!res.ok) throw new Error("config fetch failed");
    const data = await res.json();
    cachedConfig = {
      siteName: data.siteName || DEFAULT_PUBLIC_CONFIG.siteName,
      heroTagline: data.heroTagline || DEFAULT_PUBLIC_CONFIG.heroTagline,
      maintenanceMode: Boolean(data.maintenanceMode),
      featuredMovieIds: Array.isArray(data.featuredMovieIds) ? data.featuredMovieIds : [],
      trendingOverrideIds: Array.isArray(data.trendingOverrideIds) ? data.trendingOverrideIds : [],
      hiddenMovieIds: Array.isArray(data.hiddenMovieIds) ? data.hiddenMovieIds : [],
      homepageSections: Array.isArray(data.homepageSections) && data.homepageSections.length
        ? data.homepageSections
        : DEFAULT_SECTIONS,
      contentPages: data.contentPages || {},
      tmdbApiKey: data.tmdbApiKey,
    };
    return cachedConfig;
  } catch {
    return DEFAULT_PUBLIC_CONFIG;
  }
}

export function invalidateSiteConfigCache() {
  cachedConfig = null;
}

export async function fetchPublicAds(): Promise<PublicAd[]> {
  try {
    const res = await fetch("/api/ads/public");
    if (!res.ok) return [];
    const data = await res.json();
    return (data.ads || []).map((a: any) => ({
      id: a.id,
      title: a.title,
      imageUrl: a.image_url || a.imageUrl,
      targetUrl: a.target_url || a.targetUrl,
      placement: a.placement,
    }));
  } catch {
    return [];
  }
}

export function filterHiddenMovies(movies: Movie[], hiddenIds: number[]): Movie[] {
  if (!hiddenIds?.length) return movies;
  const hidden = new Set(hiddenIds);
  return movies.filter((m) => !hidden.has(m.id));
}

export async function applyTrendingOverride(movies: Movie[], overrideIds: number[]): Promise<Movie[]> {
  if (!overrideIds?.length) return movies;
  const overrideSet = new Set(overrideIds);
  const ordered: Movie[] = [];
  for (const id of overrideIds) {
    const found = movies.find((m) => m.id === id);
    if (found) {
      ordered.push(found);
      continue;
    }
    try {
      ordered.push(await tmdb.getMovieDetails(id));
    } catch {
      /* skip missing titles */
    }
  }
  return [...ordered, ...movies.filter((m) => !overrideSet.has(m.id))];
}

export async function loadFeaturedMovies(ids: number[]): Promise<Movie[]> {
  if (!ids?.length) return [];
  const results: Movie[] = [];
  for (const id of ids) {
    try {
      results.push(await tmdb.getMovieDetails(id));
    } catch {
      /* skip */
    }
  }
  return results;
}

export function adsForPlacement(ads: PublicAd[], placement: string): PublicAd[] {
  return ads.filter((a) => a.placement === placement);
}
