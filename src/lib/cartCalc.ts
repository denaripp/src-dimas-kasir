export interface CartCalcItem {
  productId: string;
  name: string;
  sellPrice: number;
  availableStock: number;
  qty: number;
}

export interface ChangeResult {
  isEnough: boolean;
  change: number;
  shortfall: number;
}

export function calculateCartTotal(items: readonly CartCalcItem[]): number {
  return items.reduce((sum, item) => sum + item.sellPrice * item.qty, 0);
}

export function calculateCartItemCount(items: readonly CartCalcItem[]): number {
  return items.reduce((sum, item) => sum + item.qty, 0);
}

export function calculateChange(total: number, cashReceived: number): ChangeResult {
  const safeTotal = Math.max(0, Math.round(total));
  const safeCash = Math.max(0, Math.round(cashReceived));

  if (safeCash >= safeTotal) {
    return {
      isEnough: true,
      change: safeCash - safeTotal,
      shortfall: 0,
    };
  }

  return {
    isEnough: false,
    change: 0,
    shortfall: safeTotal - safeCash,
  };
}

export function validateCartStock(items: readonly CartCalcItem[]): string | null {
  for (const item of items) {
    if (item.qty <= 0) {
      return `Jumlah ${item.name} tidak valid.`;
    }
    if (item.qty > item.availableStock) {
      return `Stok ${item.name} tidak cukup (tersisa ${item.availableStock}, diminta ${item.qty}).`;
    }
  }
  return null;
}

export function parseSaleRpcError(rawMessage: string): string {
  if (rawMessage.includes('STOK_TIDAK_CUKUP:')) {
    const parts = rawMessage.split('STOK_TIDAK_CUKUP:')[1]?.split(':') ?? [];
    const name = parts[0] ?? 'Barang';
    const available = parts[1] ?? '0';
    const requested = parts[2] ?? '0';
    return `Stok ${name} tidak cukup (tersisa ${available}, diminta ${requested}).`;
  }
  if (rawMessage.includes('UANG_TIDAK_CUKUP')) {
    return 'Uang diterima kurang dari total belanja.';
  }
  if (rawMessage.includes('KERANJANG_KOSONG')) {
    return 'Keranjang masih kosong.';
  }
  if (rawMessage.includes('BARANG_TIDAK_DITEMUKAN')) {
    return 'Salah satu barang sudah tidak aktif atau tidak ditemukan.';
  }
  if (rawMessage.includes('TOKO_TIDAK_DITEMUKAN')) {
    return 'Data toko tidak ditemukan. Silakan masuk ulang.';
  }
  return rawMessage || 'Gagal menyimpan transaksi.';
}
