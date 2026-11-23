import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TabMeta {
  label: string;
  icon: string;
  isCenterCta?: boolean;
}

const TAB_CONFIG: Record<string, TabMeta> = {
  index: { label: 'Beranda', icon: 'house' },
  barang: { label: 'Barang', icon: 'cube' },
  kasir: { label: 'Kasir', icon: 'barcode', isCenterCta: true },
  riwayat: { label: 'Riwayat', icon: 'receipt' },
  laporan: { label: 'Laporan', icon: 'chart-column' },
};

export function BottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row items-center border-t-[1.5px] border-black bg-white px-2 pt-1.5"
      style={{ paddingBottom: Math.max(insets.bottom, 10), minHeight: 74 }}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const meta = TAB_CONFIG[route.name] ?? {
          label: descriptors[route.key]?.options.title ?? route.name,
          icon: 'circle',
        };

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        if (meta.isCenterCta) {
          return (
            <View key={route.key} className="flex-1 items-center justify-center">
              <Pressable
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel="Buka Kasir dan Scan Barcode"
                className="-mt-7 h-[58px] w-[58px] items-center justify-center rounded-full border-[2px] border-red bg-white p-[3px]"
              >
                <View className="h-full w-full items-center justify-center rounded-full bg-red">
                  <FontAwesome6 name={meta.icon} size={21} color="#FFFFFF" solid />
                </View>
              </Pressable>
            </View>
          );
        }

        const tint = isFocused ? '#D91E2A' : '#09090B';

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="tab"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={meta.label}
            className="flex-1 items-center justify-center gap-1 py-1.5"
          >
            <FontAwesome6 name={meta.icon} size={18} color={tint} solid />
            <Text
              className={`text-[10px] ${
                isFocused ? 'font-extrabold text-red' : 'font-medium text-black'
              }`}
            >
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
