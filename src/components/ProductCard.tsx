import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { CheckCircle2, CircleAlert, Clock3, ImageOff, PackageX, X } from 'lucide-react-native';

import { AppText } from './AppText';
import { PriceDirectionBadge } from './PriceDirectionBadge';
import { SiteIcon } from './SiteIcon';
import { formatRelativeTime } from '../domain/dates';
import { formatPrice } from '../domain/price';
import { getSiteByKey } from '../domain/sites';
import { CheckStatus, TrackedProduct } from '../domain/types';
import { colors, layoutMetrics, radius } from '../theme/theme';
import { isCompactLayout } from '../theme/layout';
import { DISCOVERY_CATEGORY_LABELS } from '../domain/discoveryCategories';
import { inferWatchlistCategory } from '../domain/watchlistDiscovery';

type ProductCardProps = {
  product: TrackedProduct;
  onPress: () => void;
  onRemove?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
};

export function ProductCard({ product, onPress, onRemove, onLongPress, selected }: ProductCardProps) {
  const { width, fontScale } = useWindowDimensions();
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => { setImageFailed(false); }, [product.imageUrl]);
  const compact = isCompactLayout(width, fontScale);
  const site = getSiteByKey(product.siteKey);
  const category = inferWatchlistCategory(product);
  const isOos = product.lastAvailability === 'out_of_stock';
  const status: CheckStatus = product.lastErrorCode ?? 'ok';
  const checkFailed = status !== 'ok' && status !== 'price_changed';

  // Price change indicator. Uses the most recent actual price change so a
  // subsequent unchanged check does not erase it from the card.
  const changedFrom = product.lastPriceChangeMinor;
  const currentPrice = product.currentPriceMinor;
  const delta = !isOos && changedFrom !== undefined && currentPrice !== undefined ? currentPrice - changedFrom : 0;
  const showPriceDrop = delta < 0;
  const showPriceUp = delta > 0;
  const changedAtLabel = product.lastPriceChangeAt ? `, changed ${formatRelativeTime(product.lastPriceChangeAt)}` : '';

  // Show error pill in footer only for actual errors (not ok/price_changed/OOS)
  const showErrorPill = status !== 'ok' && status !== 'price_changed' && !isOos;

  const cardLabel = [
    product.title,
    formatPrice(product.currentPriceMinor, product.currency, product.priceBasis),
    isOos ? 'Out of stock' : showErrorPill ? 'Check failed' : undefined,
    site.shortName,
    `${checkFailed ? 'Last attempt' : 'Last checked'} ${formatRelativeTime(product.lastCheckedAt)}`
  ].filter(Boolean).join(', ');

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={cardLabel} accessibilityState={{ selected: Boolean(selected) }} onPress={onPress} onLongPress={onLongPress} delayLongPress={250} style={({ pressed }) => [styles.card, compact && styles.cardCompact, selected && styles.cardSelected, pressed && styles.pressed]}>
      {selected ? <View style={styles.selectionMark}><CheckCircle2 size={22} color={colors.primary} /></View> : null}
      <View style={[styles.imageWrap, compact && styles.imageWrapCompact]}>
        {product.imageUrl && !imageFailed ? <Image source={{ uri: product.imageUrl }} style={[styles.image, compact && styles.imageCompact, isOos && styles.imageMuted]} resizeMode="contain" onError={() => setImageFailed(true)} /> : <View accessible accessibilityLabel="Product image unavailable"><ImageOff size={24} color={colors.textMuted} /></View>}
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <AppText weight="semibold" numberOfLines={2} style={[styles.title, selected && styles.titleSelected]}>
            {product.title}
          </AppText>
        </View>
        {checkFailed || isOos ? <AppText muted style={styles.caption}>Last known price</AppText> : null}
        <View style={styles.priceRow}>
          <AppText weight="bold" style={[styles.price, isOos && styles.priceMuted]}>
            {formatPrice(product.currentPriceMinor, product.currency, product.priceBasis)}
          </AppText>
          {isOos ? (
            <View style={styles.oosBadge}>
              <PackageX size={13} color={colors.amber} />
              <AppText weight="semibold" style={styles.oosText}>
                Out of stock
              </AppText>
            </View>
          ) : showPriceDrop ? (
            <PriceDirectionBadge
              direction="down"
              text={`${formatPrice(Math.abs(delta), product.currency, product.priceBasis)} lower`}
              accessibilityLabel={`${formatPrice(Math.abs(delta), product.currency, product.priceBasis)} lower${changedAtLabel}`}
            />
          ) : showPriceUp ? (
            <PriceDirectionBadge
              direction="up"
              text={`${formatPrice(delta, product.currency, product.priceBasis)} higher`}
              accessibilityLabel={`${formatPrice(delta, product.currency, product.priceBasis)} higher${changedAtLabel}`}
            />
          ) : null}
        </View>
        <View style={styles.badge}>
          <SiteIcon siteKey={product.siteKey} size={14} />
          <AppText style={styles.badgeText}>{site.shortName}</AppText>
        </View>
        {product.variant || product.folder || (category && product.category) ? <AppText muted style={styles.variantLabel}>{[product.variant?.label, product.folder, category && product.category ? DISCOVERY_CATEGORY_LABELS[category] : undefined].filter(Boolean).join(' · ')}</AppText> : null}
        <View style={styles.footer}>
          <AppText muted style={styles.caption}>
            {checkFailed ? 'Last attempt' : 'Last checked'}: {formatRelativeTime(product.lastCheckedAt)}
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
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Remove ${product.title} from watchlist`}
            style={styles.oosRemoveRow}
            onPress={onRemove}
          >
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
    paddingVertical: 12,
    gap: 12
  },
  cardCompact: {
    flexDirection: 'column'
  },
  pressed: {
    opacity: 0.84
  },
  cardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.blueSoft
  },
  selectionMark: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14
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
  titleSelected: {
    paddingRight: 28
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 17
  },
  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6
  },
  metadataText: {
    fontSize: 11
  },
  variantLabel: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3
  },
  priceRow: {
    marginTop: 5,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  price: {
    fontSize: 18
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
    marginTop: 4,
    gap: 8
  },
  caption: {
    fontSize: 12,
    lineHeight: 17
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
    minHeight: layoutMetrics.touchTarget,
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
