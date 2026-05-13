import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, KeyRound, UserPlus, Shield, Trash2, X, Store as StoreIcon } from 'lucide-react';

interface Tenant { id: string; name: string; }
interface Store { id: string; name: string; tenant_id: string; }
interface Profile { id: string; full_name: string; role: string; tenant_id: string; store_id: string; email?: string; }
interface Employee { id: string; store_id: string; name: string; pin_code: string; role: string; }

export default function Staff() {
  const [activeTab, setActiveTab] = useState<'cloud' | 'edge'>('cloud');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  
  // Cloud Users
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [newCloudUser, setNewCloudUser] = useState({ email: '', password: '', full_name: '', role: 'tenant_admin', store_id: '' });
  
  // Edge Employees
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isEdgeModalOpen, setIsEdgeModalOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: '', pin_code: '', role: 'staff', store_id: '' });
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (selectedTenantId) {
      fetchStores();
      fetchProfiles();
      fetchEmployees();
    } else {
      setStores([]);
      setProfiles([]);
      setEmployees([]);
    }
  }, [selectedTenantId]);

  const fetchTenants = async () => {
    const { data } = await supabase.from('tenants').select('id, name');
    if (data) {
      setTenants(data);
      if (data.length > 0) setSelectedTenantId(data[0].id);
    }
  };

  const fetchStores = async () => {
    const { data } = await supabase.from('stores').select('id, name, tenant_id').eq('tenant_id', selectedTenantId);
    if (data) setStores(data);
  };

  const fetchProfiles = async () => {
    setLoading(true);
    // Note: We might not be able to get emails directly from auth.users without admin privileges. 
    // Usually, we'd need an RPC or edge function to list users. We'll fetch profiles for now.
    const { data } = await supabase.from('profiles').select('*').eq('tenant_id', selectedTenantId);
    if (data) setProfiles(data);
    setLoading(false);
  };

  const fetchEmployees = async () => {
    setLoading(true);
    // Get all store IDs for this tenant
    const { data: storeData } = await supabase.from('stores').select('id').eq('tenant_id', selectedTenantId);
    if (storeData && storeData.length > 0) {
      const storeIds = storeData.map(s => s.id);
      const { data } = await supabase.from('employees').select('*').in('store_id', storeIds);
      if (data) setEmployees(data);
    }
    setLoading(false);
  };

  const handleCreateCloudUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCloudUser.email || !newCloudUser.password) return;
    setSubmitting(true);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: newCloudUser.email,
          password: newCloudUser.password,
          role: newCloudUser.role,
          tenant_id: selectedTenantId,
          store_id: newCloudUser.store_id || null,
          full_name: newCloudUser.full_name
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create user');

      alert('雲端帳號建立成功！');
      setIsCloudModalOpen(false);
      setNewCloudUser({ email: '', password: '', full_name: '', role: 'tenant_admin', store_id: '' });
      fetchProfiles();
    } catch (error: any) {
      alert('建立失敗: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployee.store_id || !newEmployee.name || !newEmployee.pin_code) return;
    setSubmitting(true);

    const { error } = await supabase.from('employees').insert([{
      store_id: newEmployee.store_id,
      name: newEmployee.name,
      pin_code: newEmployee.pin_code,
      role: newEmployee.role
    }]);

    if (!error) {
      setIsEdgeModalOpen(false);
      setNewEmployee({ name: '', pin_code: '', role: 'staff', store_id: '' });
      fetchEmployees();
    } else {
      alert('建立失敗: ' + error.message);
    }
    setSubmitting(false);
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!window.confirm('確定要刪除這位員工嗎？')) return;
    await supabase.from('employees').delete().eq('id', id);
    fetchEmployees();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Users /> 帳號與員工管理
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>選擇操作商戶：</span>
          <select value={selectedTenantId} onChange={(e) => setSelectedTenantId(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', outline: 'none' }}>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <button onClick={() => setActiveTab('cloud')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', border: 'none', background: activeTab === 'cloud' ? 'var(--accent-color)' : 'transparent', color: activeTab === 'cloud' ? 'white' : 'var(--text-secondary)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}>
          <Shield size={18} /> 雲端後台帳號 (Email登入)
        </button>
        <button onClick={() => setActiveTab('edge')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', border: 'none', background: activeTab === 'edge' ? 'var(--accent-color)' : 'transparent', color: activeTab === 'edge' ? 'white' : 'var(--text-secondary)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}>
          <KeyRound size={18} /> 門店 POS 員工 (PIN碼登入)
        </button>
      </div>

      {activeTab === 'cloud' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <div style={{ color: 'var(--text-secondary)' }}>這些帳號可以登入這個雲端管理後台 (POS Cloud)。</div>
            <button onClick={() => setIsCloudModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--accent-color)', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
              <UserPlus size={16} /> 新增雲端帳號
            </button>
          </div>
          <div style={{ background: 'var(--bg-app)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
                <tr>
                  <th style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>姓名</th>
                  <th style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>權限角色</th>
                  <th style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>所屬門店限制</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>載入中...</td></tr> : 
                 profiles.length === 0 ? <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>無資料</td></tr> :
                 profiles.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '15px 20px', fontWeight: '500' }}>{p.full_name || '未設定'}</td>
                    <td style={{ padding: '15px 20px' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '12px', background: p.role === 'super_admin' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)', color: p.role === 'super_admin' ? '#ef4444' : '#3b82f6' }}>
                        {p.role === 'tenant_admin' ? '商戶管理員' : p.role === 'store_operator' ? '門店管理員' : '超級管理員'}
                      </span>
                    </td>
                    <td style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>
                      {p.store_id ? stores.find(s => s.id === p.store_id)?.name : '無限制 (全品牌)'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'edge' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <div style={{ color: 'var(--text-secondary)' }}>這些員工只能在 iPad 或收銀機上輸入 PIN 碼登入，無法登入雲端後台。</div>
            <button onClick={() => setIsEdgeModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--accent-color)', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
              <UserPlus size={16} /> 新增門店員工
            </button>
          </div>
          <div style={{ background: 'var(--bg-app)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
                <tr>
                  <th style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>所屬門店</th>
                  <th style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>員工姓名</th>
                  <th style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>PIN 解鎖碼</th>
                  <th style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>角色</th>
                  <th style={{ padding: '15px 20px', textAlign: 'right', color: 'var(--text-secondary)' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>載入中...</td></tr> : 
                 employees.length === 0 ? <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>無資料</td></tr> :
                 employees.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '15px 20px', fontWeight: '500' }}><StoreIcon size={14} style={{ marginRight: 5, verticalAlign: 'middle', color: 'var(--text-secondary)' }} />{stores.find(s => s.id === e.store_id)?.name}</td>
                    <td style={{ padding: '15px 20px', fontWeight: 'bold' }}>{e.name}</td>
                    <td style={{ padding: '15px 20px' }}><code style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', padding: '4px 8px', borderRadius: '6px', fontSize: '16px', letterSpacing: '2px' }}>{e.pin_code}</code></td>
                    <td style={{ padding: '15px 20px' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '12px', background: 'var(--sidebar-hover-bg)', color: 'var(--text-secondary)' }}>
                        {e.role === 'manager' ? '門店主管' : '一般員工'}
                      </span>
                    </td>
                    <td style={{ padding: '15px 20px', textAlign: 'right' }}>
                      <button onClick={() => handleDeleteEmployee(e.id)} style={{ background: 'var(--danger-bg)', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '8px', borderRadius: '6px' }}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {isCloudModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-sidebar)', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>建立雲端管理帳號</h2>
              <button onClick={() => setIsCloudModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateCloudUser}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>登入 Email</label>
                <input required type="email" value={newCloudUser.email} onChange={e => setNewCloudUser({...newCloudUser, email: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>密碼 (最少6位)</label>
                <input required type="text" minLength={6} value={newCloudUser.password} onChange={e => setNewCloudUser({...newCloudUser, password: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>姓名 / 稱呼</label>
                <input required type="text" value={newCloudUser.full_name} onChange={e => setNewCloudUser({...newCloudUser, full_name: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>權限角色</label>
                <select value={newCloudUser.role} onChange={e => setNewCloudUser({...newCloudUser, role: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                  <option value="tenant_admin">商戶管理員 (管理整個品牌)</option>
                  <option value="store_operator">門店管理員 (僅管理單一門店)</option>
                </select>
              </div>
              {newCloudUser.role === 'store_operator' && (
                <div style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>限制管理門店</label>
                  <select required value={newCloudUser.store_id} onChange={e => setNewCloudUser({...newCloudUser, store_id: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                    <option value="">-- 請選擇門店 --</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsCloudModalOpen(false)} style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>取消</button>
                <button type="submit" disabled={submitting} style={{ padding: '10px 15px', borderRadius: '6px', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer' }}>{submitting ? '建立中...' : '確認建立'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEdgeModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-sidebar)', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>新增門店員工 (PIN解鎖)</h2>
              <button onClick={() => setIsEdgeModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateEmployee}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>所屬門店</label>
                <select required value={newEmployee.store_id} onChange={e => setNewEmployee({...newEmployee, store_id: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                  <option value="">-- 請選擇門店 --</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>員工姓名</label>
                <input required type="text" value={newEmployee.name} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} placeholder="例如：王小明" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>PIN 解鎖碼 (4-6位數字)</label>
                <input required type="text" pattern="[0-9]{4,6}" maxLength={6} value={newEmployee.pin_code} onChange={e => setNewEmployee({...newEmployee, pin_code: e.target.value})} placeholder="例如：1234" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box', letterSpacing: '2px', fontFamily: 'monospace' }} />
              </div>
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>員工角色</label>
                <select value={newEmployee.role} onChange={e => setNewEmployee({...newEmployee, role: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                  <option value="staff">一般員工 (僅能結帳)</option>
                  <option value="manager">門店主管 (可授權退款/作廢)</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsEdgeModalOpen(false)} style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>取消</button>
                <button type="submit" disabled={submitting} style={{ padding: '10px 15px', borderRadius: '6px', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer' }}>{submitting ? '建立中...' : '確認建立'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
