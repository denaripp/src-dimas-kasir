import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DailySalesPoint } from '@/lib/reportCalc';

interface SimpleBarChartProps {
  series: readonly DailySalesPoint[];
}

const CHART_BAR_MAX_HEIGHT = 112;

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  barArea: {
    height: CHART_BAR_MAX_HEIGHT + 22,
  },
});

function formatCompactPeak(amount: number): string {
  if (amount >= 1_000_000) {
    const jt = amount / 1_000_000;
    return `${jt >= 10 ? Math.round(jt) : jt.toFixed(1).replace(/\.0$/, '')}jt`;
  }
  if (amount >= 1_000) {
    return `${Math.round(amount / 1_000)}rb`;
  }
  return String(amount);
}

/**
 * Grafik batang 7 hari berbasis Flexbox native murni (tanpa SVG/gifted-charts/linear-gradient).
 * Ringan, render instan, dan 100% sesuai estetika netral + puncak merah v0.2/v0.3.
 */
export const SimpleBarChart = memo(function SimpleBarChart({
  series,
}: SimpleBarChartProps) {
  const bars = useMemo(() => {
    const sliced = series.slice(-7);
    if (sliced.length === 0) return [];
    const maxVal = Math.max(...sliced.map((s) => s.totalSales), 1);

    return sliced.map((point) => {
      const isPeak = point.totalSales === maxVal && point.totalSales > 0;
      const barHeight =
        point.totalSales <= 0
          ? 4
          : Math.max(10, Math.round((point.totalSales / maxVal) * CHART_BAR_MAX_HEIGHT));

      return {
        key: point.dateKey,
        label: point.label.split(' ')[0] ?? point.label,
        totalSales: point.totalSales,
        isPeak,
        barHeight,
      };
    });
  }, [series]);

  if (bars.length === 0) {
    return (
      <View className="w-full items-center rounded-control bg-surface py-7">
        <Text className="font-medium text-[12px] text-muted">
          Belum ada grafik penjualan pada periode ini.
        </Text>
      </View>
    );
  }

  return (
    <View className="w-full">
      <View className="relative w-full justify-end" style={styles.barArea}>
        {/* Horizontal subtle guide lines */}
        <View
          pointerEvents="none"
          className="absolute inset-x-0 bottom-0 top-5 justify-between"
        >
          <View className="h-[1px] bg-border/60" />
          <View className="h-[1px] bg-border/60" />
          <View className="h-[1px] bg-border/60" />
          <View className="h-[1px] bg-border" />
        </View>

        <View className="flex-row items-end justify-around px-1">
          {bars.map((bar) => (
            <View key={bar.key} className="flex-1 items-center justify-end px-1">
              {bar.isPeak ? (
                <Text
                  className="mb-1 font-extrabold text-[9.5px] text-red"
                  style={styles.tabular}
                  numberOfLines={1}
                >
                  {formatCompactPeak(bar.totalSales)}
                </Text>
              ) : (
                <View className="mb-1 h-[13px]" />
              )}
              <View
                style={{
                  height: bar.barHeight,
                  width: 24,
                  backgroundColor: bar.isPeak ? '#D91E2A' : '#E4E4E7',
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                }}
              />
            </View>
          ))}
        </View>
      </View>

      {/* X-Axis Labels */}
      <View className="mt-1.5 flex-row justify-around px-1">
        {bars.map((bar) => (
          <Text
            key={bar.key}
            className={`flex-1 text-center text-[10.5px] ${
              bar.isPeak ? 'font-bold text-black' : 'font-semibold text-muted'
            }`}
            numberOfLines={1}
          >
            {bar.label}
          </Text>
        ))}
      </View>
    </View>
  );
});
