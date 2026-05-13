-- ==========================================
-- Phase 5: Orders Management RLS Policies
-- (只更新安全政策，不刪除現有資料表)
-- ==========================================

-- 1. 強制啟用 RLS 
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 2. 先移除可能存在的舊政策，避免衝突
DO $$ 
DECLARE 
    pol record; 
BEGIN 
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'orders' AND schemaname = 'public' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', pol.policyname); 
    END LOOP; 
    
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'order_items' AND schemaname = 'public' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.order_items', pol.policyname); 
    END LOOP; 
END $$;

-- 3. 建立絕對嚴格的 RLS 政策
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
