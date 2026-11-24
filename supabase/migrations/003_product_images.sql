-- ============================================================================
-- src dimas kasir v0.2.0 — Phase 2: Product Images Column & Storage Bucket
-- Non-destructive migration: adds optional image_url to products & storage RLS
-- ============================================================================

-- 1. Tambah kolom opsional image_url ke tabel products (aman untuk data lama)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url text;

-- 2. Storage Bucket: product-images (maks 2 MB, PNG/JPEG/WebP, public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS Policies (isolasi per folder auth.uid())
DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
CREATE POLICY "product_images_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_owner_insert" ON storage.objects;
CREATE POLICY "product_images_owner_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "product_images_owner_update" ON storage.objects;
CREATE POLICY "product_images_owner_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "product_images_owner_delete" ON storage.objects;
CREATE POLICY "product_images_owner_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
