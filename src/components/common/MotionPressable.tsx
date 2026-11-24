import type { ReactNode } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SPRING_GENTLE } from '@/lib/motion';

export interface MotionPressableProps extends Omit<PressableProps, 'children'> {
  children: ReactNode;
  className?: string;
  wrapperClassName?: string;
  wrapperStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  opacityTo?: number;
}

/**
 * Tombol interaktif dengan respons sentuhan ringan, smooth, dan santai (60fps).
 * Membungkus Pressable di dalam Animated.View agar kelas NativeWind v4 tetap aman 100%.
 */
export function MotionPressable({
  children,
  className,
  wrapperClassName,
  wrapperStyle,
  scaleTo = 0.965,
  opacityTo = 0.9,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: MotionPressableProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = (event: GestureResponderEvent) => {
    if (!disabled && !reduceMotion) {
      scale.value = withSpring(scaleTo, SPRING_GENTLE);
      opacity.value = withTiming(opacityTo, { duration: 120 });
    }
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    if (!reduceMotion) {
      scale.value = withSpring(1, SPRING_GENTLE);
      opacity.value = withTiming(1, { duration: 160 });
    }
    onPressOut?.(event);
  };

  return (
    <Animated.View className={wrapperClassName} style={[animatedStyle, wrapperStyle]}>
      <Pressable
        {...rest}
        disabled={disabled}
        className={className}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
