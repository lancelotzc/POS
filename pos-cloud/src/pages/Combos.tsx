import { useState, useEffect } from 'react';
import { Layers, Plus, Trash2, X, Coffee, ListPlus, Link as LinkIcon, Store as StoreIcon, Save, Edit, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Tenant { id: string; name: string; }
interface Modifier { id: string; name: string; type: string; }
interface ModifierOption { id: string; modifier_id: string; name: string; extra_price: number; }
interface Store { id: string; name: string; store_code: string; }
interface Category { id: string; name: string; }

// Combo specific types
interface ComboOption { product_id: string; extra_price: number; }
interface ComboGroup { id: string; name: string; category_id?: string; required_qty: number; max_qty: number; options: ComboOption[]; }
interface ComboSettings { groups: ComboGroup[]; }

interface Product { 
  id: string; 
  name: string; 
  price: number; 
  category_id: string; 
  sku: string; 
  is_combo: boolean; 
  combo_settings: ComboSettings | null; 
}

import { useAuth } from '../contexts/AuthContext';

export default function Combos() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const [activeTab, setActiveTab] = useState<'modifiers' | 'combos'>('modifiers');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derived state
  const comboProducts = products.filter(p => p.is_combo);
  const regularProducts = products.filter(p => !p.is_combo);

  // Modifiers Tab States
  const [isModModalOpen, setIsModModalOpen] = useState(false);
  const [newModName, setNewModName] = useState('');
  const [newModType, setNewModType] = useState('optional');
  const [selectedModifier, setSelectedModifier] = useState<Modifier | null>(null);
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
  const [options, setOptions] = useState<ModifierOption[]>([]);
  const [newOptName, setNewOptName] = useState('');
  const [newOptPrice, setNewOptPrice] = useState(0);
  const [isAssignProdModalOpen, setIsAssignProdModalOpen] = useState(false);
  const [assignProdTarget, setAssignProdTarget] = useState<Modifier | null>(null);
  const [productStatus, setProductStatus] = useState<Record<string, boolean>>({});
  const [isAssignStoreModalOpen, setIsAssignStoreModalOpen] = useState(false);
  const [assignStoreTarget, setAssignStoreTarget] = useState<Modifier | null>(null);
  const [storeStatus, setStoreStatus] = useState<Record<string, boolean>>({});

  // Combos Tab States
  const [isCreateComboModalOpen, setIsCreateComboModalOpen] = useState(false);
  const [newCombo, setNewCombo] = useState({ name: '', price: 0, category_id: '', sku: '' });
  
  const [isComboAssignStoreModalOpen, setIsComboAssignStoreModalOpen] = useState(false);
  const [comboAssignStoreTarget, setComboAssignStoreTarget] = useState<Product | null>(null);
  const [comboStoreStatus, setComboStoreStatus] = useState<Record<string, boolean>>({});

  // Combo Builder States
  const [builderTarget, setBuilderTarget] = useState<Product | null>(null);
  const [builderSettings, setBuilderSettings] = useState<ComboSettings>({ groups: [] });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => { fetchTenants(); }, []);
  useEffect(() => {
    if (selectedTenantId) {
      fetchCategories();
      fetchProducts();
      fetchStores();
      fetchModifiers();
    } else {
      setModifiers([]);
      setProducts([]);
      setStores([]);
      setCategories([]);
    }
  }, [selectedTenantId]);

  const fetchTenants = async () => {
    const { data } = await supabase.from('tenants').select('id, name');
    if (data) { setTenants(data); if (data.length > 0) setSelectedTenantId(data[0].id); }
  };
  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('id, name').eq('tenant_id', selectedTenantId).order('sort_order');
    if (data) setCategories(data);
  };
  const fetchStores = async () => {
    const { data } = await supabase.from('stores').select('id, name, store_code').eq('tenant_id', selectedTenantId);
    if (data) setStores(data);
  };
  const fetchModifiers = async () => {
    setLoading(true);
    const { data } = await supabase.from('modifiers').select('*').eq('tenant_id', selectedTenantId).order('created_at', { ascending: false });
    if (data) setModifiers(data);
    setLoading(false);
  };
  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').eq('tenant_id', selectedTenantId).order('created_at', { ascending: false });
    if (data) setProducts(data);
  };

  // --- MODIFIERS LOGIC ---
  const handleCreateModifier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModName.trim() || !selectedTenantId) return;
    setIsSubmitting(true);
    const { data: newMod, error } = await supabase.from('modifiers').insert([{ tenant_id: selectedTenantId, name: newModName, type: newModType }]).select().single();
    if (!error && newMod) {
      if (stores.length === 1) {
        await supabase.from('store_modifier_status').insert({ store_id: stores[0].id, modifier_id: newMod.id, is_available: true });
      }
      setIsModModalOpen(false); setNewModName(''); fetchModifiers(); 
    } else { alert('新增失敗：' + error?.message); }
    setIsSubmitting(false);
  };
  const handleDeleteModifier = async (modId: string) => {
    if (!confirm('確定要刪除此加料群組嗎？(相關的選項及綁定也會一併刪除)')) return;
    await supabase.from('modifiers').delete().eq('id', modId);
    fetchModifiers();
  };
  const openOptionsModal = async (mod: Modifier) => { setSelectedModifier(mod); setIsOptionsModalOpen(true); fetchOptions(mod.id); };
  const fetchOptions = async (modId: string) => {
    const { data } = await supabase.from('modifier_options').select('*').eq('modifier_id', modId).order('created_at', { ascending: true });
    if (data) setOptions(data);
  };
  const handleAddOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModifier || !newOptName.trim()) return;
    setIsSubmitting(true);
    const { error } = await supabase.from('modifier_options').insert([{ modifier_id: selectedModifier.id, name: newOptName, extra_price: newOptPrice }]);
    setIsSubmitting(false);
    if (!error) { setNewOptName(''); setNewOptPrice(0); fetchOptions(selectedModifier.id); } else alert('新增選項失敗：' + error.message);
  };
  const handleDeleteOption = async (optId: string) => {
    if (!selectedModifier) return;
    await supabase.from('modifier_options').delete().eq('id', optId);
    fetchOptions(selectedModifier.id);
  };
  const openAssignProdModal = async (mod: Modifier) => {
    setAssignProdTarget(mod); setIsAssignProdModalOpen(true);
    const initialStatus: Record<string, boolean> = {};
    regularProducts.forEach(p => initialStatus[p.id] = false); 
    const { data } = await supabase.from('product_modifiers').select('product_id').eq('modifier_id', mod.id);
    if (data) { data.forEach(row => { initialStatus[row.product_id] = true; }); }
    setProductStatus(initialStatus);
  };
  const handleSaveAssignProd = async () => {
    if (!assignProdTarget) return;
    setIsSubmitting(true);
    const selectedProductIds = regularProducts.filter(p => productStatus[p.id]).map(p => p.id);
    await supabase.from('product_modifiers').delete().eq('modifier_id', assignProdTarget.id);
    if (selectedProductIds.length > 0) {
      const inserts = selectedProductIds.map(pid => ({ product_id: pid, modifier_id: assignProdTarget.id }));
      const { error } = await supabase.from('product_modifiers').insert(inserts);
      if (error) alert('儲存失敗：' + error.message);
    }
    setIsSubmitting(false); setIsAssignProdModalOpen(false); alert('商品綁定設定已儲存！');
  };
  const openAssignStoreModal = async (mod: Modifier) => {
    setAssignStoreTarget(mod); setIsAssignStoreModalOpen(true);
    const initialStatus: Record<string, boolean> = {};
    stores.forEach(s => initialStatus[s.id] = true);
    const { data } = await supabase.from('store_modifier_status').select('store_id, is_available').eq('modifier_id', mod.id);
    if (data) { data.forEach(row => { initialStatus[row.store_id] = row.is_available; }); }
    setStoreStatus(initialStatus);
  };
  const handleSaveAssignStore = async () => {
    if (!assignStoreTarget) return;
    setIsSubmitting(true);
    const upsertData = stores.map(s => ({ store_id: s.id, modifier_id: assignStoreTarget.id, is_available: storeStatus[s.id] }));
    const { error } = await supabase.from('store_modifier_status').upsert(upsertData, { onConflict: `store_id,modifier_id` });
    setIsSubmitting(false);
    if (!error) { setIsAssignStoreModalOpen(false); alert('門店分派設定已儲存！'); } else { alert('儲存失敗：' + error.message); }
  };

  // --- COMBOS LOGIC ---
  const handleCreateCombo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCombo.name || !newCombo.category_id || !selectedTenantId) return;
    setIsSubmitting(true);
    const { data: newProd, error } = await supabase.from('products').insert([{ 
      tenant_id: selectedTenantId, 
      category_id: newCombo.category_id, 
      name: newCombo.name, 
      price: newCombo.price, 
      sku: newCombo.sku || null,
      is_combo: true,
      combo_settings: { groups: [] }
    }]).select().single();
    
    if (!error && newProd) {
      if (stores.length === 1) {
        await supabase.from('store_product_status').insert({ store_id: stores[0].id, product_id: newProd.id, is_available: true });
      }
      setIsCreateComboModalOpen(false); 
      setNewCombo({ name: '', category_id: '', price: 0, sku: '' }); 
      fetchProducts(); 
    } else { alert('新增套餐失敗：' + error?.message); }
    setIsSubmitting(false);
  };
  
  const handleDeleteCombo = async (id: string) => {
    if (!confirm('確定要刪除此套餐嗎？')) return;
    await supabase.from('products').delete().eq('id', id);
    fetchProducts();
  };

  const openComboAssignStoreModal = async (combo: Product) => {
    setComboAssignStoreTarget(combo); setIsComboAssignStoreModalOpen(true);
    const initialStatus: Record<string, boolean> = {};
    stores.forEach(s => initialStatus[s.id] = true);
    const { data } = await supabase.from('store_product_status').select('store_id, is_available').eq('product_id', combo.id);
    if (data) { data.forEach(row => { initialStatus[row.store_id] = row.is_available; }); }
    setComboStoreStatus(initialStatus);
  };

  const handleSaveComboAssignStore = async () => {
    if (!comboAssignStoreTarget) return;
    setIsSubmitting(true);
    const upsertData = stores.map(s => ({ store_id: s.id, product_id: comboAssignStoreTarget.id, is_available: comboStoreStatus[s.id] }));
    const { error } = await supabase.from('store_product_status').upsert(upsertData, { onConflict: `store_id,product_id` });
    setIsSubmitting(false);
    if (!error) { setIsComboAssignStoreModalOpen(false); alert('門店分派設定已儲存！'); } else { alert('儲存失敗：' + error.message); }
  };

  const openBuilder = (combo: Product) => {
    setBuilderTarget(combo);
    setBuilderSettings(combo.combo_settings || { groups: [] });
    
    // Auto-expand all groups
    const exp: Record<string, boolean> = {};
    (combo.combo_settings?.groups || []).forEach(g => exp[g.id] = true);
    setExpandedGroups(exp);
  };

  const closeBuilder = () => {
    setBuilderTarget(null);
    setBuilderSettings({ groups: [] });
  };

  const addGroup = () => {
    const newGroupId = 'g_' + Math.random().toString(36).substr(2, 9);
    setBuilderSettings(prev => ({
      groups: [...prev.groups, { id: newGroupId, name: '', category_id: '', required_qty: 1, max_qty: 1, options: [] }]
    }));
    setExpandedGroups(prev => ({ ...prev, [newGroupId]: true }));
  };

  const handleCategorySelect = (groupId: string, categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    // Auto-populate with products from this category
    const catProducts = regularProducts.filter(p => p.category_id === categoryId);
    const newOptions: ComboOption[] = catProducts.map(p => ({
      product_id: p.id,
      extra_price: 0
    }));

    setBuilderSettings(prev => ({
      groups: prev.groups.map(g => {
        if (g.id === groupId) {
          return { ...g, name: category.name, category_id: category.id, options: newOptions };
        }
        return g;
      })
    }));
  };

  const updateGroup = (groupId: string, field: keyof ComboGroup, value: any) => {
    setBuilderSettings(prev => ({
      groups: prev.groups.map(g => g.id === groupId ? { ...g, [field]: value } : g)
    }));
  };

  const removeGroup = (groupId: string) => {
    if (!confirm('確定要刪除此群組及其所有選項嗎？')) return;
    setBuilderSettings(prev => ({
      groups: prev.groups.filter(g => g.id !== groupId)
    }));
  };

  const addOptionToGroup = (groupId: string) => {
    setBuilderSettings(prev => ({
      groups: prev.groups.map(g => {
        if (g.id === groupId) {
          const availableProducts = g.category_id ? regularProducts.filter(p => p.category_id === g.category_id) : regularProducts;
          if (availableProducts.length === 0) {
            alert('此分類下無可選單品，請先至菜單管理建立單品！');
            return g;
          }
          return { ...g, options: [...g.options, { product_id: availableProducts[0].id, extra_price: 0 }] };
        }
        return g;
      })
    }));
  };

  const updateOption = (groupId: string, index: number, field: keyof ComboOption, value: any) => {
    setBuilderSettings(prev => ({
      groups: prev.groups.map(g => {
        if (g.id === groupId) {
          const newOpts = [...g.options];
          newOpts[index] = { ...newOpts[index], [field]: value };
          return { ...g, options: newOpts };
        }
        return g;
      })
    }));
  };

  const removeOption = (groupId: string, index: number) => {
    setBuilderSettings(prev => ({
      groups: prev.groups.map(g => {
        if (g.id === groupId) {
          const newOpts = [...g.options];
          newOpts.splice(index, 1);
          return { ...g, options: newOpts };
        }
        return g;
      })
    }));
  };

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleSaveComboSettings = async () => {
    if (!builderTarget) return;
    setIsSubmitting(true);
    
    // Validation
    for (const g of builderSettings.groups) {
      if (g.options.length === 0) {
        alert(`群組 "${g.name}" 內必須至少有一個選項！`);
        setIsSubmitting(false);
        return;
      }
      if (g.required_qty > g.max_qty) {
        alert(`群組 "${g.name}" 的必選數量不能大於最多可選數量！`);
        setIsSubmitting(false);
        return;
      }
    }

    const { error } = await supabase.from('products').update({ combo_settings: builderSettings }).eq('id', builderTarget.id);
    
    setIsSubmitting(false);
    if (!error) {
      alert('套餐設定已儲存！');
      fetchProducts();
      closeBuilder();
    } else {
      alert('儲存失敗：' + error.message);
    }
  };


  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Layers /> 套餐與加料管理
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

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <button onClick={() => setActiveTab('modifiers')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', border: 'none', background: activeTab === 'modifiers' ? 'var(--accent-color)' : 'transparent', color: activeTab === 'modifiers' ? 'white' : 'var(--text-secondary)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}>
          <Coffee size={18} /> 加料/客製化群組
        </button>
        <button onClick={() => setActiveTab('combos')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', border: 'none', background: activeTab === 'combos' ? 'var(--accent-color)' : 'transparent', color: activeTab === 'combos' ? 'white' : 'var(--text-secondary)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}>
          <ListPlus size={18} /> 套餐設定
        </button>
      </div>

      {!selectedTenantId ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-app)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
          請先於右上角選擇要操作的商戶/品牌。
        </div>
      ) : (
        <>
          {/* ================= MODIFIERS TAB ================= */}
          {activeTab === 'modifiers' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  建立加料群組（例如：甜度、冰量、配料），並將其綁定至指定的單品上。
                </div>
                <button onClick={() => setIsModModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--accent-color)', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
                  <Plus size={16} /> 新增加料群組
                </button>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {loading ? <div style={{ color: 'var(--text-secondary)' }}>載入中...</div> : 
                 modifiers.length === 0 ? <div style={{ color: 'var(--text-secondary)' }}>尚無加料群組</div> : 
                 modifiers.map(m => (
                  <div key={m.id} style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {m.name}
                        <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: m.type === 'required' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: m.type === 'required' ? '#ef4444' : '#3b82f6' }}>
                          {m.type === 'required' ? '必選' : '選配'}
                        </span>
                      </h3>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {stores.length > 1 && (
                          <button onClick={() => openAssignStoreModal(m)} title="門店分派" style={{ background: 'rgba(59, 130, 246, 0.1)', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}><StoreIcon size={16} /></button>
                        )}
                        <button onClick={() => handleDeleteModifier(m.id)} style={{ background: 'var(--danger-bg)', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}><Trash2 size={16} /></button>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                      <button onClick={() => openOptionsModal(m)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                        <ListPlus size={16} /> 設定選項
                      </button>
                      <button onClick={() => openAssignProdModal(m)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '8px', borderRadius: '6px', border: 'none', background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', cursor: 'pointer', fontWeight: '500' }}>
                        <LinkIcon size={16} /> 綁定單品
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= COMBOS TAB ================= */}
          {activeTab === 'combos' && (
            <div>
              {!builderTarget ? (
                // --- COMBO LIST VIEW ---
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                      在此建立套餐主檔，並設定套餐的群組結構（例如：飲料選一、配餐選二）。
                    </div>
                    <button onClick={() => setIsCreateComboModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--accent-color)', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
                      <Plus size={16} /> 新增套餐
                    </button>
                  </div>

                  <div style={{ background: 'var(--bg-app)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
                        <tr>
                          <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>套餐名稱</th>
                          <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>分類</th>
                          <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>基礎價格</th>
                          <th style={{ padding: '15px 20px', color: 'var(--text-secondary)', fontWeight: '500' }}>結構設定狀態</th>
                          <th style={{ padding: '15px 20px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: '500' }}>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>載入中...</td></tr> : 
                         comboProducts.length === 0 ? <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>尚無套餐資料，請點擊上方按鈕新增。</td></tr> : 
                         comboProducts.map(p => {
                           const groupsCount = p.combo_settings?.groups?.length || 0;
                           return (
                            <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '15px 20px', fontWeight: 'bold' }}>{p.name} <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>{p.sku}</span></td>
                              <td style={{ padding: '15px 20px' }}>
                                <span style={{ background: 'var(--sidebar-hover-bg)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                  {categories.find(c => c.id === p.category_id)?.name || '未分類'}
                                </span>
                              </td>
                              <td style={{ padding: '15px 20px', color: '#16a34a', fontWeight: 'bold' }}>${p.price.toLocaleString()}</td>
                              <td style={{ padding: '15px 20px' }}>
                                {groupsCount > 0 ? 
                                  <span style={{ color: '#16a34a', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>✓ 已設定 {groupsCount} 個群組</span> : 
                                  <span style={{ color: '#ef4444', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>! 尚未設定結構</span>}
                              </td>
                              <td style={{ padding: '15px 20px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                {stores.length > 1 && (
                                  <button onClick={() => openComboAssignStoreModal(p)} title="門店分派" style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', color: '#3b82f6', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', fontWeight: '500' }}>
                                    <StoreIcon size={14} /> 分派
                                  </button>
                                )}
                                <button onClick={() => openBuilder(p)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid #16a34a', color: '#16a34a', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', fontWeight: '500' }}>
                                  <Edit size={14} /> 編輯結構
                                </button>
                                <button onClick={() => handleDeleteCombo(p.id)} style={{ display: 'flex', alignItems: 'center', background: 'var(--danger-bg)', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '8px', borderRadius: '6px' }}><Trash2 size={16} /></button>
                              </td>
                            </tr>
                           )
                         })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                // --- COMBO BUILDER VIEW ---
                <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
                  {/* Builder Header */}
                  <div style={{ background: 'var(--bg-sidebar)', padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h2 style={{ margin: '0 0 5px 0', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ListPlus color="#3b82f6"/> 結構編輯器：{builderTarget.name}
                      </h2>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>建立此套餐的選項群組與加價邏輯。基礎價格為：${builderTarget.price}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={closeBuilder} style={{ padding: '8px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>取消 / 返回</button>
                      <button onClick={handleSaveComboSettings} disabled={isSubmitting} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 15px', borderRadius: '6px', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                        <Save size={16} /> {isSubmitting ? '儲存中...' : '儲存結構'}
                      </button>
                    </div>
                  </div>

                  {/* Builder Canvas */}
                  <div style={{ padding: '30px', background: 'var(--bg-app)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>套餐群組清單</h3>
                      <button onClick={addGroup} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
                        <Plus size={16} /> 新增群組 (Group)
                      </button>
                    </div>

                    {builderSettings.groups.length === 0 ? (
                      <div style={{ padding: '60px', textAlign: 'center', border: '2px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                        <ListPlus size={40} style={{ opacity: 0.5, marginBottom: '15px' }} />
                        <p style={{ margin: 0, fontSize: '16px' }}>目前沒有任何群組，請點擊右上方按鈕新增。</p>
                        <p style={{ margin: '5px 0 0 0', fontSize: '13px', opacity: 0.7 }}>例如：「主餐選一」、「飲料選一」</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {builderSettings.groups.map((group) => (
                          <div key={group.id} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', background: 'var(--bg-sidebar)', overflow: 'hidden' }}>
                            {/* Group Header */}
                            <div style={{ padding: '15px 20px', borderBottom: expandedGroups[group.id] ? '1px solid var(--border-color)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'rgba(0,0,0,0.02)' }} onClick={() => toggleGroupExpand(group.id)}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                {expandedGroups[group.id] ? <ChevronDown size={20} color="var(--text-secondary)"/> : <ChevronRight size={20} color="var(--text-secondary)"/>}
                                <select value={group.category_id || ''} onChange={(e) => handleCategorySelect(group.id, e.target.value)} onClick={(e) => e.stopPropagation()} style={{ fontSize: '16px', fontWeight: 'bold', padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-app)', color: 'var(--text-primary)', width: '250px' }}>
                                  <option value="">-- 選擇連動分類 --</option>
                                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }} onClick={(e) => e.stopPropagation()}>
                                  <span>必選: <input type="number" min="0" value={group.required_qty} onChange={(e) => updateGroup(group.id, 'required_qty', Number(e.target.value))} style={{ width: '50px', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}/> 項</span>
                                  <span>最多: <input type="number" min="1" value={group.max_qty} onChange={(e) => updateGroup(group.id, 'max_qty', Number(e.target.value))} style={{ width: '50px', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}/> 項</span>
                                </div>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); removeGroup(group.id); }} style={{ background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '5px' }} title="刪除群組"><Trash2 size={18} /></button>
                            </div>

                            {/* Group Options */}
                            {expandedGroups[group.id] && (
                              <div style={{ padding: '20px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
                                  <thead>
                                    <tr>
                                      <th style={{ textAlign: 'left', padding: '0 10px 10px 10px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500', width: '60%' }}>綁定單品</th>
                                      <th style={{ textAlign: 'left', padding: '0 10px 10px 10px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500', width: '30%' }}>加價 (+$)</th>
                                      <th style={{ textAlign: 'right', padding: '0 10px 10px 10px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500' }}>操作</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.options.length === 0 ? (
                                      <tr><td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '13px', borderTop: '1px dashed var(--border-color)' }}>群組內無任何選項</td></tr>
                                    ) : (
                                      group.options.map((opt, idx) => (
                                        <tr key={idx} style={{ borderTop: '1px dashed var(--border-color)' }}>
                                          <td style={{ padding: '10px' }}>
                                            <select value={opt.product_id} onChange={(e) => updateOption(group.id, idx, 'product_id', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
                                              <option value="">請選擇單品...</option>
                                              {(group.category_id ? regularProducts.filter(p => p.category_id === group.category_id) : regularProducts).map(rp => <option key={rp.id} value={rp.id}>{rp.name} (${rp.price})</option>)}
                                            </select>
                                          </td>
                                          <td style={{ padding: '10px' }}>
                                            <input type="number" min="0" value={opt.extra_price} onChange={(e) => updateOption(group.id, idx, 'extra_price', Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)' }} placeholder="加價金額" />
                                          </td>
                                          <td style={{ padding: '10px', textAlign: 'right' }}>
                                            <button onClick={() => removeOption(group.id, idx)} style={{ background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                                <button onClick={() => addOptionToGroup(group.id)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'transparent', border: '1px dashed var(--border-color)', color: 'var(--text-primary)', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', width: '100%', justifyContent: 'center', fontSize: '13px' }}>
                                  <Plus size={14} /> 新增單品選項
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* --- MODALS (Reused logic) --- */}
      {/* 新增加料群組 Modal */}
      {isModModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-sidebar)', padding: '30px', borderRadius: '12px', width: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>建立加料/客製群組</h2>
              <button onClick={() => setIsModModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateModifier}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>群組名稱</label>
                <input required type="text" value={newModName} onChange={(e) => setNewModName(e.target.value)} placeholder="例如：甜度、加配料" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>選擇類型</label>
                <select value={newModType} onChange={(e) => setNewModType(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                  <option value="optional">選配 (可選可不選)</option>
                  <option value="required">必選 (結帳時強制跳出要求選擇)</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsModModalOpen(false)} style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>取消</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '10px 15px', borderRadius: '6px', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer' }}>確認建立</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 新增套餐 Modal */}
      {isCreateComboModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-sidebar)', padding: '30px', borderRadius: '12px', width: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>建立新套餐</h2>
              <button onClick={() => setIsCreateComboModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateCombo}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>所屬分類 <span style={{color: 'red'}}>*</span></label>
                <select required value={newCombo.category_id} onChange={(e) => setNewCombo({...newCombo, category_id: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
                  <option value="">請選擇分類...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>套餐代碼 (SKU)</label>
                <input type="text" value={newCombo.sku} onChange={(e) => setNewCombo({...newCombo, sku: e.target.value})} placeholder="選填" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>套餐名稱 <span style={{color: 'red'}}>*</span></label>
                <input required type="text" value={newCombo.name} onChange={(e) => setNewCombo({...newCombo, name: e.target.value})} placeholder="例如：超值全餐" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>基礎價格 <span style={{color: 'red'}}>*</span></label>
                <input required type="number" value={newCombo.price} onChange={(e) => setNewCombo({...newCombo, price: Number(e.target.value)})} placeholder="套餐基礎售價" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '5px' }}>後續可於結構中為各別選項設定額外加價。</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsCreateComboModalOpen(false)} style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>取消</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '10px 15px', borderRadius: '6px', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer' }}>建立套餐</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 設定選項 Modal (加料) */}
      {isOptionsModalOpen && selectedModifier && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-sidebar)', padding: '30px', borderRadius: '12px', width: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>設定選項：{selectedModifier.name}</h2>
              <button onClick={() => setIsOptionsModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAddOption} style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: 'var(--bg-app)', padding: '15px', borderRadius: '8px' }}>
              <input required type="text" value={newOptName} onChange={(e) => setNewOptName(e.target.value)} placeholder="選項名稱 (如：半糖)" style={{ flex: 2, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-sidebar)', color: 'var(--text-primary)' }} />
              <input type="number" value={newOptPrice} onChange={(e) => setNewOptPrice(Number(e.target.value))} placeholder="加價 (預設 0)" style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-sidebar)', color: 'var(--text-primary)' }} />
              <button type="submit" disabled={isSubmitting} style={{ padding: '8px 15px', borderRadius: '6px', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer' }}>新增</button>
            </form>

            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {options.length === 0 ? <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>尚無選項資料</div> : 
               <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                 <tbody>
                   {options.map(o => (
                     <tr key={o.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                       <td style={{ padding: '10px', fontWeight: '500' }}>{o.name}</td>
                       <td style={{ padding: '10px', color: '#16a34a' }}>{o.extra_price > 0 ? `+$${o.extra_price}` : '+$0'}</td>
                       <td style={{ padding: '10px', textAlign: 'right' }}>
                         <button onClick={() => handleDeleteOption(o.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}><Trash2 size={16}/></button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
              }
            </div>
          </div>
        </div>
      )}

      {/* 綁定單品 Modal (加料) */}
      {isAssignProdModalOpen && assignProdTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-sidebar)', padding: '30px', borderRadius: '12px', width: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LinkIcon size={20} color="#16a34a" /> 綁定適用單品
              </h2>
              <button onClick={() => setIsAssignProdModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              請勾選需要使用 <b>{assignProdTarget.name}</b> 加料群組的單品。
            </p>

            <div style={{ maxHeight: '300px', overflowY: 'auto', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', marginBottom: '20px' }}>
              {regularProducts.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>尚無單品，請先至菜單管理建立單品。</div>
              ) : (
                regularProducts.map(p => (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={productStatus[p.id] || false} 
                      onChange={(e) => setProductStatus({...productStatus, [p.id]: e.target.checked})}
                      style={{ width: '18px', height: '18px', accentColor: '#16a34a' }}
                    />
                    <span style={{ fontWeight: '500' }}>{p.name}</span>
                  </label>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setIsAssignProdModalOpen(false)} style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>取消</button>
              <button onClick={handleSaveAssignProd} disabled={isSubmitting} style={{ padding: '10px 15px', borderRadius: '6px', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer' }}>{isSubmitting ? '儲存中...' : '確認綁定'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 門店分派 Modal (加料) */}
      {isAssignStoreModalOpen && assignStoreTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-sidebar)', padding: '30px', borderRadius: '12px', width: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StoreIcon size={20} color="#3b82f6" /> 門店分派設定
              </h2>
              <button onClick={() => setIsAssignStoreModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              請勾選要啟用 <b>{assignStoreTarget.name}</b> 的門店。未勾選的門店將不會出現此加料群組。
            </p>

            <div style={{ maxHeight: '300px', overflowY: 'auto', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', marginBottom: '20px' }}>
              {stores.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>尚無門店資料。</div>
              ) : (
                stores.map(store => (
                  <label key={store.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={storeStatus[store.id] || false} 
                      onChange={(e) => setStoreStatus({...storeStatus, [store.id]: e.target.checked})}
                      style={{ width: '18px', height: '18px', accentColor: '#3b82f6' }}
                    />
                    <span style={{ fontWeight: '500' }}>{store.name} <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>({store.store_code})</span></span>
                  </label>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setIsAssignStoreModalOpen(false)} style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>取消</button>
              <button onClick={handleSaveAssignStore} disabled={isSubmitting} style={{ padding: '10px 15px', borderRadius: '6px', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer' }}>{isSubmitting ? '儲存中...' : '確認儲存'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 門店分派 Modal (套餐) */}
      {isComboAssignStoreModalOpen && comboAssignStoreTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-sidebar)', padding: '30px', borderRadius: '12px', width: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StoreIcon size={20} color="#3b82f6" /> 門店分派設定
              </h2>
              <button onClick={() => setIsComboAssignStoreModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              請勾選要啟用 <b>{comboAssignStoreTarget.name}</b> 的門店。未勾選的門店將不會上架此套餐。
            </p>

            <div style={{ maxHeight: '300px', overflowY: 'auto', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', marginBottom: '20px' }}>
              {stores.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>尚無門店資料。</div>
              ) : (
                stores.map(store => (
                  <label key={store.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={comboStoreStatus[store.id] || false} 
                      onChange={(e) => setComboStoreStatus({...comboStoreStatus, [store.id]: e.target.checked})}
                      style={{ width: '18px', height: '18px', accentColor: '#3b82f6' }}
                    />
                    <span style={{ fontWeight: '500' }}>{store.name} <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>({store.store_code})</span></span>
                  </label>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setIsComboAssignStoreModalOpen(false)} style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>取消</button>
              <button onClick={handleSaveComboAssignStore} disabled={isSubmitting} style={{ padding: '10px 15px', borderRadius: '6px', border: 'none', background: 'var(--accent-color)', color: 'white', cursor: 'pointer' }}>{isSubmitting ? '儲存中...' : '確認儲存'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
