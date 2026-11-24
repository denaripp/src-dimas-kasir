import { Easing } from 'react-native-reanimated';

/**
 * Kurva & timing animasi global v0.2.0:
 * Smooth, santai, tidak buru-buru, dan terasa hidup di 60fps UI thread.
 */
export const EASE_SMOOTH = Easing.bezier(0.22, 1, 0.36, 1);

export const EASE_BREATHE = Easing.inOut(Easing.sin);

export const SPRING_GENTLE = {
  damping: 20,
  stiffness: 170,
  mass: 0.9,
} as const;

export const SPRING_TAB = {
  damping: 18,
  stiffness: 190,
  mass: 0.85,
} as const;

export const MOTION_DURATION = {
  logoEnter: 700,
  contentEnter: 560,
  exitSmooth: 360,
  breatheHalf: 2200,
  sheet: 280,
} as const;
