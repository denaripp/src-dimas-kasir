import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { toUserFriendlyError } from '@/lib/errorMessage';
import { printReceiptBluetooth } from '@/lib/printer';
import type { ReceiptRenderOptions } from '@/lib/receiptFormatter';
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

  const buildRenderOptions = useCallback(
    (): ReceiptRenderOptions => ({
      paper_size: store?.paper_size ?? 58,
      printedAt: new Date(),
    }),
    [store?.paper_size],
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
          buildRenderOptions(),
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
    [selectedPrinter, buildRenderOptions, options?.successTitle],
  );

  const sharePdf = useCallback(
    async (receipt: PrintableReceipt) => {
      setIsPrinting(true);
      try {
        await shareReceiptPdf(receipt.sale, receipt.items, buildRenderOptions());
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
    [buildRenderOptions],
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
