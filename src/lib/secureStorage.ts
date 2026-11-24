import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800;

function sanitizeSecureKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getCountKey(baseKey: string): string {
  return `${baseKey}.__chunks`;
}

function getChunkKey(baseKey: string, index: number): string {
  return `${baseKey}.__c${index}`;
}

async function readChunkedValue(baseKey: string): Promise<string | null> {
  const countRaw = await SecureStore.getItemAsync(getCountKey(baseKey));
  if (!countRaw) {
    return null;
  }

  const count = Number.parseInt(countRaw, 10);
  if (!Number.isInteger(count) || count <= 0) {
    return null;
  }

  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const part = await SecureStore.getItemAsync(getChunkKey(baseKey, i));
    if (part === null) {
      return null;
    }
    parts.push(part);
  }
  return parts.join('');
}

async function writeChunkedValue(baseKey: string, value: string): Promise<void> {
  const prevCountRaw = await SecureStore.getItemAsync(getCountKey(baseKey));
  const prevCount = prevCountRaw ? Number.parseInt(prevCountRaw, 10) : 0;

  const totalChunks = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
  for (let i = 0; i < totalChunks; i += 1) {
    const slice = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await SecureStore.setItemAsync(getChunkKey(baseKey, i), slice);
  }
  await SecureStore.setItemAsync(getCountKey(baseKey), String(totalChunks));

  // Bersihkan sisa chunk lama jika payload mengecil
  if (Number.isInteger(prevCount) && prevCount > totalChunks) {
    for (let i = totalChunks; i < prevCount; i += 1) {
      await SecureStore.deleteItemAsync(getChunkKey(baseKey, i));
    }
  }
}

async function deleteChunkedValue(baseKey: string): Promise<void> {
  const countRaw = await SecureStore.getItemAsync(getCountKey(baseKey));
  const count = countRaw ? Number.parseInt(countRaw, 10) : 0;

  if (Number.isInteger(count) && count > 0) {
    for (let i = 0; i < count; i += 1) {
      await SecureStore.deleteItemAsync(getChunkKey(baseKey, i));
    }
  }
  await SecureStore.deleteItemAsync(getCountKey(baseKey));
}

/**
 * Adapter storage sesi Supabase terenkripsi menggunakan Android Keystore (expo-secure-store)
 * dengan chunking otomatis (mengatasi batas 2048 byte SecureStore) serta migrasi
 * transparan 1-kali dari AsyncStorage plaintext versi v0.2.0.
 */
export const secureAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    const baseKey = sanitizeSecureKey(key);
    try {
      const existing = await readChunkedValue(baseKey);
      if (existing !== null) {
        return existing;
      }

      // Migrasi 1-kali dari AsyncStorage (upgrade v0.2.0 -> v0.3.0 tanpa logout paksa)
      const legacy = await AsyncStorage.getItem(key);
      if (legacy !== null) {
        await writeChunkedValue(baseKey, legacy);
        await AsyncStorage.removeItem(key);
        return legacy;
      }
      return null;
    } catch (err) {
      console.warn('[secureAuthStorage] getItem gagal:', err);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const baseKey = sanitizeSecureKey(key);
    await writeChunkedValue(baseKey, value);
    // Pastikan tidak ada salinan plaintext lama tertinggal di AsyncStorage
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },

  async removeItem(key: string): Promise<void> {
    const baseKey = sanitizeSecureKey(key);
    await deleteChunkedValue(baseKey).catch(() => undefined);
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
};
