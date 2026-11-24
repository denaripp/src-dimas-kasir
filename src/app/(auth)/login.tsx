import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useEffect } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotionPressable } from '@/components/common/MotionPressable';
import { useAuth } from '@/hooks/useAuth';
import { EASE_BREATHE, EASE_SMOOTH, MOTION_DURATION } from '@/lib/motion';

const STORE_LOGO = require('../../../assets/logo.png');

export default function LoginScreen() {
  const { session, signInWithGoogle, isSigningIn, authError, clearAuthError } = useAuth();
  const reduceMotion = useReducedMotion();

  // Entrance + exit progress
  const logoOpacity = useSharedValue(0);
  const logoTranslateY = useSharedValue(24);
  const logoScale = useSharedValue(0.92);

  // Subtle living breathing motion
  const breatheY = useSharedValue(0);

  // Tagline & bottom CTA staggered entrance
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(16);
  const ctaOpacity = useSharedValue(0);
  const ctaTranslateY = useSharedValue(16);

  // Animasi masuk & napas hidup saat layar Login muncul
  useEffect(() => {
    if (reduceMotion) {
      logoOpacity.value = 1;
      logoTranslateY.value = 0;
      logoScale.value = 1;
      textOpacity.value = 1;
      textTranslateY.value = 0;
      ctaOpacity.value = 1;
      ctaTranslateY.value = 0;
      return;
    }

    logoOpacity.value = withTiming(1, {
      duration: MOTION_DURATION.logoEnter,
      easing: EASE_SMOOTH,
    });
    logoTranslateY.value = withTiming(0, {
      duration: MOTION_DURATION.logoEnter,
      easing: EASE_SMOOTH,
    });
    logoScale.value = withTiming(1, {
      duration: MOTION_DURATION.logoEnter,
      easing: EASE_SMOOTH,
    });

    textOpacity.value = withDelay(
      180,
      withTiming(1, { duration: MOTION_DURATION.contentEnter, easing: EASE_SMOOTH }),
    );
    textTranslateY.value = withDelay(
      180,
      withTiming(0, { duration: MOTION_DURATION.contentEnter, easing: EASE_SMOOTH }),
    );

    ctaOpacity.value = withDelay(
      320,
      withTiming(1, { duration: MOTION_DURATION.contentEnter, easing: EASE_SMOOTH }),
    );
    ctaTranslateY.value = withDelay(
      320,
      withTiming(0, { duration: MOTION_DURATION.contentEnter, easing: EASE_SMOOTH }),
    );

    // Gerak mengambang mikro santai tanpa rekomputasi shadow scale berulang
    breatheY.value = withDelay(
      MOTION_DURATION.logoEnter,
      withRepeat(
        withSequence(
          withTiming(-4, { duration: MOTION_DURATION.breatheHalf, easing: EASE_BREATHE }),
          withTiming(0, { duration: MOTION_DURATION.breatheHalf, easing: EASE_BREATHE }),
        ),
        -1,
        false,
      ),
    );

    return () => {
      cancelAnimation(breatheY);
    };
  }, [
    reduceMotion,
    logoOpacity,
    logoTranslateY,
    logoScale,
    textOpacity,
    textTranslateY,
    ctaOpacity,
    ctaTranslateY,
    breatheY,
  ]);

  // Animasi keluar mulus ke atas saat login berhasil sebelum pindah ke Beranda
  useEffect(() => {
    if (!session || reduceMotion) {
      return;
    }

    cancelAnimation(breatheY);

    logoOpacity.value = withTiming(0, {
      duration: MOTION_DURATION.exitSmooth,
      easing: EASE_SMOOTH,
    });
    logoTranslateY.value = withTiming(-20, {
      duration: MOTION_DURATION.exitSmooth,
      easing: EASE_SMOOTH,
    });
    logoScale.value = withTiming(0.95, {
      duration: MOTION_DURATION.exitSmooth,
      easing: EASE_SMOOTH,
    });

    textOpacity.value = withTiming(0, { duration: 240, easing: EASE_SMOOTH });
    textTranslateY.value = withTiming(-10, { duration: 240, easing: EASE_SMOOTH });
    ctaOpacity.value = withTiming(0, { duration: 220, easing: EASE_SMOOTH });
    ctaTranslateY.value = withTiming(10, { duration: 220, easing: EASE_SMOOTH });
  }, [
    session,
    reduceMotion,
    breatheY,
    logoOpacity,
    logoTranslateY,
    logoScale,
    textOpacity,
    textTranslateY,
    ctaOpacity,
    ctaTranslateY,
  ]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { translateY: logoTranslateY.value + breatheY.value },
      { scale: logoScale.value },
    ],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const ctaAnimatedStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
    transform: [{ translateY: ctaTranslateY.value }],
  }));

  return (
    <SafeAreaView className="flex-1 bg-white px-6 py-7">
      <View className="flex-1 justify-between">
        {/* Top optical spacer */}
        <View className="h-6" />

        {/* Center Brand Logo + Tagline */}
        <View className="items-center">
          <Animated.View
            style={[
              logoAnimatedStyle,
              {
                width: 250,
                height: 75,
                borderRadius: 18,
                overflow: 'hidden',
                backgroundColor: '#E62129',
                shadowColor: '#D91E2A',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.18,
                shadowRadius: 24,
                elevation: 6,
              },
            ]}
          >
            <Image
              source={STORE_LOGO}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              accessibilityLabel="Logo SRC DIMAS KASIR"
            />
          </Animated.View>

          <Animated.View style={textAnimatedStyle} className="mt-6 items-center">
            <Text className="text-center font-extrabold text-[17px] tracking-[-0.02em] text-black">
              Sistem Kasir Toko SRC Dimas
            </Text>
            <Text className="mt-1.5 max-w-[260px] text-center font-medium text-[12.5px] leading-5 text-muted">
              Masuk dengan akun Google untuk mulai transaksi, cek stok, dan pantau penjualan hari ini.
            </Text>
          </Animated.View>
        </View>

        {/* Bottom Google Login Action Dock */}
        <Animated.View style={ctaAnimatedStyle} className="gap-3">
          {authError ? (
            <View className="flex-row items-center justify-between gap-2 rounded-control bg-red-soft px-4 py-3">
              <View className="flex-1 flex-row items-center gap-2.5">
                <FontAwesome6 name="triangle-exclamation" size={14} color="#D91E2A" solid />
                <Text className="flex-1 font-semibold text-[12px] text-red">{authError}</Text>
              </View>
              <Pressable
                onPress={clearAuthError}
                accessibilityLabel="Tutup pesan error"
                hitSlop={8}
              >
                <FontAwesome6 name="xmark" size={14} color="#D91E2A" solid />
              </Pressable>
            </View>
          ) : null}

          <MotionPressable
            onPress={() => void signInWithGoogle()}
            disabled={isSigningIn}
            accessibilityRole="button"
            accessibilityLabel="Masuk dengan Google"
            className="min-h-[50px] flex-row items-center justify-center gap-3 rounded-control bg-red px-5 py-3.5"
          >
            {isSigningIn ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <FontAwesome6 name="google" size={16} color="#FFFFFF" brand />
            )}
            <Text className="font-extrabold text-[14.5px] text-white">
              {isSigningIn ? 'Menghubungkan...' : 'Masuk dengan Google'}
            </Text>
          </MotionPressable>

          <Text className="px-2 text-center font-medium text-[11px] leading-4 text-muted">
            Akses khusus pengelola dan kasir Toko SRC Dimas.
          </Text>
          <Text className="text-center font-semibold text-[10.5px] text-muted">v0.3.2</Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
