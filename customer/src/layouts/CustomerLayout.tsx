import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import CustomerChatbot from '../components/CustomerChatbot';

export default function CustomerLayout() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();

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
          <div className="h-16 flex items-center justify-between gap-4">
            <NavLink
              to="/dashboard"
              className="flex items-center gap-2 shrink-0 rounded-xl px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--customer-primary)]/40 focus:ring-offset-2 hover:opacity-90 transition-opacity"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--customer-primary) 0%, var(--customer-primary-hover) 100%)', boxShadow: '0 4px 12px rgba(234, 88, 12, 0.35)' }}
              >
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
              </div>
              <span className="text-xl font-bold tracking-tight" style={{ color: 'var(--customer-text)' }}>
                Pulacan Hardware and Construction
              </span>
            </NavLink>
            <nav className="flex items-center gap-1 overflow-x-auto">
              <NavLink
                to="/dashboard"
                end
                className={({ isActive }) =>
                  `px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'text-[var(--customer-primary)] bg-[var(--customer-primary-light)]' : 'text-[var(--customer-text-muted)] hover:text-[var(--customer-primary)] hover:bg-[var(--customer-primary-light)]'}`
                }
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/browse"
                className={({ isActive }) =>
                  `px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'text-[var(--customer-primary)] bg-[var(--customer-primary-light)]' : 'text-[var(--customer-text-muted)] hover:text-[var(--customer-primary)] hover:bg-[var(--customer-primary-light)]'}`
                }
              >
                Products
              </NavLink>
              <NavLink
                to="/cart"
                className={({ isActive }) =>
                  `px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-all ${isActive ? 'text-[var(--customer-primary)] bg-[var(--customer-primary-light)]' : 'text-[var(--customer-text-muted)] hover:text-[var(--customer-primary)] hover:bg-[var(--customer-primary-light)]'}`
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
                  `px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'text-[var(--customer-primary)] bg-[var(--customer-primary-light)]' : 'text-[var(--customer-text-muted)] hover:text-[var(--customer-primary)] hover:bg-[var(--customer-primary-light)]'}`
                }
              >
                My Orders
              </NavLink>
            </nav>
            <div className="flex items-center gap-2">
              <button type="button" className="p-2.5 rounded-xl transition-colors hover:bg-[var(--customer-primary-light)]" style={{ color: 'var(--customer-text-muted)' }} title="Notifications" aria-label="Notifications">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              </button>
              <Link to="/profile" className="flex items-center gap-2 rounded-xl pl-2 pr-3 py-2 transition-colors hover:bg-[var(--customer-primary-light)]" title="Account">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 overflow-hidden text-white" style={{ backgroundColor: user?.profilePictureUrl ? 'transparent' : 'var(--customer-primary)' }}>
                  {user?.profilePictureUrl ? (
                    <img src={user.profilePictureUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    user?.fullName?.charAt(0)?.toUpperCase() || '?'
                  )}
                </div>
                <span className="text-sm font-medium truncate max-w-[100px] sm:max-w-[120px] hidden sm:inline" style={{ color: 'var(--customer-text)' }}>{user?.fullName}</span>
              </Link>
              <button type="button" onClick={handleLogout} className="text-sm font-medium px-3 py-2.5 rounded-xl transition-colors hover:bg-[var(--customer-primary-light)]" style={{ color: 'var(--customer-text-muted)' }} title="Sign out">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-[90rem] w-full mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>
      <CustomerChatbot />
    </div>
  );
}
