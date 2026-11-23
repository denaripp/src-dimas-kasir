// Supabase Edge Function: delete-account
// Menghapus permanen seluruh data toko (storage logo, sales, sale_items, products,
// stock_movements, expenses, expense_categories, stores) dan akun auth.users.
// Wajib konfirmasi nama toko persis sesuai PRD 3.11.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
      return jsonResponse({ error: 'Konfigurasi server belum lengkap.' }, 500);
    }

    const body = (await req.json().catch(() => null)) as {
      confirmStoreName?: string;
    } | null;

    const confirmStoreName = body?.confirmStoreName?.trim() ?? '';
    if (!confirmStoreName) {
      return jsonResponse({ error: 'Konfirmasi nama toko wajib diisi.' }, 400);
    }

    // 1. Verifikasi JWT pengguna
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

    // 4. Hapus seluruh file logo milik user di bucket store-logos
    const { data: files } = await adminClient.storage
      .from('store-logos')
      .list(user.id, { limit: 100 });

    if (files && files.length > 0) {
      const paths = files.map((file) => `${user.id}/${file.name}`);
      await adminClient.storage.from('store-logos').remove(paths);
    }

    // 5. Hapus sales terlebih dahulu agar cascade sale_items selesai sebelum products dihapus
    const { error: deleteSalesError } = await adminClient
      .from('sales')
      .delete()
      .eq('store_id', store.id);

    if (deleteSalesError) {
      return jsonResponse({ error: `Gagal menghapus transaksi: ${deleteSalesError.message}` }, 500);
    }

    // 6. Hapus store (cascade products, stock_movements, expenses, expense_categories)
    const { error: deleteStoreError } = await adminClient
      .from('stores')
      .delete()
      .eq('id', store.id);

    if (deleteStoreError) {
      return jsonResponse({ error: `Gagal menghapus data toko: ${deleteStoreError.message}` }, 500);
    }

    // 7. Hapus akun auth.users secara permanen
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteAuthError) {
      return jsonResponse({ error: `Gagal menghapus akun auth: ${deleteAuthError.message}` }, 500);
    }

    return jsonResponse({ success: true }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan tidak terduga.';
    return jsonResponse({ error: message }, 500);
  }
});
