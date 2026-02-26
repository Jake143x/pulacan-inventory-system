import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { STORAGE_KEY } from '../context/CartContext';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const FULLNAME_MIN = 2;
const FULLNAME_MAX = 100;

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= MIN_PASSWORD_LENGTH },
  { label: 'At least one number', test: (p: string) => /\d/.test(p) },
  { label: 'At least one uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'At least one lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'At least one special character (!@#$%^&*)', test: (p: string) => /[!@#$%^&*]/.test(p) },
];

function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'Email is required';
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(trimmed)) return 'Please enter a valid email address';
  if (trimmed.length > 254) return 'Email is too long';
  return null;
}

function validateFullName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < FULLNAME_MIN) return `Name must be at least ${FULLNAME_MIN} characters`;
  if (trimmed.length > FULLNAME_MAX) return `Name must be at most ${FULLNAME_MAX} characters`;
  if (!/^[\p{L}\p{M}\s\-'.]+$/u.test(trimmed)) return 'Name can only contain letters, spaces, hyphens, and apostrophes';
  return null;
}

const PHONE_LENGTH = 11; // 09 + 9 digits (e.g. 09171234567)
const PH_PHONE_REGEX = /^09\d{9}$/; // Philippines: 09 then 9 more digits = 11 total

function validatePhone(phone: string): string | null {
  const trimmed = phone.trim().replace(/\s/g, '');
  if (!trimmed) return 'Phone number is required';
  if (!trimmed.startsWith('09')) return 'Phone number must start with 09';
  if (!PH_PHONE_REGEX.test(trimmed)) return 'Enter exactly 11 digits starting with 09 (e.g. 09171234567)';
  if (trimmed.length > PHONE_LENGTH) return `Phone number must be exactly ${PHONE_LENGTH} digits, not more`;
  return null;
}

function validatePassword(p: string): boolean {
  return (
    p.length >= MIN_PASSWORD_LENGTH &&
    p.length <= MAX_PASSWORD_LENGTH &&
    /\d/.test(p) &&
    /[A-Z]/.test(p) &&
    /[a-z]/.test(p) &&
    /[!@#$%^&*]/.test(p)
  );
}

export default function Register() {
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const passwordChecks = useMemo(
    () => PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(password) })),
    [password]
  );
  const passwordValid = useMemo(() => validatePassword(password), [password]);
  const confirmError = useMemo(() => {
    if (!touched.confirmPassword) return null;
    if (!confirmPassword) return 'Please confirm your password';
    if (password !== confirmPassword) return 'Passwords do not match';
    return null;
  }, [confirmPassword, password, touched.confirmPassword]);
  const emailError = useMemo(() => (touched.email ? validateEmail(email) : null), [email, touched.email]);
  const fullNameError = useMemo(() => (touched.fullName ? validateFullName(fullName) : null), [fullName, touched.fullName]);
  const phoneError = useMemo(() => (touched.phoneNumber ? validatePhone(phoneNumber) : null), [phoneNumber, touched.phoneNumber]);

  const canSubmit =
    !loading &&
    validateEmail(email) === null &&
    validateFullName(fullName) === null &&
    validatePhone(phoneNumber) === null &&
    passwordValid &&
    confirmPassword === password &&
    confirmPassword.length > 0 &&
    agreeTerms;

  const handleBlur = (field: string) => () => setTouched((t) => ({ ...t, [field]: true }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const emailErr = validateEmail(email);
    const nameErr = validateFullName(fullName);
    const phoneErr = validatePhone(phoneNumber);
    if (emailErr || nameErr || phoneErr) {
      setError(emailErr || nameErr || phoneErr || 'Please fix the errors below.');
      setTouched({ email: true, fullName: true, phoneNumber: true, confirmPassword: true });
      return;
    }
    if (!passwordValid) {
      setError('Password does not meet all requirements.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setTouched((t) => ({ ...t, confirmPassword: true }));
      return;
    }
    if (!agreeTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy.');
      return;
    }
    setLoading(true);
    try {
      const normalizedPhone = phoneNumber.trim().replace(/\s/g, '');
      await register(email.trim().toLowerCase(), password, fullName.trim(), normalizedPhone || undefined);
      localStorage.removeItem(STORAGE_KEY);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'block w-full px-4 py-2.5 rounded-xl border transition-colors focus:ring-2 focus:ring-[var(--customer-primary)]/30 focus:border-[var(--customer-primary)]';
  const inputStyle = {
    backgroundColor: 'var(--customer-card)',
    borderColor: 'var(--customer-border)',
    color: 'var(--customer-text)',
  };

  const LogoIcon3D = () => (
    <div className="flex justify-center mb-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(145deg, var(--customer-primary) 0%, var(--customer-primary-hover) 50%, #1e40af 100%)', boxShadow: '0 8px 24px rgba(234, 88, 12, 0.4), 0 4px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.2)' }}>
        <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ backgroundColor: 'var(--customer-bg)' }}>
      <div className="w-full max-w-md">
        <div className="rounded-2xl shadow-lg p-8 border card-3d" style={{ backgroundColor: 'var(--customer-card)', borderColor: 'var(--customer-border)' }}>
          <div className="mb-6 text-center">
            <LogoIcon3D />
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--customer-text)' }}>Pulacan Hardware and Construction</h1>
            <p className="mt-1.5 text-sm" style={{ color: 'var(--customer-text-muted)' }}>Create an account to place orders</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {error && (
              <div className="p-3 rounded-xl text-sm border border-amber-200 bg-amber-50 text-amber-800" role="alert">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--customer-text)' }}>Full Name</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={handleBlur('fullName')}
                required
                minLength={FULLNAME_MIN}
                maxLength={FULLNAME_MAX}
                autoComplete="name"
                className={inputClass}
                style={inputStyle}
                placeholder="Your full name"
                aria-invalid={!!fullNameError}
                aria-describedby={fullNameError ? 'fullName-error' : undefined}
              />
              {fullNameError && <p id="fullName-error" className="mt-1 text-xs text-amber-600">{fullNameError}</p>}
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--customer-text)' }}>Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={handleBlur('email')}
                required
                autoComplete="email"
                className={inputClass}
                style={inputStyle}
                placeholder="email@gmail.com"
                aria-invalid={!!emailError}
                aria-describedby={emailError ? 'email-error' : undefined}
              />
              {emailError && <p id="email-error" className="mt-1 text-xs text-amber-600">{emailError}</p>}
            </div>
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--customer-text)' }}>Phone Number</label>
              <input
                id="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                  setPhoneNumber(digits);
                }}
                onBlur={handleBlur('phoneNumber')}
                required
                maxLength={PHONE_LENGTH}
                autoComplete="tel"
                className={inputClass}
                style={inputStyle}
                placeholder="09171234567"
                aria-invalid={!!phoneError}
                aria-describedby={phoneError ? 'phoneNumber-error' : undefined}
              />
              {phoneError && <p id="phoneNumber-error" className="mt-1 text-xs text-amber-600">{phoneError}</p>}
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--customer-text)' }}>Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={MAX_PASSWORD_LENGTH}
                autoComplete="new-password"
                className={inputClass}
                style={inputStyle}
                placeholder="Create a strong password"
                aria-invalid={!passwordValid && password.length > 0}
                aria-describedby="password-requirements"
              />
              <ul id="password-requirements" className="mt-2 space-y-1 text-xs" role="list" aria-live="polite" style={{ color: 'var(--customer-text-muted)' }}>
                {passwordChecks.map((c, i) => (
                  <li key={i} className={c.ok ? 'text-emerald-600' : ''}>{c.ok ? '✓' : '○'} {c.label}</li>
                ))}
                {password.length > MAX_PASSWORD_LENGTH && <li>Password must be at most {MAX_PASSWORD_LENGTH} characters</li>}
              </ul>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--customer-text)' }}>Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={handleBlur('confirmPassword')}
                required
                autoComplete="new-password"
                className={inputClass}
                style={inputStyle}
                placeholder="Re-enter your password"
                aria-invalid={!!confirmError}
                aria-describedby={confirmError ? 'confirm-error' : undefined}
              />
              {confirmError && <p id="confirm-error" className="mt-1 text-xs text-amber-600">{confirmError}</p>}
            </div>
            <div className="flex items-start gap-3">
              <input
                id="agreeTerms"
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-[var(--customer-primary)] focus:ring-[var(--customer-primary)]"
                aria-describedby="terms-label"
              />
              <label id="terms-label" htmlFor="agreeTerms" className="text-sm" style={{ color: 'var(--customer-text-muted)' }}>
                I agree to the <span className="font-medium" style={{ color: 'var(--customer-text)' }}>Terms of Service</span> and <span className="font-medium" style={{ color: 'var(--customer-text)' }}>Privacy Policy</span>.
              </label>
            </div>
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3.5 px-4 text-white font-semibold rounded-xl bg-[var(--customer-primary)] hover:bg-[var(--customer-primary-hover)] focus:ring-2 focus:ring-[var(--customer-primary)]/40 focus:ring-offset-2 disabled:opacity-50 transition-all btn-3d"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm" style={{ color: 'var(--customer-text-muted)' }}>
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-[var(--customer-primary)] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
