import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const EyeOffIcon = () => (
  <svg className="w-5 h-5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);
const EyeIcon = () => (
  <svg className="w-5 h-5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);
const LockIcon = () => (
  <svg className="w-5 h-5 shrink-0 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user, mustChangePassword } = await login(email, password);
      if (mustChangePassword) {
        navigate('/change-password', { replace: true });
        return;
      }
      if (user?.role === 'ADMIN' || user?.role === 'OWNER') navigate('/dashboard', { replace: true });
      else if (user?.role === 'CASHIER') navigate('/pos', { replace: true });
      else navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const cardStyle = {
    backgroundColor: 'var(--admin-card)',
    border: '1px solid var(--admin-border)',
    borderRadius: 16,
    boxShadow: 'var(--admin-shadow-lg), var(--admin-shadow-inset)',
    borderTopColor: 'var(--admin-highlight)',
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 admin-canvas">
      <div className="w-full max-w-md">
        <div className="p-8 rounded-2xl" style={cardStyle}>
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-white">Welcome Back</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500 focus:ring-2 focus:ring-[#2563EB]/50 focus:border-[#2563EB]"
              style={{ borderColor: 'var(--admin-border)' }}
              placeholder="email@inventory.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-2.5 pr-12 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500 focus:ring-2 focus:ring-[#2563EB]/50 focus:border-[#2563EB]"
                style={{ borderColor: 'var(--admin-border)' }}
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-200"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <a href="#" className="text-sm text-[#2563EB] hover:underline">Forgot password?</a>
          </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] focus:ring-2 focus:ring-[#2563EB]/50 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 flex items-center justify-center gap-2 btn-3d"
            >
            <LockIcon />
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}
