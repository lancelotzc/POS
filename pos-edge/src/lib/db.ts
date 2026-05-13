import { SQLocal } from 'sqlocal';

// Initialize the SQLite database connection using OPFS
export const db = new SQLocal('pos-edge-db.sqlite3');

export async function initDb() {
  // Create local tables mimicking Supabase schema
  await db.sql`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      store_code TEXT NOT NULL,
      license_status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      sku TEXT,
      is_combo INTEGER DEFAULT 0,
      combo_settings TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS modifiers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS modifier_options (
      id TEXT PRIMARY KEY,
      modifier_id TEXT NOT NULL,
      name TEXT NOT NULL,
      extra_price REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS product_modifiers (
      product_id TEXT NOT NULL,
      modifier_id TEXT NOT NULL,
      is_required INTEGER DEFAULT 0,
      max_options INTEGER DEFAULT 1,
      PRIMARY KEY (product_id, modifier_id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      order_number TEXT NOT NULL,
      total_amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      modifiers TEXT
    );
  `;
}
