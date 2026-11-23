# Design System: src dimas kasir v0.1.0

Panduan sistem desain resmi untuk aplikasi kasir Android **src dimas kasir v0.1.0**, disusun berdasarkan pratinjau terverifikasi di `index.html` dan seluruh kebutuhan fungsional di `prd.md`. Dokumen ini menjadi acuan tunggal saat membangun antarmuka React Native + Expo + NativeWind.

---

## 1. Prinsip Visual

1. **Ketat 3 Warna Murni:** Seluruh antarmuka hanya menggunakan **Merah (`#D91E2A`)**, **Putih (`#FFFFFF`)**, dan **Hitam (`#09090B`)**.
2. **Dilarang Menambahkan Warna Lain:** Tidak ada warna pink, tint merah muda/pastel, abu-abu, hijau, biru, kuning, oranye, gradasi, maupun drop shadow berwarna kabur.
3. **Hierarki Tanpa Abu-Abu:** Pembedaan elemen utama dan sekunder dicapai melalui kontras ukuran font, ketebalan huruf (`font-weight`), ketebalan garis (`1.5px` / `2px`), pola arsir/putus-putus (`dashed`), serta inversi blok warna (Merah–Putih vs Putih–Hitam).
4. **Ergonomi Kasir Cepat (`< 20 detik`):** Angka harga, nominal tunai, dan kembalian dicetak tebal (`800`) berwarna hitam di atas putih (atau putih di atas merah) agar terbaca instan di berbagai kondisi pencahayaan toko.
5. **Tanpa Elemen Klise AI:** Tidak menggunakan pill badge/chip kapsul di atas judul, tidak ada ornamen glow/blur melayang, dan tidak ada dekorasi tanpa fungsi.

---

## 2. Token Warna

| Token | Hex | Peran Penggunaan |
| :--- | :--- | :--- |
| `--red` / `brand-red` | `#D91E2A` | Kartu hero penjualan, tombol CTA utama, tombol scan kasir di tengah navigasi, tab/tanggal/filter aktif, bar puncak grafik, lingkaran ikon KPI, indikator peringatan stok menipis, teks kembalian/biaya penting, dan kartu status `VOID`. |
| `--white` / `surface-white` | `#FFFFFF` | Latar belakang utama layar, seluruh permukaan kartu normal, tombol outline default, serta seluruh teks dan ikon di atas bidang merah atau hitam. |
| `--black` / `ink-black` | `#09090B` | Seluruh teks utama dan angka harga/nominal di atas latar putih, garis tepi kartu & input (`1.5px`), ikon navigasi non-aktif, avatar toko, dan garis arsir latar grafik. |

### Konfigurasi `tailwind.config.js` (NativeWind)

```js
module.exports = {
  theme: {
    colors: {
      transparent: 'transparent',
      red: '#D91E2A',
      white: '#FFFFFF',
      black: '#09090B',
    },
    fontFamily: {
      sans: ['PlusJakartaSans-Regular'],
      medium: ['PlusJakartaSans-Medium'],
      semibold: ['PlusJakartaSans-SemiBold'],
      bold: ['PlusJakartaSans-Bold'],
      extrabold: ['PlusJakartaSans-ExtraBold'],
    },
  },
};
```

---

## 3. Tipografi & Format Data

- **Font Family:** `Plus Jakarta Sans` (bobot `400`, `500`, `600`, `700`, `800`).
- **Angka Monospaced / Tabular:** Gunakan `font-variant-numeric: tabular-nums` pada nominal Rupiah, kuantitas, dan jam transaksi agar kolom angka tetap sejajar saat nilai berubah.

### Skala Tipografi

| Peran | Ukuran | Bobot | Letter Spacing | Warna Default |
| :--- | :--- | :--- | :--- | :--- |
| Angka Utama Grafik (`chart-big-val`) | `24px` | `800` | `-0.03em` | `#09090B` |
| Nominal Hero Penjualan (`hero-title`) | `21px` | `800` | `-0.03em` | `#FFFFFF` (di atas `#D91E2A`) |
| Angka Donut Ring (`ring-num`) | `18px` | `800` | `0` | `#FFFFFF` |
| Angka KPI & Statistik (`kpi-value` / `stat-val`) | `17px` | `800` | `-0.025em` | `#09090B` |
| Judul Layar & Total Bayar (`center-title` / `total`) | `16px` | `800` | `-0.02em` | `#09090B` |
| Nama Toko / Bulan (`greeting-name` / `calendar-month`) | `15px` | `800` | `-0.02em` | `#09090B` |
| Nama Barang / Nomor Struk (`item-title`) | `14px` | `800` | `0` | `#09090B` |
| Harga Item & CTA Utama (`item-price` / `primary-cta`) | `13.5px` | `800` | `0` | `#09090B` / `#FFFFFF` |
| Judul Seksi & Input (`section-title` / `input`) | `13px` | `600–800` | `-0.01em` | `#09090B` |
| Label KPI / Subteks Item (`kpi-label` / `item-sub`) | `12px–12.5px` | `500–600` | `0` | `#09090B` |
| Keterangan Mikro / Filter (`greeting-sub` / `period-btn`) | `11px–11.5px` | `500–700` | `0` | `#09090B` / `#FFFFFF` |
| Label Navigasi Bawah & Status Tag (`nav-label` / `status-tag`) | `10px–10.5px` | `500` (aktif `800`) | `0` / `0.04em` | `#09090B` / `#D91E2A` |

### Format Data Wajib (Sesuai `prd.md`)
- **Mata uang:** `Rp15.000` (tanpa spasi setelah `Rp`, pemisah titik ribuan, tanpa `,00`).
- **Nomor struk:** `SDK-YYYYMMDD-XXXX` (contoh: `SDK-20261123-0034`).
- **Pembayaran:** Hanya menampilkan label/opsi **Tunai** di v0.1.0.

---

## 4. Layout, Spasi, Radius & Border

### Struktur Layar Mobile
- **Padding horizontal layar:** `18px`.
- **Padding bawah area scroll (dengan bottom nav):** `96px` agar konten terbawah tidak tertutup navigasi; tanpa bottom nav: `24px`.
- **Jarak antar blok utama:** `14px`–`16px`.
- **Gap grid 2 kolom (KPI & Statistik 2×2):** `12px`.
- **Gap daftar item (`list-stack`):** `10px`.
- **Tinggi Bottom Navigation Bar:** `76px` (`border-top: 1.5px solid #09090B`).

### Border & Radius

| Komponen | Border | Border Radius |
| :--- | :--- | :--- |
| Hero Card | Tanpa border (blok solid `#D91E2A`) | `26px` |
| Chart Card | `1.5px solid #09090B` | `26px` |
| Calendar Strip Card | `1.5px solid #09090B` | `24px` |
| KPI Card, Stat Card, Item Card, Pay Card | `1.5px solid #09090B` | `22px` |
| Search Box, Primary CTA, Hari Kalender Aktif | `1.5px solid #09090B` (CTA: `#D91E2A`) | `16px` |
| Tombol Filter Periode & Nominal Cepat Tunai | `1.5px solid #09090B` (aktif: `#D91E2A`) | `12px` |
| Kotak Ikon Sub-Item (`22×22`) | Tanpa border (solid `#D91E2A` atau `#09090B`) | `7px` |
| Avatar, Tombol Ikon Header, Tombol Qty, Scan CTA | `1.5px solid #09090B` (Scan CTA: border `#FFFFFF` `3px` + outline `#D91E2A` `2px`) | `9999px` (bulat penuh) |
| Garis Pemisah Total Bayar | `border-top: 1.5px dashed #09090B` | `0` |

---

## 5. Sistem Ikon (Font Awesome 6 Free Solid)

- **Web / Preview (`index.html`):** Font Awesome 6.7.2 (`fa-solid`).
- **React Native / Expo:** `@expo/vector-icons/FontAwesome6` dengan prop `solid`.
- **Aturan Pemilihan Ikon:** Wajib siluet tunggal yang tajam pada ukuran kecil (`11px`–`21px`), seragam menggunakan gaya **Solid**, dan 100% sesuai konteks kasir/toko. Hindari ikon terlalu detail pada kotak kecil.
- **Aksesibilitas:** Ikon dekoratif memakai `aria-hidden="true"` (web) / `accessible={false}` (RN); tombol ikon tanpa teks wajib memiliki `aria-label` / `accessibilityLabel`.

### Pemetaan Ikon Resmi

| Konteks / Fitur | Nama Ikon (FA6 Solid) | Ukuran Container & Ikon |
| :--- | :--- | :--- |
| Top Bar — Printer Thermal | `print` | Lingkaran `40×40`, ikon `15px` |
| Top Bar — Notifikasi Stok | `bell` (+ titik merah `8×8`) | Lingkaran `40×40`, ikon `15px` |
| Hero — Penjualan Hari Ini | `rupiah-sign` | Lingkaran putih `24×24`, ikon merah `12px` |
| KPI Beranda — Laba Kotor | `arrow-trend-up` | Lingkaran merah `36×36`, ikon putih `15px` |
| KPI Beranda — Laba Bersih | `wallet` | Lingkaran merah `36×36`, ikon putih `15px` |
| Navigasi Kalender / Kembali | `chevron-left`, `chevron-right` | Lingkaran `28×28` / `40×40`, ikon `11px`–`15px` |
| Peringatan Stok Menipis (Item) | `triangle-exclamation` | Kotak merah `22×22` (`r=7px`), ikon putih `11px` |
| Transaksi Selesai (Item) | `receipt` | Kotak hitam `22×22` (`r=7px`), ikon putih `11px` |
| Aksi Tambah / Kurang Qty | `plus`, `minus` | Lingkaran `26×26` / `34×34`, ikon `11px`–`13px` |
| Kasir — Scan Kamera | `camera` | Lingkaran `40×40`, ikon `15px` |
| Kasir — Pencarian | `magnifying-glass` | Inline `13px`–`15px` |
| Kasir — Indikator HID & Online | `barcode`, `wifi` | Inline `11px` |
| Kasir — Bayar & Cetak Struk | `print` | Inline tombol CTA `14px` |
| Barang — Import / Export CSV | `file-arrow-up` | Lingkaran `40×40`, ikon `15px` |
| Laporan — Ekspor CSV | `download` | Lingkaran `40×40`, ikon `15px` |
| Laporan — Laba Bersih | `wallet` | Lingkaran merah `36×36`, ikon putih `15px` |
| Laporan — Transaksi | `receipt` | Lingkaran merah `36×36`, ikon putih `15px` |
| Laporan — Terlaris #1 | `trophy` | Lingkaran merah `36×36`, ikon putih `15px` |
| Laporan — Stok Menipis | `box-open` | Lingkaran merah `36×36`, ikon putih `15px` |
| Bottom Nav — Beranda | `house` | Ikon `18px` |
| Bottom Nav — Barang | `cube` | Ikon `18px` |
| Bottom Nav — Kasir / Scan (Tengah) | `barcode` | Lingkaran merah `56×56`, ikon putih `21px` |
| Bottom Nav — Riwayat | `receipt` | Ikon `18px` |
| Bottom Nav — Profil | `store` | Ikon `18px` |

---

## 6. Spesifikasi Komponen Utama

### 6.1 Hero Summary Card (Dashboard)
- Latar merah solid `#D91E2A`, seluruh teks putih `#FFFFFF`, radius `26px`, padding `18px 20px`.
- Sisi kiri: label ikon lingkaran putih + teks polos `"Penjualan Hari Ini"` (bukan pill badge), angka total besar (`21px`/`800`), dan subteks jumlah transaksi tunai selesai.
- Sisi kanan: donut ring SVG `84×84` dengan lintasan latar putih putus-putus (`stroke-width: 2`, `stroke-dasharray: 4 4`) dan busur progres putih tebal (`stroke-width: 8`, `stroke-linecap: round`).

### 6.2 Bottom Navigation Bar (5 Slot)
- 5 kolom sejajar: **Beranda**, **Barang**, **Kasir (CTA tengah)**, **Riwayat**, **Profil**.
- Tab non-aktif: ikon & teks hitam `#09090B` (`500`).
- Tab aktif: ikon & teks merah `#D91E2A` (`800`).
- Tombol tengah **Kasir/Scan**: lingkaran merah `56×56` menonjol ke atas (`margin-top: -22px`), border putih `3px`, outline merah `2px`, ikon `barcode` putih `21px`.

### 6.3 Kartu Daftar (`item-card`) & Status `VOID`
- **Normal (Selesai / Barang Aktif):** Latar putih `#FFFFFF`, border `1.5px solid #09090B`, radius `22px`, padding `13px 14px`. Jika stok `<= stok_minimum`, teks stok ditulis tebal berwarna `#D91E2A`.
- **Inverted (`VOID`):** Latar merah solid `#D91E2A`, border `#D91E2A`, seluruh teks putih `#FFFFFF`, label `VOID` kapital tebal, nominal dicoret (`line-through`), dan alasan pembatalan tampil langsung di baris keterangan.

### 6.4 Panel Pembayaran Tunai (Kasir)
- Kartu putih ber-border hitam `1.5px`, memuat ringkasan Uang Diterima, 3 tombol nominal cepat (`Uang Pas`, `Rp50.000`, `Rp100.000` — tombol terpilih merah solid `#D91E2A` teks putih), baris Kembalian berwarna merah tebal `#D91E2A`, garis putus-putus hitam `1.5px`, baris Total Bayar (`16px`/`800`), dan tombol CTA lebar penuh merah solid (`Bayar & Cetak Struk`).
- **Offline Banner (Online-First):** Saat koneksi internet terputus, tampilkan banner merah solid `#D91E2A` dengan teks putih dan nonaktifkan tombol bayar.

### 6.5 Visualisasi Grafik (Laporan Usaha)
Seluruh grafik dibangun secara ketat dalam 3 warna tanpa warna pink atau abu-abu:
1. **Grafik Batang 7 Hari:** Setiap hari menampilkan pasangan 2 batang (`width: 11px`, `border-radius: 6px`):
   - Batang latar (target/pembanding): putih dengan arsir diagonal hitam (`1.1px` tiap `4.8px`) dan border `1px solid #09090B`.
   - Batang aktual normal: putih dengan border `2px solid #D91E2A`.
   - Batang puncak (hari tertinggi): merah solid `#D91E2A` dengan label persentase & nama hari berwarna merah tebal.
2. **Mini Bar Sparkline (Laba Bersih):** Bar bergantian antara merah solid (`#D91E2A`) dan putih ber-border hitam (`1.5px solid #09090B`).
3. **Garis Tren (Transaksi):** Path SVG stroke merah `#D91E2A` ketebalan `2px` (`linecap/linejoin: round`).
4. **Indikator Blok (Stok Menipis):** 5 blok vertikal; blok terisi berwarna merah solid `#D91E2A`, blok kosong berwarna putih ber-border `1.5px solid #09090B`.

---

## 7. Aturan State & Interaksi

| State | Perlakuan Visual |
| :--- | :--- |
| Default (Outline Button / Input / Card) | Latar `#FFFFFF`, border `1.5px solid #09090B`, teks/ikon `#09090B`. |
| Active / Selected (Tab, Hari, Periode, Nominal Cepat) | Latar `#D91E2A`, border `#D91E2A`, teks/ikon `#FFFFFF`. |
| Primary Action (Bayar, Simpan, Scan) | Latar `#D91E2A`, teks/ikon `#FFFFFF`. |
| Destructive / Warning (Stok Menipis, Void, Hapus Akun) | Aksen `#D91E2A` (teks tebal atau blok solid merah dengan teks `#FFFFFF`). |
| Disabled (Offline / Konfirmasi Nama Toko Belum Cocok) | Latar `#FFFFFF`, border `1.5px dashed #09090B`, teks `#09090B` (tanpa warna abu-abu). |
