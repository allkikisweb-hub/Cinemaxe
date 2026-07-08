import { useEffect, useState } from 'react';
import { websiteApi } from '../lib/websiteApi';
import {
  Film, Users, MessageSquare, PlayCircle, TrendingUp, Crown, Activity,
  ChevronRight, BarChart3, Flag, ShieldAlert, Inbox, Key, Layout, Download,
  Megaphone, Bell, Sparkles,
} from 'lucide-react';
import type { AdminUser, PageKey } from '../App';

interface DashboardProps {
  onNavigate: (p: PageKey) => void;
  adminUser?: AdminUser | null;
}

export default function Dashboard({ onNavigate, adminUser }: DashboardProps) {
  const [stats, setStats] = useState<any>(null);
  const [contentTotal, setContentTotal] = useState(0);
  const [recentContent, setRecentContent] = useState<any[]>([]);
  const [recentComments, setRecentComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openInquiries, setOpenInquiries] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [s, content, comments, inquiryData] = await Promise.all([
          websiteApi.getStats(),
          websiteApi.getContent(),
          websiteApi.getComments(),
          websiteApi.getInquiries({ status: "open" }).catch(() => ({ inquiries: [] })),
        ]);
        setStats(s);
        const items = (content as any).items || [];
        setContentTotal(items.length);
        setRecentContent(items.slice(0, 6));
        setRecentComments(((comments as any).comments || []).slice(0, 5));
        setOpenInquiries(((inquiryData as any).inquiries || []).length);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(57,255,20,0.2)', borderTopColor: 'var(--accent)' }} />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-2xl p-6 text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>
        Couldn't reach the website's admin API: {error || 'Unknown error'}. Check that the site is running and
        <code className="mx-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>VITE_WEBSITE_API_URL</code>
        points to it.
      </div>
    );
  }

  const statCards = [
    { label: 'Custom Content', value: contentTotal, icon: Film, sub: 'Cinemax Originals' },
    { label: 'Total Users', value: stats.totalUsers, icon: Users, sub: `${stats.activeUsers} active` },
    { label: 'Open Help Desk', value: openInquiries || stats.openInquiries || 0, icon: Inbox, sub: `${stats.totalInquiries || 0} total inquiries` },
    { label: 'Pending Comments', value: stats.pendingComments, icon: MessageSquare, sub: `${stats.totalComments} total` },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-2xl p-6 sm:p-8 glass-card">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
          <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--accent-text)' }}>Live Overview</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-1">
          Welcome back{adminUser?.name ? `, ${adminUser.name.split(' ')[0]}` : ''}
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Full control of the live Cinemax website — users, content, chat, ads, and settings update instantly.
        </p>
        {adminUser?.email?.toLowerCase() === 'allkikisweb@gmail.com' && (
          <p className="text-[10px] font-bold uppercase tracking-widest mt-2" style={{ color: 'var(--accent-text)' }}>
            Primary Administrator · Linked Session Active
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl p-5 animate-slide-up" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' }}>
                <Icon className="w-5 h-5" style={{ color: 'var(--accent-text)' }} />
              </div>
              <p className="text-3xl font-bold text-white tracking-tight">{card.value}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
              <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{card.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickStat icon={TrendingUp} label="Signups (7d)" value={stats.signupsLast7d} />
        <QuickStat icon={Download} label="User Downloads" value={stats.totalDownloads || 0} />
        <QuickStat icon={PlayCircle} label="Watch History" value={stats.totalWatchHistoryEntries} />
        <QuickStat icon={Flag} label="Banned Users" value={stats.bannedUsers} alert={stats.bannedUsers > 0} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {([
          { key: 'catalog' as PageKey, label: 'Catalog', icon: Sparkles },
          { key: 'inquiries' as PageKey, label: 'Help Desk', icon: Inbox },
          { key: 'advertisements' as PageKey, label: 'Ads', icon: Megaphone },
          { key: 'notifications' as PageKey, label: 'Broadcasts', icon: Bell },
          { key: 'messages' as PageKey, label: 'Live Chat', icon: MessageSquare },
          { key: 'activitylogs' as PageKey, label: 'Audit Log', icon: Activity },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onNavigate(key)}
            className="rounded-xl p-4 flex items-center gap-3 text-left cursor-pointer transition-colors hover:border-[#39FF14]/30"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <Icon className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--accent-text)' }} />
            <span className="text-sm font-semibold text-white">{label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2.5">
              <BarChart3 className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
              <h3 className="text-white font-semibold text-sm">Recent Content</h3>
            </div>
            <button onClick={() => onNavigate('movies')} className="text-xs font-medium flex items-center gap-1 cursor-pointer" style={{ color: 'var(--accent-text)' }}>
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {recentContent.length === 0 && <p className="px-5 py-10 text-center text-sm" style={{ color: 'var(--text-faint)' }}>No custom content yet — add your first title on the Movies page.</p>}
            {recentContent.map((m) => (
              <div key={m.id} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-white/[0.02]">
                <div className="w-10 h-14 rounded-lg overflow-hidden flex-shrink-0" style={{ background: 'var(--surface-3)' }}>
                  {m.posterUrl ? <img src={m.posterUrl} alt={m.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Film className="w-4 h-4" style={{ color: 'var(--text-faint)' }} /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{m.title}</p>
                  <p className="text-xs capitalize" style={{ color: 'var(--text-faint)' }}>{m.mediaType} · {(m.releaseDate || '').slice(0, 4) || '—'}</p>
                </div>
                {m.featured && (
                  <span className="text-xs px-2 py-1 rounded-md font-medium flex-shrink-0" style={{ background: 'var(--accent-dim)', color: 'var(--accent-text)' }}>
                    Featured
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
              <h3 className="text-white font-semibold text-sm">Recent Comments</h3>
            </div>
            <button onClick={() => onNavigate('comments')} className="text-xs font-medium flex items-center gap-1 cursor-pointer" style={{ color: 'var(--accent-text)' }}>
              All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {recentComments.length === 0 && <p className="px-5 py-10 text-center text-sm" style={{ color: 'var(--text-faint)' }}>No comments yet</p>}
            {recentComments.map((c: any) => (
              <div key={c.id} className="px-5 py-3 transition-colors hover:bg-white/[0.02]">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-white truncate">{c.user_name || 'Anonymous'}</p>
                  {c.status === 'pending' && <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#e0a800' }} />}
                </div>
                <p className="text-xs line-clamp-2" style={{ color: 'var(--text-muted)' }}>{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStat({ icon: Icon, label, value, alert }: { icon: typeof Film; label: string; value: number; alert?: boolean }) {
  return (
    <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'var(--surface-2)', border: alert ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border)' }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={alert ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444' } : { background: 'var(--accent-dim)', color: 'var(--accent-text)' }}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-lg font-bold text-white leading-tight">{value}</p>
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{label}</p>
      </div>
    </div>
  );
}
