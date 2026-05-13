import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, KeyRound, Loader2, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  
  // For admins to pick a store
  const [availableStores, setAvailableStores] = useState<{id: string, name: string}[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');

  useEffect(() => {
    if (session && profile) {
      if (profile.role === 'store_operator' && profile.store_id) {
        // Auto navigate to POS
        localStorage.setItem('pos_store_id', profile.store_id);
        navigate('/pos');
      } else {
        // Fetch stores for admin to select
        fetchStoresForAdmin();
      }
    }
  }, [session, profile]);

  const fetchStoresForAdmin = async () => {
    let query = supabase.from('stores').select('id, name');
    // RLS handles filtering automatically!
    const { data } = await query;
    if (data) {
      setAvailableStores(data);
      if (data.length > 0) setSelectedStoreId(data[0].id);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleSelectStore = () => {
    if (!selectedStoreId) return;
    localStorage.setItem('pos_store_id', selectedStoreId);
    navigate('/pos');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-app)' }}>
      {/* Left side: Brand / Image */}
      <div style={{ flex: 1, background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', padding: '40px' }}>
        <Store size={80} style={{ marginBottom: '20px' }} />
        <h1 style={{ fontSize: '3rem', margin: '0 0 10px 0' }}>POS Edge</h1>
        <p style={{ fontSize: '1.2rem', opacity: 0.8, textAlign: 'center' }}>
          門店專用智能結帳終端<br/>高速・離線可用・自動同步
        </p>
      </div>

      {/* Right side: Login Form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          {!session ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ margin: '0 0 10px 0', fontSize: '2rem', color: 'var(--text-primary)' }}>員工登入</h2>
              <p style={{ margin: '0 0 20px 0', color: 'var(--text-secondary)' }}>請輸入您的門店帳號密碼</p>
              
              {error && (
                <div style={{ padding: '15px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  {error}
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Email / 帳號</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-sidebar)', color: 'var(--text-primary)', boxSizing: 'border-box' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>密碼</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-sidebar)', color: 'var(--text-primary)', boxSizing: 'border-box' }} 
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '15px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', marginTop: '10px' }}
              >
                {loading ? <Loader2 className="animate-spin" /> : <KeyRound />}
                登入系統
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center' }}>
              <div style={{ padding: '20px', background: 'var(--bg-sidebar)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h2 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)' }}>管理員身分確認</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>您目前以管理員 ({profile?.full_name || session.user.email}) 身分登入，請選擇要模擬操作的門店：</p>
                
                <select 
                  value={selectedStoreId} 
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', marginBottom: '20px' }}
                >
                  {availableStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>

                <button onClick={handleSelectStore} style={{ width: '100%', padding: '15px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px' }}>
                  進入門店系統
                </button>
                <button onClick={handleLogout} style={{ width: '100%', padding: '15px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <LogOut size={18} /> 切換帳號
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
