import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { formatPrice } from '../domain/price';
import { PriceSnapshot } from '../domain/types';
import { AppText } from './AppText';
import { colors, radius, spacing } from '../theme/theme';

type PriceChartProps = {
  snapshots: PriceSnapshot[];
  currency: string;
};

type PricedSnapshot = PriceSnapshot & {
  priceMinor: number;
};

type ChartCoordinate = {
  x: number;
  y: number;
};

const MAX_POINTS = 24;
const width = 320;
const height = 154;
const padding = 18;

export function PriceChart({ snapshots, currency }: PriceChartProps) {
  const points = useMemo(
    () => snapshots
      .filter((snapshot): snapshot is PricedSnapshot => snapshot.priceMinor !== undefined)
      .slice()
      .sort((left, right) => left.checkedAt.localeCompare(right.checkedAt))
      .slice(-MAX_POINTS),
    [snapshots]
  );
  const [selectedId, setSelectedId] = useState<number | undefined>();
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    setSelectedId(points[points.length - 1]?.id);
  }, [points]);

  if (points.length < 2) {
    return (
      <View style={styles.empty}>
        <AppText muted style={styles.emptyText}>Price history appears after two priced checks.</AppText>
      </View>
    );
  }

  const selectedIndex = Math.max(0, points.findIndex((point) => point.id === selectedId));
  const selected = points[selectedIndex];
  const previous = selectedIndex > 0 ? points[selectedIndex - 1] : undefined;
  const values = points.map((point) => point.priceMinor);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const coords = values.map((value, index): ChartCoordinate => ({
    x: padding + (index / Math.max(1, values.length - 1)) * (width - padding * 2),
    y: height - padding - ((value - min) / range) * (height - padding * 2)
  }));
  const linePath = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${height - padding} L ${coords[0].x} ${height - padding} Z`;
  const selectedCoord = coords[selectedIndex];
  const selectPointAt = (locationX: number) => {
    const scale = Math.min(chartSize.width / width, chartSize.height / height);
    const renderedWidth = width * scale;
    const horizontalOffset = (chartSize.width - renderedWidth) / 2;
    const horizontalPadding = padding * scale;
    const usableWidth = Math.max(1, renderedWidth - horizontalPadding * 2);
    const offset = Math.max(0, Math.min(usableWidth, locationX - horizontalOffset - horizontalPadding));
    const index = Math.round((offset / usableWidth) * (points.length - 1));

    setSelectedId(points[index].id);
  };

  return (
    <View style={styles.chart}>
      <View style={styles.selectionRow}>
        <View>
          <AppText weight="bold" style={styles.selectedPrice}>{formatPrice(selected.priceMinor, currency)}</AppText>
          <AppText muted style={styles.selectedDate}>{formatChartDate(selected.checkedAt)}</AppText>
        </View>
        <View style={[styles.changeBadge, changeBadgeStyle(selected, previous)]}>
          <AppText weight="semibold" style={changeTextStyle(selected, previous)}>
            {formatChangeLabel(selected, previous, currency)}
          </AppText>
        </View>
      </View>

      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel="Price history chart"
        accessibilityHint="Tap a point to view its price and date"
        onLayout={(event) => setChartSize(event.nativeEvent.layout)}
        onPress={(event) => selectPointAt(event.nativeEvent.locationX)}
        style={styles.canvas}
      >
        <Svg pointerEvents="none" viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
          <Defs>
            <LinearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.primary} stopOpacity="0.16" />
              <Stop offset="1" stopColor={colors.primary} stopOpacity="0.01" />
            </LinearGradient>
          </Defs>
          {[0.25, 0.5, 0.75].map((ratio) => (
            <Line
              key={ratio}
              x1={padding}
              x2={width - padding}
              y1={padding + (height - padding * 2) * ratio}
              y2={padding + (height - padding * 2) * ratio}
              stroke={colors.border}
              strokeDasharray="3 5"
            />
          ))}
          <Path d={areaPath} fill="url(#priceFill)" />
          <Path d={linePath} fill="none" stroke={colors.primary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          <Line
            x1={selectedCoord.x}
            x2={selectedCoord.x}
            y1={padding}
            y2={height - padding}
            stroke={colors.primary}
            strokeOpacity={0.32}
            strokeDasharray="4 4"
          />
          {coords.map((coord, index) => {
            const point = points[index];
            const isSelected = index === selectedIndex;
            const pointColor = getPointColor(point, points[index - 1]);

            return (
              <Circle
                key={point.id}
                cx={coord.x}
                cy={coord.y}
                r={isSelected ? 7 : 4}
                fill={isSelected ? colors.surface : pointColor}
                stroke={isSelected ? colors.primary : colors.surface}
                strokeWidth={isSelected ? 3 : 2}
              />
            );
          })}
        </Svg>
      </Pressable>

      <View style={styles.axis}>
        <AppText muted style={styles.axisLabel}>{formatAxisDate(points[0].checkedAt)}</AppText>
        <AppText muted style={styles.axisLabel}>{formatAxisDate(points[points.length - 1].checkedAt)}</AppText>
      </View>
      <AppText muted style={styles.hint}>Tap a point to view its date and price. Green marks a drop; orange marks an increase.</AppText>
    </View>
  );
}

function getPointColor(point: PricedSnapshot, previous: PricedSnapshot | undefined): string {
  if (!previous) {
    return colors.primary;
  }

  if (point.priceMinor < previous.priceMinor) {
    return colors.green;
  }

  if (point.priceMinor > previous.priceMinor) {
    return colors.red;
  }

  return colors.borderStrong;
}

function formatChangeLabel(point: PricedSnapshot, previous: PricedSnapshot | undefined, currency: string): string {
  if (!previous) {
    return 'First price';
  }

  const delta = point.priceMinor - previous.priceMinor;
  if (delta < 0) {
    return `↓ ${formatPrice(Math.abs(delta), currency)} drop`;
  }

  if (delta > 0) {
    return `↑ ${formatPrice(delta, currency)} increase`;
  }

  return 'No change';
}

function changeBadgeStyle(point: PricedSnapshot, previous: PricedSnapshot | undefined) {
  if (!previous || point.priceMinor === previous.priceMinor) {
    return styles.changeBadgeMuted;
  }

  return point.priceMinor < previous.priceMinor ? styles.changeBadgeDown : styles.changeBadgeUp;
}

function changeTextStyle(point: PricedSnapshot, previous: PricedSnapshot | undefined) {
  if (!previous || point.priceMinor === previous.priceMinor) {
    return styles.changeTextMuted;
  }

  return point.priceMinor < previous.priceMinor ? styles.changeTextDown : styles.changeTextUp;
}

function formatChartDate(iso: string): string {
  return new Date(iso).toLocaleString('en-AE', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatAxisDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AE', {
    month: 'short',
    day: 'numeric'
  });
}

const styles = StyleSheet.create({
  chart: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1
  },
  selectionRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  selectedPrice: {
    fontSize: 20
  },
  selectedDate: {
    marginTop: 2,
    fontSize: 12
  },
  changeBadge: {
    maxWidth: '48%',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  changeBadgeDown: {
    backgroundColor: colors.greenSoft
  },
  changeBadgeUp: {
    backgroundColor: colors.redSoft
  },
  changeBadgeMuted: {
    backgroundColor: colors.surfaceMuted
  },
  changeTextDown: {
    color: colors.green,
    fontSize: 12,
    textAlign: 'right'
  },
  changeTextUp: {
    color: colors.red,
    fontSize: 12,
    textAlign: 'right'
  },
  changeTextMuted: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'right'
  },
  canvas: {
    height: 172
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2
  },
  axisLabel: {
    fontSize: 12
  },
  hint: {
    marginTop: spacing.sm,
    fontSize: 12,
    lineHeight: 17
  },
  empty: {
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1
  },
  emptyText: {
    textAlign: 'center'
  }
});
