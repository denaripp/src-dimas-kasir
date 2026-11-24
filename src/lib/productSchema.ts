import { z } from 'zod';

const PG_INT4_MAX = 2_147_483_647;

const nonNegativeIntString = (label: string, required: boolean) =>
  z
    .string()
    .transform((v) => v.trim())
    .refine((v) => (required ? v.length > 0 : true), {
      message: `${label} wajib diisi`,
    })
    .refine((v) => v === '' || /^\d+$/.test(v), {
      message: `${label} harus bilangan bulat >= 0`,
    })
    .refine((v) => v === '' || Number.parseInt(v, 10) <= PG_INT4_MAX, {
      message: `${label} melebihi batas maksimal`,
    });

export const productFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama barang wajib diisi')
    .max(120, 'Nama barang maksimal 120 karakter'),
  barcode: z.string().trim().max(64, 'Barcode maksimal 64 karakter'),
  category: z.string().trim().max(60, 'Kategori maksimal 60 karakter'),
  sell_price: nonNegativeIntString('Harga jual', true),
  cost_price: nonNegativeIntString('Harga modal', false),
  stock: nonNegativeIntString('Stok', false),
  min_stock: nonNegativeIntString('Stok minimum', false),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export function parseIntOrZero(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return Math.min(parsed, PG_INT4_MAX);
}
