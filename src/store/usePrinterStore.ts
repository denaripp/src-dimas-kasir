import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const PRINTER_STORAGE_KEY = 'srcdimaskasir:selected_printer';

export interface SavedBluetoothPrinter {
  deviceName: string;
  macAddress: string;
}

interface PrinterStoreState {
  selectedPrinter: SavedBluetoothPrinter | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSelectedPrinter: (printer: SavedBluetoothPrinter) => Promise<void>;
  clearSelectedPrinter: () => Promise<void>;
}

export const usePrinterStore = create<PrinterStoreState>((set, get) => ({
  selectedPrinter: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(PRINTER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedBluetoothPrinter;
        if (parsed?.macAddress) {
          set({ selectedPrinter: parsed, hydrated: true });
          return;
        }
      }
    } catch {
      // Abaikan error pembacaan storage korup
    }
    set({ hydrated: true });
  },

  setSelectedPrinter: async (printer) => {
    set({ selectedPrinter: printer, hydrated: true });
    await AsyncStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(printer));
  },

  clearSelectedPrinter: async () => {
    set({ selectedPrinter: null, hydrated: true });
    await AsyncStorage.removeItem(PRINTER_STORAGE_KEY);
  },
}));
