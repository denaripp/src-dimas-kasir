/**
 * Identitas permanen aplikasi kasir pribadi Toko SRC Dimas.
 * Digunakan untuk seluruh keluaran struk (Bluetooth ESC/POS, PDF/WhatsApp, Tes Cetak)
 * agar tidak pernah tertimpa data profil akun Google atau nilai bawaan database.
 */
export const STORE_BRAND = {
  name: 'Toko SRC Dimas',
  nameUpper: 'TOKO SRC DIMAS',
  address: 'Jl. Raya Belawa Wangkelang, Desa Wangkelang',
  addressLines58: ['Jl. Raya Belawa Wangkelang,', 'Desa Wangkelang'] as readonly string[],
  cashierName: 'Toko SRC Dimas',
  footerLines: ['Terima Kasih Telah Berbelanja', 'di Toko SRC DIMAS'] as readonly string[],
} as const;
