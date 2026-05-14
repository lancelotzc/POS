import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useThemeStore } from './store/themeStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminLayout from './components/layout/AdminLayout';
import HQ from './pages/HQ';
import Stores from './pages/Stores';
import Menu from './pages/Menu';
import Combos from './pages/Combos';
import Inventory from './pages/Inventory';
import Staff from './pages/Staff';
import Orders from './pages/Orders';
import './styles/theme.css';

function ProtectedRoute({ children, requireSuperAdmin = false }: { children: React.ReactNode, requireSuperAdmin?: boolean }) {
  const { session, loading, profile } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (requireSuperAdmin && profile?.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <AdminLayout>{children}</AdminLayout>;
}

function App() {
  const { theme } = useThemeStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Protected Routes wrapped in AdminLayout */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/hq" element={<ProtectedRoute requireSuperAdmin><HQ /></ProtectedRoute>} />
          <Route path="/stores" element={<ProtectedRoute><Stores /></ProtectedRoute>} />
          <Route path="/staff" element={<ProtectedRoute requireSuperAdmin><Staff /></ProtectedRoute>} />
          <Route path="/menu" element={<ProtectedRoute><Menu /></ProtectedRoute>} />
          <Route path="/combos" element={<ProtectedRoute><Combos /></ProtectedRoute>} />
          <Route path="/promotions" element={<ProtectedRoute><div>優惠折扣 (開發中...)</div></ProtectedRoute>} />
          <Route path="/members" element={<ProtectedRoute><div>會員管理 (開發中...)</div></ProtectedRoute>} />
          <Route path="/invoices" element={<ProtectedRoute><div>發票字軌 (開發中...)</div></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><div>報表中心 (開發中...)</div></ProtectedRoute>} />
          <Route path="/sync" element={<ProtectedRoute><div>同步監控 (開發中...)</div></ProtectedRoute>} />
          <Route path="/audit" element={<ProtectedRoute><div>操作紀錄 (開發中...)</div></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
