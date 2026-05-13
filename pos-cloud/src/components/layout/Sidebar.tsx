import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeStore } from '../../store/themeStore';
import { 
  LayoutDashboard, Building2, Store, UtensilsCrossed, 
  PackageOpen, Tag, Users, FileText, BarChart3, 
  Boxes, RefreshCw, ClipboardList, LogOut, Sun, Moon,
  Users2
} from 'lucide-react';
import '../../styles/layout.css';

export default function Sidebar() {
  const { signOut, user } = useAuth();
  const { theme, toggleTheme } = useThemeStore();

  const menuItems = [
    { path: '/dashboard', name: '儀表板', icon: <LayoutDashboard size={20} />, requireSuperAdmin: false },
    { path: '/hq', name: '商戶管理', icon: <Building2 size={20} />, requireSuperAdmin: true },
    { path: '/stores', name: '門店管理', icon: <Store size={20} />, requireSuperAdmin: false },
    { path: '/staff', name: '帳號與員工', icon: <Users2 size={20} />, requireSuperAdmin: false },
    { path: '/menu', name: '菜單管理', icon: <UtensilsCrossed size={20} />, requireSuperAdmin: false },
    { path: '/combos', name: '套餐加料', icon: <PackageOpen size={20} />, requireSuperAdmin: false },
    { path: '/promotions', name: '優惠折扣', icon: <Tag size={20} />, requireSuperAdmin: false },
    { path: '/members', name: '會員管理', icon: <Users size={20} />, requireSuperAdmin: false },
    { path: '/invoices', name: '發票字軌', icon: <FileText size={20} />, requireSuperAdmin: false },
    { path: '/inventory', name: '庫存管理', icon: <Boxes size={20} />, requireSuperAdmin: false },
    { path: '/reports', name: '報表中心', icon: <BarChart3 size={20} />, requireSuperAdmin: false },
    { path: '/sync', name: '同步監控', icon: <RefreshCw size={20} />, requireSuperAdmin: false },
    { path: '/audit', name: '操作紀錄', icon: <ClipboardList size={20} />, requireSuperAdmin: true },
  ];

  // TODO: Replace with actual role from Supabase profiles table
  const isSuperAdmin = true; // 暫時寫死為 true 以供開發測試

  const visibleMenuItems = menuItems.filter(item => !item.requireSuperAdmin || isSuperAdmin);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div>
          <h2>POS Cloud</h2>
          <span className="user-email">{user?.email}</span>
        </div>
        <button className="theme-toggle-btn" onClick={toggleTheme} title="切換深淺色主題">
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </div>
      
      <nav className="sidebar-nav">
        {visibleMenuItems.map((item) => (
          <NavLink 
            key={item.path} 
            to={item.path} 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            {item.icon}
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="logout-btn" onClick={signOut}>
          <LogOut size={20} />
          <span>登出系統</span>
        </button>
      </div>
    </aside>
  );
}
