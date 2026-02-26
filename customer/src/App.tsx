import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Login from './pages/Login';
import Register from './pages/Register';
import CustomerLayout from './layouts/CustomerLayout';
import Dashboard from './pages/Dashboard';
import Browse from './pages/Browse';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Orders from './pages/Orders';
import Assistant from './pages/Assistant';
import Profile from './pages/Profile';

const ADMIN_PANEL_URL = 'http://localhost:5173';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'CUSTOMER') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/50 p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Administrative account</h1>
          <p className="text-slate-600 mb-6">You are logged in as <strong>{user.role}</strong>. Use the Internal Administrative Panel for inventory, POS, and reports.</p>
          <a href={ADMIN_PANEL_URL} className="btn-store">Open Internal Administrative Panel</a>
          <p className="text-xs text-slate-400 mt-4">{ADMIN_PANEL_URL}</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (user && user.role === 'CUSTOMER') return <Navigate to="/" replace />;
  if (user && user.role !== 'CUSTOMER') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/" element={<ProtectedRoute><CartProvider><CustomerLayout /></CartProvider></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="browse" element={<Browse />} />
        <Route path="product/:id" element={<ProductDetail />} />
        <Route path="cart" element={<Cart />} />
        <Route path="orders" element={<Orders />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
