import { useCallback, useEffect, useState } from 'react';
import { websiteApi } from '../lib/websiteApi';
import { Activity, Loader2, RefreshCw } from 'lucide-react';

export default function ActivityLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await websiteApi.getLogs(150);
      setLogs((data as any).logs || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5" style={{ color: 'var(--accent-text)' }} />
            Activity Logs
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Audit trail of admin actions on the live Cinemax website.
          </p>
        </div>
        <button type="button" onClick={load} className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl p-4 text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden glass-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-faint)' }}>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Time</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Admin</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Target</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-white">{log.admin_email}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--accent-text)' }}>{log.action}</td>
                    <td className="px-4 py-3 truncate max-w-[200px]" style={{ color: 'var(--text-muted)' }}>{log.target || '—'}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
                      No activity logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
