import { Image, Pressable, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { CheckCircle2, CircleAlert, Clock3, PackageX, TrendingDown, TrendingUp, X } from 'lucide-react-native';

import { AppText } from './AppText';
import { SiteIcon } from './SiteIcon';
import { formatRelativeTime } from '../domain/dates';
import { formatPrice } from '../domain/price';
import { getSiteByKey } from '../domain/sites';
import { CheckStatus, TrackedProduct } from '../domain/types';
import { colors, radius, shadow } from '../theme/theme';
import { isCompactLayout } from '../theme/layout';

type ProductCardProps = {
  product: TrackedProduct;
  onPress: () => void;
  onRemove?: () => void;
};

export function ProductCard({ product, onPress, onRemove }: ProductCardProps) {
  const { width, fontScale } = useWindowDimensions();
  const compact = isCompactLayout(width, fontScale);
  const site = getSiteByKey(product.siteKey);
  const isOos = product.lastAvailability === 'out_of_stock';
  const status: CheckStatus = product.lastErrorCode ?? 'ok';

  // Price change indicator
  const priceChanged = status === 'price_changed';
  const previousPrice = product.previousPriceMinor;
  const currentPrice = product.currentPriceMinor;
  const delta =
    priceChanged && previousPrice !== undefined && currentPrice !== undefined
      ? currentPrice - previousPrice
      : 0;
  const showPriceDrop = delta < 0;
  const showPriceUp = delta > 0;

  // Status icon for the price row (replaces the old green dot)
  function renderStatusIcon() {
    if (isOos) {return null;}
    if (showPriceDrop || showPriceUp) {return null;} // price change badge takes priority
    if (status === 'ok' || status === 'price_changed') {
      return <CheckCircle2 size={15} color={colors.green} />;
    }
    if (status === 'network_error') {
      return <Clock3 size={15} color={colors.amber} />;
    }
    return <CircleAlert size={15} color={colors.red} />;
  }

  // Show error pill in footer only for actual errors (not ok/price_changed/OOS)
  const showErrorPill = status !== 'ok' && status !== 'price_changed' && !isOos;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, compact && styles.cardCompact, pressed && styles.pressed]}>
      <View style={[styles.imageWrap, compact && styles.imageWrapCompact]}>
        {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={[styles.image, compact && styles.imageCompact, isOos && styles.imageMuted]} resizeMode="contain" /> : null}
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <AppText weight="semibold" numberOfLines={2} style={styles.title}>
            {product.title}
          </AppText>
        </View>
        <View style={styles.badge}>
          <SiteIcon siteKey={product.siteKey} size={14} />
          <AppText style={styles.badgeText}>{site.shortName}</AppText>
        </View>
        {product.variant ? <AppText muted style={styles.variantLabel}>{product.variant.label}</AppText> : null}
        <View style={styles.priceRow}>
          <AppText weight="bold" style={[styles.price, isOos && styles.priceMuted]}>
            {formatPrice(product.currentPriceMinor, product.currency)}
          </AppText>
          {isOos ? (
            <View style={styles.oosBadge}>
              <PackageX size={13} color={colors.amber} />
              <AppText weight="semibold" style={styles.oosText}>
                Out of stock
              </AppText>
            </View>
          ) : showPriceDrop ? (
            <View style={styles.priceDropBadge}>
              <TrendingDown size={13} color={colors.green} />
              <AppText weight="semibold" style={styles.priceDropText}>
                ↓ {formatPrice(Math.abs(delta), product.currency)}
              </AppText>
            </View>
          ) : showPriceUp ? (
            <View style={styles.priceUpBadge}>
              <TrendingUp size={13} color={colors.red} />
              <AppText weight="semibold" style={styles.priceUpText}>
                ↑ {formatPrice(delta, product.currency)}
              </AppText>
            </View>
          ) : (
            renderStatusIcon()
          )}
        </View>
        <View style={styles.footer}>
          <AppText muted style={styles.caption}>
            Last checked: {formatRelativeTime(product.lastCheckedAt)}
          </AppText>
          {showErrorPill ? (
            <View style={styles.errorBadge}>
              {status === 'network_error' ? (
                <Clock3 size={12} color={colors.amber} />
              ) : (
                <CircleAlert size={12} color={colors.red} />
              )}
              <AppText weight="medium" style={status === 'network_error' ? styles.errorTextAmber : styles.errorTextRed}>
                {status === 'network_error' ? 'Network error' : status === 'blocked' ? 'Blocked' : status === 'variant_not_found' ? 'Variant unavailable' : 'Failed'}
              </AppText>
            </View>
          ) : null}
        </View>
        {isOos && onRemove ? (
          <TouchableOpacity style={styles.oosRemoveRow} onPress={onRemove}>
            <AppText muted style={styles.oosRemoveHint}>
              Still unavailable ·{' '}
            </AppText>
            <X size={12} color={colors.red} />
            <AppText weight="semibold" style={styles.oosRemoveAction}>
              {' '}Remove
            </AppText>
          </TouchableOpacity>
        ) : null}
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
  cardCompact: {
    flexDirection: 'column'
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
  imageWrapCompact: {
    width: 72,
    height: 72
  },
  image: {
    width: 80,
    height: 92
  },
  imageCompact: {
    width: 64,
    height: 64
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 5
  },
  badgeText: {
    fontSize: 12
  },
  variantLabel: {
    fontSize: 12,
    marginTop: 6
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
  priceDropBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.greenSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  priceDropText: {
    color: colors.green,
    fontSize: 12
  },
  priceUpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.redSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  priceUpText: {
    color: colors.red,
    fontSize: 12
  },
  oosBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.amberSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  oosText: {
    color: colors.amber,
    fontSize: 12
  },
  priceMuted: {
    color: colors.textMuted,
    textDecorationLine: 'line-through'
  },
  imageMuted: {
    opacity: 0.6
  },
  footer: {
    marginTop: 9,
    gap: 8
  },
  caption: {
    fontSize: 12
  },
  errorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  errorTextRed: {
    color: colors.red,
    fontSize: 11
  },
  errorTextAmber: {
    color: colors.amber,
    fontSize: 11
  },
  oosRemoveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  oosRemoveHint: {
    fontSize: 11
  },
  oosRemoveAction: {
    fontSize: 11,
    color: colors.red
  }
});
