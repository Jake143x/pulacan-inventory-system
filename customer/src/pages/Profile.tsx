import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth, uploadAvatar } from '../api/client';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) setFullName(user.fullName);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (password && password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (password && password.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    setSaving(true);
    try {
      await auth.updateProfile({
        ...(fullName.trim() && { fullName: fullName.trim() }),
        ...(password && { password }),
      });
      await refreshUser();
      setPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: 'Your changes have been saved.' });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save.' });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setMessage(null);
    setUploading(true);
    try {
      const { url } = await uploadAvatar(file);
      await auth.updateProfile({ profilePictureUrl: url });
      await refreshUser();
      setMessage({ type: 'success', text: 'Profile picture updated.' });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-slate-400">Manage your profile and security settings</p>
      </div>

      {/* Profile summary card */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm card-3d">
        <div className="px-6 py-5 border-b border-slate-700 flex items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <button
            type="button"
            onClick={handleAvatarClick}
            disabled={uploading}
            className="w-14 h-14 rounded-full border-2 border-slate-500 flex items-center justify-center shrink-0 overflow-hidden bg-slate-700/50 hover:bg-slate-600/50 focus:outline-none focus:ring-2 focus:ring-[var(--customer-primary)]/50 disabled:opacity-60 transition-colors"
            aria-label="Change profile picture"
          >
            {user?.profilePictureUrl ? (
              <img src={user.profilePictureUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-gray-300 text-xl font-semibold">
                {user?.fullName?.charAt(0)?.toUpperCase() || '?'}
              </span>
            )}
          </button>
          <div className="min-w-0">
            <p className="text-lg font-semibold text-white truncate">{user?.fullName || '—'}</p>
            <p className="text-sm text-slate-400 truncate">{user?.email}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {uploading ? 'Uploading...' : 'Click photo to change (JPEG, PNG, GIF, WebP, max 3MB)'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {message && (
            <div
              role="alert"
              className={`rounded-lg px-4 py-3 text-sm ${
                message.type === 'success'
                  ? 'bg-gray-500/15 text-gray-300 border border-gray-500/30'
                  : 'bg-gray-600/15 text-gray-300 border border-gray-500/30'
              }`}
            >
              {message.text}
            </div>
          )}

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Personal information</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-400 mb-1.5">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={user?.email ?? ''}
                  disabled
                  className="w-full px-3.5 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-400 cursor-not-allowed text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">Email is used to sign in and cannot be changed.</p>
              </div>
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-slate-400 mb-1.5">
                  Full name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  minLength={2}
                  maxLength={100}
                  className="input-store text-sm"
                  placeholder="Enter your full name"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4 pt-4 border-t border-slate-700">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Security</h2>
            <p className="text-sm text-slate-400">Change your password below. Leave both fields blank to keep your current password.</p>
            <div className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-400 mb-1.5">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="input-store text-sm"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-400 mb-1.5">
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="input-store text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn-store px-6 py-2.5 text-sm font-medium disabled:opacity-50 btn-3d"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            {saving && (
              <span className="text-xs text-slate-500">Please wait</span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
