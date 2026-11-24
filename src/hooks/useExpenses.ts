import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toUserFriendlyError } from '@/lib/errorMessage';
import { supabase } from '@/lib/supabase';
import type { ExpenseCategoryRow, ExpenseRow } from '@/types/database';

export const EXPENSE_KEYS = {
  all: ['expenses'] as const,
  categories: (storeId: string | undefined) =>
    ['expense_categories', storeId] as const,
  list: (storeId: string | undefined, startDate?: string, endDate?: string) =>
    ['expenses', 'list', storeId, startDate ?? 'all', endDate ?? 'all'] as const,
};

export function useExpenseCategoriesQuery(storeId: string | undefined) {
  return useQuery({
    queryKey: EXPENSE_KEYS.categories(storeId),
    enabled: Boolean(storeId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ExpenseCategoryRow[]> => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('store_id', storeId!)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });

      if (error) {
        throw new Error(toUserFriendlyError(error, 'Gagal memuat kategori pengeluaran.'));
      }
      return (data ?? []) as ExpenseCategoryRow[];
    },
  });
}

export function useCreateExpenseCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      storeId,
      name,
    }: {
      storeId: string;
      name: string;
    }): Promise<ExpenseCategoryRow> => {
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error('Nama kategori wajib diisi.');
      }

      const { data, error } = await supabase
        .from('expense_categories')
        .insert({
          store_id: storeId,
          name: trimmed,
          is_default: false,
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Kategori dengan nama tersebut sudah ada.');
        }
        throw new Error(toUserFriendlyError(error, 'Gagal menambah kategori.'));
      }

      return data as ExpenseCategoryRow;
    },
    onSuccess: (row) => {
      void queryClient.invalidateQueries({
        queryKey: EXPENSE_KEYS.categories(row.store_id),
      });
    },
  });
}

export function useDeleteExpenseCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      categoryId,
      storeId,
    }: {
      categoryId: string;
      storeId: string;
    }) => {
      const { error } = await supabase
        .from('expense_categories')
        .delete()
        .eq('id', categoryId)
        .eq('store_id', storeId)
        .eq('is_default', false);

      if (error) {
        throw new Error(toUserFriendlyError(error, 'Gagal menghapus kategori.'));
      }
      return storeId;
    },
    onSuccess: (storeId) => {
      void queryClient.invalidateQueries({
        queryKey: EXPENSE_KEYS.categories(storeId),
      });
    },
  });
}

export function useExpensesQuery(
  storeId: string | undefined,
  startDate?: string,
  endDate?: string,
) {
  return useQuery({
    queryKey: EXPENSE_KEYS.list(storeId, startDate, endDate),
    enabled: Boolean(storeId),
    queryFn: async (): Promise<ExpenseRow[]> => {
      let query = supabase
        .from('expenses')
        .select('*')
        .eq('store_id', storeId!)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200);

      if (startDate) {
        query = query.gte('expense_date', startDate);
      }
      if (endDate) {
        query = query.lte('expense_date', endDate);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(toUserFriendlyError(error, 'Gagal memuat daftar pengeluaran.'));
      }
      return (data ?? []) as ExpenseRow[];
    },
  });
}

export interface CreateExpenseInput {
  storeId: string;
  categoryId: string | null;
  categoryName: string;
  amount: number;
  note: string;
  expenseDate: string; // YYYY-MM-DD
}

export function useCreateExpenseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateExpenseInput): Promise<ExpenseRow> => {
      if (!Number.isInteger(input.amount) || input.amount <= 0) {
        throw new Error('Nominal pengeluaran harus bilangan bulat lebih dari 0.');
      }

      const { data, error } = await supabase
        .from('expenses')
        .insert({
          store_id: input.storeId,
          category_id: input.categoryId,
          category_name_snapshot: input.categoryName.trim(),
          amount: input.amount,
          note: input.note.trim(),
          expense_date: input.expenseDate,
        })
        .select('*')
        .single();

      if (error) {
        throw new Error(toUserFriendlyError(error, 'Gagal menyimpan pengeluaran.'));
      }
      return data as ExpenseRow;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useDeleteExpenseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
      if (error) {
        throw new Error(toUserFriendlyError(error, 'Gagal menghapus pengeluaran.'));
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
