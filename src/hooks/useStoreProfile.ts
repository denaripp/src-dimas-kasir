import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toUserFriendlyError } from '@/lib/errorMessage';
import {
  deleteStorageImageByUrl,
  uploadCompressedStorageImage,
} from '@/lib/imageUpload';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import { useCartStore } from '@/store/useCartStore';
import { usePrinterStore } from '@/store/usePrinterStore';
import type { PaperSize, StoreRow } from '@/types/database';

export interface UpdateStoreProfileInput {
  storeId: string;
  name: string;
  address: string;
  phone: string;
  receiptFooter: string;
  paperSize: PaperSize;
  logoUrl?: string | null;
  previousLogoUrl?: string | null;
}

export function useUpdateStoreProfileMutation() {
  const setActiveStore = useAppStore((s) => s.setActiveStore);

  return useMutation({
    mutationFn: async (input: UpdateStoreProfileInput): Promise<StoreRow> => {
      const cleanName = input.name.trim();
      if (!cleanName) {
        throw new Error('Nama toko wajib diisi.');
      }

      const payload: Record<string, unknown> = {
        name: cleanName,
        address: input.address.trim(),
        phone: input.phone.trim(),
        receipt_footer: input.receiptFooter.trim(),
        paper_size: input.paperSize,
      };

      if (input.logoUrl !== undefined) {
        payload.logo_url = input.logoUrl;
      }

      const { data, error } = await supabase
        .from('stores')
        .update(payload)
        .eq('id', input.storeId)
        .select('*')
        .single();

      if (error) {
        throw new Error(toUserFriendlyError(error, 'Gagal memperbarui profil toko.'));
      }

      if (
        input.previousLogoUrl &&
        input.logoUrl !== undefined &&
        input.previousLogoUrl !== input.logoUrl
      ) {
        void deleteStorageImageByUrl('store-logos', input.previousLogoUrl);
      }

      return data as StoreRow;
    },
    onSuccess: (updated) => {
      setActiveStore(updated);
    },
  });
}

export function useUploadStoreLogoMutation() {
  return useMutation({
    mutationFn: async ({
      userId,
      localUri,
    }: {
      userId: string;
      localUri: string;
      mimeType?: string;
    }): Promise<string> => {
      return uploadCompressedStorageImage({
        bucket: 'store-logos',
        userId,
        prefix: 'logo',
        localUri,
      });
    },
  });
}

export function useDeleteAccountMutation() {
  const queryClient = useQueryClient();
  const clearActiveStore = useAppStore((s) => s.clearActiveStore);
  const clearCart = useCartStore((s) => s.clearCart);
  const clearSelectedPrinter = usePrinterStore((s) => s.clearSelectedPrinter);

  return useMutation({
    mutationFn: async (confirmStoreName: string): Promise<void> => {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: { confirmStoreName: confirmStoreName.trim() },
      });

      if (error) {
        throw new Error(toUserFriendlyError(error, 'Gagal menghapus akun.'));
      }

      const parsed = data as { success?: boolean; error?: string } | null;
      if (parsed?.error) {
        throw new Error(parsed.error);
      }

      await supabase.auth.signOut();
      clearActiveStore();
      clearCart();
      await clearSelectedPrinter();
      queryClient.clear();
    },
  });
}
