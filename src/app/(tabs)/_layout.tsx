import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { useAuth } from '@/hooks/useAuth';
import { useSalesRealtime } from '@/hooks/useSales';

function renderTabBar(props: BottomTabBarProps) {
  return <BottomTabBar {...props} />;
}

const TAB_SCREEN_OPTIONS = {
  headerShown: false,
  freezeOnBlur: true,
  sceneStyle: { backgroundColor: '#FFFFFF' },
} as const;

export default function TabsLayout() {
  const { session, isLoading, store } = useAuth();
  useSalesRealtime(session ? store?.id : undefined);

  if (isLoading) {
    return <View className="flex-1 bg-white" />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs tabBar={renderTabBar} screenOptions={TAB_SCREEN_OPTIONS}>
      <Tabs.Screen name="index" options={{ title: 'Beranda' }} />
      <Tabs.Screen name="barang" options={{ title: 'Barang' }} />
      <Tabs.Screen name="kasir" options={{ title: 'Kasir' }} />
      <Tabs.Screen name="riwayat" options={{ title: 'Riwayat' }} />
      <Tabs.Screen name="laporan" options={{ title: 'Laporan' }} />
    </Tabs>
  );
}
