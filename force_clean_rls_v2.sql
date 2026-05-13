-- 1. 強制啟用資料表的 Row Level Security (RLS)
-- 如果這三個表沒有開啟 RLS，所有的 Policy 都不會生效，任何人都能看到所有資料！
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. 動態刪除 tenants, stores, profiles 上的「所有」現存 RLS 政策 (無差別掃蕩)
DO $$ 
DECLARE 
    pol record; 
BEGIN 
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'tenants' AND schemaname = 'public' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.tenants', pol.policyname); 
    END LOOP; 
    
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'stores' AND schemaname = 'public' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.stores', pol.policyname); 
    END LOOP; 

    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname); 
    END LOOP; 
END $$;

-- 3. 重新建立唯一且絕對嚴格的 RLS 政策
CREATE POLICY "Strict Policy for Tenants" ON tenants FOR SELECT USING ( id = get_user_tenant() OR get_user_role() = 'super_admin' );
CREATE POLICY "Strict Policy for Stores" ON stores FOR ALL USING ( tenant_id = get_user_tenant() OR get_user_role() = 'super_admin' );
CREATE POLICY "Strict Policy for Profiles" ON profiles FOR SELECT USING ( get_user_role() = 'super_admin' OR tenant_id = get_user_tenant() OR id = auth.uid() );
