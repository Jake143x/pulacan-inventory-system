import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { users } from '../api/client';
import type { User } from '../api/client';

const ActionsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
  </svg>
);

const cardBg = { backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' };
const inputStyle = { ...cardBg, color: 'var(--admin-text)' };

function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [list, setList] = useState<User[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | 'employee' | 'customer'>('all');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ fullName: '', isActive: true, roleName: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', password: '', fullName: '', roleName: 'CASHIER' as 'ADMIN' | 'CASHIER', isActive: true });
  const [resetting, setResetting] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [actionsOpenId, setActionsOpenId] = useState<number | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (actionsOpenId === null) return;
    const close = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setActionsOpenId(null);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [actionsOpenId]);

  const load = () => {
    setLoading(true);
    users.list({ page: pagination.page, limit: pagination.limit, search: search || undefined, category })
      .then((r) => {
        setList(r.data);
        setPagination(r.pagination);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setPagination((p) => ({ ...p, page: 1 }));
  }, [search, category]);

  useEffect(() => {
    load();
  }, [pagination.page, search, category]);

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({
      fullName: u.fullName ?? '',
      isActive: u.isActive ?? true,
      roleName: u.role ?? '',
      password: '',
    });
  };

  const saveUser = async () => {
    if (!editing) return;
    setErr('');
    try {
      const body: Partial<{ fullName: string; isActive: boolean; roleName: string; password: string }> = {
        fullName: form.fullName,
        isActive: form.isActive,
        roleName: form.roleName || undefined,
      };
      if (form.password) body.password = form.password;
      await users.update(editing.id, body);
      setEditing(null);
      load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  };

  const createUser = async () => {
    setErr('');
    setSuccess('');
    try {
      await users.create({
        email: createForm.email.trim(),
        password: createForm.password,
        fullName: createForm.fullName.trim(),
        roleName: createForm.roleName,
        isActive: createForm.isActive,
      });
      setCreating(false);
      setCreateForm({ email: '', password: '', fullName: '', roleName: 'CASHIER', isActive: true });
      setSuccess('User created successfully. They must change the temporary password on next login.');
      load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to create user');
    }
  };

  const doResetPassword = async () => {
    if (!resetting || !resetPassword.trim()) return;
    setErr('');
    try {
      await users.update(resetting.id, { password: resetPassword });
      setResetting(null);
      setResetPassword('');
      setSuccess('Password reset. User must change it on next login.');
      load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to reset password');
    }
  };

  const deactivateUser = async (u: User) => {
    setErr('');
    try {
      await users.update(u.id, { isActive: false });
      setSuccess('User deactivated.');
      load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to deactivate');
    }
  };

  const activateUser = async (u: User) => {
    setErr('');
    try {
      await users.update(u.id, { isActive: true });
      setSuccess('User activated.');
      load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to activate');
    }
  };

  const deleteUser = async (u: User) => {
    if (!window.confirm(`Delete user "${u.fullName}" (${u.email})? This cannot be undone.`)) return;
    setErr('');
    try {
      await users.delete(u.id);
      setSuccess('User deleted.');
      load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  return (
    <div>
      {err && <p className="text-red-400 text-sm mb-2">{err}</p>}
      {success && <p className="text-green-400 text-sm mb-2">{success}</p>}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border rounded-lg"
          style={inputStyle}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as 'all' | 'employee' | 'customer')}
          className="px-3 py-2 border rounded-lg"
          style={inputStyle}
        >
          <option value="all">All</option>
          <option value="employee">Employee</option>
          <option value="customer">Customer</option>
        </select>
        <button type="button" onClick={() => { setCreating(true); setErr(''); setSuccess(''); }} className="px-4 py-2 bg-[#2563EB] text-white rounded-lg hover:bg-[#1D4ED8] btn-3d">Create User</button>
      </div>
      <div className="rounded-xl border overflow-hidden card-3d overflow-x-auto" style={cardBg}>
        {loading ? (
          <p className="p-4 text-slate-400">Loading...</p>
        ) : (
          <table className="w-full text-left min-w-[800px]">
            <thead className="border-b" style={{ borderColor: 'var(--admin-border)' }}>
              <tr>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--admin-text)' }}>Name</th>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--admin-text)' }}>Email</th>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--admin-text)' }}>Role</th>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--admin-text)' }}>Status</th>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--admin-text)' }}>Last Login</th>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--admin-text)' }}>Created Date</th>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--admin-text)' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--admin-border)' }}>
              {list.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3" style={{ color: 'var(--admin-text)' }}>{u.fullName}</td>
                  <td className="px-4 py-3 text-slate-400">{u.email}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--admin-text)' }}>{u.role === 'ADMIN' ? 'Admin' : u.role === 'CASHIER' ? 'Cashier' : u.role === 'OWNER' ? 'Owner' : u.role}</td>
                  <td className="px-4 py-3">{u.isActive === false ? <span className="text-amber-500">Inactive</span> : <span className="text-emerald-400">Active</span>}</td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{formatDate(u.lastLoginAt)}</td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="relative inline-block" ref={actionsOpenId === u.id ? actionsRef : undefined}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setActionsOpenId((id) => (id === u.id ? null : u.id)); }}
                        className="p-2 rounded-lg border transition-colors hover:bg-white/10"
                        style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}
                        aria-label="Actions"
                      >
                        <ActionsIcon />
                      </button>
                      {actionsOpenId === u.id && (
                        <div
                          className="absolute right-0 top-full mt-1 min-w-[180px] rounded-lg border shadow-xl py-1 z-20"
                          style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}
                        >
                          <button
                            type="button"
                            onClick={() => { openEdit(u); setActionsOpenId(null); }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 transition-colors"
                            style={{ color: 'var(--admin-text)' }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => { setResetting(u); setResetPassword(''); setErr(''); setActionsOpenId(null); }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 transition-colors"
                            style={{ color: 'var(--admin-text)' }}
                          >
                            Reset Password
                          </button>
                          {u.isActive === false ? (
                            <button
                              type="button"
                              onClick={() => { activateUser(u); setActionsOpenId(null); }}
                              className="w-full text-left px-4 py-2.5 text-sm text-emerald-400 hover:bg-white/10 transition-colors"
                            >
                              Activate
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { deactivateUser(u); setActionsOpenId(null); }}
                              className="w-full text-left px-4 py-2.5 text-sm text-amber-500 hover:bg-white/10 transition-colors"
                            >
                              Deactivate
                            </button>
                          )}
                          {u.role !== 'OWNER' && currentUser?.id !== u.id && (
                            <button
                              type="button"
                              onClick={() => { deleteUser(u); setActionsOpenId(null); }}
                              className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/10 transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="px-4 py-2 border-t flex justify-between items-center" style={{ borderColor: 'var(--admin-border)' }}>
          <span className="text-sm text-slate-400">Page {pagination.page} of {pagination.pages || 1}</span>
          <div className="gap-2 flex">
            <button type="button" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))} className="px-2 py-1 border rounded disabled:opacity-50" style={inputStyle}>Prev</button>
            <button type="button" disabled={pagination.page >= pagination.pages} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))} className="px-2 py-1 border rounded disabled:opacity-50" style={inputStyle}>Next</button>
          </div>
        </div>
      </div>

      {creating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl p-6 max-w-md w-full card-3d shadow-xl border" style={cardBg}>
            <h2 className="font-semibold text-lg mb-4" style={{ color: 'var(--admin-text)' }}>Create User</h2>
            <div className="space-y-3">
              <input type="text" placeholder="Full Name" value={createForm.fullName} onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))} className="w-full px-3 py-2 border rounded" style={inputStyle} />
              <input type="email" placeholder="Email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 border rounded" style={inputStyle} />
              <input type="password" placeholder="Temporary Password" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} className="w-full px-3 py-2 border rounded" style={inputStyle} />
              <select value={createForm.roleName} onChange={(e) => setCreateForm((f) => ({ ...f, roleName: e.target.value as 'ADMIN' | 'CASHIER' }))} className="w-full px-3 py-2 border rounded" style={inputStyle}>
                <option value="CASHIER">Cashier</option>
                <option value="ADMIN">Admin</option>
              </select>
              <label className="flex items-center gap-2" style={{ color: 'var(--admin-text)' }}>
                <input type="checkbox" checked={createForm.isActive} onChange={(e) => setCreateForm((f) => ({ ...f, isActive: e.target.checked }))} />
                Active
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={createUser} className="px-4 py-2 bg-[#2563EB] text-white rounded-lg hover:bg-[#1D4ED8] btn-3d">Create</button>
              <button type="button" onClick={() => { setCreating(false); setCreateForm({ email: '', password: '', fullName: '', roleName: 'CASHIER', isActive: true }); }} className="px-4 py-2 border rounded" style={inputStyle}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {resetting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl p-6 max-w-md w-full card-3d shadow-xl border" style={cardBg}>
            <h2 className="font-semibold text-lg mb-4" style={{ color: 'var(--admin-text)' }}>Reset Password</h2>
            <p className="text-sm text-slate-400 mb-2">Set a new temporary password for {resetting.fullName}. They will be required to change it on next login.</p>
            <input type="password" placeholder="New temporary password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} className="w-full px-3 py-2 border rounded mb-4" style={inputStyle} />
            <div className="flex gap-2">
              <button type="button" onClick={doResetPassword} disabled={!resetPassword.trim() || resetPassword.length < 8} className="px-4 py-2 bg-[#2563EB] text-white rounded-lg hover:bg-[#1D4ED8] btn-3d disabled:opacity-50">Reset</button>
              <button type="button" onClick={() => { setResetting(null); setResetPassword(''); }} className="px-4 py-2 border rounded" style={inputStyle}>Cancel</button>
            </div>
            {resetPassword.length > 0 && resetPassword.length < 8 && <p className="text-amber-500 text-sm mt-2">Password must be at least 8 characters.</p>}
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl p-6 max-w-md w-full card-3d shadow-xl border" style={cardBg}>
            <h2 className="font-semibold text-lg mb-4" style={{ color: 'var(--admin-text)' }}>Edit user</h2>
            <div className="space-y-3">
              <input type="text" placeholder="Full name" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} className="w-full px-3 py-2 border rounded" style={inputStyle} />
              <label className="flex items-center gap-2" style={{ color: 'var(--admin-text)' }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
                Active
              </label>
              <select value={form.roleName} onChange={(e) => setForm((f) => ({ ...f, roleName: e.target.value }))} className="w-full px-3 py-2 border rounded" style={inputStyle}>
                <option value="CUSTOMER">CUSTOMER</option>
                <option value="CASHIER">Cashier</option>
                <option value="ADMIN">Admin</option>
                <option value="OWNER">OWNER</option>
              </select>
              <input type="password" placeholder="New password (leave blank to keep)" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="w-full px-3 py-2 border rounded" style={inputStyle} />
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={saveUser} className="px-4 py-2 bg-[#2563EB] text-white rounded-lg hover:bg-[#1D4ED8] btn-3d">Save</button>
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 border rounded" style={inputStyle}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
