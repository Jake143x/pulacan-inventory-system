import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CashierChatbot from '../components/CashierChatbot';

const BoxIcon = () => (
  <svg className="w-6 h-6 shrink-0 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
  </svg>
);

const ProductIcon = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const RobotIcon = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const LogoutIcon = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const CartIcon = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const OrdersIcon = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const ApproveIcon = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);

const BellIcon = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
  </svg>
);

const navByRole: Record<string, Array<{ to: string; label: string; icon?: React.ReactNode }>> = {
  ADMIN: [
    { to: '/dashboard', label: 'Dashboard', icon: <ChartIcon /> },
    { to: '/products', label: 'Product Management', icon: <ProductIcon /> },
    { to: '/inventory', label: 'Inventory', icon: <BoxIcon /> },
    { to: '/analytics', label: 'Analytics', icon: <ChartIcon /> },
    { to: '/users', label: 'User Management', icon: <UsersIcon /> },
    { to: '/notifications', label: 'Notifications', icon: <BellIcon /> },
    { to: '/ai', label: 'Assistant', icon: <RobotIcon /> },
  ],
  OWNER: [
    { to: '/dashboard', label: 'Dashboard', icon: <ChartIcon /> },
    { to: '/products', label: 'Product Management', icon: <ProductIcon /> },
    { to: '/inventory', label: 'Inventory', icon: <BoxIcon /> },
    { to: '/analytics', label: 'Analytics', icon: <ChartIcon /> },
    { to: '/users', label: 'User Management', icon: <UsersIcon /> },
    { to: '/notifications', label: 'Notifications', icon: <BellIcon /> },
    { to: '/ai', label: 'Assistant', icon: <RobotIcon /> },
  ],
  CASHIER: [
    { to: '/dashboard', label: 'Dashboard', icon: <ChartIcon /> },
    { to: '/pos', label: 'Current sale chart', icon: <CartIcon /> },
    { to: '/orders/approval', label: 'Approve Order', icon: <ApproveIcon /> },
  ],
};

const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/products': 'Product Management',
  '/inventory': 'Inventory',
  '/analytics': 'Analytics',
  '/orders': 'Sales',
  '/ai': 'Assistant',
  '/config': 'Settings',
  '/profile': 'My Profile',
  '/users': 'User Management',
  '/notifications': 'Notifications',
  '/pos': 'Current sale chart',
  '/orders/approval': 'Approve orders',
};

function getPageTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  for (const [path, title] of Object.entries(routeTitles)) {
    if (pathname === path || pathname.startsWith(path + '/')) return title;
  }
  return 'Pulacan Inventory';
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const role = user?.role ?? 'ADMIN';
  const nav = navByRole[role] ?? navByRole.ADMIN;
  const pageTitle = getPageTitle(location.pathname);
  const roleLabel = role === 'ADMIN' || role === 'OWNER' ? 'Administrator' : 'Cashier';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="h-screen flex overflow-hidden admin-canvas">
      {/* Left sidebar — fixed height, does not scroll */}
      <aside
        className="flex flex-col shrink-0 h-full border-r transition-[width] duration-200 sidebar-3d"
        style={{ width: sidebarCollapsed ? 52 : 260, backgroundColor: 'var(--admin-sidebar)', borderColor: 'var(--admin-border)' }}
      >
        <div className="flex h-14 items-center justify-between px-3 border-b" style={{ borderColor: 'var(--admin-border)' }}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(37, 99, 235, 0.2)' }}>
                <BoxIcon />
              </div>
              <span className="font-semibold text-sm truncate" style={{ color: 'var(--admin-text)' }}>Pulacan Inventory</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {nav.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to !== '/orders' && to !== '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                } ${isActive ? 'border-l-4 border-[#2563EB] pl-2' : 'border-l-4 border-transparent'}`
              }
            >
              {icon}
              {!sidebarCollapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {!sidebarCollapsed && (
          <div className="p-3 border-t" style={{ borderColor: 'var(--admin-border)' }}>
            <Link
              to="/profile"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/5"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold" style={{ backgroundColor: 'var(--admin-primary)', color: '#fff' }}>
                {user?.fullName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--admin-text)' }}>{user?.fullName}</p>
                <p className="text-xs truncate" style={{ color: 'var(--admin-dim)' }}>{roleLabel}</p>
              </div>
            </Link>
          </div>
        )}

        {!sidebarCollapsed && (
          <div className="p-2">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <LogoutIcon />
              Log Out
            </button>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-6 backdrop-blur-sm" style={{ borderColor: 'var(--admin-border)', backgroundColor: 'rgba(15, 23, 42, 0.92)' }}>
          <h1 className="text-lg font-semibold truncate" style={{ color: 'var(--admin-text)' }}>{pageTitle}</h1>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" style={{ backgroundColor: 'var(--admin-bg)' }}>
          <div className="max-w-7xl mx-auto px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
      {user?.role === 'CASHIER' && <CashierChatbot />}
    </div>
  );
}
