import { Tabs } from 'expo-router';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { useAuth } from '@/hooks/useAuth';
import { useSalesRealtime } from '@/hooks/useSales';

export default function TabsLayout() {
  const { store } = useAuth();
  useSalesRealtime(store?.id);

  return (
    <Tabs
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Beranda' }} />
      <Tabs.Screen name="barang" options={{ title: 'Barang' }} />
      <Tabs.Screen name="kasir" options={{ title: 'Kasir' }} />
      <Tabs.Screen name="riwayat" options={{ title: 'Riwayat' }} />
      <Tabs.Screen name="laporan" options={{ title: 'Laporan' }} />
    </Tabs>
  );
}
