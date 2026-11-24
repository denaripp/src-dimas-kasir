export type PaperSize = 58 | 80;
export type SaleStatus = 'completed' | 'void';
export type StockMovementType = 'stok_masuk' | 'penyesuaian' | 'penjualan' | 'void';

export interface StoreRow {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  phone: string;
  logo_url: string | null;
  receipt_footer: string;
  paper_size: PaperSize;
  created_at: string;
  updated_at: string;
}

export interface ProductRow {
  id: string;
  store_id: string;
  name: string;
  barcode: string | null;
  category: string;
  image_url: string | null;
  sell_price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SaleRow {
  id: string;
  store_id: string;
  receipt_number: string;
  total_amount: number;
  cash_received: number;
  change_amount: number;
  status: SaleStatus;
  void_reason: string | null;
  voided_at: string | null;
  created_at: string;
}

export interface SaleItemRow {
  id: string;
  sale_id: string;
  product_id: string;
  product_name_snapshot: string;
  qty: number;
  sell_price_snapshot: number;
  cost_price_snapshot: number;
  subtotal: number;
}

export interface StockMovementRow {
  id: string;
  store_id: string;
  product_id: string;
  type: StockMovementType;
  qty_delta: number;
  stock_after: number;
  note: string;
  reference_id: string | null;
  created_at: string;
}

export interface ExpenseCategoryRow {
  id: string;
  store_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface ExpenseRow {
  id: string;
  store_id: string;
  category_id: string | null;
  category_name_snapshot: string;
  amount: number;
  note: string;
  expense_date: string;
  created_at: string;
}

export interface CreateSaleItemInput {
  product_id: string;
  qty: number;
}

export interface CreateSaleAtomicResult {
  sale: SaleRow;
  items: SaleItemRow[];
}

export interface DeleteProductSmartResult {
  mode: 'soft_deleted' | 'hard_deleted';
  product_id: string;
}

export interface CsvImportProductRow {
  name: string;
  barcode?: string | null;
  category?: string;
  sell_price: number;
  cost_price?: number;
  stock?: number;
  min_stock?: number;
}

export interface ImportProductsCsvResult {
  inserted: number;
  updated: number;
  stock_adjusted: number;
}
