# Changelog

Seluruh perubahan penting pada **src dimas kasir** dicatat di dokumen ini.

## [v0.3.4] — 2026-11-24
### Panel Notifikasi Stok di Beranda
- Menambahkan modal **Notifikasi Stok** (`LowStockNotificationModal`) pada ikon lonceng kanan atas Beranda yang menampilkan daftar barang **Stok Habis (0)** dan **Stok Menipis** lengkap dengan tombol cepat **`+ Stok`** langsung ke halaman kelola stok (tidak lagi memindahkan tab ke Barang & Stok).

## [v0.3.3] — 2026-11-24
### Perbaikan Struk Thermal & PDF
- Menghapus tag `<B>` (4× besar / `ESC ! 48`) pada baris `TOTAL` agar seluruh baris ringkasan (`Total Item`, `TOTAL`, `TUNAI`, `KEMBALI`) seragam dan sejajar rata kanan 32 kolom (58mm) / 48 kolom (80mm).
- Merapikan layout struk thermal & PDF dengan ruang napas vertikal antar-seksi dan garis pemisah tunggal `----`.
- Menyederhanakan cap waktu struk menjadi 1 baris `Tanggal : DD/MM/YYYY HH:mm` (WIB) tanpa detik dan tanpa baris duplikat `Dicetak`.

## [v0.3.2] — 2026-11-24
### Perbaikan Identitas Struk, Waktu WIB & Scanner Anti-Ngawur
- Mengunci identitas struk permanen ke `TOKO SRC DIMAS` dan `Jl. Raya Belawa Wangkelang, Desa Wangkelang` melalui `src/lib/storeBrand.ts` (mengabaikan metadata profil akun Google/DB).
- Menambahkan parser `parseTimestampSafe()` & formatter WIB deterministik (`UTC+7`) di `src/lib/format.ts` agar kebal terhadap bug timezone Android Hermes.
- Menambahkan kelas `BarcodeScanConsensus` (wajib 3 frame identik untuk barcode 1D, 2 frame untuk QR, dan global cooldown `1200ms`) untuk menghilangkan salah baca 1 frame buram pada kemasan plastik.
- Mengubah mode kamera Kasir menjadi `closeOnScan={true}` dengan hard-lock penutupan modal, tombol senter (`enableTorch`), dan banner konfirmasi masuk keranjang.

## [v0.3.1] — 2026-11-24
### Pencarian Barcode & Redesign Struk Awal
- Menambahkan modul `src/lib/barcode.ts` (`normalizeBarcode`, `matchBarcode`) dengan toleransi UPC-A (12 digit) ↔ EAN-13 (13 digit) dan pembersihan karakter kontrol tersembunyi.
- Menambahkan tombol pemindai kamera di menu **Barang & Stok** serta dialog penanganan khusus untuk barang stok `0` di Kasir.
- Sinkronisasi cache instan React Query (`setQueryData`) setelah simpan/hapus barang dan auto-refetch saat tab fokus.
- Rombak awal tata letak struk thermal 58mm/80mm dan HTML/PDF ke format 2 baris per item.

## [v0.3.0] — 2026-11-24
### Performa 60fps, Security Hardening & Native Google Sign-In
- Migrasi login ke Native Android Google Sign-In (`@react-native-google-signin/google-signin` + Supabase `signInWithIdToken`) & enkripsi token sesi di Android Keystore (`expo-secure-store`).
- Audit keamanan penuh (Migrasi `004_security_and_report_rpc.sql`): pengetatan RLS multi-tenant, `REVOKE EXECUTE` RPC dari `anon`, proteksi CSV formula injection, sanitasi kontrol ESC/POS, dan ProGuard/R8 release hardening.
- Optimasi rendering 60fps: modularisasi komponen Kasir, `expo-image` disk caching, kompresi upload foto `512px`, grafik batang Flexbox murni, dan laporan periode server-side RPC.
- Penyederhanaan navigasi dengan menghapus layar Profil dan memindahkan pengaturan Printer & Akun ke modal ringkas.

## [v0.2.0] — 2026-11-24
### Redesign UI v0.2.0 & Foto Produk
- Pembaruan antarmuka modern 3 warna (Merah `#D91E2A`, Putih `#FFFFFF`, Hitam `#09090B`) dengan animasi Reanimated 60fps, katalog Kasir 2 kolom berfoto, dan slide-up checkout sheet.
- Dukungan foto produk opsional via Galeri/Kamera (`supabase/migrations/003_product_images.sql` + bucket `product-images`).
- Pembaruan ikon Android & adaptive icon resmi **SRC Dimas Kasir**.

## [v0.1.0] — 2026-11-23
### Rilis Awal
- Fondasi POS lengkap: Auth Google + Supabase, Kasir tunai dengan transaksi atomik `create_sale_atomic`, cetak struk thermal Bluetooth ESC/POS + PDF, CRUD barang, manajemen stok & mutasi, impor/ekspor CSV, riwayat realtime + void atomik, keuangan & laporan usaha.
