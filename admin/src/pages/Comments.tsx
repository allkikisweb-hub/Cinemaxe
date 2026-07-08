import { useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { websiteApi } from '../lib/websiteApi';
import { Check, X, Trash2, Star, Filter } from 'lucide-react';

interface CommentsProps {
  search: string;
}

export default function Comments({ search }: CommentsProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await websiteApi.getComments(statusFilter || undefined)) as any;
      setComments(data.comments || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? comments.filter((c) => c.text.toLowerCase().includes(search.toLowerCase()) || c.user_name.toLowerCase().includes(search.toLowerCase()))
    : comments;

  const act = async (id: string, fn: () => Promise<any>) => {
    setBusyId(id);
    try { await fn(); await load(); } catch (e: any) { alert(e.message); } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Comments & Reviews</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Moderate reviews left on movie and show pages across the site.</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5" style={{ color: 'var(--text-faint)' }} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-base w-auto">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {error && <div className="rounded-xl p-4 text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(57,255,20,0.2)', borderTopColor: 'var(--accent)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--surface-2)', border: '1px dashed var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No comments found.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((c) => (
            <div key={c.id} className="rounded-2xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white">{c.user_name}</p>
                    {c.movie_title && <span className="text-xs" style={{ color: 'var(--text-faint)' }}>on {c.movie_title}</span>}
                    {c.rating != null && (
                      <span className="flex items-center gap-0.5 text-xs font-medium" style={{ color: 'var(--accent-text)' }}>
                        <Star className="w-3 h-3 fill-current" /> {c.rating}
                      </span>
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase" style={
                      c.status === 'approved' ? { background: 'var(--accent-dim)', color: 'var(--accent-text)' } :
                      c.status === 'rejected' ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444' } :
                      { background: 'rgba(224,168,0,0.1)', color: '#e0a800' }
                    }>{c.status}</span>
                  </div>
                  <p className="text-sm mt-1.5" style={{ color: 'var(--text-muted)' }}>{c.text}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {c.status !== 'approved' && (
                    <IconBtn title="Approve" onClick={() => act(c.id, () => websiteApi.setCommentStatus(c.id, 'approved'))} busy={busyId === c.id}><Check className="w-3.5 h-3.5" /></IconBtn>
                  )}
                  {c.status !== 'rejected' && (
                    <IconBtn title="Reject" danger onClick={() => act(c.id, () => websiteApi.setCommentStatus(c.id, 'rejected'))} busy={busyId === c.id}><X className="w-3.5 h-3.5" /></IconBtn>
                  )}
                  <IconBtn title="Delete" danger onClick={() => { if (confirm('Delete this comment permanently?')) act(c.id, () => websiteApi.deleteComment(c.id)); }} busy={busyId === c.id}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, title, danger, busy }: { children: ReactNode; onClick: () => void; title: string; danger?: boolean; busy?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={busy}
      className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-40"
      style={danger ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444' } : { background: 'var(--accent-dim)', color: 'var(--accent-text)' }}
    >
      {children}
    </button>
  );
}
