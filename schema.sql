-- ==========================================
-- POS System Database Schema (Supabase)
-- Phase 2: DB Schema & Security
-- ==========================================

-- 1. 核心多租戶與權限表 (Tenants, Stores, Roles)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    store_code VARCHAR(50) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enum for User Roles
CREATE TYPE user_role AS ENUM ('super_admin', 'tenant_admin', 'store_operator');

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL, -- Null if super_admin
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL, -- Null if super/tenant admin
    role user_role NOT NULL,
    full_name VARCHAR(255),
    email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 菜單與基礎資料表 (Products, Categories, Combos, Modifiers)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    price DECIMAL(10, 2) NOT NULL,
    is_combo BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    combo_settings JSONB, -- Defines Fixed, Swappable, or Multi-choice structures
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 門店分類狀態表 (控制該門店是否啟用某分類)
CREATE TABLE store_category_status (
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    is_available BOOLEAN DEFAULT true, -- 該門店是否啟用此分類
    PRIMARY KEY (store_id, category_id)
);

-- 門店獨立的「售完」狀態表 (Offline sync supported)
CREATE TABLE store_product_status (
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    is_available BOOLEAN DEFAULT true,
    is_sold_out BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (store_id, product_id)
);

CREATE TABLE modifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'optional', -- 'required' or 'optional'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE modifier_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modifier_id UUID REFERENCES modifiers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    extra_price DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE product_modifiers (
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    modifier_id UUID REFERENCES modifiers(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, modifier_id)
);

-- 門店加料狀態表 (控制該門店是否啟用此加料群組)
CREATE TABLE store_modifier_status (
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    modifier_id UUID REFERENCES modifiers(id) ON DELETE CASCADE,
    is_available BOOLEAN DEFAULT true,
    PRIMARY KEY (store_id, modifier_id)
);

-- 3. 進階庫存表 (Raw Materials, Unit Conversions, Ledger)
CREATE TABLE raw_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    base_unit VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- BOM (Bill of Materials) 配方表
CREATE TABLE product_bom (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    raw_material_id UUID REFERENCES raw_materials(id) ON DELETE CASCADE,
    quantity_required DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 庫存流水帳 (Inventory Ledger - Cloud aggregate, Edge source of truth)
CREATE TABLE inventory_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    reference_id UUID NOT NULL, -- product_id or raw_material_id
    item_type VARCHAR(50) CHECK (item_type IN ('product', 'raw_material')),
    quantity_change DECIMAL(10, 2) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- 'sale', 'receive', 'waste', 'adjust'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 訂單與支付表 (Orders, Order Items Snapshot, Payments)
CREATE TYPE order_type AS ENUM ('dine_in', 'takeaway', 'delivery', 'pickup', 'reservation', 'retail');
CREATE TYPE order_status AS ENUM ('draft', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled', 'voided');
CREATE TYPE payment_status AS ENUM ('unpaid', 'partially_paid', 'paid', 'partially_refunded', 'refunded', 'voided');

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    order_number VARCHAR(100) NOT NULL UNIQUE, -- e.g. StoreA-M01-20231024-001
    type order_type NOT NULL,
    status order_status DEFAULT 'draft',
    pay_status payment_status DEFAULT 'unpaid',
    total_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 訂單明細 (含有 Immutable Snapshot)
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    snapshot JSONB NOT NULL, -- Immutable JSON: name, price, modifiers, taxes, combo_details
    quantity INTEGER NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 混合付款交易明細 (Payment Records)
CREATE TABLE payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    payment_method VARCHAR(50) NOT NULL, -- 'cash', 'credit_card', 'line_pay', 'jkopay'
    amount DECIMAL(10, 2) NOT NULL,
    reconciliation_data JSONB, -- Transaction Seq, Auth Code, Last 4 digits, Platform Order ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- Row Level Security (RLS) Policies
-- ==========================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 建立安全函數以避免 RLS 無窮迴圈 (Infinite Recursion)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT role::text FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_user_tenant()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid();
$$;

-- 範例：Tenant Admin 只能看到自己的 Tenant 資料
CREATE POLICY "Tenant Admins can view own tenant" ON tenants
    FOR SELECT USING (
        id = get_user_tenant()
        OR get_user_role() = 'super_admin'
    );

CREATE POLICY "Tenant Admins can view own stores" ON stores
    FOR ALL USING (
        tenant_id = get_user_tenant()
        OR get_user_role() = 'super_admin'
    );

CREATE POLICY "Users can view profiles" ON profiles
    FOR SELECT USING (
        get_user_role() = 'super_admin'
        OR tenant_id = get_user_tenant()
        OR id = auth.uid()
    );

-- 更多精細化的 RLS 可在 Supabase Dashboard 依據業務邏輯持續擴充。

-- ==========================================
-- Phase 4: Inventory Management (庫存管理模組)
-- ==========================================

-- 1. 原物料庫存主檔 (Inventory Items) - Tenant Level
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(50),
    unit VARCHAR(20) NOT NULL, -- e.g., 'g', 'ml', 'pcs', user-defined
    cost DECIMAL(10, 2) DEFAULT 0, -- Unit cost
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 產品配方表 (Recipes) - BOM (Bill of Materials)
CREATE TABLE recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NULL,
    modifier_option_id UUID REFERENCES modifier_options(id) ON DELETE CASCADE NULL,
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity DECIMAL(10, 3) NOT NULL, -- How much to deduct
    CONSTRAINT recipe_target_check CHECK (
        (product_id IS NOT NULL AND modifier_option_id IS NULL) OR
        (product_id IS NULL AND modifier_option_id IS NOT NULL)
    )
);

-- 3. 門店庫存水位表 (Store Inventory)
CREATE TABLE store_inventory (
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity DECIMAL(10, 3) DEFAULT 0,
    low_stock_alert DECIMAL(10, 3) DEFAULT 0, -- Warning threshold
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (store_id, inventory_item_id)
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_inventory ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- Phase 4.1: Business Mode (F&B vs Retail) Architecture
-- ==========================================

-- 新增 ENUM 型別
CREATE TYPE business_mode AS ENUM ('fnb', 'retail', 'mixed');
CREATE TYPE device_mode AS ENUM ('fnb', 'retail');

-- 1. 門店加入業務模式
ALTER TABLE stores ADD COLUMN mode business_mode DEFAULT 'fnb';

-- 2. 分類加入業務模式 (區分餐飲或零售分類)
ALTER TABLE categories ADD COLUMN mode device_mode DEFAULT 'fnb';

-- 3. 建立 POS 終端設備表
CREATE TABLE pos_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    device_name VARCHAR(100) NOT NULL, -- e.g. "吧台點餐機-01"
    mode device_mode NOT NULL, -- 決定這台機器是跑餐飲還是零售 UI
    status VARCHAR(20) DEFAULT 'offline',
    last_ping_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE pos_devices ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- Phase 4.2: Inventory UOM (Unit of Measure) Conversion
-- ==========================================
ALTER TABLE inventory_items ADD COLUMN purchase_unit VARCHAR(20) NULL;
ALTER TABLE inventory_items ADD COLUMN conversion_rate DECIMAL(10, 3) DEFAULT 1;
