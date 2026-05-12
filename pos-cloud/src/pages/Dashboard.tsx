import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 style={{ marginTop: 0, color: '#333' }}>儀表板 (Dashboard)</h1>
      <p style={{ color: '#666' }}>
        歡迎登入 POS Cloud 總管理後台！<br /><br />
        系統已成功與 Supabase 連線，您的使用者 ID 為：<br />
        <strong>{user?.id}</strong>
      </p>
      
      <div style={{ marginTop: '40px', padding: '20px', background: '#e6f7ff', borderLeft: '4px solid #1890ff', borderRadius: '4px' }}>
        <h3 style={{ marginTop: 0, color: '#0050b3' }}>系統開發狀態</h3>
        <p style={{ margin: 0, color: '#0050b3' }}>
          目前已完成 Phase 3：登入模組與全局路由架構建立。<br />
          您可以點擊左側導覽列預覽未來的 14 項核心管理模組。
        </p>
      </div>
    </div>
  );
}
