-- ============================================================================
-- src dimas kasir v0.1.0 — Phase 2: Initial Schema, RLS, Triggers, Realtime, Storage
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Helper Trigger Function: updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------

-- 2.1 stores (1 akun Google = 1 toko)
CREATE TABLE IF NOT EXISTS public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Toko Saya' CHECK (length(trim(name)) > 0),
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  logo_url text,
  receipt_footer text NOT NULL DEFAULT 'Terima kasih telah berbelanja!',
  paper_size smallint NOT NULL DEFAULT 58 CHECK (paper_size IN (58, 80)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_stores_updated_at ON public.stores;
CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 2.2 products
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  barcode text,
  category text NOT NULL DEFAULT '',
  sell_price integer NOT NULL CHECK (sell_price >= 0),
  cost_price integer NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock integer NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_store_barcode_unique
  ON public.products (store_id, barcode)
  WHERE barcode IS NOT NULL AND barcode <> '' AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_store_active_name
  ON public.products (store_id, is_active, name);

CREATE INDEX IF NOT EXISTS idx_products_store_low_stock
  ON public.products (store_id, stock, min_stock)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 2.3 sales
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  receipt_number text NOT NULL,
  total_amount integer NOT NULL CHECK (total_amount >= 0),
  cash_received integer NOT NULL CHECK (cash_received >= total_amount),
  change_amount integer NOT NULL CHECK (change_amount >= 0),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'void')),
  void_reason text,
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_sales_store_receipt UNIQUE (store_id, receipt_number),
  CONSTRAINT chk_sales_void_fields CHECK (
    (status = 'completed' AND void_reason IS NULL AND voided_at IS NULL)
    OR (status = 'void' AND length(trim(COALESCE(void_reason, ''))) > 0 AND voided_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_sales_store_created_at
  ON public.sales (store_id, created_at DESC);

-- 2.4 sale_items (snapshot integritas historis)
CREATE TABLE IF NOT EXISTS public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name_snapshot text NOT NULL CHECK (length(trim(product_name_snapshot)) > 0),
  qty integer NOT NULL CHECK (qty > 0),
  sell_price_snapshot integer NOT NULL CHECK (sell_price_snapshot >= 0),
  cost_price_snapshot integer NOT NULL CHECK (cost_price_snapshot >= 0),
  subtotal integer NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id
  ON public.sale_items (sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_items_product_id
  ON public.sale_items (product_id);

-- 2.5 stock_movements (4 jenis: stok_masuk, penyesuaian, penjualan, void)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('stok_masuk', 'penyesuaian', 'penjualan', 'void')),
  qty_delta integer NOT NULL CHECK (qty_delta <> 0),
  stock_after integer NOT NULL CHECK (stock_after >= 0),
  note text NOT NULL DEFAULT '',
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_store_created_at
  ON public.stock_movements (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_created_at
  ON public.stock_movements (product_id, created_at DESC);

-- 2.6 expense_categories (6 kategori bawaan + kustom)
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_expense_categories_store_name UNIQUE (store_id, name)
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_store_id
  ON public.expense_categories (store_id);

-- 2.7 expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  category_name_snapshot text NOT NULL CHECK (length(trim(category_name_snapshot)) > 0),
  amount integer NOT NULL CHECK (amount > 0),
  note text NOT NULL DEFAULT '',
  expense_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_store_date
  ON public.expenses (store_id, expense_date DESC);

-- ----------------------------------------------------------------------------
-- 3. Auto-Provisioning Trigger on auth.users (Toko Default + 6 Kategori Pengeluaran)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
BEGIN
  INSERT INTO public.stores (owner_id, name)
  VALUES (NEW.id, 'Toko Saya')
  ON CONFLICT (owner_id) DO NOTHING
  RETURNING id INTO v_store_id;

  IF v_store_id IS NULL THEN
    SELECT id INTO v_store_id
    FROM public.stores
    WHERE owner_id = NEW.id;
  END IF;

  INSERT INTO public.expense_categories (store_id, name, is_default)
  VALUES
    (v_store_id, 'Belanja Stok', true),
    (v_store_id, 'Listrik & Air', true),
    (v_store_id, 'Operasional/Kemasan', true),
    (v_store_id, 'Gaji/Upah', true),
    (v_store_id, 'Sewa', true),
    (v_store_id, 'Lainnya', true)
  ON CONFLICT (store_id, name) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 4. Row Level Security (RLS) — Isolasi Penuh Per Akun
-- ----------------------------------------------------------------------------
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- stores policies
DROP POLICY IF EXISTS "stores_owner_all" ON public.stores;
CREATE POLICY "stores_owner_all"
  ON public.stores
  FOR ALL
  TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

-- products policies
DROP POLICY IF EXISTS "products_store_owner_all" ON public.products;
CREATE POLICY "products_store_owner_all"
  ON public.products
  FOR ALL
  TO authenticated
  USING (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = (SELECT auth.uid())
    )
  );

-- sales policies
DROP POLICY IF EXISTS "sales_store_owner_all" ON public.sales;
CREATE POLICY "sales_store_owner_all"
  ON public.sales
  FOR ALL
  TO authenticated
  USING (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = (SELECT auth.uid())
    )
  );

-- sale_items policies
DROP POLICY IF EXISTS "sale_items_store_owner_all" ON public.sale_items;
CREATE POLICY "sale_items_store_owner_all"
  ON public.sale_items
  FOR ALL
  TO authenticated
  USING (
    sale_id IN (
      SELECT s.id
      FROM public.sales s
      INNER JOIN public.stores st ON st.id = s.store_id
      WHERE st.owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    sale_id IN (
      SELECT s.id
      FROM public.sales s
      INNER JOIN public.stores st ON st.id = s.store_id
      WHERE st.owner_id = (SELECT auth.uid())
    )
  );

-- stock_movements policies
DROP POLICY IF EXISTS "stock_movements_store_owner_all" ON public.stock_movements;
CREATE POLICY "stock_movements_store_owner_all"
  ON public.stock_movements
  FOR ALL
  TO authenticated
  USING (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = (SELECT auth.uid())
    )
  );

-- expense_categories policies
DROP POLICY IF EXISTS "expense_categories_store_owner_all" ON public.expense_categories;
CREATE POLICY "expense_categories_store_owner_all"
  ON public.expense_categories
  FOR ALL
  TO authenticated
  USING (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = (SELECT auth.uid())
    )
  );

-- expenses policies
DROP POLICY IF EXISTS "expenses_store_owner_all" ON public.expenses;
CREATE POLICY "expenses_store_owner_all"
  ON public.expenses
  FOR ALL
  TO authenticated
  USING (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = (SELECT auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- 5. Supabase Realtime (sales table)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sales'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 6. Storage Bucket: store-logos
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-logos',
  'store-logos',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "store_logos_public_read" ON storage.objects;
CREATE POLICY "store_logos_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'store-logos');

DROP POLICY IF EXISTS "store_logos_owner_insert" ON storage.objects;
CREATE POLICY "store_logos_owner_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'store-logos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "store_logos_owner_update" ON storage.objects;
CREATE POLICY "store_logos_owner_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'store-logos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'store-logos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "store_logos_owner_delete" ON storage.objects;
CREATE POLICY "store_logos_owner_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'store-logos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
