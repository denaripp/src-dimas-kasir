import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { toUserFriendlyError } from '@/lib/errorMessage';
import { printReceiptBluetooth } from '@/lib/printer';
import type { ReceiptStoreInfo } from '@/lib/receiptFormatter';
import { shareReceiptPdf } from '@/lib/receiptPdf';
import { usePrinterStore } from '@/store/usePrinterStore';
import type { SaleItemRow, SaleRow } from '@/types/database';

export interface PrintableReceipt {
  sale: SaleRow;
  items: SaleItemRow[];
}

export function useReceiptPrinter(options?: { successTitle?: string }) {
  const { store } = useAuth();
  const selectedPrinter = usePrinterStore((s) => s.selectedPrinter);

  const [isPrinting, setIsPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printerPickerOpen, setPrinterPickerOpen] = useState(false);

  const buildStoreInfo = useCallback(
    (): ReceiptStoreInfo => ({
      name: store?.name ?? 'Toko Saya',
      address: store?.address ?? '',
      phone: store?.phone ?? '',
      logo_url: store?.logo_url ?? null,
      receipt_footer: store?.receipt_footer ?? 'Terima kasih telah berbelanja!',
      paper_size: store?.paper_size ?? (58 as const),
    }),
    [store],
  );

  const printBluetooth = useCallback(
    async (receipt: PrintableReceipt, macOverride?: string) => {
      const mac = macOverride ?? selectedPrinter?.macAddress;
      if (!mac) {
        setPrintError('Printer Bluetooth belum dipilih atau belum terhubung.');
        return;
      }

      setIsPrinting(true);
      setPrintError(null);
      try {
        await printReceiptBluetooth(
          receipt.sale,
          receipt.items,
          buildStoreInfo(),
          mac,
        );
        Alert.alert(
          options?.successTitle ?? 'Struk Dicetak',
          `Struk ${receipt.sale.receipt_number} dikirim ke printer.`,
        );
      } catch (err) {
        setPrintError(
          toUserFriendlyError(
            err,
            'Printer Bluetooth tidak merespons atau terputus.',
          ),
        );
      } finally {
        setIsPrinting(false);
      }
    },
    [selectedPrinter, buildStoreInfo, options?.successTitle],
  );

  const sharePdf = useCallback(
    async (receipt: PrintableReceipt) => {
      setIsPrinting(true);
      try {
        await shareReceiptPdf(receipt.sale, receipt.items, buildStoreInfo());
        setPrintError(null);
      } catch (err) {
        Alert.alert(
          'Gagal Bagikan PDF',
          toUserFriendlyError(err, 'Tidak dapat membuat file PDF struk.'),
        );
      } finally {
        setIsPrinting(false);
      }
    },
    [buildStoreInfo],
  );

  const clearPrintError = useCallback(() => setPrintError(null), []);
  const openPrinterPicker = useCallback(() => {
    setPrintError(null);
    setPrinterPickerOpen(true);
  }, []);
  const closePrinterPicker = useCallback(() => setPrinterPickerOpen(false), []);

  return {
    isPrinting,
    printError,
    printerPickerOpen,
    printBluetooth,
    sharePdf,
    clearPrintError,
    openPrinterPicker,
    closePrinterPicker,
  };
}
