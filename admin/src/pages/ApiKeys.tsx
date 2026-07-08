import { useEffect, useState } from 'react';
import { Key, Save, Loader2 } from 'lucide-react';
import { websiteApi } from '../lib/websiteApi';

export default function ApiKeys() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tmdb, setTmdb] = useState('');
  const [gemini, setGemini] = useState('');
  const [groq, setGroq] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    websiteApi.getSettings().then(({ settings }) => {
      const keys = settings?.apiKeys || {};
      setTmdb(keys.tmdb || '');
      setGemini(keys.gemini || '');
      setGroq(keys.groq || '');
    }).catch(() => setMessage('Failed to load API keys.')).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      await websiteApi.updateSettings({
        apiKeys: { tmdb, gemini, groq },
      });
      setMessage('API keys saved — the main website will use them immediately.');
    } catch (e: any) {
      setMessage(e.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#39FF14' }} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Key className="w-6 h-6" style={{ color: '#39FF14' }} />
        <div>
          <h1 className="text-xl font-bold text-white">API Keys</h1>
          <p className="text-sm" style={{ color: '#8a8a8a' }}>
            Keys are stored on the website backend and applied to TMDB, Gemini, and Groq instantly.
          </p>
        </div>
      </div>

      {message && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(57,255,20,0.08)', color: '#39FF14', border: '1px solid rgba(57,255,20,0.2)' }}>
          {message}
        </div>
      )}

      <div className="glass-card rounded-2xl p-6 space-y-5">
        {[
          { label: 'TMDB API Key', value: tmdb, set: setTmdb, hint: 'Used for movie/TV search and genre discovery on the main site.' },
          { label: 'Gemini API Key', value: gemini, set: setGemini, hint: 'Powers Visual Search on the website.' },
          { label: 'Groq API Key', value: groq, set: setGroq, hint: 'Powers the AI Help Desk assistant.' },
        ].map(({ label, value, set, hint }) => (
          <div key={label} className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: '#9a9a9a' }}>{label}</label>
            <input
              type="password"
              value={value}
              onChange={(e) => set(e.target.value)}
              placeholder={`Enter ${label}`}
              className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
            <p className="text-[11px]" style={{ color: '#5a5a5a' }}>{hint}</p>
          </div>
        ))}

        <button
          onClick={save}
          disabled={saving}
          className="neon-btn flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save API Keys
        </button>
      </div>
    </div>
  );
}
