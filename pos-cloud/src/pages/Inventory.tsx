import { useState, useEffect } from 'react';
import { PackageOpen, Plus, Edit2, Trash2, X, Beaker, FileText, ChevronRight, Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Tenant { id: string; name: string; enable_inventory: boolean; }
interface InventoryItem { id: string; tenant_id: string; name: string; sku: string; unit: string; cost: number; purchase_unit?: string; conversion_rate?: number; }
interface Product { id: string; name: string; price: number; category_id: string; is_combo: boolean; }
interface ModifierOption { id: string; name: string; extra_price: number; modifier_id: string; }
interface Modifier { id: string; name: string; type: string; }
interface Recipe { id: string; product_id: string | null; modifier_option_id: string | null; inventory_item_id: string; quantity: number; inventory_item?: InventoryItem; }

import { useAuth } from '../contexts/AuthContext';

export default function Inventory() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const [activeTab, setActiveTab] = useState<'materials' | 'recipes'>('materials');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  
  // Data States
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [modifierOptions, setModifierOptions] = useState<ModifierOption[]>([]);
  
  // Loading & Submitting
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals for Materials
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<InventoryItem> & { conversion_rate_input?: string }>({});

  // Recipe Builder States
  const [recipeTargetType, setRecipeTargetType] = useState<'product' | 'modifier_option' | null>(null);
  const [recipeTargetId, setRecipeTargetId] = useState<string | null>(null);
  const [currentRecipes, setCurrentRecipes] = useState<Recipe[]>([]);
  
  // New Recipe Entry
  const [newRecipeItem, setNewRecipeItem] = useState('');
  const [newRecipeQty, setNewRecipeQty] = useState<number | ''>('');

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (selectedTenantId) {
      fetchInventoryData();
      if (activeTab === 'recipes') {
        fetchProductsAndModifiers();
      }
    } else {
      setItems([]);
      setProducts([]);
      setModifiers([]);
      setModifierOptions([]);
      setRecipeTargetId(null);
    }
  }, [selectedTenantId, activeTab]);

  const fetchTenants = async () => {
    const { data } = await supabase.from('tenants').select('*').eq('enable_inventory', true).order('created_at', { ascending: false });
    if (data) {
      setTenants(data);
      if (data.length > 0) setSelectedTenantId(data[0].id);
    }
  };

  const fetchInventoryData = async () => {
    setLoading(true);
    const { data } = await supabase.from('inventory_items').select('*').eq('tenant_id', selectedTenantId).order('name');
    if (data) setItems(data);
    setLoading(false);
  };

  const fetchProductsAndModifiers = async () => {
    const [prodRes, modRes, optRes] = await Promise.all([
      supabase.from('products').select('*').eq('tenant_id', selectedTenantId).eq('is_combo', false).order('name'),
      supabase.from('modifiers').select('*').eq('tenant_id', selectedTenantId).order('name'),
      supabase.from('modifier_options').select('*').in('modifier_id', (await supabase.from('modifiers').select('id').eq('tenant_id', selectedTenantId)).data?.map(m => m.id) || [])
    ]);
    if (prodRes.data) setProducts(prodRes.data);
    if (modRes.data) setModifiers(modRes.data);
    if (optRes.data) setModifierOptions(optRes.data);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem.name || !editingItem.unit || !selectedTenantId) return;
    setIsSubmitting(true);
    
    if (editingItem.id) {
      await supabase.from('inventory_items').update({
        name: editingItem.name,
        sku: editingItem.sku || null,
        unit: editingItem.unit,
        cost: editingItem.cost || 0,
        purchase_unit: editingItem.purchase_unit || null,
        conversion_rate: editingItem.conversion_rate_input ? Number(editingItem.conversion_rate_input) : 1
      }).eq('id', editingItem.id);
    } else {
      await supabase.from('inventory_items').insert([{
        tenant_id: selectedTenantId,
        name: editingItem.name,
        sku: editingItem.sku || null,
        unit: editingItem.unit,
        cost: editingItem.cost || 0,
        purchase_unit: editingItem.purchase_unit || null,
        conversion_rate: editingItem.conversion_rate_input ? Number(editingItem.conversion_rate_input) : 1
      }]);
    }
    
    setIsSubmitting(false);
    setIsItemModalOpen(false);
    fetchInventoryData();
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('確定要刪除此原物料嗎？(若已有配方綁定將一併刪除)')) return;
    await supabase.from('inventory_items').delete().eq('id', id);
    fetchInventoryData();
  };

  // --- Recipe Logic ---
  const selectRecipeTarget = async (type: 'product' | 'modifier_option', id: string) => {
    setRecipeTargetType(type);
    setRecipeTargetId(id);
    setNewRecipeItem('');
    setNewRecipeQty('');
    
    // Fetch recipes for this target
    const column = type === 'product' ? 'product_id' : 'modifier_option_id';
    const { data } = await supabase.from('recipes').select('*, inventory_items(*)').eq(column, id);
    if (data) {
      setCurrentRecipes(data);
    } else {
      setCurrentRecipes([]);
    }
  };

  const handleAddRecipe = async () => {
    if (!recipeTargetId || !newRecipeItem || !newRecipeQty || Number(newRecipeQty) <= 0) return;
    setIsSubmitting(true);
    
    const insertData: any = {
      tenant_id: selectedTenantId,
      inventory_item_id: newRecipeItem,
      quantity: Number(newRecipeQty)
    };
    if (recipeTargetType === 'product') insertData.product_id = recipeTargetId;
    else insertData.modifier_option_id = recipeTargetId;

    await supabase.from('recipes').insert([insertData]);
    
    setIsSubmitting(false);
    setNewRecipeItem('');
    setNewRecipeQty('');
    // Refresh recipes
    selectRecipeTarget(recipeTargetType!, recipeTargetId);
  };

  const handleRemoveRecipe = async (recipeId: string) => {
    if (!confirm('確定要移除此配方？')) return;
    await supabase.from('recipes').delete().eq('id', recipeId);
    selectRecipeTarget(recipeTargetType!, recipeTargetId!);
  };

  const getTargetName = () => {
    if (!recipeTargetId) return '';
    if (recipeTargetType === 'product') return products.find(p => p.id === recipeTargetId)?.name || '';
    if (recipeTargetType === 'modifier_option') {
      const opt = modifierOptions.find(o => o.id === recipeTargetId);
      if (!opt) return '';
      const mod = modifiers.find(m => m.id === opt.modifier_id);
      return `${mod?.name} - ${opt.name}`;
    }
    return '';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <PackageOpen /> 庫存管理與配方系統 (BOM)
        </h1>
        {isSuperAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <select value={selectedTenantId} onChange={(e) => setSelectedTenantId(e.target.value)} style={{ padding: '8px 15px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
              {tenants.length === 0 ? <option value="">無已開通庫存之商戶</option> : tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {tenants.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', background: 'var(--bg-app)', borderRadius: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          目前沒有任何商戶開通「庫存管理」模組。請先至商戶管理為特定商戶開啟權限。
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid var(--border-color)' }}>
            <button onClick={() => setActiveTab('materials')} style={{ padding: '10px 20px', background: 'transparent', border: 'none', borderBottom: activeTab === 'materials' ? '3px solid var(--accent-color)' : '3px solid transparent', color: activeTab === 'materials' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'materials' ? 'bold' : 'normal', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Beaker size={18}/> 原物料主檔
            </button>
            <button onClick={() => setActiveTab('recipes')} style={{ padding: '10px 20px', background: 'transparent', border: 'none', borderBottom: activeTab === 'recipes' ? '3px solid var(--accent-color)' : '3px solid transparent', color: activeTab === 'recipes' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'recipes' ? 'bold' : 'normal', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18}/> 產品配方設定 (Recipes)
            </button>
          </div>

          {activeTab === 'materials' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                <button onClick={() => { setEditingItem({ name: '', unit: '', sku: '', cost: 0 }); setIsItemModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--accent-color)', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer' }}>
                  <Plus size={16} /> 新增原物料
                </button>
              </div>
              
              <div style={{ background: 'var(--bg-app)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
                    <tr>
                      <th style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>原料名稱</th>
                      <th style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>SKU代碼</th>
                      <th style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>基礎單位 (配方扣減)</th>
                      <th style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>門店進貨換算 (UOM)</th>
                      <th style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>預設單位成本</th>
                      <th style={{ padding: '15px 20px', textAlign: 'right', color: 'var(--text-secondary)' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center' }}>載入中...</td></tr> : 
                     items.length === 0 ? <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>尚無原物料，請點擊右上方新增</td></tr> :
                     items.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '15px 20px', fontWeight: 'bold' }}>{item.name}</td>
                        <td style={{ padding: '15px 20px', color: 'var(--text-secondary)' }}>{item.sku || '-'}</td>
                        <td style={{ padding: '15px 20px' }}>
                          <span style={{ padding: '4px 8px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold' }}>{item.unit}</span>
                        </td>
                        <td style={{ padding: '15px 20px' }}>
                          {item.purchase_unit && item.conversion_rate && item.conversion_rate !== 1 ? (
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '4px 8px', borderRadius: '6px' }}>
                              1 {item.purchase_unit} = {item.conversion_rate} {item.unit}
                            </span>
                          ) : <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>1 : 1</span>}
                        </td>
                        <td style={{ padding: '15px 20px', color: '#16a34a' }}>${item.cost.toLocaleString()}</td>
                        <td style={{ padding: '15px 20px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                          <button onClick={() => { setEditingItem({...item, conversion_rate_input: item.conversion_rate?.toString()}); setIsItemModalOpen(true); }} style={{ background: 'var(--sidebar-hover-bg)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px', borderRadius: '6px' }}><Edit2 size={16} /></button>
                          <button onClick={() => handleDeleteItem(item.id)} style={{ background: 'var(--danger-bg)', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '8px', borderRadius: '6px' }}><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'recipes' && (
            <div style={{ display: 'flex', gap: '20px', height: '600px' }}>
              {/* Left Column: Products & Modifiers List */}
              <div style={{ width: '350px', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '15px', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={18} /> 選擇要綁定配方的項目
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                  
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 'bold', marginBottom: '10px', padding: '0 5px' }}>一般單品 (Products)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '20px' }}>
                    {products.length === 0 && <div style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '5px' }}>無資料</div>}
                    {products.map(p => (
                      <div key={p.id} onClick={() => selectRecipeTarget('product', p.id)} style={{ padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: recipeTargetId === p.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent', border: recipeTargetId === p.id ? '1px solid #3b82f6' : '1px solid transparent', color: recipeTargetId === p.id ? '#3b82f6' : 'var(--text-primary)', fontWeight: recipeTargetId === p.id ? 'bold' : 'normal' }}>
                        <span>{p.name}</span>
                        <ChevronRight size={16} style={{ opacity: recipeTargetId === p.id ? 1 : 0 }} />
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 'bold', marginBottom: '10px', padding: '0 5px' }}>加料選項 (Modifiers)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {modifiers.length === 0 && <div style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '5px' }}>無資料</div>}
                    {modifiers.map(m => (
                      <div key={m.id} style={{ paddingLeft: '5px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>{m.name}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {modifierOptions.filter(opt => opt.modifier_id === m.id).map(opt => (
                            <div key={opt.id} onClick={() => selectRecipeTarget('modifier_option', opt.id)} style={{ padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: recipeTargetId === opt.id ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-sidebar)', border: recipeTargetId === opt.id ? '1px solid #3b82f6' : '1px solid transparent', color: recipeTargetId === opt.id ? '#3b82f6' : 'var(--text-primary)', fontWeight: recipeTargetId === opt.id ? 'bold' : 'normal' }}>
                              <span style={{ fontSize: '14px' }}>{opt.name}</span>
                              <ChevronRight size={14} style={{ opacity: recipeTargetId === opt.id ? 1 : 0 }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              </div>

              {/* Right Column: Recipe Builder */}
              <div style={{ flex: 1, background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {!recipeTargetId ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    <Beaker size={48} style={{ opacity: 0.3, marginBottom: '15px' }} />
                    <p>請先從左側選擇一個項目，來設定它的配方組成。</p>
                  </div>
                ) : (
                  <>
                    <div style={{ padding: '20px', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
                      <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
                        配方設定：<span style={{ color: '#3b82f6' }}>{getTargetName()}</span>
                      </h2>
                      <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>每當賣出一份此項目時，系統將自動扣減下方列表中的原物料庫存。</p>
                    </div>

                    <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
                      {/* Add new recipe row */}
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '15px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', border: '1px dashed #3b82f6', marginBottom: '20px' }}>
                        <select value={newRecipeItem} onChange={e => setNewRecipeItem(e.target.value)} style={{ flex: 2, padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
                          <option value="">-- 選擇要扣減的原物料 --</option>
                          {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                        <input type="number" placeholder="消耗數量" value={newRecipeQty} onChange={e => setNewRecipeQty(e.target.value ? Number(e.target.value) : '')} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)' }} />
                        <span style={{ color: 'var(--text-secondary)', fontSize: '14px', width: '30px' }}>
                          {newRecipeItem ? items.find(i => i.id === newRecipeItem)?.unit : ''}
                        </span>
                        <button onClick={handleAddRecipe} disabled={!newRecipeItem || !newRecipeQty || isSubmitting} style={{ padding: '10px 15px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: 'white', cursor: (!newRecipeItem || !newRecipeQty) ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Plus size={16} /> 新增
                        </button>
                      </div>

                      {/* Current Recipes */}
                      <h3 style={{ fontSize: '16px', margin: '0 0 15px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>已綁定配方</h3>
                      {currentRecipes.length === 0 ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.02)', borderRadius: '8px' }}>
                          此項目目前尚未綁定任何配方，銷售時將不會扣減庫存。
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {currentRecipes.map(recipe => (
                            <div key={recipe.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-app)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Beaker size={20} />
                                </div>
                                <div>
                                  <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{recipe.inventory_item?.name}</div>
                                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>SKU: {recipe.inventory_item?.sku || '-'}</div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>每次銷售扣除</div>
                                  <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#ef4444' }}>
                                    - {recipe.quantity} <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{recipe.inventory_item?.unit}</span>
                                  </div>
                                </div>
                                <button onClick={() => handleRemoveRecipe(recipe.id)} style={{ padding: '8px', background: 'var(--danger-bg)', border: 'none', color: 'var(--danger-color)', borderRadius: '6px', cursor: 'pointer' }} title="移除此配方">
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Material Modal */}
      {isItemModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-sidebar)', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>{editingItem.id ? '編輯原物料' : '新增原物料'}</h2>
              <button onClick={() => setIsItemModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveItem}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>原料名稱</label>
                <input autoFocus required type="text" value={editingItem.name || ''} onChange={(e) => setEditingItem({...editingItem, name: e.target.value})} placeholder="例如：印尼曼特寧咖啡豆" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>基礎單位 (配方扣減用，非常重要)</label>
                <input required type="text" value={editingItem.unit || ''} onChange={(e) => setEditingItem({...editingItem, unit: e.target.value})} placeholder="例如：g, ml, 瓶, 杯" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>總部設定配方時，會以這個單位為基準進行扣減。</div>
              </div>
              
              <div style={{ background: 'var(--bg-app)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '15px' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', color: 'var(--text-primary)' }}>📦 門店進貨設定 (UOM 換算)</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>進貨包裝單位 (選填)</label>
                    <input type="text" value={editingItem.purchase_unit || ''} onChange={(e) => setEditingItem({...editingItem, purchase_unit: e.target.value})} placeholder="例如：箱, 袋" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-sidebar)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>換算率 (一包裝等於多少基礎單位)</label>
                    <input type="number" min="0.001" step="any" value={editingItem.conversion_rate_input || ''} onChange={(e) => setEditingItem({...editingItem, conversion_rate_input: e.target.value})} placeholder="例如：24" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-sidebar)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                  </div>
                </div>
                {(editingItem.purchase_unit && editingItem.conversion_rate_input && editingItem.unit) && (
                  <div style={{ marginTop: '10px', fontSize: '13px', color: '#d97706', background: 'rgba(245, 158, 11, 0.1)', padding: '8px', borderRadius: '6px' }}>
                    💡 <b>提示：</b>未來地端 POS 進貨 1 {editingItem.purchase_unit}，系統將自動轉換為 {editingItem.conversion_rate_input} {editingItem.unit}。
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>SKU代碼 (選填)</label>
                <input type="text" value={editingItem.sku || ''} onChange={(e) => setEditingItem({...editingItem, sku: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>預設單位成本 (依基礎單位計算)</label>
                <input type="number" min="0" step="0.01" value={editingItem.cost || 0} onChange={(e) => setEditingItem({...editingItem, cost: Number(e.target.value)})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsItemModalOpen(false)} style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>取消</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '10px 15px', borderRadius: '6px', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer' }}>{isSubmitting ? '處理中...' : '確認儲存'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
