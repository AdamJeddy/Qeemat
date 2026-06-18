import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { PriceSnapshot } from '../domain/types';
import { colors, radius } from '../theme/theme';

type PriceChartProps = {
  snapshots: PriceSnapshot[];
};

export function PriceChart({ snapshots }: PriceChartProps) {
  const points = snapshots
    .filter((snapshot) => snapshot.priceMinor !== undefined)
    .slice()
    .reverse()
    .slice(-16);

  if (points.length < 2) {
    return <View style={styles.empty} />;
  }

  const values = points.map((point) => point.priceMinor ?? 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const width = 320;
  const height = 150;
  const padding = 14;

  const coords = values.map((value, index) => {
    const x = padding + (index / Math.max(1, values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const linePath = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${height - padding} L ${coords[0].x} ${height - padding} Z`;
  const last = coords[coords.length - 1];

  return (
    <View style={styles.chart}>
      <Svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
        <Defs>
          <LinearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.green} stopOpacity="0.18" />
            <Stop offset="1" stopColor={colors.green} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill="url(#priceFill)" />
        <Path d={linePath} fill="none" stroke={colors.green} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={last.x} cy={last.y} r={5} fill={colors.green} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    height: 165,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
    overflow: 'hidden'
  },
  empty: {
    height: 165,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1
  }
});
