// Supabase Edge Function: delete-account
// Menghapus permanen seluruh data toko secara atomik (sales, sale_items, products,
// stock_movements, expenses, expense_categories, stores), akun auth.users,
// dan seluruh objek storage milik user dengan paginasi penuh.
// Wajib konfirmasi nama toko persis sesuai PRD 3.11.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const baseHeaders = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: baseHeaders,
  });
}

async function purgeUserBucket(
  adminClient: SupabaseClient,
  bucket: 'store-logos' | 'product-images',
  userId: string,
): Promise<boolean> {
  const PAGE_SIZE = 100;
  let allDeleted = true;

  for (let page = 0; page < 50; page += 1) {
    const { data: files, error: listError } = await adminClient.storage
      .from(bucket)
      .list(userId, { limit: PAGE_SIZE, offset: 0 });

    if (listError) {
      console.error(`[delete-account] gagal list bucket ${bucket}:`, listError.message);
      return false;
    }

    if (!files || files.length === 0) {
      break;
    }

    const paths = files
      .filter((file) => Boolean(file?.name))
      .map((file) => `${userId}/${file.name}`);

    if (paths.length === 0) {
      break;
    }

    const { error: removeError } = await adminClient.storage.from(bucket).remove(paths);
    if (removeError) {
      console.error(`[delete-account] gagal remove bucket ${bucket}:`, removeError.message);
      allDeleted = false;
      break;
    }

    if (files.length < PAGE_SIZE) {
      break;
    }
  }

  return allDeleted;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method tidak diizinkan.' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Sesi login tidak valid.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error('[delete-account] env server tidak lengkap');
      return jsonResponse({ error: 'Konfigurasi server belum lengkap.' }, 500);
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body.confirmStoreName !== 'string') {
      return jsonResponse({ error: 'Konfirmasi nama toko wajib diisi.' }, 400);
    }

    const confirmStoreName = body.confirmStoreName.trim();
    if (!confirmStoreName) {
      return jsonResponse({ error: 'Konfirmasi nama toko wajib diisi.' }, 400);
    }

    // 1. Verifikasi JWT pengguna server-side
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Token autentikasi tidak valid atau kedaluwarsa.' }, 401);
    }

    // 2. Client Admin untuk penghapusan permanen
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: store, error: storeError } = await adminClient
      .from('stores')
      .select('id, name')
      .eq('owner_id', user.id)
      .single();

    if (storeError || !store) {
      return jsonResponse({ error: 'Data toko tidak ditemukan.' }, 404);
    }

    // 3. Validasi konfirmasi 2 langkah: nama toko harus cocok persis
    if (confirmStoreName !== store.name.trim()) {
      return jsonResponse(
        { error: 'Nama toko tidak cocok. Ketik nama toko persis untuk menghapus akun.' },
        400,
      );
    }

    // 4. Hapus seluruh data relasional toko secara ATOMIK (1 transaksi PostgreSQL)
    //    Jika gagal, seluruh transaksi rollback — akun & storage tetap utuh.
    const { error: deleteDbError } = await adminClient.rpc('delete_store_data_atomic', {
      p_owner_id: user.id,
    });

    if (deleteDbError) {
      console.error('[delete-account] delete_store_data_atomic error:', deleteDbError.message);
      return jsonResponse(
        { error: 'Gagal menghapus data toko. Silakan coba lagi beberapa saat.' },
        500,
      );
    }

    // 5. Hapus seluruh file logo & foto produk user di Storage (dengan paginasi)
    const logosCleaned = await purgeUserBucket(adminClient, 'store-logos', user.id);
    const imagesCleaned = await purgeUserBucket(adminClient, 'product-images', user.id);
    if (!logosCleaned || !imagesCleaned) {
      console.error('[delete-account] sebagian file storage tidak terhapus untuk user:', user.id);
    }

    // 6. Hapus akun auth.users secara permanen
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteAuthError) {
      console.error('[delete-account] deleteUser error:', deleteAuthError.message);
      return jsonResponse(
        { error: 'Gagal menyelesaikan penghapusan akun. Silakan hubungi dukungan.' },
        500,
      );
    }

    return jsonResponse({ success: true }, 200);
  } catch (err) {
    console.error('[delete-account] unexpected error:', err);
    return jsonResponse({ error: 'Terjadi kesalahan pada server.' }, 500);
  }
});
