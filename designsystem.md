# Design System: src dimas kasir v0.2.0

Panduan sistem desain resmi untuk aplikasi kasir Android **src dimas kasir v0.2.0**, mengacu pada simulasi terverifikasi di [index.html](file:///C:/apk-kasir-srcdimas/index.html) (tag `v0.1.5`) serta aset resmi [assets/logo.png](file:///C:/apk-kasir-srcdimas/assets/logo.png) dan [icon-android.svg](file:///C:/apk-kasir-srcdimas/icon-android.svg).

---

## 1. Prinsip Visual

1. **Merah Brand `#D91E2A` & Layar Putih `#FFFFFF` dengan Netral Lembut:** Latar utama tetap putih bersih `#FFFFFF` dan aksen fokus tetap merah `#D91E2A`, dipadukan netral lembut (`#F7F7F8`, `#E4E4E7`, `#71717A`) serta tint merah tipis `#FEF2F2` khusus status peringatan/void agar tampilan modern, ringan, dan bebas kotak garis hitam kaku.
2. **Hierarki Terarah:** Daftar dikelompokkan dalam kontainer hairline (`border: 1px solid #E4E4E7`) dengan pembatas tipis antar baris; input dan tile metrik memakai permukaan lembut `#F7F7F8`.
3. **Ergonomi Kasir Cepat (`< 20 detik`):** Angka Rupiah, kuantitas, dan jam memakai `tabular-nums` dan bobot `800`. Layar Kasir menampilkan katalog 2 kolom berfoto dengan Sticky Floating Checkout Bar & Slide-Up Checkout Sheet.
4. **Animasi Smooth & Santai (Reanimated 60fps):**
   - Logo Login masuk santai (`700ms`, ease-out-quint), mengambang mikro hidup saat diam (`4.4s` siklus), dan keluar halus ke atas (`360ms`) saat login berhasil.
   - Seluruh klik tombol, kartu, chip, dan tab memakai `MotionPressable` (`scale 0.965`, `SPRING_GENTLE`).
5. **Tanpa Elemen Klise AI:** Tidak menggunakan eyebrow pill, tidak ada gradient/glow dekoratif, tidak ada emoji di UI.

---

## 2. Token Warna (`tailwind.config.js`)

| Token | Hex | Peran Penggunaan |
| :--- | :--- | :--- |
| `red` | `#D91E2A` | Hero Penjualan Beranda, tombol CTA utama, tombol scan Kasir tengah, tab aktif, bar puncak grafik, badge qty Kasir, teks Kembalian & status penting. |
| `red-soft` | `#FEF2F2` | Latar status ringan Stok Menipis, badge `VOID`, dan tombol aksi berbahaya lembut (`btn-danger-soft`). |
| `white` | `#FFFFFF` | Latar seluruh layar, permukaan kartu hairline, serta teks/ikon di atas bidang merah atau hitam. |
| `surface` | `#F7F7F8` | Latar input pencarian & form, tile KPI 2×2 Laporan, tombol aksi cepat Beranda, track segmented control, dan placeholder foto produk. |
| `border` | `#E4E4E7` | Garis tipis `1px` untuk tepi kartu hairline, pembatas antar baris, garis atas bottom tab, dan batang normal grafik. |
| `black` | `#09090B` | Teks utama, judul layar, nama produk, dan nominal Rupiah (kontras >19:1 di atas putih). |
| `muted` | `#71717A` | Subteks, jam, barcode, kategori, dan tab non-aktif (kontras 4.6:1, lolos WCAG AA). |
| Icon Android BG | `#E62129` | Latar solid Adaptive Icon Android (`assets/icon.png` & `assets/adaptive-icon.png`). |

---

## 3. Tipografi & Format Data

- **Font Family:** `Plus Jakarta Sans` (`400`, `500`, `600`, `700`, `800`).
- **Angka:** Wajib `tabular-nums` untuk nominal Rupiah, jumlah stok/unit, dan jam.
- **Format Data:**
  - Mata uang: `Rp15.000` (tanpa spasi, tanpa `,00`).
  - Nomor struk: `SDK-YYYYMMDD-XXXX`.
  - Pembayaran: Tunai.

---

## 4. Radius & Elevasi

| Token | Nilai | Penggunaan |
| :--- | :--- | :--- |
| `rounded-hero` | `24px` | Hero Penjualan Beranda, kartu modal utama. |
| `rounded-card` | `20px` | Kontainer kartu hairline (`group-card`), tile metrik lembut. |
| `rounded-control` | `14px` | Tombol CTA utama (`min-h-[46px]`), kolom input & search bar. |
| `rounded-thumb` | `12px` | Thumbnail foto produk (`ProductThumbnail`). |
| `rounded-chip` | `10px` | Filter chips & tombol segmen. |

---

## 5. Aset Resmi Aplikasi

- **Login Logo:** `assets/logo.png` (lockup horizontal `SRC DIMAS — KASIR`).
- **Android Launcher Icon:** `assets/icon.png` (`1024×1024` full-bleed `#E62129`) dan `assets/adaptive-icon.png` (`1024×1024` foreground transparan di dalam safe-zone 66%).
- **Ikon UI:** `@expo/vector-icons/FontAwesome6` solid.
