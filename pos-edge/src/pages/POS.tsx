import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, RefreshCw, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { db, initDb } from '../lib/db';
import { syncStoreData } from '../lib/sync';
import { startBackgroundSync } from '../lib/syncOrders';
import { useCartStore } from '../store/cartStore';
import type { CartModifier } from '../store/cartStore';
import ModifierModal from '../components/ModifierModal';
import OrderHistoryModal from '../components/OrderHistoryModal';
import { FileText } from 'lucide-react';

export default function POS() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('載入中...');
  const [syncing, setSyncing] = useState(false);
  const [locked, setLocked] = useState(false);
  
  // Local Data State
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  // Cart and Modifiers
  const { items: cartItems, addToCart, removeFromCart, updateQuantity, getTotalAmount } = useCartStore();
  const [selectedProductForModal, setSelectedProductForModal] = useState<any | null>(null);
  
  // Order History
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

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
        .select('name, is_active, valid_until, tenant_id')
        .eq('id', id)
        .single();
      
      if (error || !store) throw new Error('Store not found or offline');
      
      setStoreName(store.name);
      setTenantId(store.tenant_id);

      const isExpired = store.valid_until && new Date(store.valid_until) < new Date();

      if (!store.is_active || isExpired) {
        setLocked(true);
        setSyncing(false);
        return;
      }
      
      // Update last validation time
      localStorage.setItem('pos_last_validation', Date.now().toString());
      setLocked(false);

      // 2. Initialize local SQLite
      await initDb();
      
      // 3. Fetch categories, products from Supabase and INSERT INTO SQLite
      await syncStoreData(store.tenant_id, id);
      
      // 4. Load local data for UI
      await loadLocalData();

      // 5. Start Background Order Sync
      startBackgroundSync(30000); // Check every 30s
      
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

  const loadLocalData = async () => {
    try {
      const cats = await db.sql`SELECT * FROM categories ORDER BY sort_order ASC`;
      const prods = await db.sql`SELECT * FROM products`;
      
      setCategories(cats);
      setProducts(prods);
      
      if (cats.length > 0) {
        setActiveCategoryId(cats[0].id);
      }
    } catch (err) {
      console.error('Error loading local data:', err);
    }
  };

  const handleProductClick = async (prod: any) => {
    // Check if product has modifiers
    const res = await db.sql`SELECT count(*) as count FROM product_modifiers WHERE product_id = ${prod.id}`;
    const hasModifiers = res[0].count > 0;
    
    if (hasModifiers) {
      setSelectedProductForModal(prod);
    } else {
      addToCart({
        product_id: prod.id,
        product_name: prod.name,
        unit_price: prod.price,
        quantity: 1,
        modifiers: []
      });
    }
  };

  const handleModalConfirm = (product: any, modifiers: CartModifier[]) => {
    addToCart({
      product_id: product.id,
      product_name: product.name,
      unit_price: product.price,
      quantity: 1,
      modifiers
    });
    setSelectedProductForModal(null);
  };

  const handleCheckout = async () => {
    if (!storeId || !tenantId) return;
    try {
      const { processCheckout } = await import('../lib/checkout');
      const { orderNumber } = await processCheckout(cartItems, storeId, tenantId, 'cash');
      
      alert(`結帳成功！單號：${orderNumber}`);
      useCartStore.getState().clearCart();
    } catch (err: any) {
      alert(`結帳失敗：${err.message}`);
    }
  };

  const handleLogout = async () => {
    // 登出但不解除門店綁定 (換班概念)
    await supabase.auth.signOut();
  };

  const handleUnbind = async () => {
    // 解除設備與門店的綁定
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
        <button onClick={handleUnbind} style={{ marginTop: '10px', padding: '10px 20px', background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer' }}>
          切換門店 (解除綁定)
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
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span>{profile?.full_name || profile?.email}</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{profile?.role === 'super_admin' ? '總管理員' : profile?.role === 'tenant_admin' ? '商戶管理員' : '門店人員'}</span>
          </div>
          <button onClick={() => setIsHistoryModalOpen(true)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <FileText size={16} /> 歷史訂單
          </button>
          <button onClick={handleLogout} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <LogOut size={16} /> 交班登出
          </button>
          {(profile?.role === 'super_admin' || profile?.role === 'tenant_admin') && (
            <button onClick={handleUnbind} style={{ background: 'transparent', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
              切換門店
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)', background: 'var(--bg-app)' }}>
          {/* Categories Horizontal Scroll */}
          <div style={{ display: 'flex', overflowX: 'auto', padding: '15px 20px', gap: '10px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-sidebar)' }}>
            {categories.map(cat => (
              <button 
                key={cat.id} 
                onClick={() => setActiveCategoryId(cat.id)}
                style={{ 
                  padding: '10px 20px', 
                  borderRadius: '20px', 
                  border: 'none', 
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  fontWeight: '600',
                  background: activeCategoryId === cat.id ? '#3b82f6' : 'transparent',
                  color: activeCategoryId === cat.id ? 'white' : 'var(--text-secondary)',
                  border: activeCategoryId === cat.id ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                  transition: 'all 0.2s'
                }}
              >
                {cat.name}
              </button>
            ))}
            {categories.length === 0 && !syncing && <div style={{ color: 'var(--text-secondary)' }}>尚無分類資料</div>}
          </div>
          
          {/* Products Grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px', alignContent: 'start' }}>
            {products.filter(p => p.category_id === activeCategoryId).map(prod => (
              <div 
                key={prod.id} 
                style={{ 
                  background: 'var(--bg-sidebar)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '12px', 
                  padding: '15px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '120px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  transition: 'transform 0.1s, box-shadow 0.1s'
                }}
                onClick={() => handleProductClick(prod)}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '1.1rem', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {prod.name}
                </div>
                <div style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: '1.1rem', marginTop: '10px' }}>
                  ${prod.price}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Cart Sidebar */}
        <div style={{ flex: 1, padding: '20px', background: 'var(--bg-sidebar)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>購物車清單</h3>
            <span style={{ background: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>
              {cartItems.reduce((sum, item) => sum + item.quantity, 0)} 項
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {cartItems.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', border: '2px dashed var(--border-color)', borderRadius: '12px' }}>
                請點擊左側商品加入
              </div>
            ) : (
              cartItems.map(item => (
                <div key={item.cart_id} style={{ padding: '15px', background: 'var(--bg-app)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{item.product_name}</div>
                    <div style={{ fontWeight: 'bold', color: '#3b82f6' }}>${item.subtotal}</div>
                  </div>
                  
                  {item.modifiers.length > 0 && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {item.modifiers.map(m => (
                        <span key={m.option_id} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '2px 6px', borderRadius: '4px' }}>
                          {m.option_name} {m.extra_price > 0 && `(+$${m.extra_price})`}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
                    <button onClick={() => removeFromCart(item.cart_id)} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}>
                      刪除
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-sidebar)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <button onClick={() => updateQuantity(item.cart_id, -1)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: 'var(--bg-app)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                      <span style={{ fontWeight: '600', width: '20px', textAlign: 'center', color: 'var(--text-primary)' }}>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.cart_id, 1)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: 'var(--bg-app)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', fontSize: '1.2rem', color: 'var(--text-primary)' }}>
              <span>總計金額</span>
              <span style={{ fontWeight: 'bold', fontSize: '1.5rem', color: '#3b82f6' }}>${getTotalAmount()}</span>
            </div>
            <button 
              disabled={cartItems.length === 0}
              onClick={handleCheckout}
              style={{ width: '100%', padding: '20px', background: cartItems.length === 0 ? 'var(--border-color)' : '#3b82f6', color: cartItems.length === 0 ? 'var(--text-secondary)' : 'white', border: 'none', borderRadius: '12px', fontSize: '1.3rem', fontWeight: 'bold', cursor: cartItems.length === 0 ? 'not-allowed' : 'pointer', boxShadow: cartItems.length === 0 ? 'none' : '0 10px 15px -3px rgba(59, 130, 246, 0.3)', transition: 'all 0.2s' }}
            >
              現金結帳
            </button>
          </div>
        </div>
      </div>

      {/* Modifier Modal */}
      {selectedProductForModal && (
        <ModifierModal 
          product={selectedProductForModal} 
          onClose={() => setSelectedProductForModal(null)}
          onConfirm={handleModalConfirm}
        />
      )}

      {/* Order History Modal */}
      {isHistoryModalOpen && (
        <OrderHistoryModal onClose={() => setIsHistoryModalOpen(false)} />
      )}
    </div>
  );
}
