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
  useState,
  type ReactNode,
} from 'react';
import { parseAuthTokensFromUrl } from '@/lib/authUrl';
import { registerSupabaseAppStateRefresh, supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import type { StoreRow } from '@/types/database';

WebBrowser.maybeCompleteAuthSession();

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const activeStore = useAppStore((s) => s.activeStore);
  const setActiveStore = useAppStore((s) => s.setActiveStore);
  const clearActiveStore = useAppStore((s) => s.clearActiveStore);

  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const syncStoreForSession = useCallback(
    async (nextSession: Session | null): Promise<StoreRow | null> => {
      if (!nextSession?.user) {
        clearActiveStore();
        return null;
      }

      try {
        const storeRow = await fetchOrInitializeStore(nextSession.user.id);
        setActiveStore(storeRow);
        return storeRow;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Gagal memuat data toko.';
        setAuthError(message);
        return null;
      }
    },
    [clearActiveStore, setActiveStore],
  );

  useEffect(() => {
    registerSupabaseAppStateRefresh();

    let mounted = true;

    const bootstrap = async () => {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;
        setSession(initialSession);
        await syncStoreForSession(initialSession);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      void syncStoreForSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [syncStoreForSession]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setIsSigningIn(true);

    try {
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

      const parsed = parseAuthTokensFromUrl(result.url);
      if (parsed.error) {
        throw new Error(parsed.errorDescription ?? parsed.error);
      }

      if (parsed.code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
          parsed.code,
        );
        if (exchangeError) {
          throw new Error(exchangeError.message);
        }
        return;
      }

      if (parsed.accessToken && parsed.refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: parsed.accessToken,
          refresh_token: parsed.refreshToken,
        });
        if (sessionError) {
          throw new Error(sessionError.message);
        }
        return;
      }

      throw new Error('Token sesi Google tidak ditemukan pada callback.');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Gagal masuk dengan Google. Periksa koneksi internet Anda.';
      setAuthError(message);
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    await supabase.auth.signOut();
    clearActiveStore();
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
