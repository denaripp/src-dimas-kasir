import { PermissionsAndroid, Platform } from 'react-native';
import {
  buildEscPosReceiptText,
  buildTestReceiptText,
  type ReceiptStoreInfo,
} from '@/lib/receiptFormatter';
import type { SaleItemRow, SaleRow } from '@/types/database';

export interface BluetoothPrinterDevice {
  deviceName: string;
  macAddress: string;
}

interface NativeBlePrinter {
  init: () => Promise<void>;
  getDeviceList: () => Promise<{ device_name: string; inner_mac_address: string }[]>;
  connectPrinter: (inner_mac_address: string) => Promise<unknown>;
  closeConn: () => Promise<void>;
  printBill: (text: string, opts?: { beep?: boolean; cut?: boolean; tailingLine?: boolean }) => void;
  printImage?: (
    imgUrl: string,
    opts?: { imageWidth?: number; imageHeight?: number; printerWidthType?: number },
  ) => void;
}

function getBlePrinterModule(): NativeBlePrinter {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-thermal-receipt-printer-image-qr') as {
      BLEPrinter?: NativeBlePrinter;
    };
    if (!mod?.BLEPrinter) {
      throw new Error('Modul BLEPrinter tidak tersedia.');
    }
    return mod.BLEPrinter;
  } catch {
    throw new Error(
      'Modul printer Bluetooth memerlukan Expo Development Build (tidak tersedia di Expo Go).',
    );
  }
}

export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 31;

  if (apiLevel >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return (
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
        PermissionsAndroid.RESULTS.GRANTED &&
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
        PermissionsAndroid.RESULTS.GRANTED
    );
  }

  const locationStatus = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return locationStatus === PermissionsAndroid.RESULTS.GRANTED;
}

export async function scanBluetoothPrinters(): Promise<BluetoothPrinterDevice[]> {
  const granted = await requestBluetoothPermissions();
  if (!granted) {
    throw new Error('Izin Bluetooth ditolak. Aktifkan izin Bluetooth di pengaturan HP.');
  }

  const BLEPrinter = getBlePrinterModule();
  await BLEPrinter.init();
  const list = await BLEPrinter.getDeviceList();

  return (list ?? [])
    .filter((d) => Boolean(d?.inner_mac_address))
    .map((d) => ({
      deviceName: d.device_name?.trim() || 'Printer Bluetooth',
      macAddress: d.inner_mac_address,
    }));
}

export async function connectPrinter(macAddress: string): Promise<void> {
  const granted = await requestBluetoothPermissions();
  if (!granted) {
    throw new Error('Izin Bluetooth belum diaktifkan.');
  }

  const BLEPrinter = getBlePrinterModule();
  await BLEPrinter.init();
  await BLEPrinter.connectPrinter(macAddress);
}

export async function printReceiptBluetooth(
  sale: SaleRow,
  items: SaleItemRow[],
  store: ReceiptStoreInfo,
  macAddress: string,
): Promise<void> {
  if (!macAddress) {
    throw new Error('Printer Bluetooth belum dipilih.');
  }

  await connectPrinter(macAddress);
  const BLEPrinter = getBlePrinterModule();

  if (store.logo_url && BLEPrinter.printImage) {
    try {
      BLEPrinter.printImage(store.logo_url, {
        imageWidth: 160,
        imageHeight: 160,
        printerWidthType: store.paper_size,
      });
    } catch {
      // Gagal cetak logo tidak menghentikan cetak teks struk
    }
  }

  const payload = buildEscPosReceiptText(sale, items, store);
  BLEPrinter.printBill(payload, { beep: true, cut: true, tailingLine: true });
}

export async function printTestReceiptBluetooth(
  store: Pick<ReceiptStoreInfo, 'name' | 'paper_size'>,
  macAddress: string,
): Promise<void> {
  if (!macAddress) {
    throw new Error('Pilih printer Bluetooth terlebih dahulu.');
  }

  await connectPrinter(macAddress);
  const BLEPrinter = getBlePrinterModule();
  const payload = buildTestReceiptText(store);
  BLEPrinter.printBill(payload, { beep: true, cut: true, tailingLine: true });
}
