import { useState, useEffect } from 'react';
import { UtensilsCrossed, Plus, Trash2, X, FolderTree, Package, Store as StoreIcon, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Tenant { id: string; name: string; }
interface Category { id: string; name: string; sort_order: number; mode: 'fnb' | 'retail'; }
interface Product { id: string; name: string; category_id: string; price: number; is_active: boolean; sku: string; }
interface Store { id: string; name: string; store_code: string; }

import { useAuth } from '../contexts/AuthContext';

export default function Menu() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const [activeTab, setActiveTab] = useState<'categories' | 'products'>('categories');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals state
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ id?: string }>({});
  const [newCatName, setNewCatName] = useState('');
  const [newCatMode, setNewCatMode] = useState<'fnb' | 'retail'>('fnb');
  
  const [isProdModalOpen, setIsProdModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<{ id?: string }>({});
  const [newProd, setNewProd] = useState({ name: '', category_id: '', price: 0, sku: '', track_inventory: false });
  
  // Assign Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<{ id: string; type: 'category' | 'product'; name: string } | null>(null);
  const [storeStatus, setStoreStatus] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (selectedTenantId) {
      fetchCategories();
      fetchProducts();
      fetchStores();
    } else {
      setCategories([]);
      setProducts([]);
      setStores([]);
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
    const { data } = await supabase.from('stores').select('id, name, store_code').eq('tenant_id', selectedTenantId);
    if (data) setStores(data);
  };

  const fetchCategories = async () => {
    setLoading(true);
    const { data } = await supabase.from('categories').select('*').eq('tenant_id', selectedTenantId).order('sort_order', { ascending: true });
    if (data) setCategories(data);
    setLoading(false);
  };

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').eq('tenant_id', selectedTenantId).order('created_at', { ascending: false });
    if (data) setProducts(data);
    setLoading(false);
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || !selectedTenantId) return;
    setIsSubmitting(true);
    
    if (editingCategory.id) {
      const { error } = await supabase.from('categories').update({
        name: newCatName,
        mode: newCatMode
      }).eq('id', editingCategory.id);
      
      if (!error) {
        setIsCatModalOpen(false); 
        setEditingCategory({});
        setNewCatName(''); 
        setNewCatMode('fnb');
        fetchCategories(); 
      } else {
        alert('修改失敗：' + error?.message);
      }
    } else {
      // Insert and return the new record
      const { data: newCat, error } = await supabase.from('categories').insert([{ 
        tenant_id: selectedTenantId, 
        name: newCatName, 
        sort_order: categories.length + 1,
        mode: newCatMode
      }]).select().single();
      
      if (!error && newCat) {
        // Auto-assign if only 1 store exists
        if (stores.length === 1) {
          await supabase.from('store_category_status').insert({
            store_id: stores[0].id,
            category_id: newCat.id,
            is_available: true
          });
        }
        setIsCatModalOpen(false); 
        setNewCatName(''); 
        setNewCatMode('fnb');
        fetchCategories(); 
      } else {
        alert('新增失敗：' + error?.message);
      }
    }
    setIsSubmitting(false);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProd.name || !newProd.category_id || !selectedTenantId) return;
    setIsSubmitting(true);
    
    if (editingProduct.id) {
      const { error } = await supabase.from('products').update({
        category_id: newProd.category_id, 
        name: newProd.name, 
        price: newProd.price, 
        sku: newProd.sku || null 
      }).eq('id', editingProduct.id);
      
      if (!error) {
        setIsProdModalOpen(false); 
        setEditingProduct({});
        setNewProd({ name: '', category_id: '', price: 0, sku: '', track_inventory: false }); 
        fetchProducts(); 
      } else {
        alert('修改失敗：' + error?.message);
      }
    } else {
      const { data: newProduct, error } = await supabase.from('products').insert([{ 
        tenant_id: selectedTenantId, 
        category_id: newProd.category_id, 
        name: newProd.name, 
        price: newProd.price, 
        sku: newProd.sku || null 
      }]).select().single();
      
      if (!error && newProduct) {
        // Auto-assign if only 1 store exists
        if (stores.length === 1) {
          await supabase.from('store_product_status').insert({
            store_id: stores[0].id,
            product_id: newProduct.id,
            is_available: true
          });
        }

        // Retail Auto-BOM (1:1 Inventory Tracking)
        if (newProd.track_inventory) {
          const { data: invItem } = await supabase.from('inventory_items').insert([{
            tenant_id: selectedTenantId,
            name: newProd.name,
            sku: newProd.sku || null,
            unit: '個' // 預設單位
          }]).select().single();

          if (invItem) {
            await supabase.from('recipes').insert([{
              tenant_id: selectedTenantId,
              product_id: newProduct.id,
              inventory_item_id: invItem.id,
              quantity: 1
            }]);
          }
        }

        setIsProdModalOpen(false); 
        setNewProd({ name: '', category_id: '', price: 0, sku: '', track_inventory: false }); 
        fetchProducts(); 
      } else {
        alert('新增失敗：' + error?.message);
      }
    }
    setIsSubmitting(false);
  };

  // 打開分派視窗並載入狀態
  const openAssignModal = async (id: string, name: string, type: 'category' | 'product') => {
    setAssignTarget({ id, type, name });
    setIsAssignModalOpen(true);
    
    // 預設全部開啟 (true)
    const initialStatus: Record<string, boolean> = {};
    stores.forEach(s => initialStatus[s.id] = true);

    const tableName = type === 'category' ? 'store_category_status' : 'store_product_status';
    const idColumn = type === 'category' ? 'category_id' : 'product_id';

    const { data } = await supabase.from(tableName).select('store_id, is_available').eq(idColumn, id);
    if (data) {
      data.forEach(row => {
        initialStatus[row.store_id] = row.is_available;
      });
    }
    setStoreStatus(initialStatus);
  };

  // 儲存分派設定
  const handleSaveAssign = async () => {
    if (!assignTarget) return;
    setIsSubmitting(true);
    
    const tableName = assignTarget.type === 'category' ? 'store_category_status' : 'store_product_status';
    const idColumn = assignTarget.type === 'category' ? 'category_id' : 'product_id';

    // 採用 upsert 覆蓋設定
    const upsertData = stores.map(s => ({
      store_id: s.id,
      [idColumn]: assignTarget.id,
      is_available: storeStatus[s.id]
    }));

    const { error } = await supabase.from(tableName).upsert(upsertData, { onConflict: `store_id,${idColumn}` });
    
    setIsSubmitting(false);
    if (!error) {
      setIsAssignModalOpen(false);
      alert('門店分派設定已儲存！');
    } else {
      alert('儲存失敗：' + error.message);
    }
  };

  return (
    <div>
      {/* Header & Tenant Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <UtensilsCrossed /> 主菜單管理 (Master Menu)
        </h1>
        {isSuperAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>選擇操作商戶：</span>
            <select value={selectedTenantId} onChange={(e) => setSelectedTenantId(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', outline: 'none' }}>
              <option value="">-- 請選擇商戶 --</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {stores.length > 1 ? (
        <div style={{ background: 'rgba(59, 130, 246, 0.1)', borderLeft: '4px solid #3b82f6', padding: '15px', borderRadius: '8px', marginBottom: '20px', color: 'var(--text-secondary)' }}>
          💡 <b>菜單分派機制：</b> 您在此建立的為「全域主菜單」。點擊清單右側的 <StoreIcon size={16} style={{ verticalAlign: 'text-bottom', margin: '0 2px' }}/> <b>分派按鈕</b>，即可設定該項目是否要在特定的門店上架販售。
        </div>
      ) : stores.length === 1 ? (
        <div style={{ background: 'rgba(34, 197, 94, 0.1)', borderLeft: '4px solid #16a34a', padding: '15px', borderRadius: '8px', marginBottom: '20px', color: 'var(--text-secondary)' }}>
          💡 您目前只有一間門店，新增的分類與單品將會<b>自動套用</b>至該門店，無需再手動分派。
        </div>
      ) : null}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <button onClick={() => setActiveTab('categories')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', border: 'none', background: activeTab === 'categories' ? 'var(--accent-color)' : 'transparent', color: activeTab === 'categories' ? 'white' : 'var(--text-secondary)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}>
          <FolderTree size={18} /> 分類主檔
        </button>
        <button onClick={() => setActiveTab('products')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', border: 'none', background: activeTab === 'products' ? 'var(--accent-color)' : 'transparent', color: activeTab === 'products' ? 'white' : 'var(--text-secondary)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}>
          <Package size={18} /> 單品主檔
        </button>
      </div>

      {!selectedTenantId ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-app)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
          請先於右上角選擇要操作的商戶/品牌。
        </div>
      ) : (
        <>
          {/* Categories Tab Content */}
          {activeTab === 'categories' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                <button onClick={() => { setEditingCategory({}); setNewCatName(''); setNewCatMode('fnb'); setIsCatModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--accent-color)', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
                  <Plus size={16} /> 新增分類
                </button>
              </div>
              <div style={{ background: 'var(--bg-app)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
                    <tr>
                      <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>排序</th>
                      <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>分類名稱</th>
                      <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>分類屬性 (POS端點)</th>
                      <th style={{ padding: '15px 20px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: '500' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>載入中...</td></tr> : 
                     categories.length === 0 ? <tr><td colSpan={3} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>尚無分類資料</td></tr> : 
                     categories.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '15px 20px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>{c.sort_order}</td>
                        <td style={{ padding: '15px 20px', fontWeight: '500' }}>{c.name}</td>
                        <td style={{ padding: '15px 20px' }}>
                          <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '500', background: c.mode === 'retail' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(236, 72, 153, 0.1)', color: c.mode === 'retail' ? '#8b5cf6' : '#ec4899', border: `1px solid ${c.mode === 'retail' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(236, 72, 153, 0.2)'}` }}>
                            {c.mode === 'fnb' ? '🍔 餐飲類別' : '🛍️ 零售類別'}
                          </span>
                        </td>
                        <td style={{ padding: '15px 20px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                          {stores.length > 1 && (
                            <button onClick={() => openAssignModal(c.id, c.name, 'category')} title="分派至門店" style={{ display: 'flex', alignItems: 'center', background: 'rgba(59, 130, 246, 0.15)', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '8px', borderRadius: '6px' }}><StoreIcon size={16} /></button>
                          )}
                          <button onClick={() => { setEditingCategory({ id: c.id }); setNewCatName(c.name); setNewCatMode(c.mode); setIsCatModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', background: 'var(--sidebar-hover-bg)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px', borderRadius: '6px' }}><Edit2 size={16} /></button>
                          <button style={{ display: 'flex', alignItems: 'center', background: 'var(--danger-bg)', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '8px', borderRadius: '6px' }}><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Products Tab Content */}
          {activeTab === 'products' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                <button onClick={() => { setEditingProduct({}); setNewProd({ name: '', category_id: '', price: 0, sku: '', track_inventory: false }); setIsProdModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--accent-color)', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
                  <Plus size={16} /> 新增單品
                </button>
              </div>
              <div style={{ background: 'var(--bg-app)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
                    <tr>
                      <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>單品名稱</th>
                      <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>所屬分類</th>
                      <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>價格</th>
                      <th style={{ padding: '15px 20px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: '500' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>載入中...</td></tr> : 
                     products.length === 0 ? <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>尚無商品資料</td></tr> : 
                     products.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '15px 20px', fontWeight: 'bold' }}>{p.name} <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>{p.sku}</span></td>
                        <td style={{ padding: '15px 20px' }}>
                          <span style={{ background: 'var(--sidebar-hover-bg)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {categories.find(c => c.id === p.category_id)?.name || '未知分類'}
                          </span>
                        </td>
                        <td style={{ padding: '15px 20px', color: '#16a34a', fontWeight: 'bold' }}>${p.price.toLocaleString()}</td>
                        <td style={{ padding: '15px 20px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                          {stores.length > 1 && (
                            <button onClick={() => openAssignModal(p.id, p.name, 'product')} title="分派至門店" style={{ display: 'flex', alignItems: 'center', background: 'rgba(59, 130, 246, 0.15)', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '8px', borderRadius: '6px' }}><StoreIcon size={16} /></button>
                          )}
                          <button onClick={() => { setEditingProduct({ id: p.id }); setNewProd({ name: p.name, category_id: p.category_id, price: p.price, sku: p.sku || '', track_inventory: false }); setIsProdModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', background: 'var(--sidebar-hover-bg)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px', borderRadius: '6px' }}><Edit2 size={16} /></button>
                          <button style={{ display: 'flex', alignItems: 'center', background: 'var(--danger-bg)', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '8px', borderRadius: '6px' }}><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Assign Modal (分派門店) */}
      {isAssignModalOpen && assignTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-sidebar)', padding: '30px', borderRadius: '12px', width: '500px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StoreIcon size={20} color="#3b82f6" /> 
                門店分派設定
              </h2>
              <button onClick={() => setIsAssignModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              請勾選要啟用 <strong style={{ color: 'var(--text-primary)' }}>{assignTarget.name}</strong> 的門店。
              未勾選的門店將不會在 POS 上顯示此項目。
            </p>

            <div style={{ maxHeight: '300px', overflowY: 'auto', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', marginBottom: '20px' }}>
              {stores.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>該商戶下尚無任何門店。請先至門店管理新增門店。</div>
              ) : (
                stores.map(store => (
                  <label key={store.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={storeStatus[store.id] || false} 
                      onChange={(e) => setStoreStatus({...storeStatus, [store.id]: e.target.checked})}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--accent-color)' }}
                    />
                    <span style={{ fontWeight: '500' }}>{store.name} <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>({store.store_code})</span></span>
                  </label>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setIsAssignModalOpen(false)} style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>取消</button>
              <button onClick={handleSaveAssign} disabled={isSubmitting || stores.length === 0} style={{ padding: '10px 15px', borderRadius: '6px', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer' }}>{isSubmitting ? '儲存中...' : '確認儲存'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Categories & Products Create Modals are hidden for brevity, assuming existing... */}
      {/* (To ensure code completeness I will retain the simple Modals below) */}
      
      {isCatModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-sidebar)', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>{editingCategory.id ? '編輯分類' : '建立新分類'}</h2>
              <button onClick={() => setIsCatModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateCategory}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>分類名稱</label>
                <input autoFocus required type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="例如：主餐、飲料" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>分類屬性 (決定顯示在哪種 POS 機上)</label>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                    <input type="radio" name="cat_mode" value="fnb" checked={newCatMode === 'fnb'} onChange={() => setNewCatMode('fnb')} style={{ accentColor: 'var(--accent-color)' }} />
                    <span style={{ color: 'var(--text-primary)' }}>🍔 餐飲類別 (點餐機顯示)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                    <input type="radio" name="cat_mode" value="retail" checked={newCatMode === 'retail'} onChange={() => setNewCatMode('retail')} style={{ accentColor: 'var(--accent-color)' }} />
                    <span style={{ color: 'var(--text-primary)' }}>🛍️ 零售類別 (收銀機顯示)</span>
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsCatModalOpen(false)} style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>取消</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '10px 15px', borderRadius: '6px', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer' }}>{editingCategory.id ? '儲存修改' : '確認建立'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isProdModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-sidebar)', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>{editingProduct.id ? '編輯單品' : '建立新單品'}</h2>
              <button onClick={() => setIsProdModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateProduct}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>所屬分類</label>
                <select required value={newProd.category_id} onChange={(e) => setNewProd({...newProd, category_id: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                  <option value="">-- 請選擇分類 --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>單品代碼 (SKU)</label>
                <input type="text" value={newProd.sku} onChange={(e) => setNewProd({...newProd, sku: e.target.value})} placeholder="選填，例如：BEEF-01" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>單品名稱</label>
                <input required type="text" value={newProd.name} onChange={(e) => setNewProd({...newProd, name: e.target.value})} placeholder="例如：招牌牛肉麵" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>價格</label>
                <input required type="number" min="0" value={newProd.price} onChange={(e) => setNewProd({...newProd, price: Number(e.target.value)})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              {!editingProduct.id && (
              <div style={{ marginBottom: '25px', padding: '15px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', border: '1px dashed #3b82f6' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={newProd.track_inventory} 
                    onChange={(e) => setNewProd({...newProd, track_inventory: e.target.checked})} 
                    style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: '#3b82f6' }} 
                  />
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '500', color: 'var(--text-primary)' }}>📦 啟用零售庫存追蹤 (Auto-BOM)</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      勾選後，系統將自動為您建立一個同名的「原物料」，並綁定 1:1 的扣減配方。適合直接銷售的零售商品。
                    </div>
                  </div>
                </label>
              </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsProdModalOpen(false)} style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>取消</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '10px 15px', borderRadius: '6px', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer' }}>{editingProduct.id ? '儲存修改' : '確認建立'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
