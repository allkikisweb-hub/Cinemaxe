import { useCallback, useEffect, useState } from 'react';
import { websiteApi } from '../lib/websiteApi';
import { fetchTmdbKeyFromSettings, posterUrl, searchMulti } from '../lib/tmdb';
import { Film, Loader2, Plus, Search, X } from 'lucide-react';

function MovieIdListEditor({
  title,
  description,
  ids,
  onChange,
  tmdbKey,
}: {
  title: string;
  description: string;
  ids: number[];
  onChange: (ids: number[]) => void;
  tmdbKey: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      searchMulti(query, tmdbKey)
        .then((r) => setResults(r.slice(0, 6)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(t);
  }, [query, tmdbKey]);

  return (
    <div className="rounded-2xl p-5 glass-card">
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>{description}</p>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-faint)' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search TMDB to add a title..."
          className="input-base pl-9"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin" style={{ color: 'var(--text-faint)' }} />}
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-xl overflow-hidden max-h-64 overflow-y-auto glass-card">
            {results.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange([...new Set([...ids, m.id])]);
                  setQuery('');
                  setResults([]);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left cursor-pointer"
              >
                {m.poster_path && (
                  <img src={posterUrl(m.poster_path)} alt="" className="h-9 w-6 rounded object-cover" />
                )}
                <span className="text-xs text-white truncate flex-1">{m.title || m.name}</span>
                <Plus className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--accent-text)' }} />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <span
            key={id}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px]"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            #{id}
            <button type="button" onClick={() => onChange(ids.filter((i) => i !== id))} className="cursor-pointer" style={{ color: 'var(--text-faint)' }}>
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {ids.length === 0 && (
          <span className="text-[11px] italic" style={{ color: 'var(--text-faint)' }}>None — using default TMDB data.</span>
        )}
      </div>
    </div>
  );
}

export default function Catalog() {
  const [settings, setSettings] = useState<any>(null);
  const [tmdbKey, setTmdbKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await websiteApi.getSettings();
      setSettings((data as any).settings);
      const key = await fetchTmdbKeyFromSettings(() => websiteApi.getSettings());
      setTmdbKey(key);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const persist = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      const { settings: next } = (await websiteApi.updateSettings(patch)) as any;
      setSettings(next);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="rounded-xl p-4 text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>
        {error || 'Could not load catalog settings.'}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Film className="w-5 h-5" style={{ color: 'var(--accent-text)' }} />
            Catalog Curation
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Pin featured titles, override trending rows, and hide blocked content site-wide.
          </p>
        </div>
        {saving && (
          <span className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
            <Loader2 className="w-3 h-3 animate-spin" /> Saving…
          </span>
        )}
      </div>

      <MovieIdListEditor
        title="Featured Movies"
        description="Pinned to the homepage hero rotation on the live site."
        ids={settings.featuredMovieIds || []}
        onChange={(ids) => persist({ featuredMovieIds: ids })}
        tmdbKey={tmdbKey}
      />
      <MovieIdListEditor
        title="Trending Override"
        description="Force specific titles into the Trending Now row."
        ids={settings.trendingOverrideIds || []}
        onChange={(ids) => persist({ trendingOverrideIds: ids })}
        tmdbKey={tmdbKey}
      />
      <MovieIdListEditor
        title="Hidden / Blocked Titles"
        description="These TMDB IDs are hidden across the entire website."
        ids={settings.hiddenMovieIds || []}
        onChange={(ids) => persist({ hiddenMovieIds: ids })}
        tmdbKey={tmdbKey}
      />
    </div>
  );
}
