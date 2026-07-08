import { VisualContextPayload } from "./visualSearch";

export interface AssistantUserContext {
  name?: string;
  email?: string;
  role?: string;
  subscription?: string;
  isGuest?: boolean;
  preferences?: Record<string, unknown>;
}

export interface AssistantMovieContext {
  id?: number;
  title?: string;
  name?: string;
  overview?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  genres?: Array<{ name: string }> | string;
}

export async function askAssistant(params: {
  message: string;
  history?: Array<{ role: string; text: string }>;
  movieContext?: AssistantMovieContext;
  visualContext?: VisualContextPayload | null;
}): Promise<{ text: string }> {
  const res = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      message: params.message,
      history: params.history || [],
      movieContext: params.movieContext,
      visualContext: params.visualContext,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Assistant error (${res.status})`);
  return { text: data.text || "" };
}

/** Strip ```action blocks for widgets that don't execute actions. */
export function stripActionBlocks(text: string): string {
  return text.replace(/```action\s*[\s\S]*?```/g, "").trim();
}
