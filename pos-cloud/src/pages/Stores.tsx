import { useState, useEffect } from 'react';
import { Store, Plus, Power, Edit2, X, Clock, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface StoreData {
  id: string;
  name: string;
  store_code: string;
  is_active: boolean;
  tenant_id: string;
  created_at: string;
  valid_until?: string | null;
  enable_inventory: boolean;
  mode: 'fnb' | 'retail' | 'mixed';
  tenants?: { name: string; enable_inventory: boolean };
}

import { useAuth } from '../contexts/AuthContext';

export default function Stores() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const [stores, setStores] = useState<StoreData[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [tenantsList, setTenantsList] = useState<{id: string, name: string, enable_inventory: boolean}[]>([]);
  
  const [newStore, setNewStore] = useState<{name: string, store_code: string, tenant_id: string, valid_until: string, enable_inventory: boolean, mode: 'fnb' | 'retail' | 'mixed'}>({ name: '', store_code: '', tenant_id: '', valid_until: '', enable_inventory: false, mode: 'fnb' });
  const [editingStore, setEditingStore] = useState<Partial<StoreData> & { valid_until_input?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchStores();
    fetchTenantsForDropdown();
  }, []);

  const fetchStores = async () => {
    const { data, error } = await supabase
      .from('stores')
      .select('*, tenants(name, enable_inventory)')
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      setStores(data);
    }
    setLoading(false);
  };

  const fetchTenantsForDropdown = async () => {
    const { data } = await supabase.from('tenants').select('id, name, enable_inventory');
    if (data) setTenantsList(data);
  };

  const toggleLicense = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('stores').update({ is_active: !currentStatus }).eq('id', id);
    if (!error) {
      fetchStores();
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStore.name || !newStore.store_code || !newStore.tenant_id) return;
    
    setIsSubmitting(true);
    // Convert YYYY-MM-DD to full ISO string, set time to end of day
    const validDate = newStore.valid_until ? new Date(`${newStore.valid_until}T23:59:59`).toISOString() : null;
    
    const { error } = await supabase.from('stores').insert([{ 
      name: newStore.name,
      store_code: newStore.store_code,
      tenant_id: newStore.tenant_id,
      valid_until: validDate,
      enable_inventory: newStore.enable_inventory,
      mode: newStore.mode
    }]);
    
    setIsSubmitting(false);
    
    if (!error) {
      setIsModalOpen(false);
      setNewStore({ name: '', store_code: '', tenant_id: '', valid_until: '', enable_inventory: false, mode: 'fnb' });
      fetchStores();
    } else {
      alert('新增失敗：' + error.message);
    }
  };

  const openEditModal = (store: StoreData) => {
    let formattedDate = '';
    if (store.valid_until) {
      // YYYY-MM-DD string for HTML5 date input
      formattedDate = new Date(store.valid_until).toISOString().slice(0, 10);
    }
    setEditingStore({ ...store, valid_until_input: formattedDate });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore.id) return;
    
    setIsSubmitting(true);
    const validDate = editingStore.valid_until_input ? new Date(`${editingStore.valid_until_input}T23:59:59`).toISOString() : null;
    
    const { error } = await supabase.from('stores').update({ 
      name: editingStore.name,
      store_code: editingStore.store_code,
      tenant_id: editingStore.tenant_id,
      valid_until: validDate,
      enable_inventory: editingStore.enable_inventory,
      mode: editingStore.mode
    }).eq('id', editingStore.id);
    
    setIsSubmitting(false);
    
    if (!error) {
      setIsEditModalOpen(false);
      fetchStores();
    } else {
      alert('更新失敗：' + error.message);
    }
  };

  const getStatusDisplay = (isActive: boolean, validUntil?: string | null) => {
    const now = new Date();
    if (validUntil && new Date(validUntil) < now) {
      return { label: '已過期 (Expired)', color: 'var(--danger-color)', bg: 'var(--danger-bg)' };
    }
    if (!isActive) {
      return { label: '已停權 (Disabled)', color: 'var(--text-secondary)', bg: 'var(--border-color)' };
    }
    return { label: '已啟用 (Active)', color: '#16a34a', bg: 'rgba(34, 197, 94, 0.15)' };
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Store /> 門店管理與授權
        </h1>
        {isSuperAdmin && (
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--accent-color)', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}
          >
            <Plus size={16} /> 新增門店
          </button>
        )}
      </div>

      <div style={{ background: 'var(--bg-app)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
            <tr>
              {isSuperAdmin && <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>所屬商戶</th>}
              <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>門店代號</th>
              <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>門店名稱</th>
              <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>業務模式</th>
              <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>啟用模組</th>
              <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>授權狀態 (License)</th>
              <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>有效期限</th>
              {isSuperAdmin && <th style={{ padding: '15px 20px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: '500' }}>操作</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>載入中...</td></tr>
            ) : stores.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>尚無門店資料</td></tr>
            ) : (
              stores.map(s => {
                const status = getStatusDisplay(s.is_active, s.valid_until);
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {isSuperAdmin && <td style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>{s.tenants?.name || '-'}</td>}
                    <td style={{ padding: '15px 20px', fontWeight: 'bold' }}>{s.store_code}</td>
                    <td style={{ padding: '15px 20px' }}>{s.name}</td>
                    <td style={{ padding: '15px 20px' }}>
                      <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '500', background: s.mode === 'retail' ? 'rgba(139, 92, 246, 0.1)' : s.mode === 'mixed' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(236, 72, 153, 0.1)', color: s.mode === 'retail' ? '#8b5cf6' : s.mode === 'mixed' ? '#d97706' : '#ec4899', border: `1px solid ${s.mode === 'retail' ? 'rgba(139, 92, 246, 0.2)' : s.mode === 'mixed' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(236, 72, 153, 0.2)'}` }}>
                        {s.mode === 'fnb' ? '🍔 純餐飲' : s.mode === 'retail' ? '🛍️ 純零售' : '🔄 複合式 (餐飲+零售)'}
                      </span>
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      {s.enable_inventory && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '500', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                          📦 庫存
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', background: status.bg, color: status.color }}>
                        {status.label}
                      </span>
                    </td>
                    <td style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                      {s.valid_until ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Clock size={14} />
                          {new Date(s.valid_until).toLocaleDateString()}
                        </div>
                      ) : '永久有效'}
                    </td>
                    {isSuperAdmin && (
                      <td style={{ padding: '15px 20px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button onClick={() => toggleLicense(s.id, s.is_active)} title={s.is_active ? '停權此門店' : '啟用此門店'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: s.is_active ? 'var(--danger-bg)' : 'rgba(34, 197, 94, 0.1)', border: 'none', color: s.is_active ? 'var(--danger-color)' : '#16a34a', cursor: 'pointer', padding: '8px', borderRadius: '6px', transition: 'all 0.2s' }}>
                          <Power size={16} />
                        </button>
                        <button onClick={() => openEditModal(s)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sidebar-hover-bg)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px', borderRadius: '6px', transition: 'all 0.2s' }}>
                          <Edit2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Store Modal */}
      {isEditModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-sidebar)', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>編輯門店資料</h2>
              <button onClick={() => setIsEditModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleUpdate}>
              
              {/* 顯示建立日期 */}
              <div style={{ marginBottom: '15px', padding: '10px', background: 'var(--bg-app)', borderRadius: '6px', border: '1px dashed var(--border-color)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>門店建立日期 (Establishment Date)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', fontWeight: '500' }}>
                  <Calendar size={14} color="var(--accent-color)"/>
                  {editingStore.created_at ? new Date(editingStore.created_at).toLocaleString() : '未知'}
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>選擇所屬商戶</label>
                <select required value={editingStore.tenant_id || ''} onChange={(e) => setEditingStore({...editingStore, tenant_id: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                  <option value="">-- 請選擇商戶 --</option>
                  {tenantsList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>門店代號</label>
                <input required type="text" value={editingStore.store_code || ''} onChange={(e) => setEditingStore({...editingStore, store_code: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>門店名稱</label>
                <input required type="text" value={editingStore.name || ''} onChange={(e) => setEditingStore({...editingStore, name: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>業務模式 (Business Mode)</label>
                <select value={editingStore.mode || 'fnb'} onChange={(e) => setEditingStore({...editingStore, mode: e.target.value as any})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                  <option value="fnb">🍔 純餐飲 (Food & Beverage)</option>
                  <option value="retail">🛍️ 純零售 (Retail)</option>
                  <option value="mixed">🔄 複合式 (餐飲 + 零售)</option>
                </select>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>有效期限 (到期自動停權)</label>
                {/* 改用 type="date" */}
                <input type="date" value={editingStore.valid_until_input || ''} onChange={(e) => setEditingStore({...editingStore, valid_until_input: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>

              {(() => {
                const parentTenant = tenantsList.find(t => t.id === editingStore.tenant_id);
                const tenantHasInventory = parentTenant?.enable_inventory;
                return (
                  <div style={{ marginBottom: '25px', padding: '15px', background: tenantHasInventory ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-app)', borderRadius: '8px', border: tenantHasInventory ? '1px solid rgba(59, 130, 246, 0.2)' : '1px dashed var(--border-color)', opacity: tenantHasInventory ? 1 : 0.6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: tenantHasInventory ? 'pointer' : 'not-allowed' }}>
                      <input 
                        type="checkbox" 
                        disabled={!tenantHasInventory}
                        checked={editingStore.enable_inventory || false} 
                        onChange={(e) => setEditingStore({...editingStore, enable_inventory: e.target.checked})} 
                        style={{ width: '18px', height: '18px', accentColor: '#3b82f6' }} 
                      />
                      <span style={{ fontSize: '15px', fontWeight: '500', color: 'var(--text-primary)' }}>📦 啟用此門店的「庫存管理」功能</span>
                    </label>
                    <div style={{ fontSize: '12px', color: tenantHasInventory ? 'var(--text-secondary)' : 'var(--danger-color)', marginLeft: '28px', marginTop: '4px' }}>
                      {tenantHasInventory ? '允許此門店使用庫存扣減與配方功能。' : '⚠️ 上層商戶未購買/開通庫存模組，門店無法啟用。'}
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>取消</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '10px 15px', borderRadius: '6px', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer' }}>{isSubmitting ? '處理中...' : '儲存變更'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 新增門店 Modal (同樣修改 type="date") */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-sidebar)', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>建立新門店</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>選擇所屬商戶</label>
                <select required value={newStore.tenant_id} onChange={(e) => setNewStore({...newStore, tenant_id: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                  <option value="">-- 請選擇商戶 --</option>
                  {tenantsList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>門店代號 (不可重複)</label>
                <input required type="text" value={newStore.store_code} onChange={(e) => setNewStore({...newStore, store_code: e.target.value})} placeholder="例如：M01" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>門店名稱</label>
                <input required type="text" value={newStore.name} onChange={(e) => setNewStore({...newStore, name: e.target.value})} placeholder="例如：台北復興店" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>業務模式 (Business Mode)</label>
                <select value={newStore.mode} onChange={(e) => setNewStore({...newStore, mode: e.target.value as any})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                  <option value="fnb">🍔 純餐飲 (Food & Beverage)</option>
                  <option value="retail">🛍️ 純零售 (Retail)</option>
                  <option value="mixed">🔄 複合式 (餐飲 + 零售)</option>
                </select>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>有效期限 (留白代表永久有效)</label>
                <input type="date" value={newStore.valid_until} onChange={(e) => setNewStore({...newStore, valid_until: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>

              {(() => {
                const parentTenant = tenantsList.find(t => t.id === newStore.tenant_id);
                const tenantHasInventory = parentTenant?.enable_inventory;
                return (
                  <div style={{ marginBottom: '25px', padding: '15px', background: tenantHasInventory ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-app)', borderRadius: '8px', border: tenantHasInventory ? '1px solid rgba(59, 130, 246, 0.2)' : '1px dashed var(--border-color)', opacity: tenantHasInventory ? 1 : 0.6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: tenantHasInventory ? 'pointer' : 'not-allowed' }}>
                      <input 
                        type="checkbox" 
                        disabled={!tenantHasInventory}
                        checked={newStore.enable_inventory && tenantHasInventory} 
                        onChange={(e) => setNewStore({...newStore, enable_inventory: e.target.checked})} 
                        style={{ width: '18px', height: '18px', accentColor: '#3b82f6' }} 
                      />
                      <span style={{ fontSize: '15px', fontWeight: '500', color: 'var(--text-primary)' }}>📦 啟用此門店的「庫存管理」功能</span>
                    </label>
                    <div style={{ fontSize: '12px', color: tenantHasInventory ? 'var(--text-secondary)' : 'var(--danger-color)', marginLeft: '28px', marginTop: '4px' }}>
                      {tenantHasInventory ? '允許此門店使用庫存扣減與配方功能。' : '⚠️ 請先選擇商戶。若商戶未開通庫存模組，門店無法啟用。'}
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>取消</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '10px 15px', borderRadius: '6px', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer' }}>{isSubmitting ? '處理中...' : '確認建立'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
