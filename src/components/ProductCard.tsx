import { Image, Pressable, StyleSheet, View } from 'react-native';
import { MoreVertical, TrendingDown } from 'lucide-react-native';

import { AppText } from './AppText';
import { StatusPill } from './StatusPill';
import { formatRelativeTime } from '../domain/dates';
import { formatPrice } from '../domain/price';
import { getSiteByKey } from '../domain/sites';
import { TrackedProduct } from '../domain/types';
import { colors, radius, shadow } from '../theme/theme';

type ProductCardProps = {
  product: TrackedProduct;
  onPress: () => void;
};

export function ProductCard({ product, onPress }: ProductCardProps) {
  const site = getSiteByKey(product.siteKey);
  const status = product.lastErrorCode ?? 'ok';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.imageWrap}>
        {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.image} resizeMode="contain" /> : null}
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <AppText weight="semibold" numberOfLines={2} style={styles.title}>
            {product.title}
          </AppText>
          <MoreVertical size={18} color={colors.textMuted} />
        </View>
        <View style={styles.badge}>
          <AppText style={styles.badgeText}>{site.shortName}</AppText>
        </View>
        <View style={styles.priceRow}>
          <AppText weight="bold" style={styles.price}>
            {formatPrice(product.currentPriceMinor, product.currency)}
          </AppText>
          <View style={styles.dropBadge}>
            <TrendingDown size={13} color={colors.green} />
            <AppText weight="semibold" style={styles.dropText}>
              Tracking
            </AppText>
          </View>
        </View>
        <View style={styles.footer}>
          <AppText muted style={styles.caption}>
            Last checked: {formatRelativeTime(product.lastCheckedAt)}
          </AppText>
          <StatusPill status={status} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 12,
    ...shadow
  },
  pressed: {
    opacity: 0.84
  },
  imageWrap: {
    width: 88,
    height: 100,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  image: {
    width: 80,
    height: 92
  },
  content: {
    flex: 1,
    minWidth: 0
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6
  },
  title: {
    flex: 1
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 5
  },
  badgeText: {
    fontSize: 12
  },
  priceRow: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  price: {
    fontSize: 18
  },
  dropBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.greenSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  dropText: {
    color: colors.green,
    fontSize: 12
  },
  footer: {
    marginTop: 9,
    gap: 8
  },
  caption: {
    fontSize: 12
  }
});
