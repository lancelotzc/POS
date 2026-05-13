-- ==========================================
-- Phase 5: Orders Management (訂單與明細模組)
-- ==========================================

-- 1. 訂單主檔 (Orders)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    order_number VARCHAR(50) NOT NULL, -- e.g. 20260513-M001-0001
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash', -- Cash, Credit, LinePay etc.
    status VARCHAR(50) NOT NULL DEFAULT 'completed', -- completed, refunded, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 訂單明細 (Order Items)
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL, -- 若商品被刪除，訂單明細保留但設為 NULL
    product_name VARCHAR(255) NOT NULL, -- 商品名稱快照
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
    modifiers JSONB DEFAULT '[]'::jsonb, -- 紀錄加料與客製化選項 (例如：[{"name":"大杯","price":10}, {"name":"少冰","price":0}])
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 強制啟用 RLS (Row Level Security)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 4. 建立絕對嚴格的 RLS 政策
-- Orders (訂單)：門店人員只能看到/寫入自己門店的訂單；商戶管理員可以看到自己商戶的所有訂單；總管理員看全部
CREATE POLICY "Strict Policy for Orders" ON orders
    FOR ALL USING (
        (get_user_role() = 'store_operator' AND store_id = (SELECT store_id FROM profiles WHERE id = auth.uid()))
        OR (get_user_role() = 'tenant_admin' AND tenant_id = get_user_tenant())
        OR get_user_role() = 'super_admin'
    );

-- Order Items (訂單明細)：透過關聯 orders 表來判斷權限
CREATE POLICY "Strict Policy for Order Items" ON order_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_items.order_id 
            AND (
                (get_user_role() = 'store_operator' AND orders.store_id = (SELECT store_id FROM profiles WHERE id = auth.uid()))
                OR (get_user_role() = 'tenant_admin' AND orders.tenant_id = get_user_tenant())
                OR get_user_role() = 'super_admin'
            )
        )
    );
