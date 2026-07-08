import React, { useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { AppNotification } from "../types";
import { Bell, Film, Bookmark, Sparkles, UserCog, Info, CheckCheck, Trash2, Megaphone } from "lucide-react";

const ICONS: Record<string, React.ElementType> = {
  new_release: Film,
  watchlist: Bookmark,
  recommendation: Sparkles,
  account: UserCog,
  system: Info,
  announcement: Megaphone,
};

const ACCENTS: Record<string, string> = {
  new_release: "notif-accent-green",
  watchlist: "notif-accent-blue",
  recommendation: "notif-accent-purple",
  account: "notif-accent-amber",
  system: "notif-accent-neutral",
  announcement: "notif-accent-green",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const NotificationCenter: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead, clearNotifications } = useApp();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={ref}
      id="notification-center-panel"
      className="absolute right-0 top-14 w-[22rem] max-w-[90vw] rounded-2xl overflow-hidden z-50 animate-dropdown-pop surface-panel"
    >
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-neutral-800 bg-neutral-900">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[#39FF14] flex items-center justify-center">
            <Bell className="h-4 w-4 text-black" />
          </div>
          <div>
            <h3 className="font-sans font-bold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <p className="text-[10px] text-neutral-500">{unreadCount} unread</p>
            )}
          </div>
        </div>
        {notifications.length > 0 && (
          <button
            onClick={markAllNotificationsRead}
            title="Mark all as read"
            className="text-neutral-400 hover:text-[#39FF14] transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-neutral-800"
          >
            <CheckCheck className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="max-h-[24rem] overflow-y-auto bg-neutral-950">
        {notifications.length === 0 ? (
          <div className="p-10 text-center">
            <Bell className="h-10 w-10 text-neutral-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-neutral-400">All caught up</p>
            <p className="text-xs text-neutral-600 mt-1">New alerts will appear here</p>
          </div>
        ) : (
          notifications.map((n) => {
            const type = n.type in ICONS ? n.type : "system";
            const Icon = ICONS[type];
            return (
              <button
                key={n.id}
                onClick={() => markNotificationRead(n.id)}
                className={`w-full flex gap-3 px-4 py-3.5 text-left border-b border-neutral-800/80 last:border-0 hover:bg-neutral-900 transition-colors cursor-pointer ${
                  n.read ? "opacity-55" : "bg-neutral-900/40"
                }`}
              >
                <div className={`flex-shrink-0 h-9 w-9 rounded-xl border flex items-center justify-center ${ACCENTS[type]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold leading-tight">{n.title}</p>
                    {!n.read && <span className="flex-shrink-0 h-2 w-2 rounded-full bg-[#39FF14] mt-0.5" />}
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-snug line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-neutral-600 mt-1.5 font-medium">{timeAgo(n.timestamp)}</p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {notifications.length > 0 && (
        <button
          onClick={clearNotifications}
          className="w-full flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold text-neutral-500 hover:text-rose-400 border-t border-neutral-800 bg-neutral-900 transition-colors cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear all notifications
        </button>
      )}
    </div>
  );
};
