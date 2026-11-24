import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { useQueryClient } from '@tanstack/react-query';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { isExpectedAuthCallback, parseAuthTokensFromUrl } from '@/lib/authUrl';
import { toUserFriendlyError } from '@/lib/errorMessage';
import { registerSupabaseAppStateRefresh, supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import { useCartStore } from '@/store/useCartStore';
import type { StoreRow } from '@/types/database';

WebBrowser.maybeCompleteAuthSession();

const CACHED_STORE_KEY = '@srcdimaskasir/active_store_cache_v1';
const GOOGLE_WEB_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();

let googleSignInConfigured = false;

function ensureGoogleSignInConfigured(): boolean {
  if (!GOOGLE_WEB_CLIENT_ID) {
    return false;
  }
  if (!googleSignInConfigured) {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: false,
    });
    googleSignInConfigured = true;
  }
  return true;
}

function isSameStoreRow(a: StoreRow | null, b: StoreRow | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.owner_id === b.owner_id &&
    a.updated_at === b.updated_at &&
    a.name === b.name &&
    a.address === b.address &&
    a.phone === b.phone &&
    a.logo_url === b.logo_url &&
    a.receipt_footer === b.receipt_footer &&
    a.paper_size === b.paper_size
  );
}

async function readCachedStore(userId: string): Promise<StoreRow | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHED_STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoreRow;
    if (parsed && parsed.owner_id === userId && typeof parsed.id === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeCachedStore(store: StoreRow | null): Promise<void> {
  try {
    if (!store) {
      await AsyncStorage.removeItem(CACHED_STORE_KEY);
      return;
    }
    await AsyncStorage.setItem(CACHED_STORE_KEY, JSON.stringify(store));
  } catch {
    // Gagal tulis cache lokal tidak memblokir alur utama
  }
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  store: StoreRow | null;
  isLoading: boolean;
  isSigningIn: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshStore: () => Promise<StoreRow | null>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchOrInitializeStore(userId: string): Promise<StoreRow | null> {
  const { data: existing, error: fetchError } = await supabase
    .from('stores')
    .select('*')
    .eq('owner_id', userId)
    .maybeSingle();

  if (existing && !fetchError) {
    return existing as StoreRow;
  }

  const { data: initialized, error: initError } = await supabase.rpc(
    'ensure_store_initialized',
  );

  if (initError) {
    throw initError;
  }

  return (initialized as StoreRow | null) ?? null;
}

async function signInWithBrowserPkce(): Promise<void> {
  const redirectTo = makeRedirectUri({
    scheme: 'srcdimaskasir',
    path: 'auth/callback',
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });

  if (error || !data?.url) {
    throw new Error(error?.message ?? 'Gagal memulai login Google.');
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return;
  }

  if (result.type !== 'success' || !result.url) {
    throw new Error('Autentikasi Google tidak selesai. Silakan coba lagi.');
  }

  if (!isExpectedAuthCallback(result.url, redirectTo)) {
    throw new Error('URL callback autentikasi tidak valid.');
  }

  const parsed = parseAuthTokensFromUrl(result.url);
  if (parsed.error) {
    throw new Error(parsed.errorDescription ?? parsed.error);
  }

  if (!parsed.code) {
    throw new Error('Kode otorisasi PKCE tidak ditemukan pada callback.');
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(parsed.code);
  if (exchangeError) {
    throw new Error(exchangeError.message);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const activeStore = useAppStore((s) => s.activeStore);
  const setActiveStore = useAppStore((s) => s.setActiveStore);
  const clearActiveStore = useAppStore((s) => s.clearActiveStore);

  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const lastUserIdRef = useRef<string | null>(null);
  const inFlightStoreSyncRef = useRef<Promise<StoreRow | null> | null>(null);

  const applyStoreIfChanged = useCallback(
    (nextStore: StoreRow | null) => {
      const current = useAppStore.getState().activeStore;
      if (!isSameStoreRow(current, nextStore)) {
        setActiveStore(nextStore);
      }
      void writeCachedStore(nextStore);
    },
    [setActiveStore],
  );

  const syncStoreForSession = useCallback(
    async (nextSession: Session | null): Promise<StoreRow | null> => {
      if (!nextSession?.user) {
        clearActiveStore();
        void writeCachedStore(null);
        return null;
      }

      if (inFlightStoreSyncRef.current) {
        return inFlightStoreSyncRef.current;
      }

      const task = (async () => {
        try {
          const storeRow = await fetchOrInitializeStore(nextSession.user.id);
          applyStoreIfChanged(storeRow);
          return storeRow;
        } catch (err) {
          setAuthError(toUserFriendlyError(err, 'Gagal memuat data toko.'));
          return null;
        } finally {
          inFlightStoreSyncRef.current = null;
        }
      })();

      inFlightStoreSyncRef.current = task;
      return task;
    },
    [applyStoreIfChanged, clearActiveStore],
  );

  useEffect(() => {
    registerSupabaseAppStateRefresh();

    let mounted = true;
    let initialResolved = false;

    const finishLoading = () => {
      if (mounted && !initialResolved) {
        initialResolved = true;
        setIsLoading(false);
      }
    };

    const handleSessionChange = async (
      event: string,
      nextSession: Session | null,
    ) => {
      if (!mounted) return;

      const nextUserId = nextSession?.user?.id ?? null;
      const prevUserId = lastUserIdRef.current;

      // Bersihkan keranjang & cache jika user logout atau berganti akun (F-09)
      if (prevUserId && prevUserId !== nextUserId) {
        useCartStore.getState().clearCart();
        clearActiveStore();
        void writeCachedStore(null);
        queryClient.clear();
      }
      lastUserIdRef.current = nextUserId;

      setSession(nextSession);

      // TOKEN_REFRESHED tidak perlu menembak ulang query tabel stores
      if (event === 'TOKEN_REFRESHED') {
        finishLoading();
        return;
      }

      if (!nextSession?.user) {
        useCartStore.getState().clearCart();
        clearActiveStore();
        void writeCachedStore(null);
        finishLoading();
        return;
      }

      // Cold start cepat: hydrate cached store instan (stale-while-revalidate)
      if (event === 'INITIAL_SESSION') {
        const cached = await readCachedStore(nextSession.user.id);
        if (!mounted) return;
        if (cached) {
          applyStoreIfChanged(cached);
          finishLoading();
          void syncStoreForSession(nextSession);
          return;
        }
      }

      await syncStoreForSession(nextSession);
      finishLoading();
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      void handleSessionChange(event, nextSession);
    });

    // Fallback pengaman jika INITIAL_SESSION tertunda
    const safetyTimer = setTimeout(() => {
      if (!initialResolved && mounted) {
        void supabase.auth.getSession().then(({ data: { session: fallbackSession } }) => {
          if (!initialResolved && mounted) {
            void handleSessionChange('INITIAL_SESSION', fallbackSession);
          }
        });
      }
    }, 1200);

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [applyStoreIfChanged, clearActiveStore, queryClient, syncStoreForSession]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setIsSigningIn(true);

    try {
      const canUseNative = ensureGoogleSignInConfigured();

      if (canUseNative) {
        try {
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          // Bersihkan akun terakhir pada SDK native agar pemilih akun Google selalu muncul
          await GoogleSignin.signOut().catch(() => undefined);

          const response = await GoogleSignin.signIn();
          if (isCancelledResponse(response)) {
            return;
          }

          if (!isSuccessResponse(response) || !response.data.idToken) {
            throw new Error('Token identitas Google tidak diterima. Silakan coba lagi.');
          }

          const { error: idTokenError } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: response.data.idToken,
          });

          if (idTokenError) {
            throw new Error(idTokenError.message);
          }
          return;
        } catch (nativeErr) {
          if (isErrorWithCode(nativeErr)) {
            if (
              nativeErr.code === statusCodes.SIGN_IN_CANCELLED ||
              nativeErr.code === statusCodes.IN_PROGRESS
            ) {
              return;
            }
            if (nativeErr.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
              await signInWithBrowserPkce();
              return;
            }
            if (nativeErr.code === '10' || nativeErr.code === 'DEVELOPER_ERROR') {
              throw new Error(
                'Konfigurasi Google Sign-In Android (SHA-1 / Android Client ID) belum terdaftar di Google Cloud Console.',
              );
            }
          }
          throw nativeErr;
        }
      }

      // Fallback aman berbasis PKCE saja (tanpa implicit token) jika webClientId belum diatur
      await signInWithBrowserPkce();
    } catch (err) {
      setAuthError(
        toUserFriendlyError(
          err,
          'Gagal masuk dengan Google. Periksa koneksi internet Anda.',
        ),
      );
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    useCartStore.getState().clearCart();
    clearActiveStore();
    await writeCachedStore(null);
    await GoogleSignin.signOut().catch(() => undefined);
    await supabase.auth.signOut();
    queryClient.clear();
  }, [clearActiveStore, queryClient]);

  const refreshStore = useCallback(async () => {
    return syncStoreForSession(session);
  }, [session, syncStoreForSession]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      store: activeStore,
      isLoading,
      isSigningIn,
      authError,
      signInWithGoogle,
      signOut,
      refreshStore,
      clearAuthError,
    }),
    [
      session,
      activeStore,
      isLoading,
      isSigningIn,
      authError,
      signInWithGoogle,
      signOut,
      refreshStore,
      clearAuthError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  }
  return ctx;
}
