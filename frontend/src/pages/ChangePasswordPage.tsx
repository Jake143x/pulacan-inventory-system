import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function ChangePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await api<unknown>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ password }),
      });
      if (user?.role === 'ADMIN' || user?.role === 'OWNER') navigate('/dashboard', { replace: true });
      else if (user?.role === 'CASHIER') navigate('/pos', { replace: true });
      else navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 admin-canvas">
      <div className="card-3d rounded-xl p-8 max-w-md w-full" style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <h1 className="text-xl font-bold text-white mb-2">Change password</h1>
        <p className="text-gray-400 text-sm mb-4">You must set a new password before continuing.</p>
        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white"
            style={{ borderColor: 'var(--admin-border)' }}
            autoComplete="new-password"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white"
            style={{ borderColor: 'var(--admin-border)' }}
            autoComplete="new-password"
          />
          <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50">
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
