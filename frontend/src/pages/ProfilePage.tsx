import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth, uploadAvatar } from '../api/client';

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{
    fullName: string;
    email: string;
    contactNumber: string;
    profilePictureUrl: string | null;
    role: string;
    isActive: boolean;
    createdAt: string | null;
    lastLoginAt: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState({ fullName: '', email: '', contactNumber: '', profilePictureUrl: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    auth
      .me()
      .then((u) => {
        setProfile({
          fullName: u.fullName,
          email: u.email,
          contactNumber: u.contactNumber ?? '',
          profilePictureUrl: u.profilePictureUrl ?? null,
          role: u.role,
          isActive: u.isActive ?? true,
          createdAt: u.createdAt ?? null,
          lastLoginAt: u.lastLoginAt ?? null,
        });
        setEdit({
          fullName: u.fullName,
          email: u.email,
          contactNumber: u.contactNumber ?? '',
          profilePictureUrl: u.profilePictureUrl ?? '',
        });
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await auth.updateMe({
        fullName: edit.fullName.trim(),
        email: edit.email.trim() || undefined,
        contactNumber: edit.contactNumber.trim() || null,
        profilePictureUrl: edit.profilePictureUrl.trim() || null,
      });
      await refreshUser();
      setProfile((p) => (p ? { ...p, ...edit, profilePictureUrl: edit.profilePictureUrl.trim() || null } : null));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoutAll = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setError('');
    setUploading(true);
    try {
      const { url } = await uploadAvatar(file);
      setEdit((x) => ({ ...x, profilePictureUrl: url }));
      await auth.updateMe({ profilePictureUrl: url });
      setProfile((p) => (p ? { ...p, profilePictureUrl: url } : null));
      await refreshUser();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="text-slate-400">Loading profile...</div>;
  if (!profile) return <div className="text-red-400">{error || 'Profile not found'}</div>;

  const roleLabel = profile.role === 'OWNER' ? 'System Owner' : profile.role === 'ADMIN' ? 'Administrator' : profile.role;

  return (
    <div className="flex flex-col items-center w-full">
      <div className="space-y-8 w-full max-w-3xl">
        <h1 className="text-2xl font-bold text-center" style={{ color: 'var(--admin-text)' }}>My Profile</h1>

      {/* 1. Profile Information */}
      <section className="rounded-xl border p-6 card-3d" style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--admin-text)' }}>Profile Information</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex flex-col items-center gap-4">
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
              className="shrink-0 rounded-full border-2 border-dashed transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/50 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-60 cursor-pointer"
              style={{ borderColor: 'var(--admin-border)' }}
              aria-label="Upload profile picture"
            >
              {profile.profilePictureUrl || edit.profilePictureUrl ? (
                <img
                  src={edit.profilePictureUrl || profile.profilePictureUrl || ''}
                  alt="Profile"
                  className="w-28 h-28 rounded-full object-cover"
                />
              ) : (
                <div
                  className="w-28 h-28 rounded-full flex items-center justify-center text-3xl font-semibold"
                  style={{ backgroundColor: 'var(--admin-primary)', color: '#fff' }}
                >
                  {(edit.fullName || user?.fullName || '?').charAt(0).toUpperCase()}
                </div>
              )}
            </button>
            <p className="text-sm" style={{ color: 'var(--admin-dim)' }}>
              {uploading ? 'Uploading...' : 'Click to upload a photo (JPEG, PNG, GIF, WebP)'}
            </p>
          </div>
          <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--admin-dim)' }}>Full Name</label>
                <input
                  type="text"
                  value={edit.fullName}
                  onChange={(e) => setEdit((x) => ({ ...x, fullName: e.target.value }))}
                  required
                  minLength={2}
                  maxLength={100}
                  className="w-full px-3 py-2 rounded-lg border bg-white/5"
                  style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--admin-dim)' }}>Email (optional)</label>
                <input
                  type="email"
                  value={edit.email}
                  onChange={(e) => setEdit((x) => ({ ...x, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border bg-white/5"
                  style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--admin-dim)' }}>Contact Number (optional)</label>
                <input
                  type="text"
                  value={edit.contactNumber}
                  onChange={(e) => setEdit((x) => ({ ...x, contactNumber: e.target.value }))}
                  placeholder="+63..."
                  maxLength={30}
                  className="w-full px-3 py-2 rounded-lg border bg-white/5"
                  style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}
                />
              </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/20" style={{ color: 'var(--admin-dim)' }}>
              Role: {roleLabel}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
              Status: {profile.isActive ? 'Active' : 'Inactive'}
            </span>
            {profile.createdAt && (
              <span className="text-xs" style={{ color: 'var(--admin-dim)' }}>
                Account created: {new Date(profile.createdAt).toLocaleDateString()}
              </span>
            )}
            {profile.lastLoginAt && (
              <span className="text-xs" style={{ color: 'var(--admin-dim)' }}>
                Last login: {new Date(profile.lastLoginAt).toLocaleString()}
              </span>
            )}
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg font-medium bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-50">
            {saving ? 'Saving...' : 'Save profile'}
          </button>
        </form>
      </section>

      {/* 2. Security Settings */}
      <section className="rounded-xl border p-6 card-3d" style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--admin-text)' }}>Security Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-medium" style={{ color: 'var(--admin-text)' }}>Change Password</p>
              <p className="text-sm" style={{ color: 'var(--admin-dim)' }}>Update your password. We recommend forcing re-login after change.</p>
            </div>
            <Link to="/change-password" className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-white/5 transition-colors" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>
              Change Password
            </Link>
          </div>
          <p className="text-xs flex items-center gap-1" style={{ color: 'var(--admin-dim)' }}>
            <span aria-hidden>✔</span> Force re-login after password change (recommended)
          </p>
          <hr style={{ borderColor: 'var(--admin-border)' }} />
          <div>
            <p className="font-medium" style={{ color: 'var(--admin-text)' }}>Two-Factor Authentication</p>
            <p className="text-sm" style={{ color: 'var(--admin-dim)' }}>Optional extra security. Coming soon.</p>
          </div>
          <hr style={{ borderColor: 'var(--admin-border)' }} />
          <div>
            <p className="font-medium" style={{ color: 'var(--admin-text)' }}>Login Activity History</p>
            <p className="text-sm" style={{ color: 'var(--admin-dim)' }}>View recent sign-in activity. Coming soon.</p>
          </div>
          <hr style={{ borderColor: 'var(--admin-border)' }} />
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-medium" style={{ color: 'var(--admin-text)' }}>Logout from All Devices</p>
              <p className="text-sm" style={{ color: 'var(--admin-dim)' }}>Sign out from this device. For full session invalidation, change your password.</p>
            </div>
            <button
              type="button"
              onClick={handleLogoutAll}
              className="px-4 py-2 rounded-lg border text-sm font-medium text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-colors"
              style={{ borderColor: 'var(--admin-border)' }}
            >
              Log out
            </button>
          </div>
        </div>
      </section>

      {/* 4. Owner restrictions (informational) */}
      {profile.role === 'OWNER' && (
        <section className="rounded-xl border p-6 card-3d" style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--admin-text)' }}>Owner Account</h2>
          <p className="text-sm mb-3" style={{ color: 'var(--admin-dim)' }}>The following restrictions apply to the System Owner account:</p>
          <ul className="list-disc list-inside space-y-1 text-sm" style={{ color: 'var(--admin-dim)' }}>
            <li>Owner account cannot be deleted.</li>
            <li>Owner account cannot be deactivated.</li>
            <li>Owner role cannot be changed.</li>
            <li>Only the Owner can reset other users&apos; passwords (admin reset).</li>
          </ul>
        </section>
      )}
      </div>
    </div>
  );
}
