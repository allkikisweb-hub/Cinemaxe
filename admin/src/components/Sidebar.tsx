import {
  LayoutDashboard, Film, Tv, Users, Tag, MessageSquare, Settings,
  X, Clapperboard, ChevronRight, LogOut, Mail, ShieldCheck, ExternalLink, Key, Layout, Inbox,
  Megaphone, Bell, Activity, Sparkles,
} from 'lucide-react';
import type { AdminUser, PageKey } from '../App';
import { clearAdminSession } from '../pages/Login';

interface SidebarProps {
  page: PageKey;
  onNavigate: (p: PageKey) => void;
  open: boolean;
  onClose: () => void;
  unreadCount: number;
  onLogout: () => void;
  adminUser: AdminUser | null;
}

interface NavItem {
  key: PageKey;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: boolean;
}

const navGroups = [
  {
    label: 'Main',
    items: [
      { key: 'dashboard' as PageKey, label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Content',
    items: [
      { key: 'movies' as PageKey, label: 'Movies', icon: Film },
      { key: 'tvshows' as PageKey, label: 'TV Shows', icon: Tv },
      { key: 'catalog' as PageKey, label: 'Catalog Curation', icon: Sparkles },
      { key: 'genres' as PageKey, label: 'Genres & Categories', icon: Tag },
      { key: 'contentpages' as PageKey, label: 'Content Pages', icon: Layout },
    ],
  },
  {
    label: 'Community',
    items: [
      { key: 'users' as PageKey, label: 'User Management', icon: Users },
      { key: 'messages' as PageKey, label: 'Live Chat', icon: Mail, badge: true },
      { key: 'inquiries' as PageKey, label: 'Help Desk', icon: Inbox },
      { key: 'comments' as PageKey, label: 'Comments', icon: MessageSquare },
      { key: 'advertisements' as PageKey, label: 'Advertisements', icon: Megaphone },
      { key: 'notifications' as PageKey, label: 'Broadcasts', icon: Bell },
    ],
  },
  {
    label: 'System',
    items: [
      { key: 'activitylogs' as PageKey, label: 'Activity Logs', icon: Activity },
      { key: 'apikeys' as PageKey, label: 'API Keys', icon: Key },
      { key: 'settings' as PageKey, label: 'Settings', icon: Settings },
    ],
  },
];

export default function Sidebar({ page, onNavigate, open, onClose, unreadCount, onLogout, adminUser }: SidebarProps) {
  const initials = (adminUser?.name || 'A').charAt(0).toUpperCase();
  const isLinkedAdmin = adminUser?.email?.toLowerCase() === 'allkikisweb@gmail.com';
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/70 z-30 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed top-0 left-0 z-40 h-full w-[240px] flex flex-col transition-transform duration-200 ease-out lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: '#0c0c0c', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-[70px] border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-base"
              style={{ background: '#39FF14', color: '#000' }}
            >
              C
            </div>
            <div>
              <span className="font-black text-white text-lg tracking-widest">CINEMAX</span>
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mt-0.5" style={{ color: '#39FF14' }}>
                Admin Panel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: '#9a9a9a', background: 'rgba(255,255,255,0.04)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-3">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase mb-2 px-2" style={{ color: '#4a4a4a' }}>
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ key, label, icon: Icon, badge }) => {
                  const active = page === key;
                  return (
                    <button
                      key={key}
                      onClick={() => onNavigate(key)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150"
                      style={
                        active
                          ? { background: 'rgba(57,255,20,0.10)', color: '#39FF14', border: '1px solid rgba(57,255,20,0.18)' }
                          : { color: '#8a8a8a', border: '1px solid transparent' }
                      }
                      onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#f5f5f5'; }}
                      onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = '#8a8a8a'; }}
                    >
                      <Icon className="w-[17px] h-[17px] flex-shrink-0" />
                      <span className="flex-1 text-left">{label}</span>
                      {badge && unreadCount > 0 && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: '#39FF14', color: '#000' }}
                        >
                          {unreadCount}
                        </span>
                      )}
                      {active && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* View live website */}
        <div className="px-3 pb-3">
          <a
            href={import.meta.env.VITE_WEBSITE_URL || '/'}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-150"
            style={{ background: 'rgba(57,255,20,0.08)', color: '#39FF14', border: '1px solid rgba(57,255,20,0.2)' }}
          >
            <ExternalLink className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">View Live Website</span>
          </a>
        </div>

        {/* Linked website badge */}
        <div className="px-3 pb-3">
          <div
            className="rounded-xl p-3 flex items-center gap-2.5"
            style={{ background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.15)' }}
          >
            <ShieldCheck className="w-4 h-4 flex-shrink-0" style={{ color: '#39FF14' }} />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">Live Website Linked</p>
              <p className="text-[10px] truncate" style={{ color: '#5a5a5a' }}>
                {isLinkedAdmin ? 'Primary admin · full control' : 'Connected to Cinemax API'}
              </p>
            </div>
          </div>
        </div>

        {/* User + logout */}
        <div className="px-3 pb-4 pt-1">
          <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {adminUser?.avatar && !adminUser.avatar.startsWith('anim:') && !adminUser.avatar.startsWith('cartoon:') ? (
              <img src={adminUser.avatar} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-black flex-shrink-0"
                style={{ background: '#39FF14' }}
              >
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{adminUser?.name || 'Admin'}</p>
              <p className="text-xs truncate" style={{ color: '#5a5a5a' }}>{adminUser?.email || '—'}</p>
            </div>
            <button
              onClick={onLogout}
              title="Logout"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: '#5a5a5a', background: 'rgba(255,255,255,0.04)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#5a5a5a'; }}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
