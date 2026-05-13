-- 1. 首先，刪除可能導致資料外洩的全域開放政策 (Permissive Policies)
-- 如果您之前有在後台按過 "Enable read access for all users" 等按鈕，會產生這些政策
DROP POLICY IF EXISTS "Enable read access for all users" ON tenants;
DROP POLICY IF EXISTS "Enable read access for all users" ON stores;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;

-- 2. 為了保險起見，我們將我們自己建立的政策也先移除，確保沒有重複或衝突
DROP POLICY IF EXISTS "Tenant Admins can view own tenant" ON tenants;
DROP POLICY IF EXISTS "Tenant Admins can view own stores" ON stores;
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;

-- 3. 重新建立嚴格的 RLS 政策
-- Tenants (商戶)：商戶管理員只能看到自己所屬的商戶，總管理員可以看到全部
CREATE POLICY "Strict Policy for Tenants" ON tenants
    FOR SELECT USING (
        id = get_user_tenant()
        OR get_user_role() = 'super_admin'
    );

-- Stores (門店)：商戶管理員只能看到自己商戶下的門店，總管理員可以看到全部
CREATE POLICY "Strict Policy for Stores" ON stores
    FOR ALL USING (
        tenant_id = get_user_tenant()
        OR get_user_role() = 'super_admin'
    );

-- Profiles (帳號)：商戶管理員只能看到同商戶的人員，或是自己的帳號
CREATE POLICY "Strict Policy for Profiles" ON profiles
    FOR SELECT USING (
        get_user_role() = 'super_admin'
        OR tenant_id = get_user_tenant()
        OR id = auth.uid()
    );
