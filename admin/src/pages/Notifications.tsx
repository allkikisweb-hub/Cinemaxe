import { useState } from 'react';
import { websiteApi } from '../lib/websiteApi';
import { Bell, Check, Loader2 } from 'lucide-react';

export default function Notifications() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<number | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    try {
      const res = await websiteApi.broadcastNotification({ title: title.trim(), message: message.trim(), type: 'announcement' });
      setSent(res.recipients);
      setTitle('');
      setMessage('');
      setTimeout(() => setSent(null), 4000);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Bell className="w-5 h-5" style={{ color: 'var(--accent-text)' }} />
          Broadcast Notifications
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Send a site-wide announcement to every registered user&apos;s notification bell on the live website.
        </p>
      </div>

      {sent != null && (
        <div className="rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2 accent-chip">
          <Check className="w-4 h-4" /> Delivered to {sent} users.
        </div>
      )}

      <form onSubmit={handleSend} className="rounded-2xl p-5 space-y-3 glass-card">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Notification title"
          className="input-base"
          required
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message body"
          rows={5}
          className="input-base resize-none"
          required
        />
        <button type="submit" disabled={sending} className="neon-btn flex items-center gap-2 font-bold px-5 py-2.5 rounded-xl text-xs uppercase disabled:opacity-60">
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
          Broadcast to All Users
        </button>
      </form>
    </div>
  );
}
