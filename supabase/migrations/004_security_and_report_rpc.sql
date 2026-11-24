-- ============================================================================
-- src dimas kasir v0.3.0 — Phase 1: Security Hardening & Report Summary RPC
-- Non-destructive migration:
--   - F-01: Tighten cross-tenant FK RLS WITH CHECK on sale_items,
--           stock_movements, and expenses
--   - F-02: Drop public listing SELECT policies on storage.objects for
--           store-logos & product-images; enforce owner-only SELECT listing
--           and ensure bucket file_size_limit / allowed_mime_types
--   - Defense-in-depth: pin search_path on set_updated_at(), protect default
--           expense categories from DELETE, enforce Supabase Storage HTTPS
--           origin on logo_url/image_url, revoke anon EXECUTE on all RPCs,
--           harden create_sale_atomic input checks
--   - Perf: Add server-side get_period_report_summary RPC (eliminates
--           unbounded JS aggregation & 1,000-row PostgREST truncation)
--   - F-05: Add service_role-only delete_store_data_atomic RPC for atomic
--           relational cleanup inside delete-account Edge Function
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Pin search_path on set_updated_at() trigger helper
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. F-01: Tighten cross-tenant Foreign Key RLS WITH CHECK policies
-- ----------------------------------------------------------------------------

-- 2.1 sale_items: verify BOTH sale_id AND product_id belong to caller's store
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
    AND product_id IN (
      SELECT p.id
      FROM public.products p
      INNER JOIN public.stores st ON st.id = p.store_id
      WHERE st.owner_id = (SELECT auth.uid())
    )
  );

-- 2.2 stock_movements: verify BOTH store_id AND product_id belong to caller's store
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
    AND product_id IN (
      SELECT p.id
      FROM public.products p
      INNER JOIN public.stores st ON st.id = p.store_id
      WHERE st.owner_id = (SELECT auth.uid())
    )
  );

-- 2.3 expenses: verify store_id AND (category_id IS NULL OR belongs to caller's store)
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
    AND (
      category_id IS NULL
      OR category_id IN (
        SELECT ec.id
        FROM public.expense_categories ec
        INNER JOIN public.stores st ON st.id = ec.store_id
        WHERE st.owner_id = (SELECT auth.uid())
      )
    )
  );

-- 2.4 expense_categories: protect default categories (is_default = true) from DELETE
DROP POLICY IF EXISTS "expense_categories_store_owner_all" ON public.expense_categories;
DROP POLICY IF EXISTS "expense_categories_owner_select" ON public.expense_categories;
DROP POLICY IF EXISTS "expense_categories_owner_insert" ON public.expense_categories;
DROP POLICY IF EXISTS "expense_categories_owner_update" ON public.expense_categories;
DROP POLICY IF EXISTS "expense_categories_owner_delete" ON public.expense_categories;

CREATE POLICY "expense_categories_owner_select"
  ON public.expense_categories
  FOR SELECT
  TO authenticated
  USING (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "expense_categories_owner_insert"
  ON public.expense_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = (SELECT auth.uid())
    )
    AND is_default = false
  );

CREATE POLICY "expense_categories_owner_update"
  ON public.expense_categories
  FOR UPDATE
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

CREATE POLICY "expense_categories_owner_delete"
  ON public.expense_categories
  FOR DELETE
  TO authenticated
  USING (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = (SELECT auth.uid())
    )
    AND is_default = false
  );

-- ----------------------------------------------------------------------------
-- 3. F-02: Remove public directory listing on storage.objects & enforce bucket limits
--    Note: Buckets remain public = true so direct /object/public/... URLs stay
--    fast & cacheable, while unauthenticated/cross-tenant .list() is blocked.
-- ----------------------------------------------------------------------------
UPDATE storage.buckets
SET
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
WHERE id IN ('store-logos', 'product-images');

DROP POLICY IF EXISTS "store_logos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "store_logos_owner_select" ON storage.objects;
CREATE POLICY "store_logos_owner_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'store-logos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "product_images_owner_select" ON storage.objects;
CREATE POLICY "product_images_owner_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- ----------------------------------------------------------------------------
-- 4. Restrict logo_url & image_url to HTTPS Supabase Storage public bucket URLs
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_stores_logo_url_https'
  ) THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT chk_stores_logo_url_https
      CHECK (
        logo_url IS NULL
        OR logo_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/store-logos/'
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_image_url_https'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT chk_products_image_url_https
      CHECK (
        image_url IS NULL
        OR image_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/product-images/'
      ) NOT VALID;
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 5. Harden create_sale_atomic: per-element qty > 0 check, max 200 items, bigint sum
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_sale_atomic(
  p_local_date text,
  p_cash_received integer,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_sale_id uuid;
  v_receipt_prefix text;
  v_next_seq integer;
  v_receipt_number text;
  v_total_amount_big bigint := 0;
  v_total_amount integer := 0;
  v_change_amount integer := 0;
  v_item record;
  v_product public.products%ROWTYPE;
  v_sale_row public.sales%ROWTYPE;
  v_sale_items_json jsonb;
  v_has_invalid_elem boolean;
BEGIN
  IF p_local_date IS NULL OR p_local_date !~ '^\d{8}$' THEN
    RAISE EXCEPTION 'FORMAT_TANGGAL_TIDAK_VALID';
  END IF;

  IF p_cash_received IS NULL OR p_cash_received < 0 THEN
    RAISE EXCEPTION 'NOMINAL_TUNAI_TIDAK_VALID';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'KERANJANG_KOSONG';
  END IF;

  IF jsonb_array_length(p_items) > 200 THEN
    RAISE EXCEPTION 'TERLALU_BANYAK_ITEM';
  END IF;

  -- Tolak elemen tidak valid atau qty <= 0 sebelum agregasi SUM
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS elem
    WHERE jsonb_typeof(elem) <> 'object'
      OR (elem->>'product_id') IS NULL
      OR (elem->>'qty') IS NULL
      OR (elem->>'qty') !~ '^\d+$'
      OR (elem->>'qty')::bigint <= 0
      OR (elem->>'qty')::bigint > 100000
  )
  INTO v_has_invalid_elem;

  IF v_has_invalid_elem THEN
    RAISE EXCEPTION 'ITEM_TIDAK_VALID';
  END IF;

  v_store_id := public.get_current_store_id();

  -- Validasi & kunci seluruh baris produk secara terurut (anti deadlock)
  FOR v_item IN
    SELECT
      (elem->>'product_id')::uuid AS product_id,
      SUM((elem->>'qty')::bigint) AS qty_big
    FROM jsonb_array_elements(p_items) AS elem
    GROUP BY (elem->>'product_id')::uuid
    ORDER BY (elem->>'product_id')::uuid ASC
  LOOP
    IF v_item.product_id IS NULL OR v_item.qty_big IS NULL OR v_item.qty_big <= 0 OR v_item.qty_big > 100000 THEN
      RAISE EXCEPTION 'ITEM_TIDAK_VALID';
    END IF;

    SELECT *
    INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
      AND store_id = v_store_id
      AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'BARANG_TIDAK_DITEMUKAN:%', v_item.product_id;
    END IF;

    IF v_product.stock < v_item.qty_big THEN
      RAISE EXCEPTION 'STOK_TIDAK_CUKUP:%:%:%', v_product.name, v_product.stock, v_item.qty_big;
    END IF;

    v_total_amount_big := v_total_amount_big + (v_product.sell_price::bigint * v_item.qty_big);
    IF v_total_amount_big > 2147483647 THEN
      RAISE EXCEPTION 'TOTAL_MELEBIHI_BATAS';
    END IF;
  END LOOP;

  v_total_amount := v_total_amount_big::integer;

  IF p_cash_received < v_total_amount THEN
    RAISE EXCEPTION 'UANG_TIDAK_CUKUP:%:%', p_cash_received, v_total_amount;
  END IF;

  v_change_amount := p_cash_received - v_total_amount;

  -- Advisory lock per toko + tanggal lokal agar nomor struk harian bebas race condition
  PERFORM pg_advisory_xact_lock(hashtext(v_store_id::text || ':' || p_local_date));

  v_receipt_prefix := 'SDK-' || p_local_date || '-';

  SELECT COALESCE(MAX(split_part(receipt_number, '-', 3)::integer), 0) + 1
  INTO v_next_seq
  FROM public.sales
  WHERE store_id = v_store_id
    AND receipt_number LIKE v_receipt_prefix || '%';

  v_receipt_number := v_receipt_prefix || lpad(v_next_seq::text, 4, '0');

  INSERT INTO public.sales (
    store_id,
    receipt_number,
    total_amount,
    cash_received,
    change_amount,
    status
  )
  VALUES (
    v_store_id,
    v_receipt_number,
    v_total_amount,
    p_cash_received,
    v_change_amount,
    'completed'
  )
  RETURNING * INTO v_sale_row;

  v_sale_id := v_sale_row.id;

  FOR v_item IN
    SELECT
      (elem->>'product_id')::uuid AS product_id,
      SUM((elem->>'qty')::integer)::integer AS qty
    FROM jsonb_array_elements(p_items) AS elem
    GROUP BY (elem->>'product_id')::uuid
    ORDER BY (elem->>'product_id')::uuid ASC
  LOOP
    SELECT *
    INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
      AND store_id = v_store_id;

    INSERT INTO public.sale_items (
      sale_id,
      product_id,
      product_name_snapshot,
      qty,
      sell_price_snapshot,
      cost_price_snapshot,
      subtotal
    )
    VALUES (
      v_sale_id,
      v_product.id,
      v_product.name,
      v_item.qty,
      v_product.sell_price,
      v_product.cost_price,
      v_product.sell_price * v_item.qty
    );

    UPDATE public.products
    SET stock = stock - v_item.qty
    WHERE id = v_product.id
    RETURNING * INTO v_product;

    INSERT INTO public.stock_movements (
      store_id,
      product_id,
      type,
      qty_delta,
      stock_after,
      note,
      reference_id
    )
    VALUES (
      v_store_id,
      v_product.id,
      'penjualan',
      -v_item.qty,
      v_product.stock,
      v_receipt_number,
      v_sale_id
    );
  END LOOP;

  SELECT COALESCE(jsonb_agg(to_jsonb(si) ORDER BY si.product_name_snapshot ASC), '[]'::jsonb)
  INTO v_sale_items_json
  FROM public.sale_items si
  WHERE si.sale_id = v_sale_id;

  RETURN jsonb_build_object(
    'sale', to_jsonb(v_sale_row),
    'items', v_sale_items_json
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Server-side Report Summary RPC (Perf §3.1)
--    Computes KPIs, Top 5 Products, and Daily Series inside PostgreSQL.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_period_report_summary(
  p_start_iso timestamptz,
  p_end_iso timestamptz,
  p_start_date date,
  p_end_date date,
  p_tz_offset_minutes integer DEFAULT 420
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_total_sales bigint := 0;
  v_completed_count integer := 0;
  v_void_count integer := 0;
  v_gross_profit bigint := 0;
  v_total_expenses bigint := 0;
  v_top_products jsonb := '[]'::jsonb;
  v_daily_series jsonb := '[]'::jsonb;
  v_clamped_tz integer;
BEGIN
  IF p_start_iso IS NULL OR p_end_iso IS NULL OR p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'PARAMETER_PERIODE_TIDAK_VALID';
  END IF;

  -- Batasi offset timezone antara UTC-12 (-720) hingga UTC+14 (+840)
  v_clamped_tz := LEAST(GREATEST(COALESCE(p_tz_offset_minutes, 420), -720), 840);
  v_store_id := public.get_current_store_id();

  -- KPI penjualan & jumlah transaksi
  SELECT
    COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.total_amount::bigint ELSE 0 END), 0),
    COUNT(*) FILTER (WHERE s.status = 'completed')::integer,
    COUNT(*) FILTER (WHERE s.status = 'void')::integer
  INTO v_total_sales, v_completed_count, v_void_count
  FROM public.sales s
  WHERE s.store_id = v_store_id
    AND s.created_at >= p_start_iso
    AND s.created_at <= p_end_iso;

  -- Laba kotor dari snapshot sale_items (hanya transaksi completed)
  SELECT
    COALESCE(SUM((si.sell_price_snapshot::bigint - si.cost_price_snapshot::bigint) * si.qty::bigint), 0)
  INTO v_gross_profit
  FROM public.sale_items si
  INNER JOIN public.sales s ON s.id = si.sale_id
  WHERE s.store_id = v_store_id
    AND s.status = 'completed'
    AND s.created_at >= p_start_iso
    AND s.created_at <= p_end_iso;

  -- Total pengeluaran periode
  SELECT
    COALESCE(SUM(e.amount::bigint), 0)
  INTO v_total_expenses
  FROM public.expenses e
  WHERE e.store_id = v_store_id
    AND e.expense_date >= p_start_date
    AND e.expense_date <= p_end_date;

  -- Top 5 barang terlaris berdasarkan total unit terjual lalu omzet
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'productId', t.product_id,
        'name', t.product_name,
        'totalQty', t.total_qty,
        'totalRevenue', t.total_revenue
      )
      ORDER BY t.total_qty DESC, t.total_revenue DESC
    ),
    '[]'::jsonb
  )
  INTO v_top_products
  FROM (
    SELECT
      si.product_id,
      (ARRAY_AGG(si.product_name_snapshot ORDER BY s.created_at DESC))[1] AS product_name,
      SUM(si.qty::bigint) AS total_qty,
      SUM(si.subtotal::bigint) AS total_revenue
    FROM public.sale_items si
    INNER JOIN public.sales s ON s.id = si.sale_id
    WHERE s.store_id = v_store_id
      AND s.status = 'completed'
      AND s.created_at >= p_start_iso
      AND s.created_at <= p_end_iso
    GROUP BY si.product_id
    ORDER BY SUM(si.qty::bigint) DESC, SUM(si.subtotal::bigint) DESC
    LIMIT 5
  ) t;

  -- Tren harian berdasarkan tanggal lokal perangkat
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'dateKey', to_char(d.local_day, 'YYYY-MM-DD'),
        'label',
          (ARRAY['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'])[EXTRACT(DOW FROM d.local_day)::integer + 1]
          || ' ' || EXTRACT(DAY FROM d.local_day)::integer::text,
        'totalSales', d.day_sales,
        'txCount', d.tx_count
      )
      ORDER BY d.local_day ASC
    ),
    '[]'::jsonb
  )
  INTO v_daily_series
  FROM (
    SELECT
      ((s.created_at AT TIME ZONE 'UTC') + make_interval(mins => v_clamped_tz))::date AS local_day,
      SUM(s.total_amount::bigint) AS day_sales,
      COUNT(*)::integer AS tx_count
    FROM public.sales s
    WHERE s.store_id = v_store_id
      AND s.status = 'completed'
      AND s.created_at >= p_start_iso
      AND s.created_at <= p_end_iso
    GROUP BY 1
  ) d;

  RETURN jsonb_build_object(
    'totalSales', v_total_sales,
    'completedCount', v_completed_count,
    'voidCount', v_void_count,
    'grossProfit', v_gross_profit,
    'totalExpenses', v_total_expenses,
    'netProfit', v_gross_profit - v_total_expenses,
    'topProducts', v_top_products,
    'dailySeries', v_daily_series
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. F-05: Atomic Relational Cleanup RPC (service_role ONLY)
--    Deletes sales (cascading sale_items) + store (cascading products,
--    stock_movements, expenses, expense_categories) inside 1 SQL transaction.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_store_data_atomic(
  p_owner_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
BEGIN
  IF p_owner_id IS NULL THEN
    RAISE EXCEPTION 'OWNER_ID_WAJIB';
  END IF;

  SELECT id INTO v_store_id
  FROM public.stores
  WHERE owner_id = p_owner_id
  FOR UPDATE;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'TOKO_TIDAK_DITEMUKAN';
  END IF;

  DELETE FROM public.sales
  WHERE store_id = v_store_id;

  DELETE FROM public.stores
  WHERE id = v_store_id;

  RETURN v_store_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Explicit Privilege Hardening: REVOKE FROM PUBLIC & anon on all RPCs
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.ensure_store_initialized() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_current_store_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_sale_atomic(text, integer, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_sale_atomic(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adjust_stock_atomic(uuid, text, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_product_smart(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_products_csv_atomic(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_period_report_summary(timestamptz, timestamptz, date, date, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_store_data_atomic(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ensure_store_initialized() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_store_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_sale_atomic(text, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_sale_atomic(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_stock_atomic(uuid, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_product_smart(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_products_csv_atomic(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_period_report_summary(timestamptz, timestamptz, date, date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_store_data_atomic(uuid) TO service_role;
