import { useEffect, useState, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import Movies from './pages/Movies';
import Users from './pages/Users';
import Genres from './pages/Genres';
import Comments from './pages/Comments';
import Settings from './pages/Settings';
import Messages from './pages/Messages';
import Login, { isAdminAuthenticated, clearAdminSession } from './pages/Login';
import ApiKeys from './pages/ApiKeys';
import ContentPages from './pages/ContentPages';
import Inquiries from './pages/Inquiries';
import Advertisements from './pages/Advertisements';
import Notifications from './pages/Notifications';
import ActivityLogs from './pages/ActivityLogs';
import Catalog from './pages/Catalog';
import { websiteApi, websiteAuth } from './lib/websiteApi';

export type PageKey =
  | 'dashboard'
  | 'movies'
  | 'tvshows'
  | 'catalog'
  | 'users'
  | 'genres'
  | 'messages'
  | 'inquiries'
  | 'comments'
  | 'advertisements'
  | 'notifications'
  | 'activitylogs'
  | 'settings'
  | 'apikeys'
  | 'contentpages';

export interface AdminUser {
  name: string;
  email: string;
  avatar?: string;
}

export default function App() {
  const [authed, setAuthed] = useState(isAdminAuthenticated());
  const [checkingSession, setCheckingSession] = useState(true);
  const [page, setPage] = useState<PageKey>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  const refreshUnread = useCallback(async () => {
    try {
      const data = await websiteAuth.me();
      if (data.user?.role !== 'admin') {
        clearAdminSession();
        setAuthed(false);
        setAdminUser(null);
        return;
      }
      setAdminUser({ name: data.user.name, email: data.user.email, avatar: data.user.avatar });
      const convData = await websiteApi.getChatConversations();
      const unread = (convData.conversations || []).reduce((sum: number, conv: any) => sum + (conv.unreadCount || 0), 0);
      setUnreadCount(unread);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  // A token in storage might be stale (expired / revoked) — confirm it
  // still resolves to a real, current admin before trusting it.
  useEffect(() => {
    if (!isAdminAuthenticated()) {
      setCheckingSession(false);
      return;
    }
    websiteAuth
      .me()
      .then(({ user }) => {
        if (user?.role === 'admin') {
          setAuthed(true);
          setAdminUser({ name: user.name, email: user.email, avatar: user.avatar });
        } else {
          clearAdminSession();
          setAuthed(false);
          setAdminUser(null);
        }
      })
      .catch(() => {
        clearAdminSession();
        setAuthed(false);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (authed) {
      refreshUnread();
    }
  }, [authed, refreshUnread]);

  const handleLogout = () => {
    clearAdminSession();
    setAuthed(false);
    setAdminUser(null);
    setPage('dashboard');
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard onNavigate={setPage} adminUser={adminUser} />;
      case 'movies':    return <Movies typeFilter="movie" search={search} />;
      case 'tvshows':   return <Movies typeFilter="tvshow" search={search} />;
      case 'catalog':   return <Catalog />;
      case 'users':     return <Users search={search} />;
      case 'genres':    return <Genres />;
      case 'messages':  return <Messages search={search} onReadChange={refreshUnread} />;
      case 'inquiries': return <Inquiries search={search} />;
      case 'comments':  return <Comments search={search} />;
      case 'advertisements': return <Advertisements />;
      case 'notifications': return <Notifications />;
      case 'activitylogs': return <ActivityLogs />;
      case 'settings':  return <Settings />;
      case 'apikeys':   return <ApiKeys />;
      case 'contentpages': return <ContentPages />;
      default:          return <Dashboard onNavigate={setPage} />;
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      <Sidebar
        page={page}
        onNavigate={(p) => { setPage(p); setSidebarOpen(false); }}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        unreadCount={unreadCount}
        onLogout={handleLogout}
        adminUser={adminUser}
      />
      <div className="flex-1 flex flex-col min-w-0 lg:ml-[240px]">
        <Topbar
          page={page}
          search={search}
          onSearch={setSearch}
          onMenu={() => setSidebarOpen(true)}
          adminUser={adminUser}
        />
        <main className="flex-1 p-5 sm:p-7 overflow-x-hidden">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
