import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { db } from '../lib/db';
import type { CartModifier } from '../store/cartStore';

interface ModifierModalProps {
  product: any;
  onClose: () => void;
  onConfirm: (product: any, modifiers: CartModifier[]) => void;
}

export default function ModifierModal({ product, onClose, onConfirm }: ModifierModalProps) {
  const [loading, setLoading] = useState(true);
  // Array of grouped modifiers
  // Each modifier group has: id, name, type (required/optional), max_options, options: []
  const [modifierGroups, setModifierGroups] = useState<any[]>([]);
  
  // Selected options: Map<modifier_id, Set<option_id>>
  const [selectedOptions, setSelectedOptions] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    loadModifiers();
  }, [product.id]);

  const loadModifiers = async () => {
    try {
      const data = await db.sql`
        SELECT pm.modifier_id, pm.is_required, pm.max_options,
               m.name as modifier_name, m.type as modifier_type,
               mo.id as option_id, mo.name as option_name, mo.extra_price
        FROM product_modifiers pm
        JOIN modifiers m ON m.id = pm.modifier_id
        JOIN modifier_options mo ON mo.modifier_id = m.id
        WHERE pm.product_id = ${product.id}
      `;

      // Group by modifier_id
      const groups: Record<string, any> = {};
      data.forEach(row => {
        if (!groups[row.modifier_id]) {
          groups[row.modifier_id] = {
            id: row.modifier_id,
            name: row.modifier_name,
            type: row.modifier_type, // 'required' or 'optional'
            is_required: row.is_required === 1,
            max_options: row.max_options,
            options: []
          };
        }
        groups[row.modifier_id].options.push({
          id: row.option_id,
          name: row.option_name,
          extra_price: row.extra_price
        });
      });

      const groupedArray = Object.values(groups);
      setModifierGroups(groupedArray);
      
      // Auto-select first option for required groups if max_options === 1
      const initialSelected: Record<string, Set<string>> = {};
      groupedArray.forEach(g => {
        initialSelected[g.id] = new Set();
        if (g.is_required && g.max_options === 1 && g.options.length > 0) {
          initialSelected[g.id].add(g.options[0].id);
        }
      });
      setSelectedOptions(initialSelected);
      
    } catch (err) {
      console.error('Failed to load modifiers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOption = (groupId: string, optionId: string, maxOptions: number) => {
    setSelectedOptions(prev => {
      const newSelected = { ...prev };
      const groupSet = new Set(newSelected[groupId]);
      
      if (groupSet.has(optionId)) {
        // Deselect
        groupSet.delete(optionId);
      } else {
        // Select
        if (maxOptions === 1) {
          groupSet.clear(); // single choice
        } else if (groupSet.size >= maxOptions && maxOptions > 0) {
          // Reached max, do nothing or replace oldest (do nothing is simpler)
          return prev;
        }
        groupSet.add(optionId);
      }
      
      newSelected[groupId] = groupSet;
      return newSelected;
    });
  };

  const calculateSubtotal = () => {
    let extra = 0;
    modifierGroups.forEach(g => {
      const selected = selectedOptions[g.id] || new Set();
      g.options.forEach((opt: any) => {
        if (selected.has(opt.id)) {
          extra += opt.extra_price;
        }
      });
    });
    return product.price + extra;
  };

  const isFormValid = () => {
    for (const g of modifierGroups) {
      if (g.is_required) {
        const selected = selectedOptions[g.id];
        if (!selected || selected.size === 0) return false;
      }
    }
    return true;
  };

  const handleConfirm = () => {
    if (!isFormValid()) return;
    
    const cartModifiers: CartModifier[] = [];
    modifierGroups.forEach(g => {
      const selected = selectedOptions[g.id] || new Set();
      g.options.forEach((opt: any) => {
        if (selected.has(opt.id)) {
          cartModifiers.push({
            modifier_id: g.id,
            modifier_name: g.name,
            option_id: opt.id,
            option_name: opt.name,
            extra_price: opt.extra_price
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

  // If no modifiers, auto confirm immediately (this case should ideally be handled before rendering modal, but fallback here)
  if (modifierGroups.length === 0) {
    // We shouldn't automatically call onConfirm in render, just show empty state and let user click confirm
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--bg-sidebar)', width: '100%', maxWidth: '500px', borderRadius: '20px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-app)' }}>
          <div>
            <h2 style={{ margin: '0 0 5px 0', fontSize: '1.25rem' }}>{product.name}</h2>
            <div style={{ color: '#3b82f6', fontWeight: 'bold' }}>${product.price}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {modifierGroups.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', margin: '20px 0' }}>此商品無客製化選項</p>
          ) : (
            modifierGroups.map(group => (
              <div key={group.id} style={{ marginBottom: '25px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                    {group.name}
                    {group.is_required && <span style={{ color: '#ef4444', fontSize: '0.9rem', marginLeft: '8px' }}>*必選</span>}
                  </h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {group.max_options === 1 ? '單選' : `最多選 ${group.max_options} 項`}
                  </span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {group.options.map((opt: any) => {
                    const isSelected = selectedOptions[group.id]?.has(opt.id);
                    return (
                      <div 
                        key={opt.id}
                        onClick={() => handleToggleOption(group.id, opt.id, group.max_options)}
                        style={{ 
                          padding: '12px 15px', 
                          borderRadius: '10px', 
                          border: isSelected ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                          background: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-app)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.1s'
                        }}
                      >
                        <span style={{ fontWeight: isSelected ? '600' : 'normal', color: isSelected ? '#3b82f6' : 'var(--text-primary)' }}>{opt.name}</span>
                        {opt.extra_price > 0 && (
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
              background: isFormValid() ? '#3b82f6' : 'var(--border-color)', 
              color: isFormValid() ? 'white' : 'var(--text-secondary)',
              fontSize: '1.2rem', 
              fontWeight: 'bold',
              cursor: isFormValid() ? 'pointer' : 'not-allowed',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: isFormValid() ? '0 10px 15px -3px rgba(59, 130, 246, 0.3)' : 'none'
            }}
          >
            <span>加入購物車</span>
            <span>${calculateSubtotal()}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
