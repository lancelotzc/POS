import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, RefreshCw, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { db, initDb } from '../lib/db';

export default function POS() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('載入中...');
  const [syncing, setSyncing] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const id = localStorage.getItem('pos_store_id');
    if (!id) {
      navigate('/login');
      return;
    }
    setStoreId(id);
    
    // Check license and sync on mount
    validateAndSync(id);
  }, [navigate]);

  const validateAndSync = async (id: string) => {
    setSyncing(true);
    try {
      // 1. Check license online
      const { data: store, error } = await supabase
        .from('stores')
        .select('name, license_status')
        .eq('id', id)
        .single();
      
      if (error || !store) throw new Error('Store not found or offline');
      
      setStoreName(store.name);

      if (store.license_status !== 'active') {
        setLocked(true);
        setSyncing(false);
        return;
      }
      
      // Update last validation time
      localStorage.setItem('pos_last_validation', Date.now().toString());
      setLocked(false);

      // 2. Initialize local SQLite
      await initDb();
      
      // 3. TODO: Fetch categories, products from Supabase and INSERT INTO SQLite
      // ...
      
    } catch (e) {
      console.error('Validation/Sync failed, falling back to offline mode', e);
      // Check offline grace period
      const lastValidation = parseInt(localStorage.getItem('pos_last_validation') || '0');
      const hoursSinceValidation = (Date.now() - lastValidation) / (1000 * 60 * 60);
      
      if (hoursSinceValidation > 24) {
        setLocked(true); // Grace period expired
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('pos_store_id');
    await supabase.auth.signOut();
  };

  if (locked) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111827', color: 'white' }}>
        <Lock size={64} color="#ef4444" style={{ marginBottom: '20px' }} />
        <h1 style={{ fontSize: '2rem', color: '#ef4444' }}>系統已鎖定 / 授權終止</h1>
        <p style={{ marginTop: '10px', color: '#9ca3af', maxWidth: '400px', textAlign: 'center' }}>
          此設備的授權已被雲端終止，或已超過離線寬限期 (24小時未連網)。請確保設備已連上網路並重新驗證授權。
        </p>
        <button onClick={() => storeId && validateAndSync(storeId)} style={{ marginTop: '20px', padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <RefreshCw size={16} /> 重新連網驗證
        </button>
        <button onClick={handleLogout} style={{ marginTop: '10px', padding: '10px 20px', background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer' }}>
          切換帳號 / 登出
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      {/* Header */}
      <header style={{ height: '60px', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem' }}>POS Edge</h2>
          <span style={{ padding: '4px 8px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold' }}>
            {storeName}
          </span>
          {syncing && <span style={{ color: '#f59e0b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}><RefreshCw size={14} className="animate-spin" /> 同步中...</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {profile?.full_name || profile?.email}
          </div>
          <button onClick={handleLogout} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <LogOut size={18} /> 登出
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex' }}>
        <div style={{ flex: 2, padding: '20px', borderRight: '1px solid var(--border-color)', overflowY: 'auto' }}>
          <h3 style={{ color: 'var(--text-primary)' }}>商品與分類 (開發中)</h3>
          <p style={{ color: 'var(--text-secondary)' }}>本地資料庫已就緒，即將串接點餐邏輯...</p>
        </div>
        <div style={{ flex: 1, padding: '20px', background: 'var(--bg-sidebar)', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ color: 'var(--text-primary)' }}>購物車</h3>
          <div style={{ flex: 1 }}></div>
          <button style={{ width: '100%', padding: '20px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.5rem', fontWeight: 'bold', cursor: 'pointer' }}>
            結帳 $0
          </button>
        </div>
      </div>
    </div>
  );
}
