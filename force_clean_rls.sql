-- 1. 動態刪除 `tenants`, `stores`, `profiles` 表上的「所有」現存 RLS 政策
-- 這樣可以確保沒有任何未知名稱的寬鬆政策殘留
DO $$ 
DECLARE 
    pol record; 
BEGIN 
    -- 刪除 tenants 的所有政策
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'tenants' AND schemaname = 'public' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.tenants', pol.policyname); 
    END LOOP; 
    
    -- 刪除 stores 的所有政策
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'stores' AND schemaname = 'public' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.stores', pol.policyname); 
    END LOOP; 

    -- 刪除 profiles 的所有政策
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname); 
    END LOOP; 
END $$;

-- 2. 重新建立唯一且嚴格的 RLS 政策
CREATE POLICY "Strict Policy for Tenants" ON tenants
    FOR SELECT USING (
        id = get_user_tenant()
        OR get_user_role() = 'super_admin'
    );

CREATE POLICY "Strict Policy for Stores" ON stores
    FOR ALL USING (
        tenant_id = get_user_tenant()
        OR get_user_role() = 'super_admin'
    );

CREATE POLICY "Strict Policy for Profiles" ON profiles
    FOR SELECT USING (
        get_user_role() = 'super_admin'
        OR tenant_id = get_user_tenant()
        OR id = auth.uid()
    );
