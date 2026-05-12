import { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Trash2, X, Clock, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Tenant {
  id: string;
  name: string;
  created_at: string;
  valid_until?: string | null;
  enable_inventory: boolean;
}

export default function HQ() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [newTenantName, setNewTenantName] = useState('');
  const [newValidUntil, setNewValidUntil] = useState('');
  const [newEnableInventory, setNewEnableInventory] = useState(false);
  
  const [editingTenant, setEditingTenant] = useState<Partial<Tenant> & { valid_until_input?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    const { data, error } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setTenants(data);
    }
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName.trim()) return;
    
    setIsSubmitting(true);
    const validDate = newValidUntil ? new Date(`${newValidUntil}T23:59:59`).toISOString() : null;
    
    const { error } = await supabase.from('tenants').insert([{ 
      name: newTenantName,
      valid_until: validDate,
      enable_inventory: newEnableInventory
    }]);
    
    setIsSubmitting(false);
    
    if (!error) {
      setIsModalOpen(false);
      setNewTenantName('');
      setNewValidUntil('');
      setNewEnableInventory(false);
      fetchTenants();
    } else {
      alert('新增失敗：' + error.message);
    }
  };

  const openEditModal = (tenant: Tenant) => {
    let formattedDate = '';
    if (tenant.valid_until) {
      formattedDate = new Date(tenant.valid_until).toISOString().slice(0, 10);
    }
    setEditingTenant({ ...tenant, valid_until_input: formattedDate });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant.id) return;
    
    setIsSubmitting(true);
    const validDate = editingTenant.valid_until_input ? new Date(`${editingTenant.valid_until_input}T23:59:59`).toISOString() : null;
    
    const { error } = await supabase.from('tenants').update({ 
      name: editingTenant.name,
      valid_until: validDate,
      enable_inventory: editingTenant.enable_inventory
    }).eq('id', editingTenant.id);
    
    setIsSubmitting(false);
    
    if (!error) {
      setIsEditModalOpen(false);
      fetchTenants();
    } else {
      alert('更新失敗：' + error.message);
    }
  };

  const getStatusDisplay = (validUntil?: string | null) => {
    const now = new Date();
    if (validUntil && new Date(validUntil) < now) {
      return { label: '已過期 (Expired)', color: 'var(--danger-color)', bg: 'var(--danger-bg)' };
    }
    return { label: '正常合約', color: '#16a34a', bg: 'rgba(34, 197, 94, 0.15)' };
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Building2 /> 商戶管理 (POS商專用)
        </h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--accent-color)', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}
        >
          <Plus size={16} /> 新增商戶
        </button>
      </div>

      <div style={{ background: 'var(--bg-app)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
            <tr>
              <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>商戶/品牌名稱</th>
              <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>建立時間 (起始日)</th>
              <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>授權模組</th>
              <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>合約狀態</th>
              <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>有效期限</th>
              <th style={{ padding: '15px 20px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: '500' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>載入中...</td></tr>
            ) : tenants.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>尚無商戶資料</td></tr>
            ) : (
              tenants.map(t => {
                const status = getStatusDisplay(t.valid_until);
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '15px 20px', fontWeight: '500' }}>{t.name}</td>
                    <td style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '15px 20px' }}>
                      {t.enable_inventory && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '500', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                          📦 庫存管理
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', background: status.bg, color: status.color }}>
                        {status.label}
                      </span>
                    </td>
                    <td style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                      {t.valid_until ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Clock size={14} />
                          {new Date(t.valid_until).toLocaleDateString()}
                        </div>
                      ) : '永久有效'}
                    </td>
                    <td style={{ padding: '15px 20px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button onClick={() => openEditModal(t)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sidebar-hover-bg)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px', borderRadius: '6px' }}>
                        <Edit2 size={16} />
                      </button>
                      <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--danger-bg)', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '8px', borderRadius: '6px' }}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Tenant Modal */}
      {isEditModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-sidebar)', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>編輯商戶資料</h2>
              <button onClick={() => setIsEditModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdate}>
              
              <div style={{ marginBottom: '15px', padding: '10px', background: 'var(--bg-app)', borderRadius: '6px', border: '1px dashed var(--border-color)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>合約起始日期 (建立時間)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', fontWeight: '500' }}>
                  <Calendar size={14} color="var(--accent-color)"/>
                  {editingTenant.created_at ? new Date(editingTenant.created_at).toLocaleString() : '未知'}
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>商戶/品牌名稱</label>
                <input required type="text" value={editingTenant.name || ''} onChange={(e) => setEditingTenant({...editingTenant, name: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>合約有效期限 (到期自動停權旗下所有門店)</label>
                <input type="date" value={editingTenant.valid_until_input || ''} onChange={(e) => setEditingTenant({...editingTenant, valid_until_input: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '25px', padding: '15px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editingTenant.enable_inventory || false} onChange={(e) => setEditingTenant({...editingTenant, enable_inventory: e.target.checked})} style={{ width: '18px', height: '18px', accentColor: '#3b82f6' }} />
                  <span style={{ fontSize: '15px', fontWeight: '500', color: 'var(--text-primary)' }}>📦 開通「進階庫存管理」模組</span>
                </label>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '28px', marginTop: '4px' }}>勾選後，該商戶(與旗下門店)才能使用配方與庫存扣減功能。</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>取消</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '10px 15px', borderRadius: '6px', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer' }}>{isSubmitting ? '處理中...' : '儲存變更'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Tenant Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-sidebar)', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>建立新商戶 (Tenant)</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>商戶/品牌名稱</label>
                <input autoFocus required type="text" value={newTenantName} onChange={(e) => setNewTenantName(e.target.value)} placeholder="例如：王記牛肉麵" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>合約有效期限 (留白代表永久有效)</label>
                <input type="date" value={newValidUntil} onChange={(e) => setNewValidUntil(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '25px', padding: '15px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={newEnableInventory} onChange={(e) => setNewEnableInventory(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#3b82f6' }} />
                  <span style={{ fontSize: '15px', fontWeight: '500', color: 'var(--text-primary)' }}>📦 開通「進階庫存管理」模組</span>
                </label>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '28px', marginTop: '4px' }}>勾選後，該商戶(與旗下門店)才能使用配方與庫存扣減功能。</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>取消</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '10px 15px', borderRadius: '6px', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer' }}>{isSubmitting ? '建立中...' : '確認建立'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
