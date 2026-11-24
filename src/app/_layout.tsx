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
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppErrorBoundary } from '@/components/common/AppErrorBoundary';
import { AuthProvider, useAuth } from '@/hooks/useAuth';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

function RootNavigator() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      // Beri jeda singkat 260ms agar animasi keluar logo Login terlihat mulus sebelum fade ke Beranda
      const timer = setTimeout(() => {
        router.replace('/(tabs)');
      }, 260);
      return () => clearTimeout(timer);
    }
  }, [session, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#D91E2A" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FFFFFF' },
        animation: 'fade_from_bottom',
        animationDuration: 260,
      }}
    >
      <Stack.Screen
        name="(auth)"
        options={{ animation: 'none' }}
      />
      <Stack.Screen
        name="(tabs)"
        options={{ animation: 'fade', animationDuration: 320 }}
      />
      <Stack.Screen name="barang/[id]" />
      <Stack.Screen name="barang/csv" />
      <Stack.Screen name="stok/[productId]" />
      <Stack.Screen name="riwayat/[id]" />
      <Stack.Screen name="keuangan/index" />
      <Stack.Screen name="profil/index" />
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
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

  if (!fontsLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#D91E2A" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" backgroundColor="#FFFFFF" />
          <AppErrorBoundary>
            <RootNavigator />
          </AppErrorBoundary>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
