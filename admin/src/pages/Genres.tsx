import { useEffect, useState, useCallback } from 'react';
import { websiteApi } from '../lib/websiteApi';
import { Eye, EyeOff, Tag, Pencil, Check, X } from 'lucide-react';

// Same public TMDB v3 key the website itself uses for its genre catalog —
// genres are TMDB's, not something stored in Cinemax's own database.
const TMDB_KEY = '8e887749d8a5b7a31b807aadd903d25a';

interface TmdbGenre { id: number; name: string; }
interface Override { genre_id: number; label: string | null; hidden: boolean; }

export default function Genres() {
  const [movieGenres, setMovieGenres] = useState<TmdbGenre[]>([]);
  const [tvGenres, setTvGenres] = useState<TmdbGenre[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [tab, setTab] = useState<'movie' | 'tv'>('movie');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [tmdbKey, setTmdbKey] = useState(TMDB_KEY);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const settings = await websiteApi.getSettings().catch(() => ({ settings: {} }));
      const key = settings?.settings?.apiKeys?.tmdb || TMDB_KEY;
      setTmdbKey(key);
      const [mv, tv, ov] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${key}`).then((r) => r.json()),
        fetch(`https://api.themoviedb.org/3/genre/tv/list?api_key=${key}`).then((r) => r.json()),
        websiteApi.getCategoryOverrides(),
      ]);
      setMovieGenres(mv.genres || []);
      setTvGenres(tv.genres || []);
      setOverrides((ov as any).overrides || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const overrideFor = (id: number) => overrides.find((o) => o.genre_id === id);

  const toggleHidden = async (id: number) => {
    const current = overrideFor(id);
    const { override } = (await websiteApi.updateCategoryOverride(id, { hidden: !current?.hidden })) as any;
    setOverrides((prev) => [...prev.filter((o) => o.genre_id !== id), override]);
  };

  const startRename = (g: TmdbGenre) => {
    setRenamingId(g.id);
    setRenameValue(overrideFor(g.id)?.label || g.name);
  };

  const saveRename = async (id: number) => {
    const { override } = (await websiteApi.updateCategoryOverride(id, { label: renameValue.trim() || null })) as any;
    setOverrides((prev) => [...prev.filter((o) => o.genre_id !== id), override]);
    setRenamingId(null);
  };

  const genres = tab === 'movie' ? movieGenres : tvGenres;

  const runTmdbSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const endpoint = tab === 'movie' ? 'search/movie' : 'search/tv';
      const data = await fetch(
        `https://api.themoviedb.org/3/${endpoint}?api_key=${tmdbKey}&query=${encodeURIComponent(searchQuery)}`
      ).then((r) => r.json());
      setSearchResults((data.results || []).slice(0, 12));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2"><Tag className="w-5 h-5" style={{ color: 'var(--accent-text)' }} /> Categories & Genres</h1>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Manage categories, search TMDB for titles, and control what appears in the website navigation.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>TMDB Search</p>
        <div className="flex gap-2">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runTmdbSearch()}
            placeholder={`Search ${tab === 'movie' ? 'movies' : 'TV shows'} on TMDB...`}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          />
          <button onClick={runTmdbSearch} disabled={searching} className="neon-btn px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            {searchResults.map((r) => (
              <div key={r.id} className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {r.poster_path && (
                  <img src={`https://image.tmdb.org/t/p/w200${r.poster_path}`} alt="" className="w-full aspect-[2/3] object-cover" />
                )}
                <div className="p-2">
                  <p className="text-xs font-bold text-white truncate">{r.title || r.name}</p>
                  <p className="text-[10px]" style={{ color: '#5a5a5a' }}>ID: {r.id}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {(['movie', 'tv'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide cursor-pointer transition-colors"
            style={tab === t ? { background: 'var(--accent)', color: '#050505' } : { background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            {t === 'movie' ? 'Movie Genres' : 'TV Genres'}
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl p-4 text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(57,255,20,0.2)', borderTopColor: 'var(--accent)' }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {genres.map((g) => {
            const ov = overrideFor(g.id);
            const hidden = !!ov?.hidden;
            const displayName = ov?.label || g.name;
            return (
              <div key={g.id} className="rounded-xl p-4 flex items-center justify-between gap-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                {renamingId === g.id ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveRename(g.id)}
                      className="input-base"
                    />
                    <button onClick={() => saveRename(g.id)} className="cursor-pointer flex-shrink-0"><Check className="w-4 h-4" style={{ color: 'var(--accent-text)' }} /></button>
                    <button onClick={() => setRenamingId(null)} className="cursor-pointer flex-shrink-0"><X className="w-4 h-4" style={{ color: 'var(--text-faint)' }} /></button>
                  </div>
                ) : (
                  <button onClick={() => startRename(g)} className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer group">
                    <span className={`text-sm font-semibold truncate ${hidden ? 'line-through' : ''}`} style={{ color: hidden ? 'var(--text-faint)' : '#fff' }}>{displayName}</span>
                    <Pencil className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-faint)' }} />
                  </button>
                )}
                <button onClick={() => toggleHidden(g.id)} className="flex-shrink-0 cursor-pointer">
                  {hidden ? <EyeOff className="w-4 h-4" style={{ color: 'var(--text-faint)' }} /> : <Eye className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
