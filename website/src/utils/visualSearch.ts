import { Movie } from "../types";

export interface VisualAnalysis {
  description: string;
  genres: string[];
  keywords: string[];
  moodTags: string[];
  exactTitle?: string | null;
  exactYear?: string | null;
  isKnownPoster?: boolean;
}

export interface VisualSearchResult {
  description: string;
  analysis: VisualAnalysis;
  matches: Movie[];
  aiAnswer?: string;
}

export interface VisualContextPayload {
  description: string;
  analysis: VisualAnalysis;
  matches: Array<{ id: number; title: string; overview?: string; rating?: number }>;
}

/**
 * Full visual search pipeline — Gemini vision + TMDB matching (+ optional AI Q&A)
 * runs server-side in one request.
 */
export async function runVisualSearchMatch(
  imageBase64: string,
  mimeType: string,
  question?: string
): Promise<VisualSearchResult> {
  const res = await fetch("/api/visual-search/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ imageBase64, mimeType, question: question?.trim() || undefined }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Visual search failed. Check that Gemini API key is configured.");
  return data as VisualSearchResult;
}

export function buildVisualContextFromResult(result: VisualSearchResult): VisualContextPayload {
  return {
    description: result.description,
    analysis: result.analysis,
    matches: result.matches.slice(0, 8).map((m) => ({
      id: m.id,
      title: (m.title || m.name || "Unknown") as string,
      overview: m.overview,
      rating: m.vote_average,
    })),
  };
}
