-- Phase 7: Dine-in Tables Management
CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL, -- e.g. "T01", "A桌"
    capacity INTEGER DEFAULT 4,
    x_pos DECIMAL(10,2) DEFAULT 0,
    y_pos DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'idle', -- 'idle', 'occupied'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add table_id to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES tables(id) ON DELETE SET NULL;

-- Setup RLS
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
    pol record; 
BEGIN 
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'tables' AND schemaname = 'public' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.tables', pol.policyname); 
    END LOOP; 
END $$;

CREATE POLICY "Strict Policy for Tables" ON tables
    FOR ALL USING (
        (get_user_role() = 'store_operator' AND store_id = (SELECT store_id FROM profiles WHERE id = auth.uid()))
        OR (get_user_role() = 'tenant_admin' AND store_id IN (SELECT id FROM stores WHERE tenant_id = get_user_tenant()))
        OR get_user_role() = 'super_admin'
    );
