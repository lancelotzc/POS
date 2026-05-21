import { useState, useEffect } from 'react';
import { X, Save, RefreshCw, Printer, MonitorSmartphone, Settings } from 'lucide-react';
import { db } from '../lib/db';
import { supabase } from '../lib/supabase';

interface SettingsModalProps {
  onClose: () => void;
  onSettingsChanged: () => void;
}

export default function SettingsModal({ onClose, onSettingsChanged }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'menu' | 'device'>('general');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Settings State
  const [checkoutMode, setCheckoutMode] = useState<'pay_first' | 'pay_later'>('pay_first');
  const [printerIp, setPrinterIp] = useState('');
  const [deviceNo, setDeviceNo] = useState('');

  // Menu State (Sold out management)
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');
  
  // Sold out mapping: productId -> boolean
  const [soldOutStatus, setSoldOutStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Load local settings
    const mode = localStorage.getItem('pos_checkout_mode') as 'pay_first' | 'pay_later' || 'pay_first';
    const printer = localStorage.getItem('pos_printer_ip') || '';
    const dNo = localStorage.getItem('pos_device_no') || 'POS-01';
    
    setCheckoutMode(mode);
    setPrinterIp(printer);
    setDeviceNo(dNo);

    loadMenuData();
  }, []);

  const loadMenuData = async () => {
    setLoading(true);
    try {
      const cats = await db.sql`SELECT * FROM categories ORDER BY sort_order ASC`;
      const prods = await db.sql`SELECT * FROM products WHERE is_active = 1`;
      
      setCategories(cats);
      setProducts(prods);
      if (cats.length > 0) setActiveCategoryId(cats[0].id);

      // Load sold out status
      const storeId = localStorage.getItem('pos_store_id');
      if (storeId) {
        // Query local store_product_status if we synced it, or just query Supabase directly for simplicity in settings
        // To be offline-friendly, we should use local DB if we have it, but for sold out we might want to sync immediately
        const { data } = await supabase.from('store_product_status').select('product_id, is_sold_out').eq('store_id', storeId);
        if (data) {
          const statusMap: Record<string, boolean> = {};
          data.forEach(row => {
            statusMap[row.product_id] = row.is_sold_out;
          });
          setSoldOutStatus(statusMap);
        }
      }
    } catch (err) {
      console.error('Failed to load menu data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSoldOut = async (productId: string, currentStatus: boolean) => {
    const storeId = localStorage.getItem('pos_store_id');
    if (!storeId) return;

    const newStatus = !currentStatus;
    
    // Update local state immediately for fast UI
    setSoldOutStatus(prev => ({ ...prev, [productId]: newStatus }));

    // Sync to Supabase
    try {
      const { error } = await supabase.from('store_product_status').upsert({
        store_id: storeId,
        product_id: productId,
        is_sold_out: newStatus,
        updated_at: new Date().toISOString()
      }, { onConflict: 'store_id,product_id' });

      if (error) throw error;
      
      // Update local SQLite as well
      await db.sql`UPDATE store_product_status SET is_sold_out = ${newStatus ? 1 : 0} WHERE product_id = ${productId}`;
    } catch (err) {
      console.error('Failed to update sold out status:', err);
      alert('更新狀態失敗，請確認網路連線');
      // Revert UI
      setSoldOutStatus(prev => ({ ...prev, [productId]: currentStatus }));
    }
  };

  const handleSaveSettings = () => {
    setSaving(true);
    localStorage.setItem('pos_checkout_mode', checkoutMode);
    localStorage.setItem('pos_printer_ip', printerIp);
    localStorage.setItem('pos_device_no', deviceNo);
    
    setTimeout(() => {
      setSaving(false);
      onSettingsChanged();
      onClose();
    }, 500);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--bg-app)', width: '100%', maxWidth: '800px', height: '80vh', borderRadius: '20px', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-sidebar)' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings size={24} /> 系統設定
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar */}
          <div style={{ width: '200px', background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
            <button 
              onClick={() => setActiveTab('general')}
              style={{ padding: '15px 20px', textAlign: 'left', background: activeTab === 'general' ? 'rgba(59, 130, 246, 0.1)' : 'transparent', color: activeTab === 'general' ? '#3b82f6' : 'var(--text-primary)', border: 'none', borderLeft: activeTab === 'general' ? '4px solid #3b82f6' : '4px solid transparent', cursor: 'pointer', fontWeight: activeTab === 'general' ? 'bold' : 'normal' }}
            >
              一般設定 (營運模式)
            </button>
            <button 
              onClick={() => setActiveTab('menu')}
              style={{ padding: '15px 20px', textAlign: 'left', background: activeTab === 'menu' ? 'rgba(59, 130, 246, 0.1)' : 'transparent', color: activeTab === 'menu' ? '#3b82f6' : 'var(--text-primary)', border: 'none', borderLeft: activeTab === 'menu' ? '4px solid #3b82f6' : '4px solid transparent', cursor: 'pointer', fontWeight: activeTab === 'menu' ? 'bold' : 'normal' }}
            >
              菜單狀態 (售完管理)
            </button>
            <button 
              onClick={() => setActiveTab('device')}
              style={{ padding: '15px 20px', textAlign: 'left', background: activeTab === 'device' ? 'rgba(59, 130, 246, 0.1)' : 'transparent', color: activeTab === 'device' ? '#3b82f6' : 'var(--text-primary)', border: 'none', borderLeft: activeTab === 'device' ? '4px solid #3b82f6' : '4px solid transparent', cursor: 'pointer', fontWeight: activeTab === 'device' ? 'bold' : 'normal' }}
            >
              硬體設備 (出單機)
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
            
            {activeTab === 'general' && (
              <div>
                <h3 style={{ margin: '0 0 20px 0', color: 'var(--text-primary)' }}>營運模式設定</h3>
                
                <div style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '10px', color: 'var(--text-secondary)' }}>結帳模式</label>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div 
                      onClick={() => setCheckoutMode('pay_first')}
                      style={{ flex: 1, padding: '20px', borderRadius: '12px', border: checkoutMode === 'pay_first' ? '2px solid #3b82f6' : '1px solid var(--border-color)', background: checkoutMode === 'pay_first' ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-sidebar)', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      <h4 style={{ margin: '0 0 5px 0', color: checkoutMode === 'pay_first' ? '#3b82f6' : 'var(--text-primary)' }}>先結帳 (Pay First)</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>點餐後立即收銀，適用於飲料店、快餐店或外帶為主之門店。</p>
                    </div>
                    <div 
                      onClick={() => setCheckoutMode('pay_later')}
                      style={{ flex: 1, padding: '20px', borderRadius: '12px', border: checkoutMode === 'pay_later' ? '2px solid #3b82f6' : '1px solid var(--border-color)', background: checkoutMode === 'pay_later' ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-sidebar)', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      <h4 style={{ margin: '0 0 5px 0', color: checkoutMode === 'pay_later' ? '#3b82f6' : 'var(--text-primary)' }}>後結帳 (Pay Later)</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>啟用「桌況圖」。帶位入座後點餐送廚，客完食用後再進行結帳。</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'menu' && (
              <div>
                <h3 style={{ margin: '0 0 20px 0', color: 'var(--text-primary)' }}>售完狀態管理</h3>
                {loading ? (
                  <div style={{ color: 'var(--text-secondary)' }}>載入中...</div>
                ) : (
                  <div style={{ display: 'flex', gap: '20px' }}>
                    <div style={{ width: '150px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {categories.map(cat => (
                        <button 
                          key={cat.id}
                          onClick={() => setActiveCategoryId(cat.id)}
                          style={{ padding: '10px', borderRadius: '8px', border: 'none', background: activeCategoryId === cat.id ? '#3b82f6' : 'var(--bg-sidebar)', color: activeCategoryId === cat.id ? 'white' : 'var(--text-primary)', cursor: 'pointer', textAlign: 'left' }}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {products.filter(p => p.category_id === activeCategoryId).map(prod => (
                        <div key={prod.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: 'var(--bg-sidebar)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <div>
                            <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{prod.name}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>${prod.price}</div>
                          </div>
                          <button 
                            onClick={() => handleToggleSoldOut(prod.id, !!soldOutStatus[prod.id])}
                            style={{ 
                              padding: '8px 16px', 
                              borderRadius: '20px', 
                              border: 'none', 
                              background: soldOutStatus[prod.id] ? '#ef4444' : 'rgba(16, 185, 129, 0.1)', 
                              color: soldOutStatus[prod.id] ? 'white' : '#10b981',
                              fontWeight: 'bold',
                              cursor: 'pointer'
                            }}
                          >
                            {soldOutStatus[prod.id] ? '已售完 (恢復供應)' : '正常供應'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'device' && (
              <div>
                <h3 style={{ margin: '0 0 20px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <MonitorSmartphone size={20} /> 硬體設備設定
                </h3>
                
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>本機設備編號 (Device No.)</label>
                  <input 
                    type="text" 
                    value={deviceNo}
                    onChange={e => setDeviceNo(e.target.value)}
                    placeholder="e.g. POS-01"
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-sidebar)', color: 'var(--text-primary)' }}
                  />
                  <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>用於識別結帳機台，會記錄於訂單資訊中。</p>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                    <Printer size={16} /> 網路出單機 IP 地址
                  </label>
                  <input 
                    type="text" 
                    value={printerIp}
                    onChange={e => setPrinterIp(e.target.value)}
                    placeholder="e.g. 192.168.1.100"
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-sidebar)', color: 'var(--text-primary)' }}
                  />
                  <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>支援 ESC/POS 協議的網路熱感應印表機。留空則不列印。</p>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-sidebar)', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            取消
          </button>
          <button 
            onClick={handleSaveSettings}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
          >
            {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
            儲存設定
          </button>
        </div>

      </div>
    </div>
  );
}
