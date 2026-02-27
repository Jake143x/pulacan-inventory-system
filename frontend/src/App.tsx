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

const CUSTOMER_WEB_PORTAL_URL = 'http://localhost:5174';

const INTERNAL_ALLOWED_ROLES = ['ADMIN', 'OWNER', 'CASHIER'];

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'CUSTOMER') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 admin-canvas">
        <div className="card-3d rounded-xl p-8 max-w-md text-center" style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
          <h1 className="text-xl font-bold text-white mb-2">Customer account</h1>
          <p className="text-gray-400 mb-4">You are logged in as <strong>Customer</strong>. Use the Customer Web Portal to browse and place orders.</p>
          <a href={CUSTOMER_WEB_PORTAL_URL} className="inline-block px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-200">Open Customer Web Portal</a>
          <p className="text-sm text-gray-500 mt-4">{CUSTOMER_WEB_PORTAL_URL}</p>
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
