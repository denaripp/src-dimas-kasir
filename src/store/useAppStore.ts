import { create } from 'zustand';
import type { StoreRow } from '@/types/database';

interface AppStoreState {
  activeStore: StoreRow | null;
  setActiveStore: (store: StoreRow | null) => void;
  clearActiveStore: () => void;
}

export const useAppStore = create<AppStoreState>((set) => ({
  activeStore: null,
  setActiveStore: (store) => set({ activeStore: store }),
  clearActiveStore: () => set({ activeStore: null }),
}));
