import '../../global.css';

import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppErrorBoundary } from '@/components/common/AppErrorBoundary';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { usePrinterStore } from '@/store/usePrinterStore';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

const STACK_SCREEN_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: '#FFFFFF' },
  animation: 'fade',
  animationDuration: 180,
} as const;

const AUTH_SCREEN_OPTIONS = { animation: 'none' } as const;
const TABS_SCREEN_OPTIONS = { animation: 'fade', animationDuration: 220 } as const;

function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const isAppReady = fontsLoaded && !isLoading;

  useEffect(() => {
    if (isAppReady) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [isAppReady]);

  useEffect(() => {
    if (!isAppReady) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      // Beri jeda singkat 240ms agar animasi keluar logo Login mulus sebelum fade ke Beranda
      const timer = setTimeout(() => {
        router.replace('/(tabs)');
      }, 240);
      return () => clearTimeout(timer);
    }
  }, [session, isAppReady, segments, router]);

  if (!isAppReady) {
    return <View className="flex-1 bg-white" />;
  }

  return (
    <Stack screenOptions={STACK_SCREEN_OPTIONS}>
      <Stack.Screen name="(auth)" options={AUTH_SCREEN_OPTIONS} />
      <Stack.Screen name="(tabs)" options={TABS_SCREEN_OPTIONS} />
      <Stack.Screen name="barang/[id]" />
      <Stack.Screen name="barang/csv" />
      <Stack.Screen name="stok/[productId]" />
      <Stack.Screen name="riwayat/[id]" />
      <Stack.Screen name="keuangan/index" />
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 15 * 60_000,
            retry: 1,
          },
        },
      }),
  );

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    void usePrinterStore.getState().hydrate();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" backgroundColor="#FFFFFF" />
          <AppErrorBoundary>
            <RootNavigator fontsLoaded={fontsLoaded} />
          </AppErrorBoundary>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
