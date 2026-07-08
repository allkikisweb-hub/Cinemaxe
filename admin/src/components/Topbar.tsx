import { useEffect, useState } from 'react';
import { Menu, Search, Bell } from 'lucide-react';
import type { AdminUser, PageKey } from '../App';
import { websiteAuth } from '../lib/websiteApi';

interface TopbarProps {
  page: PageKey;
  search: string;
  onSearch: (v: string) => void;
  onMenu: () => void;
  adminUser: AdminUser | null;
}

const titles: Record<PageKey, { title: string; crumb: string }> = {
  dashboard:  { title: 'Dashboard',           crumb: 'Overview' },
  movies:     { title: 'Movies',              crumb: 'Content / Movies' },
  tvshows:    { title: 'TV Shows',            crumb: 'Content / TV Shows' },
  catalog:    { title: 'Catalog Curation',    crumb: 'Content / Curation' },
  users:      { title: 'User Management',     crumb: 'Community / Users' },
  genres:     { title: 'Genres',              crumb: 'Content / Genres' },
  messages:   { title: 'Live Chat',           crumb: 'Community / Live Chat' },
  inquiries:  { title: 'Help Desk Inquiries', crumb: 'Community / Help Desk' },
  comments:   { title: 'Comments',            crumb: 'Community / Comments' },
  advertisements: { title: 'Advertisements',  crumb: 'Marketing / Ads' },
  notifications: { title: 'Broadcasts',       crumb: 'Marketing / Notifications' },
  activitylogs: { title: 'Activity Logs',     crumb: 'System / Audit' },
  settings:   { title: 'Settings',            crumb: 'System / Settings' },
  apikeys:    { title: 'API Keys',            crumb: 'System / API Keys' },
  contentpages: { title: 'Content Pages',     crumb: 'Content / Pages' },
};

export default function Topbar({ page, search, onSearch, onMenu, adminUser }: TopbarProps) {
  const { title, crumb } = titles[page];
  const showSearch = ['movies', 'tvshows', 'users', 'comments', 'messages', 'inquiries'].includes(page);
  const [apiLive, setApiLive] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ping = () => {
      websiteAuth.checkConnection()
        .then(() => { if (!cancelled) setApiLive(true); })
        .catch(() => { if (!cancelled) setApiLive(false); });
    };
    ping();
    const id = window.setInterval(ping, 30000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-4 px-5 sm:px-7 h-[70px]"
      style={{
        background: 'rgba(12,12,12,0.90)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <button
        onClick={onMenu}
        className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
        style={{ background: 'rgba(255,255,255,0.04)', color: '#9a9a9a' }}
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium mb-0.5" style={{ color: 'rgba(57,255,20,0.6)' }}>{crumb}</p>
        <h1 className="text-white font-bold text-lg leading-none tracking-tight">{title}</h1>
      </div>

      {showSearch && (
        <div className="hidden md:flex items-center relative flex-shrink-0">
          <Search className="absolute left-3.5 w-4 h-4 z-10" style={{ color: '#5a5a5a' }} />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search..."
            className="w-52 lg:w-64 pl-10 pr-4 py-2.5 text-sm rounded-xl outline-none transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#f5f5f5' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(57,255,20,0.22)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <div
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{
            background: apiLive === false ? 'rgba(239,68,68,0.08)' : 'rgba(57,255,20,0.08)',
            border: apiLive === false ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(57,255,20,0.15)',
          }}
          title={apiLive === false ? 'Cannot reach the Cinemax website API' : 'Connected to the live Cinemax website'}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: apiLive === false ? '#ef4444' : apiLive === true ? '#39FF14' : '#737373' }}
          />
          <span
            className="text-xs font-semibold"
            style={{ color: apiLive === false ? '#f87171' : apiLive === true ? '#39FF14' : '#a3a3a3' }}
          >
            {apiLive === false ? 'OFFLINE' : apiLive === true ? 'LIVE' : '…'}
          </span>
        </div>

        <button
          className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#9a9a9a' }}
        >
          <Bell className="w-4 h-4" />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ background: '#39FF14', border: '2px solid #050505' }}
          />
        </button>

        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-black cursor-pointer overflow-hidden"
          style={{ background: '#39FF14' }}
          title={adminUser?.email || 'Admin'}
        >
          {adminUser?.avatar && !adminUser.avatar.startsWith('anim:') && !adminUser.avatar.startsWith('cartoon:') ? (
            <img src={adminUser.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            (adminUser?.name || 'A').charAt(0).toUpperCase()
          )}
        </div>
      </div>
    </header>
  );
}
