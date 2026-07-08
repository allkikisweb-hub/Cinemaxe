import { useCallback, useEffect, useState } from 'react';
import { websiteApi } from '../lib/websiteApi';
import { Mail, Trash2, CheckCircle2, MessageSquare, Loader2 } from 'lucide-react';

interface InquiriesProps {
  search: string;
}

type InquiryStatus = 'open' | 'replied' | 'closed';

export default function Inquiries({ search }: InquiriesProps) {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | InquiryStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = statusFilter === 'all' ? {} : { status: statusFilter };
      const data = (await websiteApi.getInquiries(params)) as any;
      let items = data.inquiries || [];
      const q = search.trim().toLowerCase();
      if (q) {
        items = items.filter(
          (i: any) =>
            i.subject?.toLowerCase().includes(q) ||
            i.message?.toLowerCase().includes(q) ||
            i.user_email?.toLowerCase().includes(q) ||
            i.user_name?.toLowerCase().includes(q)
        );
      }
      setInquiries(items);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = inquiries.find((i) => i.id === selectedId) || null;

  useEffect(() => {
    if (selectedId && !inquiries.find((i) => i.id === selectedId)) {
      setSelectedId(null);
    }
  }, [inquiries, selectedId]);

  useEffect(() => {
    setReplyText(selected?.admin_reply || '');
  }, [selected?.id, selected?.admin_reply]);

  const updateInquiry = async (id: string, body: { status?: InquiryStatus; adminReply?: string }) => {
    setBusyId(id);
    try {
      const data = (await websiteApi.updateInquiry(id, body)) as any;
      setInquiries((prev) => prev.map((i) => (i.id === id ? data.inquiry : i)));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this inquiry permanently?')) return;
    setBusyId(id);
    try {
      await websiteApi.deleteInquiry(id);
      setInquiries((prev) => prev.filter((i) => i.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const openCount = inquiries.filter((i) => i.status === 'open').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white">Help Desk Inquiries</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Messages submitted from the website Contact form.
            {openCount > 0 && (
              <span className="ml-2 font-bold" style={{ color: 'var(--accent-text)' }}>
                {openCount} open
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {(['all', 'open', 'replied', 'closed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg capitalize transition-colors"
              style={
                statusFilter === s
                  ? { background: 'rgba(57,255,20,0.12)', color: '#39FF14', border: '1px solid rgba(57,255,20,0.2)' }
                  : { color: 'var(--text-muted)', border: '1px solid transparent' }
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-sm p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 min-h-[480px]">
        <div className="rounded-2xl overflow-hidden glass-card">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent-text)' }} />
            </div>
          ) : inquiries.length === 0 ? (
            <div className="text-center py-20 px-6">
              <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No inquiries yet.</p>
            </div>
          ) : (
            <div className="divide-y max-h-[560px] overflow-y-auto" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              {inquiries.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className="w-full text-left p-4 transition-colors"
                  style={
                    selectedId === item.id
                      ? { background: 'rgba(57,255,20,0.08)' }
                      : { background: 'transparent' }
                  }
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-white truncate">{item.subject}</span>
                    <span
                      className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        background:
                          item.status === 'open'
                            ? 'rgba(250,204,21,0.15)'
                            : item.status === 'replied'
                              ? 'rgba(57,255,20,0.12)'
                              : 'rgba(255,255,255,0.06)',
                        color:
                          item.status === 'open' ? '#facc15' : item.status === 'replied' ? '#39FF14' : '#888',
                      }}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                    {item.user_name} · {item.user_email}
                  </p>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-faint)' }}>
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl glass-card p-6">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center">
              <MessageSquare className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Select an inquiry to read and reply.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">{selected.subject}</h2>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    From {selected.user_name} ({selected.user_email}) · {new Date(selected.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => remove(selected.id)}
                  disabled={busyId === selected.id}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}
                  title="Delete inquiry"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap" style={{ background: 'rgba(255,255,255,0.03)', color: '#d4d4d4' }}>
                {selected.message}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Admin notes / reply
                </label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                  placeholder="Internal reply notes (saved to this ticket)..."
                  className="input-base resize-none"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => updateInquiry(selected.id, { adminReply: replyText })}
                  disabled={busyId === selected.id}
                  className="neon-btn text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 disabled:opacity-60"
                >
                  {busyId === selected.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Save Reply
                </button>
                {selected.status !== 'closed' && (
                  <button
                    onClick={() => updateInquiry(selected.id, { status: 'closed', adminReply: replyText })}
                    disabled={busyId === selected.id}
                    className="text-xs font-bold px-4 py-2 rounded-xl border disabled:opacity-60"
                    style={{ color: 'var(--text-muted)', borderColor: 'rgba(255,255,255,0.1)' }}
                  >
                    Mark Closed
                  </button>
                )}
                {selected.status === 'closed' && (
                  <button
                    onClick={() => updateInquiry(selected.id, { status: 'open' })}
                    disabled={busyId === selected.id}
                    className="text-xs font-bold px-4 py-2 rounded-xl border disabled:opacity-60"
                    style={{ color: 'var(--accent-text)', borderColor: 'rgba(57,255,20,0.2)' }}
                  >
                    Reopen
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
