import { StyleSheet, View } from 'react-native';
import { TrendingDown, TrendingUp } from 'lucide-react-native';

import { AppText } from './AppText';
import { colors, radius } from '../theme/theme';

type PriceDirectionBadgeProps = {
  direction: 'down' | 'up';
  text: string;
  accessibilityLabel?: string;
};

export function PriceDirectionBadge({ direction, text, accessibilityLabel }: PriceDirectionBadgeProps) {
  const isDown = direction === 'down';
  const Icon = isDown ? TrendingDown : TrendingUp;

  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      style={[styles.badge, isDown ? styles.down : styles.up]}
    >
      <Icon size={13} color={isDown ? colors.green : colors.amber} />
      <AppText weight="semibold" style={[styles.label, isDown ? styles.downText : styles.upText]}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  down: {
    backgroundColor: colors.greenSoft
  },
  up: {
    backgroundColor: colors.amberSoft
  },
  label: {
    fontSize: 12
  },
  downText: {
    color: colors.green
  },
  upText: {
    color: colors.amber
  }
});
