import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import AdminDashboard from './pages/dashboards/AdminDashboard';
import CashierDashboard from './pages/dashboards/CashierDashboard';
import InventoryPage from './pages/InventoryPage';
import ProductManagementPage from './pages/ProductManagementPage';
import POSPage from './pages/POSPage';
import OrdersPage from './pages/OrdersPage';
import OrderApprovalPage from './pages/OrderApprovalPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AIPage from './pages/AIPage';
import ConfigPage from './pages/ConfigPage';
import UsersPage from './pages/UsersPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';
import SalesChartFullPage from './pages/SalesChartFullPage';
import MonitorPage from './pages/MonitorPage';
import FullscreenMonitorPage from './pages/FullscreenMonitorPage';
import StoreAnalyticsMonitorPage from './pages/StoreAnalyticsMonitorPage';
import LiveChatPage from './pages/LiveChatPage';

const CUSTOMER_WEB_PORTAL_URL = 'http://localhost:5174';

const INTERNAL_ALLOWED_ROLES = ['ADMIN', 'OWNER', 'CASHIER'];

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'CUSTOMER') {
    // Send customers straight to the Customer Web Portal instead of showing a modal
    window.location.href = CUSTOMER_WEB_PORTAL_URL;
    return (
      <div className="min-h-screen flex items-center justify-center p-4 admin-canvas">
        <div className="card-3d rounded-xl p-8 max-w-md text-center" style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
          <h1 className="text-xl font-bold text-white mb-2">Customer account</h1>
          <p className="text-gray-400 mb-4">Redirecting you to the Customer Web Portal…</p>
          <p className="text-sm text-gray-500">If nothing happens, <a href={CUSTOMER_WEB_PORTAL_URL} className="text-blue-400 underline">open it here</a>.</p>
        </div>
      </div>
    );
  }
  if (!INTERNAL_ALLOWED_ROLES.includes(user.role)) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (user) {
    if (user.role === 'ADMIN' || user.role === 'OWNER') return <Navigate to="/dashboard" replace />;
    if (user.role === 'CASHIER') return <Navigate to="/pos" replace />;
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
      <Route path="/dashboard/sales-chart" element={<ProtectedRoute roles={['ADMIN', 'OWNER']}><SalesChartFullPage /></ProtectedRoute>} />
      <Route path="/monitor" element={<ProtectedRoute roles={['ADMIN', 'OWNER']}><MonitorPage /></ProtectedRoute>} />
      <Route path="/fullscreen-monitor" element={<ProtectedRoute roles={['ADMIN', 'OWNER']}><FullscreenMonitorPage /></ProtectedRoute>} />
      <Route path="/store-analytics-monitor" element={<ProtectedRoute roles={['ADMIN', 'OWNER']}><StoreAnalyticsMonitorPage /></ProtectedRoute>} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<RoleDashboard />} />
        <Route path="products" element={<ProtectedRoute roles={['ADMIN', 'OWNER']}><ProductManagementPage /></ProtectedRoute>} />
        <Route path="inventory" element={<ProtectedRoute roles={['ADMIN', 'OWNER']}><InventoryPage /></ProtectedRoute>} />
        <Route path="pos" element={<ProtectedRoute roles={['CASHIER']}><POSPage /></ProtectedRoute>} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/approval" element={<ProtectedRoute roles={['CASHIER']}><OrderApprovalPage /></ProtectedRoute>} />
        <Route path="live-chat" element={<ProtectedRoute roles={['CASHIER', 'ADMIN', 'OWNER']}><LiveChatPage /></ProtectedRoute>} />
        <Route path="analytics" element={<ProtectedRoute roles={['ADMIN', 'OWNER']}><AnalyticsPage /></ProtectedRoute>} />
        <Route path="ai" element={<AIPage />} />
        <Route path="config" element={<ProtectedRoute roles={['ADMIN', 'OWNER']}><ConfigPage /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute roles={['ADMIN', 'OWNER']}><UsersPage /></ProtectedRoute>} />
        <Route path="notifications" element={<ProtectedRoute roles={['ADMIN', 'OWNER']}><NotificationsPage /></ProtectedRoute>} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RoleDashboard() {
  const { user } = useAuth();
  if (user?.role === 'ADMIN' || user?.role === 'OWNER') return <AdminDashboard />;
  if (user?.role === 'CASHIER') return <CashierDashboard />;
  return null;
}
