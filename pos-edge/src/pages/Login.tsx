import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ArrowRight, Loader2, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  
  const [availableTenants, setAvailableTenants] = useState<{id: string, name: string}[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [availableStores, setAvailableStores] = useState<{id: string, name: string}[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');

  useEffect(() => {
    if (session && profile) {
      const savedStoreId = localStorage.getItem('pos_store_id');
      if (savedStoreId) {
        navigate('/pos');
        return;
      }

      if (profile.role === 'store_operator' && profile.store_id) {
        localStorage.setItem('pos_store_id', profile.store_id);
        navigate('/pos');
      } else {
        fetchDataForAdmin(profile.role);
      }
    }
  }, [session, profile]);

  const fetchDataForAdmin = async (role: string) => {
    if (role === 'super_admin') {
      const { data: tenants } = await supabase.from('tenants').select('id, name');
      if (tenants && tenants.length > 0) {
        setAvailableTenants(tenants);
        setSelectedTenantId(tenants[0].id);
        fetchStores(tenants[0].id);
      }
    } else if (role === 'tenant_admin') {
      fetchStores();
    }
  };

  const fetchStores = async (tenantId?: string) => {
    let query = supabase.from('stores').select('id, name');
    if (tenantId) query = query.eq('tenant_id', tenantId);
    
    const { data: stores } = await query;
    if (stores) {
      setAvailableStores(stores);
      if (stores.length > 0) {
        setSelectedStoreId(stores[0].id);
      } else {
        setSelectedStoreId('');
      }
    }
  };

  useEffect(() => {
    if (profile?.role === 'super_admin' && selectedTenantId) {
      fetchStores(selectedTenantId);
    }
  }, [selectedTenantId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError('帳號或密碼錯誤');
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
    <div style={{ 
      display: 'flex', 
      minHeight: '100vh', 
      background: 'var(--bg-app)', 
      backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(59,130,246,0.1) 0%, transparent 50%)',
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '20px',
      fontFamily: "'Inter', sans-serif"
    }}>
      
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'var(--bg-sidebar)',
        borderRadius: '24px',
        padding: '40px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        
        {/* Logo Area */}
        <div style={{
          width: '64px',
          height: '64px',
          background: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
          color: '#3b82f6'
        }}>
          <Store size={32} />
        </div>
        
        <h1 style={{ fontSize: '1.75rem', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
          TWPOS
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 32px 0', fontSize: '0.95rem' }}>
          請登入以開始您的作業
        </p>

        <div style={{ width: '100%' }}>
          {!session ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {error && (
                <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.9rem', textAlign: 'center' }}>
                  {error}
                </div>
              )}

              <div>
                <input 
                  type="email" 
                  placeholder="帳號 (Email)"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' }} 
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                />
              </div>

              <div>
                <input 
                  type="password" 
                  placeholder="密碼"
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' }} 
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '16px', background: 'var(--text-primary)', color: 'var(--bg-app)', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', transition: 'opacity 0.2s', marginTop: '8px' }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : '登入'}
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
              <div style={{ padding: '24px', background: 'var(--bg-app)', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', color: '#3b82f6', fontSize: '1.2rem', fontWeight: 'bold' }}>
                  {profile?.full_name?.charAt(0).toUpperCase() || profile?.email?.charAt(0).toUpperCase()}
                </div>
                <h2 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{profile?.full_name || session.user.email}</h2>
                <p style={{ color: 'var(--text-secondary)', margin: '0 0 24px 0', fontSize: '0.85rem' }}>請選擇要登入的門店</p>
                
                {profile?.role === 'super_admin' && (
                  <select 
                    value={selectedTenantId} 
                    onChange={(e) => setSelectedTenantId(e.target.value)}
                    style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-sidebar)', color: 'var(--text-primary)', marginBottom: '12px', outline: 'none' }}
                  >
                    {availableTenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}

                <select 
                  value={selectedStoreId} 
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  disabled={availableStores.length === 0}
                  style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-sidebar)', color: 'var(--text-primary)', marginBottom: '24px', opacity: availableStores.length === 0 ? 0.5 : 1, outline: 'none' }}
                >
                  {availableStores.length > 0 
                    ? availableStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                    : <option value="">無門店資料</option>
                  }
                </select>

                <button onClick={handleSelectStore} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '500', cursor: 'pointer', marginBottom: '12px' }}>
                  進入系統 <ArrowRight size={18} />
                </button>
                <button onClick={handleLogout} style={{ width: '100%', padding: '14px', background: 'transparent', color: 'var(--text-secondary)', border: 'none', borderRadius: '10px', fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <LogOut size={16} /> 改用其他帳號
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Subtle footer */}
      <div style={{ position: 'absolute', bottom: '20px', color: 'var(--text-secondary)', fontSize: '0.8rem', opacity: 0.6 }}>
        TWPOS Edge Terminal v1.0.0
      </div>
    </div>
  );
}
