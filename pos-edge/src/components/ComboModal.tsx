import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { db } from '../lib/db';
import type { CartModifier } from '../store/cartStore';

interface ComboModalProps {
  product: any;
  onClose: () => void;
  onConfirm: (product: any, modifiers: CartModifier[]) => void;
}

export default function ComboModal({ product, onClose, onConfirm }: ComboModalProps) {
  const [loading, setLoading] = useState(true);
  
  // Parsed combo settings
  const [groups, setGroups] = useState<any[]>([]);
  // Mapping of product_id -> { name, price }
  const [productMap, setProductMap] = useState<Record<string, any>>({});
  
  // Selected options: Map<group_id, Set<product_id>>
  const [selectedOptions, setSelectedOptions] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    loadComboData();
  }, [product.id]);

  const loadComboData = async () => {
    try {
      if (!product.combo_settings) {
        setLoading(false);
        return;
      }

      let settings;
      try {
        settings = typeof product.combo_settings === 'string' 
          ? JSON.parse(product.combo_settings) 
          : product.combo_settings;
      } catch (e) {
        console.error('Invalid combo settings JSON', e);
        setLoading(false);
        return;
      }

      if (!settings.groups || !Array.isArray(settings.groups)) {
        setLoading(false);
        return;
      }

      const allProductIds = new Set<string>();
      settings.groups.forEach((g: any) => {
        g.options?.forEach((opt: any) => allProductIds.add(opt.product_id));
      });

      // Fetch product names for the options
      const map: Record<string, any> = {};
      if (allProductIds.size > 0) {
        
        // Let's just fetch all products and map them (since it's a small local DB)
        const allProducts = await db.sql`SELECT id, name, price FROM products`;
        allProducts.forEach(p => {
          map[p.id] = p;
        });
      }

      setProductMap(map);
      setGroups(settings.groups);

      // Auto-select for groups with required_qty = 1 and exactly 1 option
      const initialSelected: Record<string, Set<string>> = {};
      settings.groups.forEach((g: any) => {
        initialSelected[g.id] = new Set();
        if (g.required_qty === 1 && g.max_qty === 1 && g.options?.length === 1) {
          initialSelected[g.id].add(g.options[0].product_id);
        }
      });
      setSelectedOptions(initialSelected);

    } catch (err) {
      console.error('Failed to load combo data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOption = (groupId: string, productId: string, maxQty: number) => {
    setSelectedOptions(prev => {
      const newSelected = { ...prev };
      const groupSet = new Set(newSelected[groupId]);
      
      if (groupSet.has(productId)) {
        groupSet.delete(productId);
      } else {
        if (maxQty === 1) {
          groupSet.clear(); 
        } else if (groupSet.size >= maxQty && maxQty > 0) {
          return prev;
        }
        groupSet.add(productId);
      }
      
      newSelected[groupId] = groupSet;
      return newSelected;
    });
  };

  const calculateSubtotal = () => {
    let extra = 0;
    groups.forEach(g => {
      const selected = selectedOptions[g.id] || new Set();
      g.options?.forEach((opt: any) => {
        if (selected.has(opt.product_id)) {
          extra += Number(opt.extra_price || 0);
        }
      });
    });
    return Number(product.price) + extra;
  };

  const isFormValid = () => {
    for (const g of groups) {
      const selected = selectedOptions[g.id];
      const count = selected ? selected.size : 0;
      if (count < g.required_qty) return false;
    }
    return true;
  };

  const handleConfirm = () => {
    if (!isFormValid()) return;
    
    const cartModifiers: CartModifier[] = [];
    groups.forEach(g => {
      const selected = selectedOptions[g.id] || new Set();
      g.options?.forEach((opt: any) => {
        if (selected.has(opt.product_id)) {
          cartModifiers.push({
            modifier_id: g.id,
            modifier_name: g.name,
            option_id: opt.product_id,
            option_name: productMap[opt.product_id]?.name || '未知商品',
            extra_price: Number(opt.extra_price || 0)
          });
        }
      });
    });
    
    onConfirm(product, cartModifiers);
  };

  if (loading) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'var(--bg-app)', padding: '20px', borderRadius: '12px' }}>載入中...</div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--bg-sidebar)', width: '100%', maxWidth: '500px', borderRadius: '20px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-app)' }}>
          <div>
            <h2 style={{ margin: '0 0 5px 0', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ padding: '2px 6px', background: '#f59e0b', color: 'white', fontSize: '0.75rem', borderRadius: '4px' }}>套餐</span>
              {product.name}
            </h2>
            <div style={{ color: '#3b82f6', fontWeight: 'bold' }}>${product.price}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {groups.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', margin: '20px 0' }}>此套餐尚未設定子選項</p>
          ) : (
            groups.map(group => (
              <div key={group.id} style={{ marginBottom: '25px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                    {group.name}
                    {group.required_qty > 0 && <span style={{ color: '#ef4444', fontSize: '0.9rem', marginLeft: '8px' }}>*必選 {group.required_qty} 項</span>}
                  </h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {group.max_qty === 1 ? '單選' : `最多選 ${group.max_qty} 項`}
                  </span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '10px' }}>
                  {group.options?.map((opt: any) => {
                    const isSelected = selectedOptions[group.id]?.has(opt.product_id);
                    const prodInfo = productMap[opt.product_id];
                    if (!prodInfo) return null;

                    return (
                      <div 
                        key={opt.product_id}
                        onClick={() => handleToggleOption(group.id, opt.product_id, group.max_qty)}
                        style={{ 
                          padding: '12px 15px', 
                          borderRadius: '10px', 
                          border: isSelected ? '2px solid #f59e0b' : '1px solid var(--border-color)',
                          background: isSelected ? 'rgba(245, 158, 11, 0.05)' : 'var(--bg-app)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.1s'
                        }}
                      >
                        <span style={{ fontWeight: isSelected ? '600' : 'normal', color: isSelected ? '#f59e0b' : 'var(--text-primary)' }}>
                          {prodInfo.name}
                        </span>
                        {Number(opt.extra_price) > 0 && (
                          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>+${opt.extra_price}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-app)' }}>
          <button 
            onClick={handleConfirm}
            disabled={!isFormValid()}
            style={{ 
              width: '100%', 
              padding: '16px', 
              borderRadius: '12px', 
              border: 'none', 
              background: isFormValid() ? '#f59e0b' : 'var(--border-color)', 
              color: isFormValid() ? 'white' : 'var(--text-secondary)',
              fontSize: '1.2rem', 
              fontWeight: 'bold',
              cursor: isFormValid() ? 'pointer' : 'not-allowed',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: isFormValid() ? '0 10px 15px -3px rgba(245, 158, 11, 0.3)' : 'none'
            }}
          >
            <span>確認套餐</span>
            <span>${calculateSubtotal()}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
