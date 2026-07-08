import { useEffect, useState, useCallback } from 'react';
import { websiteApi } from '../lib/websiteApi';
import {
  Plus, Trash2, Shield, ShieldOff, Ban, CheckCircle2, X, Check, Loader2,
  Pencil, ChevronLeft, ChevronRight, Database, Bell,
} from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';

interface UsersProps {
  search: string;
}

const PRIMARY_ADMIN_EMAIL = 'allkikisweb@gmail.com';
const SUBSCRIPTION_TIERS = ['Free', 'Basic', 'Standard', 'Premium'];
const emptyForm = { name: '', email: '', password: '' };

export default function Users({ search }: UsersProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [detailUser, setDetailUser] = useState<any | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [notifyForm, setNotifyForm] = useState({ title: '', message: '' });

  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await websiteApi.getUsers({
        search: search || undefined,
        status: statusFilter || undefined,
        role: roleFilter || undefined,
        page,
      })) as any;
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, roleFilter, page]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { setPage(1); }, [search, statusFilter, roleFilter]);

  const act = async (id: string, fn: () => Promise<any>) => {
    setBusyId(id);
    try { await fn(); await load(); } catch (e: any) { alert(e.message); } finally { setBusyId(null); }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await websiteApi.createUser(form);
      setForm({ ...emptyForm });
      setShowCreate(false);
      load();
    } catch (e: any) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (u: any) => {
    setEditUser(u);
    setEditForm({ name: u.name, email: u.email });
  };

  const saveEdit = async () => {
    if (!editUser) return;
    await act(editUser.id, () => websiteApi.updateUser(editUser.id, editForm));
    setEditUser(null);
  };

  const openDetail = async (u: any) => {
    setDetailUser(u);
    setUserData(null);
    setNotifyForm({ title: '', message: '' });
    try {
      const data = await websiteApi.getUserData(u.id);
      setUserData(data);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isPrimaryAdmin = (email: string) => email?.toLowerCase() === PRIMARY_ADMIN_EMAIL;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Users</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Full account control — create, edit, suspend, manage subscriptions, and inspect user data.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input-base w-auto">
            <option value="">All roles</option>
            <option value="user">Users</option>
            <option value="admin">Admins</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-base w-auto">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
          <button onClick={() => setShowCreate((v) => !v)} className="neon-btn flex items-center gap-2 font-semibold px-4 py-2.5 rounded-xl text-sm cursor-pointer">
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-2xl p-4 flex flex-wrap items-end gap-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <label className="flex-1 min-w-[140px] space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Full Name</span>
            <input required className="input-base" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="flex-1 min-w-[180px] space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Email</span>
            <input required type="email" className="input-base" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="flex-1 min-w-[140px] space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Password</span>
            <input required type="password" minLength={8} className="input-base" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
          <button type="submit" disabled={creating} className="neon-btn flex items-center gap-2 font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wide cursor-pointer disabled:opacity-60">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Create
          </button>
          <button type="button" onClick={() => setShowCreate(false)} className="cursor-pointer"><X className="w-4 h-4" style={{ color: 'var(--text-faint)' }} /></button>
          {createError && <p className="text-xs font-semibold w-full" style={{ color: '#f87171' }}>{createError}</p>}
        </form>
      )}

      {error && <div className="rounded-xl p-4 text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(57,255,20,0.2)', borderTopColor: 'var(--accent)' }} />
        </div>
      ) : (
        <>
          <div className="rounded-2xl overflow-hidden overflow-x-auto" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b uppercase tracking-wider text-[10px]" style={{ borderColor: 'var(--border)', color: 'var(--text-faint)' }}>
                  <th className="text-left px-4 py-3 font-bold">User</th>
                  <th className="text-left px-4 py-3 font-bold">Status</th>
                  <th className="text-left px-4 py-3 font-bold">Role</th>
                  <th className="text-left px-4 py-3 font-bold">Plan</th>
                  <th className="text-left px-4 py-3 font-bold">Lists</th>
                  <th className="text-right px-4 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{u.name}</p>
                      <p style={{ color: 'var(--text-faint)' }}>{u.email}</p>
                      {isPrimaryAdmin(u.email) && (
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent-text)' }}>Primary Owner</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-md font-bold uppercase text-[10px]" style={
                        u.status === 'active' ? { background: 'var(--accent-dim)', color: 'var(--accent-text)' } :
                        u.status === 'suspended' ? { background: 'rgba(224,168,0,0.1)', color: '#e0a800' } :
                        { background: 'rgba(239,68,68,0.1)', color: '#ef4444' }
                      }>{u.status}</span>
                    </td>
                    <td className="px-4 py-3 capitalize" style={{ color: 'var(--text-muted)' }}>{u.role}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.subscription || 'Free'}
                        disabled={busyId === u.id}
                        onChange={(e) => act(u.id, () => websiteApi.setUserSubscription(u.id, e.target.value))}
                        className="input-base text-[10px] py-1 w-auto"
                      >
                        {SUBSCRIPTION_TIERS.map((tier) => (
                          <option key={tier} value={tier}>{tier}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-faint)' }}>{u.favoritesCount} favs · {u.watchlistCount} wl</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <IconBtn title="Inspect data" onClick={() => openDetail(u)} busy={busyId === u.id}><Database className="w-3.5 h-3.5" /></IconBtn>
                        <IconBtn title="Edit" onClick={() => openEdit(u)} busy={busyId === u.id}><Pencil className="w-3.5 h-3.5" /></IconBtn>
                        {!isPrimaryAdmin(u.email) && u.role !== 'admin' && (
                          <>
                            {u.status !== 'active' ? (
                              <IconBtn title="Reactivate" onClick={() => act(u.id, () => websiteApi.setUserStatus(u.id, 'active'))} busy={busyId === u.id}><CheckCircle2 className="w-3.5 h-3.5" /></IconBtn>
                            ) : (
                              <IconBtn title="Suspend" onClick={() => act(u.id, () => websiteApi.setUserStatus(u.id, 'suspended'))} busy={busyId === u.id}><ShieldOff className="w-3.5 h-3.5" /></IconBtn>
                            )}
                            {u.status !== 'banned' && (
                              <IconBtn title="Ban" danger onClick={() => act(u.id, () => websiteApi.setUserStatus(u.id, 'banned'))} busy={busyId === u.id}><Ban className="w-3.5 h-3.5" /></IconBtn>
                            )}
                            <IconBtn title="Make admin" onClick={() => act(u.id, () => websiteApi.setUserRole(u.id, 'admin'))} busy={busyId === u.id}><Shield className="w-3.5 h-3.5" /></IconBtn>
                            <IconBtn title="Delete" danger onClick={() => { if (confirm(`Delete ${u.email}?`)) act(u.id, () => websiteApi.deleteUser(u.id)); }} busy={busyId === u.id}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                          </>
                        )}
                        {!isPrimaryAdmin(u.email) && u.role === 'admin' && (
                          <IconBtn title="Demote to user" danger onClick={() => act(u.id, () => websiteApi.setUserRole(u.id, 'user'))} busy={busyId === u.id}><ShieldOff className="w-3.5 h-3.5" /></IconBtn>
                        )}
                        {isPrimaryAdmin(u.email) && <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>Protected</span>}
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center" style={{ color: 'var(--text-faint)' }}>No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>{total} users · page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="input-base px-3 py-1.5 disabled:opacity-40 cursor-pointer">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="input-base px-3 py-1.5 disabled:opacity-40 cursor-pointer">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <h3 className="font-bold text-white">Edit User</h3>
            <input className="input-base w-full" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Name" />
            <input className="input-base w-full" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="Email" />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setEditUser(null)} className="input-base px-4 py-2 cursor-pointer">Cancel</button>
              <button type="button" onClick={saveEdit} className="neon-btn px-4 py-2 rounded-xl font-bold text-xs cursor-pointer">Save</button>
            </div>
          </div>
        </div>
      )}

      {detailUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-white">{detailUser.name}</h3>
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{detailUser.email}</p>
              </div>
              <button type="button" onClick={() => setDetailUser(null)} className="cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            {userData ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ['Favorites', userData.favorites, 'favorites'],
                  ['Watchlist', userData.watchlist, 'watchlist'],
                  ['My List', userData.myList, 'my_list'],
                  ['History', userData.watchHistory, 'watch_history'],
                  ['Downloads', userData.downloads, 'downloads'],
                  ['Notifications', userData.notifications, 'notifications'],
                ].map(([label, count, kind]) => (
                  <div key={kind as string} className="rounded-xl p-3 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{count as number}</span>
                      {(count as number) > 0 && (
                        <button
                          type="button"
                          className="text-[10px] font-bold cursor-pointer"
                          style={{ color: '#f87171' }}
                          onClick={() => act(detailUser.id, async () => {
                            await websiteApi.clearUserData(detailUser.id, kind as string);
                            const refreshed = await websiteApi.getUserData(detailUser.id);
                            setUserData(refreshed);
                          })}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: 'var(--accent)' }} />
            )}
            <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                <Bell className="w-3 h-3" /> Send notification
              </p>
              <input className="input-base w-full" placeholder="Title" value={notifyForm.title} onChange={(e) => setNotifyForm({ ...notifyForm, title: e.target.value })} />
              <textarea className="input-base w-full min-h-[72px]" placeholder="Message" value={notifyForm.message} onChange={(e) => setNotifyForm({ ...notifyForm, message: e.target.value })} />
              <button
                type="button"
                disabled={!notifyForm.title || !notifyForm.message}
                onClick={() => act(detailUser.id, () => websiteApi.notifyUser({ userId: detailUser.id, ...notifyForm }))}
                className="neon-btn w-full py-2.5 rounded-xl text-xs font-bold uppercase cursor-pointer disabled:opacity-50"
              >
                Send to User
              </button>
            </div>
          </div>
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
