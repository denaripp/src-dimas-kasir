import { z } from 'zod';

const nonNegativeIntString = (label: string, required: boolean) =>
  z
    .string()
    .transform((v) => v.trim())
    .refine((v) => (required ? v.length > 0 : true), {
      message: `${label} wajib diisi`,
    })
    .refine((v) => v === '' || /^\d+$/.test(v), {
      message: `${label} harus bilangan bulat >= 0`,
    });

export const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Nama barang wajib diisi'),
  barcode: z.string().trim(),
  category: z.string().trim(),
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
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
}
