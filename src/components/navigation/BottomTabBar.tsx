import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotionPressable } from '@/components/common/MotionPressable';
import { SPRING_TAB } from '@/lib/motion';

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

interface AnimatedTabItemProps {
  icon: string;
  label: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function AnimatedTabItem({
  icon,
  label,
  isFocused,
  onPress,
  onLongPress,
}: AnimatedTabItemProps) {
  const reduceMotion = useReducedMotion();
  const iconScale = useSharedValue(isFocused ? 1.07 : 1);

  useEffect(() => {
    if (reduceMotion) {
      iconScale.value = 1;
      return;
    }
    iconScale.value = withSpring(isFocused ? 1.07 : 1, SPRING_TAB);
  }, [isFocused, reduceMotion, iconScale]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const tint = isFocused ? '#D91E2A' : '#71717A';

  return (
    <MotionPressable
      wrapperClassName="flex-1"
      onPress={onPress}
      onLongPress={onLongPress}
      scaleTo={0.94}
      accessibilityRole="tab"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={label}
      className="items-center justify-center gap-1 py-1.5"
    >
      <Animated.View style={iconAnimatedStyle}>
        <FontAwesome6 name={icon} size={17} color={tint} solid />
      </Animated.View>
      <Text
        className={`text-[10.5px] ${
          isFocused ? 'font-extrabold text-red' : 'font-semibold text-muted'
        }`}
      >
        {label}
      </Text>
    </MotionPressable>
  );
}

export function BottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row items-center border-t border-border bg-white px-2 pt-1.5"
      style={{ paddingBottom: Math.max(insets.bottom, 10), minHeight: 70 }}
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
              <MotionPressable
                onPress={onPress}
                onLongPress={onLongPress}
                scaleTo={0.92}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel="Buka Kasir dan Scan Barcode"
                className="-mt-6 h-[56px] w-[56px] items-center justify-center rounded-full border-[4px] border-white bg-red"
                style={{
                  shadowColor: '#D91E2A',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.28,
                  shadowRadius: 12,
                  elevation: 6,
                }}
              >
                <FontAwesome6 name={meta.icon} size={20} color="#FFFFFF" solid />
              </MotionPressable>
            </View>
          );
        }

        return (
          <AnimatedTabItem
            key={route.key}
            icon={meta.icon}
            label={meta.label}
            isFocused={isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        );
      })}
    </View>
  );
}
