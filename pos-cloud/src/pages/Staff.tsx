import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, UserPlus, X, Edit2, Trash2, Search } from 'lucide-react';

interface Tenant { id: string; name: string; }
interface Store { id: string; name: string; tenant_id: string; }
interface Profile { id: string; full_name: string; role: string; tenant_id: string; store_id: string; email?: string; }

export default function Staff() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  
  // Cloud Users
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTenantId, setFilterTenantId] = useState('');
  const [filterStoreId, setFilterStoreId] = useState('');
  
  // Create Modal
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [newCloudUser, setNewCloudUser] = useState({ email: '', password: '', full_name: '', role: 'tenant_admin', store_id: '', tenant_id: '' });
  
  // Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState({ id: '', email: '', password: '', full_name: '', role: 'tenant_admin', store_id: '', tenant_id: '' });

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTenants();
    fetchStores();
    fetchProfiles();
  }, []);

  const fetchTenants = async () => {
    const { data } = await supabase.from('tenants').select('id, name');
    if (data) {
      setTenants(data);
    }
  };

  const fetchStores = async () => {
    // We should fetch all stores if we are a super_admin editing across tenants, but for now fetch the selected one
    const { data } = await supabase.from('stores').select('id, name, tenant_id');
    if (data) setStores(data);
  };

  const fetchProfiles = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*');
    if (data) setProfiles(data);
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
          tenant_id: newCloudUser.role === 'super_admin' ? null : newCloudUser.tenant_id,
          store_id: newCloudUser.role === 'store_operator' ? newCloudUser.store_id : null,
          full_name: newCloudUser.full_name
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create user');

      alert('雲端帳號建立成功！');
      setIsCloudModalOpen(false);
      setNewCloudUser({ email: '', password: '', full_name: '', role: 'tenant_admin', store_id: '', tenant_id: '' });
      fetchProfiles();
    } catch (error: any) {
      alert('建立失敗: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCloudUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'update',
          target_user_id: editingUser.id,
          password: editingUser.password, // Optional
          role: editingUser.role,
          tenant_id: editingUser.role === 'super_admin' ? null : editingUser.tenant_id,
          store_id: editingUser.role === 'store_operator' ? editingUser.store_id : null,
          full_name: editingUser.full_name
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update user');

      alert('雲端帳號更新成功！');
      setIsEditModalOpen(false);
      fetchProfiles();
    } catch (error: any) {
      alert('更新失敗: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCloudUser = async (id: string, email: string) => {
    if (!window.confirm(`確定要徹底刪除帳號 ${email || id} 嗎？此動作無法復原。`)) return;
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'delete',
          target_user_id: id
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to delete user');

      alert('帳號已刪除');
      fetchProfiles();
    } catch (error: any) {
      alert('刪除失敗: ' + error.message);
    }
  };

  const filteredProfiles = profiles.filter(p => {
    const searchLower = searchTerm.toLowerCase();
    const tenantName = p.tenant_id ? tenants.find(t => t.id === p.tenant_id)?.name || '' : '無限制';
    const storeName = p.store_id ? stores.find(s => s.id === p.store_id)?.name || '' : '全品牌';
    const email = p.email || '';
    const name = p.full_name || '';
    
    const matchesSearch = name.toLowerCase().includes(searchLower) || 
                          email.toLowerCase().includes(searchLower) ||
                          tenantName.toLowerCase().includes(searchLower) ||
                          storeName.toLowerCase().includes(searchLower);
                          
    const matchesTenant = filterTenantId ? p.tenant_id === filterTenantId : true;
    const matchesStore = filterStoreId ? p.store_id === filterStoreId : true;

    return matchesSearch && matchesTenant && matchesStore;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Users /> 雲端帳號管理
        </h1>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '250px' }}>
              <Search size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
              <input 
                type="text" 
                placeholder="搜尋姓名、Email、商戶或門店..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
              />
            </div>
            <select value={filterTenantId} onChange={(e) => { setFilterTenantId(e.target.value); setFilterStoreId(''); }} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', outline: 'none' }}>
              <option value="">所有商戶</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={filterStoreId} onChange={(e) => setFilterStoreId(e.target.value)} disabled={!filterTenantId} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', outline: 'none', opacity: filterTenantId ? 1 : 0.5 }}>
              <option value="">所有門店</option>
              {stores.filter(s => s.tenant_id === filterTenantId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button onClick={() => setIsCloudModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--accent-color)', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
            <UserPlus size={16} /> 新增雲端帳號
          </button>
        </div>
        <div style={{ background: 'var(--bg-app)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                <th style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>姓名</th>
                <th style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>Email</th>
                <th style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>權限角色</th>
                <th style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>目標商戶 / 門店限制</th>
                <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>載入中...</td></tr> : 
               filteredProfiles.length === 0 ? <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>無符合的帳號資料</td></tr> :
               filteredProfiles.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '15px 20px', fontWeight: '500' }}>{p.full_name || '未設定'}</td>
                  <td style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>{p.email || '-'}</td>
                  <td style={{ padding: '15px 20px' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '12px', background: p.role === 'super_admin' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)', color: p.role === 'super_admin' ? '#ef4444' : '#3b82f6' }}>
                      {p.role === 'tenant_admin' ? '商戶管理員' : p.role === 'store_operator' ? '門店管理員' : 'POS商總管理員'}
                    </span>
                  </td>
                  <td style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>
                    <div>{p.tenant_id ? tenants.find(t => t.id === p.tenant_id)?.name : '無限制 (全品牌)'}</div>
                    <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>
                      {p.role === 'store_operator' && p.store_id ? `📍 ${stores.find(s => s.id === p.store_id)?.name}` : ''}
                    </div>
                  </td>
                  <td style={{ padding: '15px 20px', textAlign: 'right' }}>
                    <button 
                      onClick={() => {
                        setEditingUser({
                          id: p.id,
                          email: p.email || '',
                          password: '',
                          full_name: p.full_name || '',
                          role: p.role,
                          tenant_id: p.tenant_id || '',
                          store_id: p.store_id || ''
                        });
                        setIsEditModalOpen(true);
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '5px' }}>
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeleteCloudUser(p.id, p.email || p.full_name)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '5px', marginLeft: '10px' }}>
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      {isCloudModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-sidebar)', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
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
                  <option value="tenant_admin">商戶管理員 (管理單一品牌)</option>
                  <option value="store_operator">門店管理員 (管理單一門店)</option>
                  <option value="super_admin">POS商總管理員 (可看和異動所有資料)</option>
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>目標商戶</label>
                {newCloudUser.role === 'super_admin' ? (
                  <input type="text" readOnly value="無限制 (全品牌)" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-sidebar)', color: 'var(--text-secondary)', boxSizing: 'border-box', cursor: 'not-allowed' }} disabled />
                ) : (
                  <select required value={newCloudUser.tenant_id || ''} onChange={e => setNewCloudUser({...newCloudUser, tenant_id: e.target.value, store_id: ''})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                    <option value="">-- 請選擇商戶 --</option>
                    {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
              </div>
              {newCloudUser.role === 'store_operator' && (
                <div style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>限制管理門店</label>
                  <select required value={newCloudUser.store_id} onChange={e => setNewCloudUser({...newCloudUser, store_id: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                    <option value="">-- 請選擇門店 --</option>
                    {stores.filter(s => s.tenant_id === newCloudUser.tenant_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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

      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-sidebar)', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>編輯雲端管理帳號</h2>
              <button onClick={() => setIsEditModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdateCloudUser}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>登入 Email (無法修改)</label>
                <input type="email" value={editingUser.email} readOnly style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-sidebar)', color: 'var(--text-secondary)', boxSizing: 'border-box', cursor: 'not-allowed' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>新密碼 (若不修改請留白)</label>
                <input type="text" minLength={6} value={editingUser.password} onChange={e => setEditingUser({...editingUser, password: e.target.value})} placeholder="******" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>姓名 / 稱呼</label>
                <input required type="text" value={editingUser.full_name} onChange={e => setEditingUser({...editingUser, full_name: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>權限角色</label>
                <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                  <option value="tenant_admin">商戶管理員 (管理單一品牌)</option>
                  <option value="store_operator">門店管理員 (管理單一門店)</option>
                  <option value="super_admin">POS商總管理員 (可看和異動所有資料)</option>
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>目標商戶</label>
                {editingUser.role === 'super_admin' ? (
                  <input type="text" readOnly value="無限制 (全品牌)" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-sidebar)', color: 'var(--text-secondary)', boxSizing: 'border-box', cursor: 'not-allowed' }} disabled />
                ) : (
                  <select required value={editingUser.tenant_id} onChange={e => setEditingUser({...editingUser, tenant_id: e.target.value, store_id: ''})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                    <option value="">-- 請選擇商戶 --</option>
                    {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
              </div>
              {editingUser.role === 'store_operator' && (
                <div style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>限制管理門店</label>
                  <select required value={editingUser.store_id} onChange={e => setEditingUser({...editingUser, store_id: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                    <option value="">-- 請選擇門店 --</option>
                    {stores.filter(s => s.tenant_id === editingUser.tenant_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>取消</button>
                <button type="submit" disabled={submitting} style={{ padding: '10px 15px', borderRadius: '6px', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer' }}>{submitting ? '儲存中...' : '儲存變更'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
