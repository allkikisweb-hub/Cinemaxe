import { useCallback, useEffect, useState } from 'react';
import { websiteApi } from '../lib/websiteApi';
import { Loader2, Megaphone, Plus, Trash2, Pencil } from 'lucide-react';

export default function Advertisements() {
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', imageUrl: '', targetUrl: '', placement: 'homepage_top' });
  const [editAd, setEditAd] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ title: '', imageUrl: '', targetUrl: '', placement: 'homepage_top', active: true });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await websiteApi.getAds();
      setAds((data as any).ads || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.imageUrl || !form.targetUrl) return;
    setCreating(true);
    try {
      await websiteApi.createAd(form);
      setForm({ title: '', imageUrl: '', targetUrl: '', placement: 'homepage_top' });
      load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (ad: any) => {
    setEditAd(ad);
    setEditForm({
      title: ad.title,
      imageUrl: ad.image_url,
      targetUrl: ad.target_url,
      placement: ad.placement,
      active: ad.active,
    });
  };

  const saveEdit = async () => {
    if (!editAd) return;
    try {
      await websiteApi.updateAd(editAd.id, {
        title: editForm.title,
        imageUrl: editForm.imageUrl,
        targetUrl: editForm.targetUrl,
        placement: editForm.placement,
        active: editForm.active,
      });
      setEditAd(null);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Megaphone className="w-5 h-5" style={{ color: 'var(--accent-text)' }} />
          Advertisements
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Manage ad placements across the live website — homepage, sidebar, and player pre-roll.
        </p>
      </div>

      {error && (
        <div className="rounded-xl p-4 text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>{error}</div>
      )}

      <form onSubmit={handleCreate} className="rounded-2xl p-5 space-y-3 glass-card">
        <h3 className="text-sm font-bold text-white">New Ad Placement</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ad title"
            className="input-base"
          />
          <select
            value={form.placement}
            onChange={(e) => setForm({ ...form, placement: e.target.value })}
            className="input-base"
          >
            <option value="homepage_top">Homepage — Top</option>
            <option value="homepage_mid">Homepage — Mid</option>
            <option value="sidebar">Sidebar</option>
            <option value="player_pre_roll">Player Pre-Roll</option>
          </select>
          <input
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            placeholder="Image URL"
            className="input-base sm:col-span-2"
          />
          <input
            value={form.targetUrl}
            onChange={(e) => setForm({ ...form, targetUrl: e.target.value })}
            placeholder="Destination URL"
            className="input-base sm:col-span-2"
          />
        </div>
        <button type="submit" disabled={creating} className="neon-btn flex items-center gap-2 font-bold px-5 py-2.5 rounded-xl text-xs uppercase disabled:opacity-60">
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Create Ad
        </button>
      </form>

      <div className="space-y-2">
        {ads.map((ad) => (
          <div key={ad.id} className="rounded-2xl p-4 flex items-center gap-4 glass-card">
            <img src={ad.image_url} alt="" className="h-14 w-24 rounded-lg object-cover" style={{ background: 'rgba(255,255,255,0.05)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{ad.title}</p>
              <p className="text-[10px] truncate" style={{ color: 'var(--text-faint)' }}>{ad.placement} · {ad.target_url}</p>
            </div>
            <button
              type="button"
              onClick={() => websiteApi.updateAd(ad.id, { active: !ad.active }).then(load)}
              className="text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer"
              style={{
                background: ad.active ? 'rgba(57,255,20,0.1)' : 'rgba(255,255,255,0.05)',
                color: ad.active ? '#39FF14' : 'var(--text-muted)',
              }}
            >
              {ad.active ? 'Active' : 'Paused'}
            </button>
            <button
              type="button"
              onClick={() => openEdit(ad)}
              className="p-2 rounded-lg cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--accent-text)' }}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => { if (confirm('Delete this ad?')) websiteApi.deleteAd(ad.id).then(load); }}
              className="p-2 rounded-lg cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#f87171' }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {ads.length === 0 && (
          <p className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>No ads yet — create one above.</p>
        )}
      </div>

      {editAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <h3 className="font-bold text-white">Edit Ad</h3>
            <input className="input-base w-full" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="Title" />
            <select className="input-base w-full" value={editForm.placement} onChange={(e) => setEditForm({ ...editForm, placement: e.target.value })}>
              <option value="homepage_top">Homepage — Top</option>
              <option value="homepage_mid">Homepage — Mid</option>
              <option value="sidebar">Sidebar</option>
              <option value="player_pre_roll">Player Pre-Roll</option>
            </select>
            <input className="input-base w-full" value={editForm.imageUrl} onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })} placeholder="Image URL" />
            <input className="input-base w-full" value={editForm.targetUrl} onChange={(e) => setEditForm({ ...editForm, targetUrl: e.target.value })} placeholder="Destination URL" />
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={editForm.active} onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })} />
              Active on live website
            </label>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setEditAd(null)} className="input-base px-4 py-2 cursor-pointer">Cancel</button>
              <button type="button" onClick={saveEdit} className="neon-btn px-4 py-2 rounded-xl font-bold text-xs cursor-pointer">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
