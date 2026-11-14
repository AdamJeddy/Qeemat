import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ImageOff, Plus } from 'lucide-react-native';

import { AppText } from './AppText';
import { PriceDirectionBadge } from './PriceDirectionBadge';
import { SiteIcon } from './SiteIcon';
import { DISCOVERY_CATEGORY_LABELS } from '../domain/discovery';
import { formatPrice } from '../domain/price';
import { getSiteByKey } from '../domain/sites';
import { DiscoveryOffer, DiscoveryProductGroup } from '../domain/types';
import { isCompactLayout } from '../theme/layout';
import { colors, layoutMetrics, radius } from '../theme/theme';

export type SearchProductRowProps = {
  group: DiscoveryProductGroup;
  onPress: () => void;
  onTrack?: () => void;
  onOpenTracker?: () => void;
  tracking?: boolean;
  compact?: boolean;
};

/** Up to this many source icons fit on one line at 343dp with large text. */
const MAX_SOURCE_ICONS = 4;

function shortStoreName(offer: DiscoveryOffer): string {
  return getSiteByKey(offer.product.siteKey).shortName;
}

function offerPriceDisplay(offer: DiscoveryOffer | undefined, fallbackCurrency: string): string {
  if (!offer) {
    return formatPrice(undefined, fallbackCurrency);
  }
  const product = offer.product;
  const price = formatPrice(product.priceMinor, product.currency || fallbackCurrency, product.priceBasis);
  return product.hasPriceRange && product.priceMinor !== undefined ? `From ${price}` : price;
}

export function SearchProductRow({ group, onPress, onTrack, onOpenTracker, tracking, compact: compactProp }: SearchProductRowProps) {
  const { width, fontScale } = useWindowDimensions();
  const compact = compactProp ?? isCompactLayout(width, fontScale);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [group.imageUrl]);

  // bestOffer is only present for genuinely comparable prices, so it is safe to
  // call it the lowest. Otherwise fall back to the first observed offer without
  // making a lowest-price claim.
  const displayOffer = group.bestOffer ?? group.offers[0];
  const product = displayOffer?.product;
  const currency = product?.currency ?? group.currency;
  const priceDisplay = offerPriceDisplay(displayOffer, group.currency);
  const previousPriceMinor = product?.previousPriceMinor;
  const currentPriceMinor = product?.priceMinor;
  const priceDifference = previousPriceMinor !== undefined && currentPriceMinor !== undefined ? currentPriceMinor - previousPriceMinor : 0;
  const directionText = priceDifference === 0 ? undefined : `${formatPrice(Math.abs(priceDifference), currency, product?.priceBasis)} ${priceDifference < 0 ? 'lower' : 'higher'}`;

  const storeLabel = group.bestOffer
    ? `Lowest at ${shortStoreName(group.bestOffer)}`
    : group.offers.length > 1
      ? `${group.offers.length} stores`
      : group.offers.length === 1
        ? `At ${shortStoreName(group.offers[0])}`
        : 'No stores';
  const storeCountLabel = group.bestOffer && group.offers.length > 1 ? `${group.offers.length} stores` : undefined;
  const saving = group.bestOffer && (group.priceSpreadMinor ?? 0) > 0 ? `Save ${formatPrice(group.priceSpreadMinor, group.currency)}` : undefined;
  const trackedLabel = group.trackedProduct ? `On your watchlist at ${getSiteByKey(group.trackedProduct.siteKey).shortName}` : undefined;
  const showStoreLine = trackedLabel ? group.offers.length > 1 : true;
  const reason = group.relevance?.reason && !(group.trackedProduct && group.relevance.reason.startsWith('You track this')) ? group.relevance.reason : undefined;
  const categoryLabel = group.category === 'general' ? undefined : DISCOVERY_CATEGORY_LABELS[group.category];
  const categoryLine = [group.brand && group.brand !== 'Other brands' ? group.brand : undefined, categoryLabel].filter(Boolean).join(' · ');
  const accessibilityLabel = [
    group.title,
    group.brand,
    priceDisplay,
    storeLabel,
    trackedLabel,
    reason
  ].filter(Boolean).join(', ');

  return (
    <View style={styles.item}>
      <View style={[styles.row, compact && styles.rowCompact]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}
          style={({ pressed }) => [styles.main, compact && styles.mainCompact, pressed && styles.pressed]}
        >
          <View style={[styles.imageWrap, compact && styles.imageWrapCompact]}>
            {group.imageUrl && !imageFailed ? (
              <Image
                source={{ uri: group.imageUrl }}
                style={[styles.image, compact && styles.imageCompact]}
                resizeMode="contain"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <View accessible accessibilityLabel="Product image unavailable">
                <ImageOff size={24} color={colors.textMuted} />
              </View>
            )}
          </View>
          <View style={styles.content}>
            {categoryLine ? (
              <AppText muted weight="medium" numberOfLines={1} style={styles.category}>
                {categoryLine}
              </AppText>
            ) : null}
            <AppText weight="semibold" numberOfLines={2} style={styles.title}>
              {group.title}
            </AppText>
            <View style={styles.priceRow}>
              <AppText weight="bold" style={styles.price}>
                {priceDisplay}
              </AppText>
              {directionText ? (
                <PriceDirectionBadge direction={priceDifference < 0 ? 'down' : 'up'} text={directionText} />
              ) : null}
              {product?.availability === 'out_of_stock' ? (
                <View style={styles.oosTag}>
                  <AppText weight="semibold" style={styles.oosText}>
                    Out of stock
                  </AppText>
                </View>
              ) : null}
            </View>
            {trackedLabel ? (
              <AppText muted style={styles.tracked}>
                {trackedLabel}
              </AppText>
            ) : null}
            {showStoreLine ? (
              <View style={styles.storeLine}>
                <View style={styles.storeIcons}>
                  {group.offers.slice(0, MAX_SOURCE_ICONS).map((offer) => (
                    <SiteIcon key={`${offer.product.siteKey}:${offer.order}`} siteKey={offer.product.siteKey} size={14} />
                  ))}
                </View>
                <AppText style={styles.storeText}>
                  {storeCountLabel ? `${storeLabel} · ${storeCountLabel}` : storeLabel}
                </AppText>
                {saving ? (
                  <AppText weight="semibold" style={styles.saving}>
                    {saving}
                  </AppText>
                ) : null}
              </View>
            ) : saving ? (
              <AppText weight="semibold" style={styles.saving}>{saving}</AppText>
            ) : null}
            {reason ? (
              <AppText muted style={styles.reason}>
                {reason}
              </AppText>
            ) : null}
          </View>
        </Pressable>
      </View>
      {/* Kept outside the row Pressable so the action buttons never nest inside it. */}
      <View style={[styles.actions, compact && styles.actionsCompact]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Compare prices for ${group.title}`}
          onPress={onPress}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <AppText weight="semibold" style={styles.actionText}>
            Compare
          </AppText>
        </Pressable>
        {group.trackedProduct && onOpenTracker ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open tracker for ${group.title}`}
            onPress={onOpenTracker}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          >
            <AppText weight="semibold" style={styles.actionText}>Open</AppText>
          </Pressable>
        ) : onTrack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Track ${group.title}`}
            accessibilityState={{ busy: Boolean(tracking), disabled: Boolean(tracking) }}
            onPress={onTrack}
            disabled={tracking}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          >
            {tracking ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Plus size={15} color={colors.primary} />
                <AppText weight="semibold" style={styles.actionText}>
                  Track
                </AppText>
              </>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
    paddingVertical: 12
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  rowCompact: {
    flexDirection: 'column',
    gap: 10
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0
  },
  mainCompact: {
    flexDirection: 'column',
    gap: 10
  },
  pressed: {
    opacity: 0.84
  },
  imageWrap: {
    width: 84,
    height: 96,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  imageWrapCompact: {
    width: 64,
    height: 72
  },
  image: {
    width: 76,
    height: 88
  },
  imageCompact: {
    width: 56,
    height: 64
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  category: {
    fontSize: 11,
    lineHeight: 15
  },
  title: {
    fontSize: 15,
    lineHeight: 21
  },
  priceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8
  },
  price: {
    fontSize: 18,
    lineHeight: 24
  },
  oosTag: {
    backgroundColor: colors.amberSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 3
  },
  oosText: {
    color: colors.amber,
    fontSize: 11
  },
  tracked: {
    fontSize: 12,
    lineHeight: 17
  },
  storeLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6
  },
  storeIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  storeText: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 17
  },
  saving: {
    color: colors.green,
    fontSize: 12,
    lineHeight: 17
  },
  reason: {
    fontSize: 11,
    lineHeight: 15
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    // Align under the content column (84px image + 12px row gap) on wide layouts.
    marginLeft: 96
  },
  actionsCompact: {
    marginLeft: 0
  },
  action: {
    minHeight: layoutMetrics.touchTarget,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12
  },
  actionPressed: {
    opacity: 0.82
  },
  actionText: {
    color: colors.primary,
    fontSize: 12
  }
});
