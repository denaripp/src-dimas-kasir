-- ============================================================================
-- src dimas kasir v0.1.0 — Phase 2 SQL Verification Script
-- Jalankan di Supabase SQL Editor dalam transaksi ROLLBACK agar data bersih.
-- Menguji: trigger onboarding, atomic sale, stok kurang rollback, void 2x ditolak,
-- smart delete (soft vs hard), import CSV upsert, dan isolasi RLS User A vs User B.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_store_a uuid;
  v_store_b uuid;
  v_cat_count integer;
  v_prod_indomie uuid;
  v_prod_unused uuid;
  v_sale_res jsonb;
  v_sale_id uuid;
  v_stock_now integer;
  v_del_res jsonb;
  v_csv_res jsonb;
  v_rls_count integer;
BEGIN
  -- 1. Buat 2 user auth dummy -> cek trigger otomatis stores + 6 kategori pengeluaran
  INSERT INTO auth.users (id, aud, role, email)
  VALUES
    (v_user_a, 'authenticated', 'authenticated', 'user_a_' || v_user_a || '@test.local'),
    (v_user_b, 'authenticated', 'authenticated', 'user_b_' || v_user_b || '@test.local');

  SELECT id INTO v_store_a FROM public.stores WHERE owner_id = v_user_a;
  SELECT id INTO v_store_b FROM public.stores WHERE owner_id = v_user_b;
  ASSERT v_store_a IS NOT NULL AND v_store_b IS NOT NULL, 'Trigger stores gagal';

  SELECT count(*) INTO v_cat_count FROM public.expense_categories WHERE store_id = v_store_a;
  ASSERT v_cat_count = 6, format('Kategori bawaan harus 6, dapat %s', v_cat_count);

  -- Impersonate User A
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  -- 2. Tambah barang untuk User A
  INSERT INTO public.products (store_id, name, barcode, sell_price, cost_price, stock, min_stock)
  VALUES
    (v_store_a, 'Indomie Goreng', '8998866200578', 3500, 2800, 10, 3)
  RETURNING id INTO v_prod_indomie;

  INSERT INTO public.products (store_id, name, sell_price, cost_price, stock, min_stock)
  VALUES
    (v_store_a, 'Barang Belum Terjual', 5000, 3000, 5, 1)
  RETURNING id INTO v_prod_unused;

  -- 3. Uji create_sale_atomic sukses (2 pcs -> total Rp7.000, bayar Rp10.000, kembali Rp3.000)
  v_sale_res := public.create_sale_atomic(
    '20261123',
    10000,
    jsonb_build_array(jsonb_build_object('product_id', v_prod_indomie, 'qty', 2))
  );

  v_sale_id := (v_sale_res->'sale'->>'id')::uuid;
  ASSERT (v_sale_res->'sale'->>'receipt_number') = 'SDK-20261123-0001', 'Nomor struk salah';
  ASSERT (v_sale_res->'sale'->>'total_amount')::integer = 7000, 'Total salah';
  ASSERT (v_sale_res->'sale'->>'change_amount')::integer = 3000, 'Kembalian salah';

  SELECT stock INTO v_stock_now FROM public.products WHERE id = v_prod_indomie;
  ASSERT v_stock_now = 8, format('Stok seharusnya 8, dapat %s', v_stock_now);

  -- 4. Uji create_sale_atomic ditolak jika stok kurang (minta 9 saat stok 8)
  BEGIN
    PERFORM public.create_sale_atomic(
      '20261123',
      50000,
      jsonb_build_array(jsonb_build_object('product_id', v_prod_indomie, 'qty', 9))
    );
    RAISE EXCEPTION 'Seharusnya gagal karena stok tidak cukup';
  EXCEPTION
    WHEN OTHERS THEN
      ASSERT SQLERRM LIKE 'STOK_TIDAK_CUKUP%', format('Error tak terduga: %s', SQLERRM);
  END;

  SELECT stock INTO v_stock_now FROM public.products WHERE id = v_prod_indomie;
  ASSERT v_stock_now = 8, 'Stok berubah padahal transaksi ditolak';

  -- 5. Uji void_sale_atomic 1x sukses (stok kembali ke 10), void ke-2 ditolak
  PERFORM public.void_sale_atomic(v_sale_id, 'Salah input barang');
  SELECT stock INTO v_stock_now FROM public.products WHERE id = v_prod_indomie;
  ASSERT v_stock_now = 10, format('Stok pasca void seharusnya 10, dapat %s', v_stock_now);

  BEGIN
    PERFORM public.void_sale_atomic(v_sale_id, 'Coba void lagi');
    RAISE EXCEPTION 'Void kedua seharusnya ditolak';
  EXCEPTION
    WHEN OTHERS THEN
      ASSERT SQLERRM = 'TRANSAKSI_SUDAH_VOID', format('Error void ke-2 salah: %s', SQLERRM);
  END;

  -- 6. Uji delete_product_smart: pernah terjual -> soft_deleted, belum -> hard_deleted
  v_del_res := public.delete_product_smart(v_prod_indomie);
  ASSERT (v_del_res->>'mode') = 'soft_deleted', 'Barang terjual harus soft delete';

  v_del_res := public.delete_product_smart(v_prod_unused);
  ASSERT (v_del_res->>'mode') = 'hard_deleted', 'Barang belum terjual harus hard delete';

  -- 7. Uji import_products_csv_atomic: insert baru + upsert barcode aktif + mutasi stok
  v_csv_res := public.import_products_csv_atomic(
    jsonb_build_array(
      jsonb_build_object('name', 'Air Mineral', 'barcode', '8886008101053', 'sell_price', 4000, 'cost_price', 2500, 'stock', 20, 'min_stock', 5)
    )
  );
  ASSERT (v_csv_res->>'inserted')::integer = 1 AND (v_csv_res->>'stock_adjusted')::integer = 1, 'CSV insert gagal';

  v_csv_res := public.import_products_csv_atomic(
    jsonb_build_array(
      jsonb_build_object('name', 'Air Mineral 600ml', 'barcode', '8886008101053', 'sell_price', 4500, 'cost_price', 2500, 'stock', 25, 'min_stock', 5)
    )
  );
  ASSERT (v_csv_res->>'updated')::integer = 1 AND (v_csv_res->>'stock_adjusted')::integer = 1, 'CSV upsert gagal';

  -- 8. Uji isolasi RLS: ganti ke User B, tidak boleh melihat produk/transaksi User A
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO v_rls_count FROM public.products WHERE store_id = v_store_a;
  ASSERT v_rls_count = 0, 'RLS bocor pada tabel products';

  SELECT count(*) INTO v_rls_count FROM public.sales WHERE store_id = v_store_a;
  ASSERT v_rls_count = 0, 'RLS bocor pada tabel sales';

  RAISE NOTICE 'SELURUH UJI PHASE 2 LULUS 100%%';
END
$$;

ROLLBACK;
