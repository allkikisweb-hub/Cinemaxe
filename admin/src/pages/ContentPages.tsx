import { useEffect, useState } from 'react';
import { Layout, Save, Loader2 } from 'lucide-react';
import { websiteApi } from '../lib/websiteApi';

const PAGE_KEYS = [
  'home', 'movies', 'tv', 'shorts', 'mylist', 'watchlist', 'history', 'favorites', 'downloads',
] as const;

const DEFAULT_LABELS: Record<string, string> = {
  home: 'Home',
  movies: 'Movies',
  tv: 'TV Shows',
  shorts: 'Shorts',
  mylist: 'My List',
  watchlist: 'Watchlist',
  history: 'History',
  favorites: 'Favorites',
  downloads: 'Downloads',
};

export default function ContentPages() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pages, setPages] = useState<Record<string, { enabled: boolean; label: string }>>({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    websiteApi.getSettings().then(({ settings }) => {
      setPages(settings?.contentPages || {});
    }).finally(() => setLoading(false));
  }, []);

  const toggle = (key: string) => {
    setPages((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key]?.enabled, label: prev[key]?.label || DEFAULT_LABELS[key] },
    }));
  };

  const setLabel = (key: string, label: string) => {
    setPages((prev) => ({
      ...prev,
      [key]: { enabled: prev[key]?.enabled ?? true, label },
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await websiteApi.updateSettings({ contentPages: pages });
      setMessage('Content page settings saved.');
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#39FF14' }} /></div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Layout className="w-6 h-6" style={{ color: '#39FF14' }} />
        <div>
          <h1 className="text-xl font-bold text-white">Content Pages</h1>
          <p className="text-sm" style={{ color: '#8a8a8a' }}>Enable or disable website sections and customize their labels.</p>
        </div>
      </div>

      {message && <p className="text-sm" style={{ color: '#39FF14' }}>{message}</p>}

      <div className="glass-card rounded-2xl divide-y divide-white/5">
        {PAGE_KEYS.map((key) => {
          const p = pages[key] || { enabled: true, label: DEFAULT_LABELS[key] };
          return (
            <div key={key} className="flex items-center gap-4 px-5 py-4">
              <button
                onClick={() => toggle(key)}
                className="w-10 h-6 rounded-full relative transition-colors flex-shrink-0"
                style={{ background: p.enabled ? '#39FF14' : 'rgba(255,255,255,0.1)' }}
              >
                <span
                  className="absolute top-1 w-4 h-4 rounded-full bg-black transition-all"
                  style={{ left: p.enabled ? '22px' : '4px' }}
                />
              </button>
              <input
                value={p.label}
                onChange={(e) => setLabel(key, e.target.value)}
                className="flex-1 bg-transparent text-sm text-white outline-none border-b border-transparent focus:border-[#39FF14]/40"
              />
              <span className="text-[10px] uppercase tracking-wider" style={{ color: '#5a5a5a' }}>{key}</span>
            </div>
          );
        })}
      </div>

      <button onClick={save} disabled={saving} className="neon-btn flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save Content Pages
      </button>
    </div>
  );
}
