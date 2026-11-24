-- ============================================================================
-- src dimas kasir v0.3.0 — Phase 1 Security & Report RPC Verification Script
-- Runs inside BEGIN ... ROLLBACK so production data stays 100% untouched.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_store_a uuid;
  v_store_b uuid;
  v_prod_a uuid;
  v_cat_a uuid;
  v_sale_b uuid;
  v_default_cat_a uuid;
  v_report jsonb;
  v_anon_exec_count integer;
  v_public_storage_policies integer;
  v_deleted_store_id uuid;
  v_remaining_stores integer;
BEGIN
  -- 0. Verify no public SELECT storage listing policies remain (F-02)
  SELECT COUNT(*) INTO v_public_storage_policies
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname IN ('store_logos_public_read', 'product_images_public_read');
  ASSERT v_public_storage_policies = 0, 'F-02 failed: public storage listing policies still exist';

  -- 0b. Verify anon has ZERO EXECUTE privileges on public RPC functions
  SELECT COUNT(*) INTO v_anon_exec_count
  FROM information_schema.routine_privileges
  WHERE routine_schema = 'public'
    AND grantee = 'anon'
    AND privilege_type = 'EXECUTE'
    AND routine_name IN (
      'ensure_store_initialized',
      'get_current_store_id',
      'create_sale_atomic',
      'void_sale_atomic',
      'adjust_stock_atomic',
      'delete_product_smart',
      'import_products_csv_atomic',
      'get_period_report_summary',
      'delete_store_data_atomic'
    );
  ASSERT v_anon_exec_count = 0, format('anon EXECUTE privilege still present on %s RPCs', v_anon_exec_count);

  -- 1. Create 2 dummy tenants
  INSERT INTO auth.users (id, aud, role, email)
  VALUES
    (v_user_a, 'authenticated', 'authenticated', 'sec_a_' || v_user_a || '@test.local'),
    (v_user_b, 'authenticated', 'authenticated', 'sec_b_' || v_user_b || '@test.local');

  SELECT id INTO v_store_a FROM public.stores WHERE owner_id = v_user_a;
  SELECT id INTO v_store_b FROM public.stores WHERE owner_id = v_user_b;
  SELECT id INTO v_default_cat_a FROM public.expense_categories WHERE store_id = v_store_a AND is_default = true LIMIT 1;

  -- Impersonate Tenant A
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  INSERT INTO public.products (store_id, name, sell_price, cost_price, stock, min_stock)
  VALUES (v_store_a, 'Produk Tenant A', 10000, 7000, 20, 5)
  RETURNING id INTO v_prod_a;

  INSERT INTO public.expense_categories (store_id, name, is_default)
  VALUES (v_store_a, 'Kategori Kustom A', false)
  RETURNING id INTO v_cat_a;

  -- 2. Verify default expense category cannot be deleted via RLS
  DELETE FROM public.expense_categories WHERE id = v_default_cat_a;
  ASSERT EXISTS (SELECT 1 FROM public.expense_categories WHERE id = v_default_cat_a),
    'Default expense category should be protected from DELETE';

  -- 3. Verify negative qty element in create_sale_atomic is rejected
  BEGIN
    PERFORM public.create_sale_atomic(
      '20261124',
      20000,
      jsonb_build_array(
        jsonb_build_object('product_id', v_prod_a, 'qty', 3),
        jsonb_build_object('product_id', v_prod_a, 'qty', -2)
      )
    );
    RAISE EXCEPTION 'Negative qty element should be rejected';
  EXCEPTION
    WHEN OTHERS THEN
      ASSERT SQLERRM = 'ITEM_TIDAK_VALID', format('Unexpected error for negative qty: %s', SQLERRM);
  END;

  -- 4. Create 1 real sale + 1 expense for Tenant A and verify get_period_report_summary
  PERFORM public.create_sale_atomic(
    '20261124',
    25000,
    jsonb_build_array(jsonb_build_object('product_id', v_prod_a, 'qty', 2))
  );

  INSERT INTO public.expenses (store_id, category_id, category_name_snapshot, amount, note, expense_date)
  VALUES (v_store_a, v_cat_a, 'Kategori Kustom A', 1500, 'Biaya test', CURRENT_DATE);

  v_report := public.get_period_report_summary(
    now() - interval '1 hour',
    now() + interval '1 hour',
    CURRENT_DATE,
    CURRENT_DATE,
    420
  );

  ASSERT (v_report->>'totalSales')::bigint = 20000, format('Expected totalSales=20000, got %s', v_report->>'totalSales');
  ASSERT (v_report->>'completedCount')::integer = 1, format('Expected completedCount=1, got %s', v_report->>'completedCount');
  ASSERT (v_report->>'grossProfit')::bigint = 6000, format('Expected grossProfit=6000, got %s', v_report->>'grossProfit');
  ASSERT (v_report->>'totalExpenses')::bigint = 1500, format('Expected totalExpenses=1500, got %s', v_report->>'totalExpenses');
  ASSERT (v_report->>'netProfit')::bigint = 4500, format('Expected netProfit=4500, got %s', v_report->>'netProfit');
  ASSERT jsonb_array_length(v_report->'topProducts') = 1, 'Expected 1 top product';
  ASSERT jsonb_array_length(v_report->'dailySeries') = 1, 'Expected 1 daily series point';

  -- 5. Verify F-01: Impersonate Tenant B and attempt cross-tenant FK injection
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  INSERT INTO public.sales (store_id, receipt_number, total_amount, cash_received, change_amount, status)
  VALUES (v_store_b, 'SDK-20261124-9999', 10000, 10000, 0, 'completed')
  RETURNING id INTO v_sale_b;

  -- 5a. Cross-tenant sale_items -> Tenant A's product_id MUST fail RLS (42501)
  BEGIN
    INSERT INTO public.sale_items (
      sale_id, product_id, product_name_snapshot, qty, sell_price_snapshot, cost_price_snapshot, subtotal
    )
    VALUES (v_sale_b, v_prod_a, 'Injected', 1, 10000, 7000, 10000);
    RAISE EXCEPTION 'F-01 failed: cross-tenant sale_items insert succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL; -- Expected 42501 RLS violation
  END;

  -- 5b. Cross-tenant stock_movements -> Tenant A's product_id MUST fail RLS (42501)
  BEGIN
    INSERT INTO public.stock_movements (
      store_id, product_id, type, qty_delta, stock_after, note
    )
    VALUES (v_store_b, v_prod_a, 'penyesuaian', 1, 1, 'Injected');
    RAISE EXCEPTION 'F-01 failed: cross-tenant stock_movements insert succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  -- 5c. Cross-tenant expenses -> Tenant A's category_id MUST fail RLS (42501)
  BEGIN
    INSERT INTO public.expenses (
      store_id, category_id, category_name_snapshot, amount, note, expense_date
    )
    VALUES (v_store_b, v_cat_a, 'Injected', 1000, 'Injected', CURRENT_DATE);
    RAISE EXCEPTION 'F-01 failed: cross-tenant expenses insert succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  -- 5d. Verify authenticated CANNOT call delete_store_data_atomic
  BEGIN
    PERFORM public.delete_store_data_atomic(v_user_a);
    RAISE EXCEPTION 'authenticated should NOT be allowed to execute delete_store_data_atomic';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  -- 6. Verify service_role CAN execute delete_store_data_atomic atomically
  RESET ROLE;
  SET LOCAL ROLE service_role;
  v_deleted_store_id := public.delete_store_data_atomic(v_user_a);
  ASSERT v_deleted_store_id = v_store_a, 'delete_store_data_atomic returned wrong store_id';

  RESET ROLE;
  SELECT COUNT(*) INTO v_remaining_stores FROM public.stores WHERE id = v_store_a;
  ASSERT v_remaining_stores = 0, 'Store A still exists after delete_store_data_atomic';

  RAISE NOTICE 'SELURUH UJI V0.3.0 PHASE 1 LULUS 100%%';
END
$$;

ROLLBACK;
