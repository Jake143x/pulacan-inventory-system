import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8 || !/\d/.test(password) || !/[A-Z]/.test(password) || !/[!@#$%^&*]/.test(password)) {
      setError('Password must be 8+ chars with number, uppercase, and special character');
      return;
    }
    setLoading(true);
    try {
      await register(email, password, fullName);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center admin-canvas px-4">
      <div className="w-full max-w-sm rounded-2xl shadow-xl p-8 card-3d" style={{ backgroundColor: 'var(--admin-card)', border: '1px solid var(--admin-border)' }}>
        <h1 className="text-2xl font-bold text-center text-white mb-2">Create account</h1>
        <p className="text-slate-400 text-center text-sm mb-6">Register as customer</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-200 bg-red-500/10 p-2 rounded-xl border border-red-500/30">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500 focus:ring-2 focus:ring-[#2563EB]/50 focus:border-[#2563EB]"
              style={{ borderColor: 'var(--admin-border)' }}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500 focus:ring-2 focus:ring-[#2563EB]/50 focus:border-[#2563EB]"
              style={{ borderColor: 'var(--admin-border)' }}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500 focus:ring-2 focus:ring-[#2563EB]/50 focus:border-[#2563EB]"
              style={{ borderColor: 'var(--admin-border)' }}
              placeholder="Min 8 chars, number, uppercase, special"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#2563EB] text-white font-medium rounded-lg hover:bg-[#1D4ED8] disabled:opacity-50 btn-3d"
          >
            {loading ? 'Creating...' : 'Register'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-400">
          Already have an account? <Link to="/login" className="text-[#2563EB] hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
