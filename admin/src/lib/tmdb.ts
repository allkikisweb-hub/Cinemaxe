const DEFAULT_KEY = '8e887749d8a5b7a31b807aadd903d25a';

export function posterUrl(path: string | null, size = 'w500') {
  if (!path) return '';
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export async function searchMulti(query: string, apiKey = DEFAULT_KEY) {
  if (!query.trim()) return [];
  const qs = new URLSearchParams({ api_key: apiKey, query: query.trim(), include_adult: 'false' });
  const res = await fetch(`https://api.themoviedb.org/3/search/multi?${qs}`);
  const data = await res.json();
  return (data.results || []).filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv');
}

export async function fetchTmdbKeyFromSettings(getSettings: () => Promise<any>): Promise<string> {
  try {
    const data = await getSettings();
    return data?.settings?.apiKeys?.tmdb || DEFAULT_KEY;
  } catch {
    return DEFAULT_KEY;
  }
}
