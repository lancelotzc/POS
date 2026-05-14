import { create } from 'zustand';

export interface CartModifier {
  modifier_id: string;
  modifier_name: string;
  option_id: string;
  option_name: string;
  extra_price: number;
}

export interface CartItem {
  cart_id: string; // Unique ID for this item in the cart (e.g. timestamp)
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  modifiers: CartModifier[];
  subtotal: number;
}

interface CartStore {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'cart_id' | 'subtotal'>) => void;
  removeFromCart: (cartId: string) => void;
  updateQuantity: (cartId: string, delta: number) => void;
  clearCart: () => void;
  getTotalAmount: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  
  addToCart: (newItem) => {
    // Calculate subtotal
    const modifiersTotal = newItem.modifiers.reduce((sum, mod) => sum + mod.extra_price, 0);
    const subtotal = (newItem.unit_price + modifiersTotal) * newItem.quantity;
    
    // Check if exactly same product with same modifiers exists
    // If so, just increase quantity. Otherwise, add as new line item.
    const existingIndex = get().items.findIndex(item => {
      if (item.product_id !== newItem.product_id) return false;
      if (item.modifiers.length !== newItem.modifiers.length) return false;
      
      // Check if all modifiers match exactly
      const hasDifferentModifier = item.modifiers.some(mod1 => 
        !newItem.modifiers.find(mod2 => mod2.option_id === mod1.option_id)
      );
      return !hasDifferentModifier;
    });

    if (existingIndex >= 0) {
      set(state => {
        const newItems = [...state.items];
        const existing = newItems[existingIndex];
        const newQuantity = existing.quantity + newItem.quantity;
        const newSubtotal = (existing.unit_price + modifiersTotal) * newQuantity;
        
        newItems[existingIndex] = {
          ...existing,
          quantity: newQuantity,
          subtotal: newSubtotal
        };
        return { items: newItems };
      });
    } else {
      set(state => ({
        items: [...state.items, {
          ...newItem,
          cart_id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          subtotal
        }]
      }));
    }
  },
  
  removeFromCart: (cartId) => {
    set(state => ({
      items: state.items.filter(item => item.cart_id !== cartId)
    }));
  },
  
  updateQuantity: (cartId, delta) => {
    set(state => {
      const newItems = state.items.map(item => {
        if (item.cart_id === cartId) {
          const newQuantity = Math.max(1, item.quantity + delta);
          const modifiersTotal = item.modifiers.reduce((sum, mod) => sum + mod.extra_price, 0);
          return {
            ...item,
            quantity: newQuantity,
            subtotal: (item.unit_price + modifiersTotal) * newQuantity
          };
        }
        return item;
      });
      return { items: newItems };
    });
  },
  
  clearCart: () => {
    set({ items: [] });
  },
  
  getTotalAmount: () => {
    return get().items.reduce((sum, item) => sum + item.subtotal, 0);
  }
}));
