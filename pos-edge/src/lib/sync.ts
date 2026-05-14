import { supabase } from './supabase';
import { db } from './db';

export async function syncStoreData(tenantId: string, storeId: string) {
  try {
    console.log('Starting full sync for store:', storeId);

    // 1. Fetch data from Supabase
    const [
      { data: categories, error: errCat },
      { data: products, error: errProd },
      { data: storeProductStatus, error: errStatus },
      { data: modifiers, error: errMod },
      { data: modifierOptions, error: errModOpt },
      { data: productModifiers, error: errProdMod }
    ] = await Promise.all([
      supabase.from('categories').select('*').eq('tenant_id', tenantId),
      supabase.from('products').select('*').eq('tenant_id', tenantId).eq('is_active', true),
      supabase.from('store_product_status').select('*').eq('store_id', storeId),
      supabase.from('modifiers').select('*').eq('tenant_id', tenantId),
      // modifier_options and product_modifiers don't have tenant_id directly, 
      // but RLS will filter them based on the tenant of their parent tables.
      supabase.from('modifier_options').select('*'),
      supabase.from('product_modifiers').select('*')
    ]);

    if (errCat || errProd || errStatus || errMod || errModOpt || errProdMod) {
      console.error('Error fetching from Supabase', { errCat, errProd, errStatus, errMod, errModOpt, errProdMod });
      throw new Error('Failed to fetch data from cloud');
    }

    // 2. Start Local DB Transaction (SQLocal supports transactions via sequential execution or custom functions, we'll do sequential for now)
    
    // Clear old data
    await db.sql`DELETE FROM categories`;
    await db.sql`DELETE FROM products`;
    await db.sql`DELETE FROM modifiers`;
    await db.sql`DELETE FROM modifier_options`;
    await db.sql`DELETE FROM product_modifiers`;

    // Insert Categories
    if (categories && categories.length > 0) {
      for (const cat of categories) {
        await db.sql`INSERT INTO categories (id, name, sort_order) VALUES (${cat.id}, ${cat.name}, ${cat.sort_order || 0})`;
      }
    }

    // Insert Products
    if (products && products.length > 0) {
      const statusMap = new Map(storeProductStatus?.map(s => [s.product_id, s]) || []);
      
      for (const prod of products) {
        const status = statusMap.get(prod.id);
        // If a status exists and it says it's unavailable, we can either skip it or store its status.
        // For POS Edge, if it's not available in this store, we don't even need to show it, or we show it as "Disabled".
        // Let's add is_available and is_sold_out to our local schema if needed, but for now we skip unavailable ones to save local space.
        if (status && status.is_available === false) continue;
        
        await db.sql`
          INSERT INTO products (id, category_id, name, price, sku, is_combo, combo_settings) 
          VALUES (${prod.id}, ${prod.category_id}, ${prod.name}, ${prod.price}, ${prod.sku}, ${prod.is_combo ? 1 : 0}, ${prod.combo_settings ? JSON.stringify(prod.combo_settings) : null})
        `;
      }
    }

    // Insert Modifiers
    if (modifiers && modifiers.length > 0) {
      for (const mod of modifiers) {
        await db.sql`INSERT INTO modifiers (id, name, type) VALUES (${mod.id}, ${mod.name}, ${mod.type})`;
      }
    }

    // Insert Modifier Options
    if (modifierOptions && modifierOptions.length > 0) {
      for (const opt of modifierOptions) {
        await db.sql`INSERT INTO modifier_options (id, modifier_id, name, extra_price) VALUES (${opt.id}, ${opt.modifier_id}, ${opt.name}, ${opt.extra_price || 0})`;
      }
    }

    // Insert Product Modifiers
    if (productModifiers && productModifiers.length > 0) {
      for (const pm of productModifiers) {
        await db.sql`INSERT INTO product_modifiers (product_id, modifier_id, is_required, max_options) VALUES (${pm.product_id}, ${pm.modifier_id}, 0, 1)`;
      }
    }

    console.log('Sync completed successfully');
    return true;
  } catch (error) {
    console.error('Sync process failed:', error);
    throw error;
  }
}
