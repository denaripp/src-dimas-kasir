-- ============================================================================
-- src dimas kasir v0.1.0 — Phase 2: Atomic PostgreSQL RPC Functions
-- Semua fungsi memakai SECURITY INVOKER agar RLS tetap dievaluasi penuh.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper: Pastikan toko + 6 kategori bawaan ada (fallback aman untuk akun lama)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_store_initialized()
RETURNS public.stores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_store public.stores%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'TIDAK_TERAUTENTIKASI';
  END IF;

  INSERT INTO public.stores (owner_id, name)
  VALUES (v_uid, 'Toko Saya')
  ON CONFLICT (owner_id) DO NOTHING;

  SELECT * INTO v_store
  FROM public.stores
  WHERE owner_id = v_uid;

  INSERT INTO public.expense_categories (store_id, name, is_default)
  VALUES
    (v_store.id, 'Belanja Stok', true),
    (v_store.id, 'Listrik & Air', true),
    (v_store.id, 'Operasional/Kemasan', true),
    (v_store.id, 'Gaji/Upah', true),
    (v_store.id, 'Sewa', true),
    (v_store.id, 'Lainnya', true)
  ON CONFLICT (store_id, name) DO NOTHING;

  RETURN v_store;
END;
$$;

-- ----------------------------------------------------------------------------
-- Helper: Ambil store_id milik user yang sedang login
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_store_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
BEGIN
  SELECT id INTO v_store_id
  FROM public.stores
  WHERE owner_id = (SELECT auth.uid());

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'TOKO_TIDAK_DITEMUKAN';
  END IF;

  RETURN v_store_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. create_sale_atomic
--    Simpan transaksi tunai, kurangi stok, catat mutasi stok, terbitkan struk
--    SDK-YYYYMMDD-XXXX secara atomik dengan FOR UPDATE row lock.
--    p_items format: [{"product_id": "<uuid>", "qty": 2}, ...]
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
  v_total_amount integer := 0;
  v_change_amount integer := 0;
  v_item record;
  v_product public.products%ROWTYPE;
  v_sale_row public.sales%ROWTYPE;
  v_sale_items_json jsonb;
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

  v_store_id := public.get_current_store_id();

  -- Validasi & kunci seluruh baris produk secara terurut (anti deadlock)
  FOR v_item IN
    SELECT
      (elem->>'product_id')::uuid AS product_id,
      SUM((elem->>'qty')::integer)::integer AS qty
    FROM jsonb_array_elements(p_items) AS elem
    GROUP BY (elem->>'product_id')::uuid
    ORDER BY (elem->>'product_id')::uuid ASC
  LOOP
    IF v_item.product_id IS NULL OR v_item.qty IS NULL OR v_item.qty <= 0 THEN
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

    IF v_product.stock < v_item.qty THEN
      RAISE EXCEPTION 'STOK_TIDAK_CUKUP:%:%:%', v_product.name, v_product.stock, v_item.qty;
    END IF;

    v_total_amount := v_total_amount + (v_product.sell_price * v_item.qty);
  END LOOP;

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

  -- Insert header transaksi
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

  -- Insert snapshot item, kurangi stok, catat stock_movements
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
-- 2. void_sale_atomic
--    Batalkan transaksi 1 kali (no undo), alasan wajib, kembalikan stok atomik.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_sale_atomic(
  p_sale_id uuid,
  p_reason text
)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_reason text;
  v_sale public.sales%ROWTYPE;
  v_item record;
  v_product public.products%ROWTYPE;
BEGIN
  v_reason := trim(COALESCE(p_reason, ''));
  IF length(v_reason) = 0 THEN
    RAISE EXCEPTION 'ALASAN_VOID_WAJIB';
  END IF;

  v_store_id := public.get_current_store_id();

  SELECT *
  INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id
    AND store_id = v_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSAKSI_TIDAK_DITEMUKAN';
  END IF;

  IF v_sale.status = 'void' THEN
    RAISE EXCEPTION 'TRANSAKSI_SUDAH_VOID';
  END IF;

  UPDATE public.sales
  SET
    status = 'void',
    void_reason = v_reason,
    voided_at = now()
  WHERE id = v_sale.id
  RETURNING * INTO v_sale;

  FOR v_item IN
    SELECT product_id, SUM(qty)::integer AS qty
    FROM public.sale_items
    WHERE sale_id = v_sale.id
    GROUP BY product_id
    ORDER BY product_id ASC
  LOOP
    SELECT *
    INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
      AND store_id = v_store_id
    FOR UPDATE;

    UPDATE public.products
    SET stock = stock + v_item.qty
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
      'void',
      v_item.qty,
      v_product.stock,
      v_reason,
      v_sale.id
    );
  END LOOP;

  RETURN v_sale;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. adjust_stock_atomic
--    Mutasi manual stok_masuk (catatan opsional) & penyesuaian (alasan wajib).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_stock_atomic(
  p_product_id uuid,
  p_type text,
  p_qty_delta integer,
  p_note text DEFAULT ''
)
RETURNS public.products
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_note text;
  v_product public.products%ROWTYPE;
BEGIN
  IF p_type NOT IN ('stok_masuk', 'penyesuaian') THEN
    RAISE EXCEPTION 'JENIS_MUTASI_TIDAK_VALID';
  END IF;

  IF p_qty_delta IS NULL OR p_qty_delta = 0 THEN
    RAISE EXCEPTION 'DELTA_STOK_TIDAK_BOLEH_NOL';
  END IF;

  IF p_type = 'stok_masuk' AND p_qty_delta < 0 THEN
    RAISE EXCEPTION 'STOK_MASUK_HARUS_POSITIF';
  END IF;

  v_note := trim(COALESCE(p_note, ''));
  IF p_type = 'penyesuaian' AND length(v_note) = 0 THEN
    RAISE EXCEPTION 'ALASAN_PENYESUAIAN_WAJIB';
  END IF;

  v_store_id := public.get_current_store_id();

  SELECT *
  INTO v_product
  FROM public.products
  WHERE id = p_product_id
    AND store_id = v_store_id
    AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BARANG_TIDAK_DITEMUKAN';
  END IF;

  IF v_product.stock + p_qty_delta < 0 THEN
    RAISE EXCEPTION 'STOK_TIDAK_BOLEH_MINUS';
  END IF;

  UPDATE public.products
  SET stock = stock + p_qty_delta
  WHERE id = v_product.id
  RETURNING * INTO v_product;

  INSERT INTO public.stock_movements (
    store_id,
    product_id,
    type,
    qty_delta,
    stock_after,
    note
  )
  VALUES (
    v_store_id,
    v_product.id,
    p_type,
    p_qty_delta,
    v_product.stock,
    v_note
  );

  RETURN v_product;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. delete_product_smart
--    Pernah terjual -> soft delete (is_active = false).
--    Belum pernah terjual -> hard delete permanen.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_product_smart(
  p_product_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_exists boolean;
  v_has_sales boolean;
BEGIN
  v_store_id := public.get_current_store_id();

  SELECT EXISTS (
    SELECT 1
    FROM public.products
    WHERE id = p_product_id
      AND store_id = v_store_id
  )
  INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'BARANG_TIDAK_DITEMUKAN';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.sale_items
    WHERE product_id = p_product_id
  )
  INTO v_has_sales;

  IF v_has_sales THEN
    UPDATE public.products
    SET is_active = false
    WHERE id = p_product_id
      AND store_id = v_store_id;

    RETURN jsonb_build_object(
      'mode', 'soft_deleted',
      'product_id', p_product_id
    );
  ELSE
    DELETE FROM public.products
    WHERE id = p_product_id
      AND store_id = v_store_id;

    RETURN jsonb_build_object(
      'mode', 'hard_deleted',
      'product_id', p_product_id
    );
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. import_products_csv_atomic
--    Proses maks 1.000 baris valid hasil preview CSV klien.
--    Upsert berdasarkan (store_id, barcode) hanya pada barang aktif (is_active = true).
--    Perubahan stok dicatat di stock_movements sebagai 'penyesuaian' ("Import CSV").
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_products_csv_atomic(
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_row_count integer;
  v_row jsonb;
  v_name text;
  v_barcode text;
  v_category text;
  v_sell_price integer;
  v_cost_price integer;
  v_stock integer;
  v_min_stock integer;
  v_existing public.products%ROWTYPE;
  v_found boolean := false;
  v_created public.products%ROWTYPE;
  v_delta integer;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_stock_adjusted integer := 0;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'DATA_CSV_TIDAK_VALID';
  END IF;

  v_row_count := jsonb_array_length(p_rows);
  IF v_row_count = 0 THEN
    RAISE EXCEPTION 'DATA_CSV_KOSONG';
  END IF;

  IF v_row_count > 1000 THEN
    RAISE EXCEPTION 'MAKSIMAL_1000_BARIS_CSV';
  END IF;

  v_store_id := public.get_current_store_id();

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_name := trim(COALESCE(v_row->>'name', ''));
    v_barcode := NULLIF(trim(COALESCE(v_row->>'barcode', '')), '');
    v_category := trim(COALESCE(v_row->>'category', ''));
    v_sell_price := COALESCE((v_row->>'sell_price')::integer, -1);
    v_cost_price := COALESCE((v_row->>'cost_price')::integer, 0);
    v_stock := COALESCE((v_row->>'stock')::integer, 0);
    v_min_stock := COALESCE((v_row->>'min_stock')::integer, 0);

    IF length(v_name) = 0
      OR v_sell_price < 0
      OR v_cost_price < 0
      OR v_stock < 0
      OR v_min_stock < 0
    THEN
      RAISE EXCEPTION 'BARIS_CSV_TIDAK_VALID:%', v_name;
    END IF;

    v_found := false;

    IF v_barcode IS NOT NULL THEN
      SELECT *
      INTO v_existing
      FROM public.products
      WHERE store_id = v_store_id
        AND barcode = v_barcode
        AND is_active = true
      FOR UPDATE;
      v_found := FOUND;
    END IF;

    IF v_found THEN
      v_delta := v_stock - v_existing.stock;

      UPDATE public.products
      SET
        name = v_name,
        category = v_category,
        sell_price = v_sell_price,
        cost_price = v_cost_price,
        stock = v_stock,
        min_stock = v_min_stock
      WHERE id = v_existing.id;

      v_updated := v_updated + 1;

      IF v_delta <> 0 THEN
        INSERT INTO public.stock_movements (
          store_id,
          product_id,
          type,
          qty_delta,
          stock_after,
          note
        )
        VALUES (
          v_store_id,
          v_existing.id,
          'penyesuaian',
          v_delta,
          v_stock,
          'Import CSV'
        );
        v_stock_adjusted := v_stock_adjusted + 1;
      END IF;
    ELSE
      INSERT INTO public.products (
        store_id,
        name,
        barcode,
        category,
        sell_price,
        cost_price,
        stock,
        min_stock,
        is_active
      )
      VALUES (
        v_store_id,
        v_name,
        v_barcode,
        v_category,
        v_sell_price,
        v_cost_price,
        v_stock,
        v_min_stock,
        true
      )
      RETURNING * INTO v_created;

      v_inserted := v_inserted + 1;

      IF v_stock > 0 THEN
        INSERT INTO public.stock_movements (
          store_id,
          product_id,
          type,
          qty_delta,
          stock_after,
          note
        )
        VALUES (
          v_store_id,
          v_created.id,
          'penyesuaian',
          v_stock,
          v_stock,
          'Import CSV'
        );
        v_stock_adjusted := v_stock_adjusted + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'stock_adjusted', v_stock_adjusted
  );
END;
$$;

-- Berikan hak eksekusi hanya ke role authenticated
REVOKE ALL ON FUNCTION public.ensure_store_initialized() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_store_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_sale_atomic(text, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.void_sale_atomic(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjust_stock_atomic(uuid, text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_product_smart(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_products_csv_atomic(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ensure_store_initialized() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_store_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_sale_atomic(text, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_sale_atomic(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_stock_atomic(uuid, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_product_smart(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_products_csv_atomic(jsonb) TO authenticated;
