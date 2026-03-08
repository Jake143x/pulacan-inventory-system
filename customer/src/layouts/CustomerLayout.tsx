import { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import CustomerChatbot from '../components/CustomerChatbot';

export default function CustomerLayout() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col customer-theme-bg">
      <header
        className="sticky top-0 z-30 border-b shadow-md"
        style={{
          backgroundColor: 'var(--customer-card)',
          borderColor: 'var(--customer-border)',
          boxShadow: '0 4px 20px rgba(234, 88, 12, 0.08)',
        }}
      >
        <div className="max-w-[90rem] w-full mx-auto px-4 sm:px-6">
          <div className="h-14 sm:h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1 md:flex-initial">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 -ml-2 rounded-xl text-[var(--customer-text-muted)] hover:bg-[var(--customer-primary-light)] hover:text-[var(--customer-primary)] transition-colors"
                aria-label="Open menu"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <NavLink
                to="/dashboard"
                className="flex items-center gap-2 shrink-0 rounded-xl px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--customer-primary)]/40 focus:ring-offset-2 hover:opacity-90 transition-opacity"
              >
                <div
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--customer-primary) 0%, var(--customer-primary-hover) 100%)', boxShadow: '0 4px 12px rgba(234, 88, 12, 0.35)' }}
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                </div>
                <span className="text-base sm:text-xl font-bold tracking-tight truncate hidden sm:inline max-w-[220px] lg:max-w-[320px]" style={{ color: 'var(--customer-text)' }}>
                  Pulacan Hardware and Construction
                </span>
                <span className="text-base font-bold tracking-tight truncate sm:hidden" style={{ color: 'var(--customer-text)' }}>
                  Pulacan
                </span>
              </NavLink>
            </div>
            <nav className="hidden md:flex items-center gap-1 overflow-x-auto flex-1 justify-center min-w-0">
              <NavLink
                to="/dashboard"
                end
                className={({ isActive }) =>
                  `whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-medium transition-all shrink-0 ${isActive ? 'text-[var(--customer-primary)] bg-[var(--customer-primary-light)]' : 'text-[var(--customer-text-muted)] hover:text-[var(--customer-primary)] hover:bg-[var(--customer-primary-light)]'}`
                }
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/browse"
                className={({ isActive }) =>
                  `whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-medium transition-all shrink-0 ${isActive ? 'text-[var(--customer-primary)] bg-[var(--customer-primary-light)]' : 'text-[var(--customer-text-muted)] hover:text-[var(--customer-primary)] hover:bg-[var(--customer-primary-light)]'}`
                }
              >
                Products
              </NavLink>
              <NavLink
                to="/cart"
                className={({ isActive }) =>
                  `whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-all shrink-0 ${isActive ? 'text-[var(--customer-primary)] bg-[var(--customer-primary-light)]' : 'text-[var(--customer-text-muted)] hover:text-[var(--customer-primary)] hover:bg-[var(--customer-primary-light)]'}`
                }
              >
                Cart
                {itemCount > 0 && (
                  <span
                    className="cart-badge-animate text-xs font-semibold min-w-[1.25rem] h-5 px-1.5 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: 'var(--customer-primary)' }}
                  >
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </NavLink>
              <NavLink
                to="/orders"
                className={({ isActive }) =>
                  `whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-medium transition-all shrink-0 ${isActive ? 'text-[var(--customer-primary)] bg-[var(--customer-primary-light)]' : 'text-[var(--customer-text-muted)] hover:text-[var(--customer-primary)] hover:bg-[var(--customer-primary-light)]'}`
                }
              >
                My Orders
              </NavLink>
            </nav>
            <div className="flex items-center gap-2 sm:gap-2 shrink-0">
              <button type="button" className="p-2 sm:p-2.5 rounded-xl transition-colors hover:bg-[var(--customer-primary-light)] hidden sm:block" style={{ color: 'var(--customer-text-muted)' }} title="Notifications" aria-label="Notifications">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              </button>
              <Link to="/profile" className="flex items-center gap-2 rounded-xl p-2 sm:pl-2 sm:pr-3 sm:py-2 transition-colors hover:bg-[var(--customer-primary-light)]" title="Account">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 overflow-hidden text-white" style={{ backgroundColor: user?.profilePictureUrl ? 'transparent' : 'var(--customer-primary)' }}>
                  {user?.profilePictureUrl ? (
                    <img src={user.profilePictureUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    user?.fullName?.charAt(0)?.toUpperCase() || '?'
                  )}
                </div>
                <span className="text-sm font-medium truncate max-w-[80px] sm:max-w-[120px] hidden sm:inline" style={{ color: 'var(--customer-text)' }}>{user?.fullName}</span>
              </Link>
              <button type="button" onClick={handleLogout} className="text-sm font-medium px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-colors hover:bg-[var(--customer-primary-light)]" style={{ color: 'var(--customer-text-muted)' }} title="Sign out">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile nav overlay */}
      <div
        role="button"
        tabIndex={-1}
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
        style={{ visibility: mobileMenuOpen ? 'visible' : 'hidden', opacity: mobileMenuOpen ? 1 : 0 }}
        onClick={() => setMobileMenuOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setMobileMenuOpen(false)}
        aria-hidden="true"
      />
      <div
        className={`
          fixed top-0 left-0 z-50 h-full w-[min(280px,85vw)] max-w-[280px] border-r shadow-xl transition-transform duration-200 md:hidden
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          backgroundColor: 'var(--customer-card)',
          borderColor: 'var(--customer-border)',
        }}
      >
        <div className="flex flex-col h-full pt-14">
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--customer-border)' }}>
            <span className="font-semibold" style={{ color: 'var(--customer-text)' }}>Menu</span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-xl text-[var(--customer-text-muted)] hover:bg-[var(--customer-primary-light)] hover:text-[var(--customer-primary)]"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <nav className="flex flex-col p-2">
            <NavLink
              to="/dashboard"
              end
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? 'text-[var(--customer-primary)] bg-[var(--customer-primary-light)]' : 'text-[var(--customer-text-muted)] hover:bg-[var(--customer-primary-light)]'}`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/browse"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? 'text-[var(--customer-primary)] bg-[var(--customer-primary-light)]' : 'text-[var(--customer-text-muted)] hover:bg-[var(--customer-primary-light)]'}`
              }
            >
              Products
            </NavLink>
            <NavLink
              to="/cart"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? 'text-[var(--customer-primary)] bg-[var(--customer-primary-light)]' : 'text-[var(--customer-text-muted)] hover:bg-[var(--customer-primary-light)]'}`
              }
            >
              Cart
              {itemCount > 0 && (
                <span className="text-xs font-semibold min-w-[1.25rem] h-5 px-1.5 rounded-full flex items-center justify-center text-white ml-auto" style={{ backgroundColor: 'var(--customer-primary)' }}>
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </NavLink>
            <NavLink
              to="/orders"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? 'text-[var(--customer-primary)] bg-[var(--customer-primary-light)]' : 'text-[var(--customer-text-muted)] hover:bg-[var(--customer-primary-light)]'}`
              }
            >
              My Orders
            </NavLink>
          </nav>
        </div>
      </div>
      <main className="flex-1 max-w-[90rem] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
      <CustomerChatbot />
    </div>
  );
}
