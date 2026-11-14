import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExternalLink, ImageOff, Plus, X } from 'lucide-react-native';

import { AppText } from './AppText';
import { PriceDirectionBadge } from './PriceDirectionBadge';
import { PrimaryButton } from './PrimaryButton';
import { SiteIcon } from './SiteIcon';
import { Surface } from './Surface';
import { formatRelativeTime } from '../domain/dates';
import { DISCOVERY_CATEGORY_LABELS } from '../domain/discovery';
import { formatPrice } from '../domain/price';
import { cleanUrl, getSiteByKey } from '../domain/sites';
import { Availability, DiscoveryOffer, DiscoveryProductGroup } from '../domain/types';
import { colors, layoutMetrics, radius, spacing } from '../theme/theme';

export type SearchCompareSheetProps = {
  visible: boolean;
  group?: DiscoveryProductGroup;
  /** Product id currently being tracked/saved, so its row can show a spinner. */
  trackingOfferId?: string;
  onClose: () => void;
  onTrack: (offer: DiscoveryOffer) => void;
  onOpenOffer: (offer: DiscoveryOffer) => void;
  onDismiss: () => void;
  onMoreLikeThis: (brand: string) => void;
  /** Present when group.trackedProduct exists. */
  onOpenTracker?: () => void;
};

function availabilityLabel(availability: Availability): string {
  if (availability === 'in_stock') {
    return 'In stock';
  }
  if (availability === 'out_of_stock') {
    return 'Out of stock';
  }
  return 'Availability not confirmed';
}

function availabilityStyle(availability: Availability) {
  if (availability === 'in_stock') {
    return styles.availabilityInStock;
  }
  if (availability === 'out_of_stock') {
    return styles.availabilityOutOfStock;
  }
  return styles.availabilityUnknown;
}

/** One short, obvious reason a row cannot join the lowest-price comparison. */
function notComparableReason(offer: DiscoveryOffer): string | undefined {
  const product = offer.product;
  if (product.hasPriceRange) {
    return 'price varies by variant';
  }
  if (product.availability === 'out_of_stock') {
    return 'out of stock';
  }
  if (product.priceBasis === 'kg') {
    return 'priced per kg';
  }
  if (product.priceBasis?.startsWith('pack:')) {
    return 'priced per pack';
  }
  return undefined;
}

function priceChange(offer: DiscoveryOffer): { direction: 'down' | 'up'; text: string } | undefined {
  const product = offer.product;
  if (product.previousPriceMinor === undefined || product.priceMinor === undefined) {
    return undefined;
  }
  const difference = product.priceMinor - product.previousPriceMinor;
  if (difference === 0) {
    return undefined;
  }
  const currency = product.currency || 'AED';
  return {
    direction: difference < 0 ? 'down' : 'up',
    text: `${formatPrice(Math.abs(difference), currency, product.priceBasis)} ${difference < 0 ? 'lower' : 'higher'}`
  };
}

export function SearchCompareSheet({
  visible,
  group,
  trackingOfferId,
  onClose,
  onTrack,
  onOpenOffer,
  onDismiss,
  onMoreLikeThis,
  onOpenTracker
}: SearchCompareSheetProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const offers = group?.offers ?? [];
  const bestOffer = group?.bestOffer;
  const trackedProduct = group?.trackedProduct;
  const imageUrl = group?.imageUrl ?? offers.find((offer) => offer.product.imageUrl)?.product.imageUrl;
  const summaryOffer = bestOffer ?? (offers.length === 1 ? offers[0] : undefined);
  const primaryOffer = bestOffer ?? offers[0];
  const trackedUrl = trackedProduct ? cleanUrl(trackedProduct.canonicalUrl || trackedProduct.url) : undefined;
  const storeCount = group?.comparableOfferCount || offers.length;
  const currency = group?.currency ?? 'AED';
  const brandLabel = group && group.brand && group.brand !== 'Other brands' ? group.brand : undefined;
  const contextLine = group ? [brandLabel, DISCOVERY_CATEGORY_LABELS[group.category]].filter(Boolean).join(' · ') : '';

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl, visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.sheet}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close compare prices" onPress={onClose} style={styles.closeButton}>
            <X size={20} color={colors.text} />
          </Pressable>
          <AppText weight="bold" accessibilityRole="header" style={styles.headerTitle}>Compare prices</AppText>
        </View>

        {group ? (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.imageWrap}>
              {imageUrl && !imageFailed ? (
                <Image source={{ uri: imageUrl }} resizeMode="contain" style={styles.image} onError={() => setImageFailed(true)} />
              ) : (
                <View accessible accessibilityLabel="Product image unavailable" style={styles.imageFallback}>
                  <ImageOff size={28} color={colors.textMuted} />
                </View>
              )}
            </View>

            <View style={styles.heading}>
              {contextLine ? <AppText muted style={styles.contextLine}>{contextLine}</AppText> : null}
              <AppText weight="bold" numberOfLines={3} style={styles.title}>{group.title}</AppText>
            </View>

            <View style={styles.summary}>
              {summaryOffer && summaryOffer.product.priceMinor !== undefined ? (
                <AppText weight="bold" style={styles.summaryPrice}>
                  {summaryOffer.product.hasPriceRange ? 'From ' : ''}
                  {formatPrice(summaryOffer.product.priceMinor, summaryOffer.product.currency || currency, summaryOffer.product.priceBasis)}
                </AppText>
              ) : null}
              {bestOffer ? (
                <AppText weight="semibold" style={styles.lowestAt}>Lowest at {getSiteByKey(bestOffer.product.siteKey).shortName}</AppText>
              ) : offers.length > 1 ? (
                <AppText weight="semibold" style={styles.notComparableSummary}>These prices are not directly comparable</AppText>
              ) : null}
              {group.priceSpreadMinor !== undefined && group.priceSpreadMinor > 0 ? (
                <AppText weight="semibold" style={styles.saving}>Save {formatPrice(group.priceSpreadMinor, currency)} across {storeCount} stores</AppText>
              ) : null}
              <AppText muted style={styles.checked}>Prices checked {formatRelativeTime(group.observedAt)}</AppText>
            </View>

            {trackedProduct ? (
              <Surface variant="muted" padding="sm" style={styles.trackedBlock}>
                <View style={styles.trackedRow}>
                  <AppText weight="semibold" style={styles.trackedText}>
                    You track this at {getSiteByKey(trackedProduct.siteKey).shortName}
                  </AppText>
                  {onOpenTracker ? (
                    <PrimaryButton label="Open tracker" variant="outline" onPress={onOpenTracker} style={styles.trackedButton} />
                  ) : null}
                </View>
              </Surface>
            ) : null}

            <AppText weight="bold" accessibilityRole="header" style={styles.sectionTitle}>
              {offers.length === 1 ? 'Price' : `Prices across ${offers.length} stores`}
            </AppText>

            {offers.map((offer) => {
              const product = offer.product;
              const site = getSiteByKey(product.siteKey);
              const isBest = Boolean(bestOffer) && (bestOffer === offer || bestOffer?.product.id === product.id);
              const isTracking = trackingOfferId === product.id;
              const isTracked = trackedUrl !== undefined && cleanUrl(product.url) === trackedUrl;
              const change = priceChange(offer);
              const reason = notComparableReason(offer);
              const offerCurrency = product.currency || currency;

              return (
                <Surface key={`${product.siteKey}:${product.id}`} variant="card" padding="sm" style={[styles.offerCard, isBest && styles.offerCardBest]}>
                  <View style={styles.offerTopRow}>
                    <SiteIcon siteKey={product.siteKey} size={24} />
                    <View style={styles.offerIdentity}>
                      <AppText weight="semibold" numberOfLines={1} style={styles.storeName}>{site.shortName}</AppText>
                      <View style={styles.offerStatusRow}>
                        <AppText style={[styles.availability, availabilityStyle(product.availability)]}>{availabilityLabel(product.availability)}</AppText>
                        {isBest ? <View style={styles.lowestBadge}><AppText weight="semibold" style={styles.lowestBadgeText}>Lowest price</AppText></View> : null}
                      </View>
                    </View>
                    <AppText weight="bold" style={styles.offerPrice}>
                      {product.hasPriceRange ? 'From ' : ''}
                      {formatPrice(product.priceMinor, offerCurrency, product.priceBasis)}
                    </AppText>
                  </View>

                  {product.title !== group.title ? <AppText muted numberOfLines={2} style={styles.offerTitle}>{product.title}</AppText> : null}

                  {change ? (
                    <View style={styles.previousRow}>
                      <AppText muted style={styles.metaText}>was {formatPrice(product.previousPriceMinor, offerCurrency, product.priceBasis)}</AppText>
                      <PriceDirectionBadge direction={change.direction} text={change.text} />
                    </View>
                  ) : product.previousPriceMinor !== undefined ? (
                    <AppText muted style={styles.metaText}>was {formatPrice(product.previousPriceMinor, offerCurrency, product.priceBasis)}</AppText>
                  ) : null}

                  <AppText muted style={styles.metaText}>Checked {formatRelativeTime(product.observedAt)}</AppText>

                  {!offer.comparable && offers.length > 1 ? (
                    <AppText muted style={styles.metaText}>
                      Not directly comparable{reason ? ` · ${reason}` : ''}
                    </AppText>
                  ) : null}

                  <View style={styles.offerActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Track ${site.shortName} price`}
                      accessibilityState={{ selected: isTracked, disabled: isTracking }}
                      disabled={isTracking}
                      onPress={() => onTrack(offer)}
                      style={({ pressed }) => [styles.offerAction, isTracked && styles.offerActionTracked, pressed && styles.pressed]}
                    >
                      {isTracking ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <>
                          <Plus size={15} color={colors.primary} />
                          <AppText weight="semibold" style={styles.actionText}>{isTracked ? 'Tracked' : 'Track'}</AppText>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${site.shortName} offer`}
                      onPress={() => onOpenOffer(offer)}
                      style={({ pressed }) => [styles.offerAction, pressed && styles.pressed]}
                    >
                      <ExternalLink size={15} color={colors.primary} />
                      <AppText weight="semibold" style={styles.actionText}>Open</AppText>
                    </Pressable>
                  </View>
                </Surface>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.emptyState}>
            <AppText muted>Choose a product to compare prices across stores.</AppText>
          </View>
        )}

        <View style={styles.footer}>
          <PrimaryButton
            label="Track lowest price"
            disabled={!primaryOffer}
            onPress={() => {
              if (primaryOffer) {
                onTrack(primaryOffer);
              }
            }}
          />
          <View style={styles.footerRow}>
            <PrimaryButton label="Not interested" variant="outline" onPress={onDismiss} style={styles.footerButton} />
            <PrimaryButton
              label="More like this"
              variant="outline"
              disabled={!group}
              onPress={() => {
                if (group) {
                  onMoreLikeThis(group.brand);
                }
              }}
              style={styles.footerButton}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  closeButton: {
    width: layoutMetrics.touchTarget,
    height: layoutMetrics.touchTarget,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    flex: 1,
    fontSize: 17
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xl
  },
  imageWrap: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden'
  },
  image: {
    width: '100%',
    height: '100%'
  },
  imageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  heading: {
    gap: spacing.xs
  },
  contextLine: {
    fontSize: 13,
    lineHeight: 18
  },
  title: {
    fontSize: 20,
    lineHeight: 26
  },
  summary: {
    gap: spacing.xs
  },
  summaryPrice: {
    fontSize: 28,
    lineHeight: 34
  },
  lowestAt: {
    color: colors.primary,
    fontSize: 15
  },
  notComparableSummary: {
    color: colors.amber,
    fontSize: 15
  },
  saving: {
    color: colors.green,
    fontSize: 14
  },
  checked: {
    fontSize: 12,
    lineHeight: 17
  },
  trackedBlock: {
    gap: spacing.sm
  },
  trackedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  trackedText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14
  },
  trackedButton: {
    minHeight: layoutMetrics.touchTarget,
    paddingHorizontal: 14
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24
  },
  offerCard: {
    gap: 6
  },
  offerCardBest: {
    backgroundColor: colors.blueSoft,
    borderColor: colors.primary
  },
  offerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  offerIdentity: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  storeName: {
    fontSize: 15
  },
  offerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6
  },
  availability: {
    fontSize: 12,
    lineHeight: 16
  },
  availabilityInStock: {
    color: colors.green
  },
  availabilityOutOfStock: {
    color: colors.amber
  },
  availabilityUnknown: {
    color: colors.textMuted
  },
  lowestBadge: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  lowestBadgeText: {
    color: colors.primary,
    fontSize: 10,
    lineHeight: 14
  },
  offerPrice: {
    fontSize: 17
  },
  offerTitle: {
    fontSize: 12,
    lineHeight: 17
  },
  previousRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  metaText: {
    fontSize: 12,
    lineHeight: 17
  },
  offerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 2
  },
  offerAction: {
    flex: 1,
    minHeight: layoutMetrics.touchTarget,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10
  },
  offerActionTracked: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderStrong
  },
  actionText: {
    color: colors.primary,
    fontSize: 13
  },
  pressed: {
    opacity: 0.82
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl
  },
  footer: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  footerButton: {
    flex: 1
  }
});
