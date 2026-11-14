import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight, ImageOff, PackageX } from 'lucide-react-native';

import { AppText } from './AppText';
import { PriceDirectionBadge } from './PriceDirectionBadge';
import { Surface } from './Surface';
import { formatActivityTime, groupActivityEventsByDay } from '../domain/activity';
import { formatPrice } from '../domain/price';
import { getSiteByKey } from '../domain/sites';
import { snapshotSourceLabel } from '../domain/snapshotSource';
import type { ActivityEvent, TrackedProduct } from '../domain/types';
import { colors, radius } from '../theme/theme';

type ActivityListProps = {
  events: ActivityEvent[];
  productsById: Map<number, TrackedProduct>;
  onOpenProduct: (productId: number) => void;
  now?: Date;
};

function deltaLabel(event: ActivityEvent): string | undefined {
  if (event.previousPriceMinor === undefined) { return undefined; }
  const delta = event.newPriceMinor - event.previousPriceMinor;
  if (!Number.isFinite(delta) || delta === 0) { return undefined; }
  return `${formatPrice(Math.abs(delta), event.currency, event.priceBasis)} ${delta < 0 ? 'lower' : 'higher'}`;
}

function deltaBadgeText(event: ActivityEvent): string | undefined {
  if (event.previousPriceMinor === undefined) { return undefined; }
  const delta = event.newPriceMinor - event.previousPriceMinor;
  if (!Number.isFinite(delta) || delta === 0) { return undefined; }
  return `${delta < 0 ? '−' : '+'}${formatPrice(Math.abs(delta), event.currency, event.priceBasis)}`;
}

function priceLine(event: ActivityEvent) {
  if (event.availability === 'out_of_stock') {
    return (
      <>
        <PackageX size={16} color={colors.amber} />
        <AppText weight="semibold" style={styles.oosLabel}>Out of stock</AppText>
        {event.previousPriceMinor !== undefined ? (
          <AppText muted style={styles.oldPrice}>{formatPrice(event.previousPriceMinor, event.currency, event.priceBasis)}</AppText>
        ) : null}
      </>
    );
  }
  if (event.availability === 'in_stock') {
    return (
      <>
        <AppText weight="semibold" style={styles.primaryLabel}>Back in stock</AppText>
        <AppText weight="bold" style={styles.newPrice}>{formatPrice(event.newPriceMinor, event.currency, event.priceBasis)}</AppText>
      </>
    );
  }
  if (event.priceDirection === 'first') {
    return (
      <>
        <AppText weight="semibold" style={styles.primaryLabel}>Started tracking</AppText>
        <AppText muted style={styles.arrow}>·</AppText>
        <AppText weight="bold" style={styles.newPrice}>{formatPrice(event.newPriceMinor, event.currency, event.priceBasis)}</AppText>
      </>
    );
  }
  return (
    <>
      {event.previousPriceMinor !== undefined ? (
        <AppText muted style={styles.oldPrice}>{formatPrice(event.previousPriceMinor, event.currency, event.priceBasis)}</AppText>
      ) : null}
      <AppText muted style={styles.arrow}>→</AppText>
      <AppText
        weight="bold"
        style={[styles.newPrice, event.priceDirection === 'down' && styles.priceDown, event.priceDirection === 'up' && styles.priceUp]}
      >
        {formatPrice(event.newPriceMinor, event.currency, event.priceBasis)}
      </AppText>
    </>
  );
}

function statusBadge(event: ActivityEvent) {
  if (event.availability) { return null; }
  if (event.priceDirection === 'first') {
    return <View style={[styles.badge, styles.badgePrimary]}><AppText weight="semibold" style={styles.badgePrimaryText}>New</AppText></View>;
  }
  const delta = deltaBadgeText(event);
  if (!delta) { return null; }
  return <PriceDirectionBadge direction={event.priceDirection === 'down' ? 'down' : 'up'} text={delta} />;
}

function eventLabel(event: ActivityEvent, meta: string): string {
  const title = event.productTitle;
  if (event.availability === 'out_of_stock') {
    const price = event.previousPriceMinor !== undefined ? formatPrice(event.previousPriceMinor, event.currency, event.priceBasis) : undefined;
    return [title, 'out of stock', price ? `last ${price}` : undefined, meta].filter(Boolean).join(', ');
  }
  if (event.availability === 'in_stock') {
    return [title, 'back in stock', formatPrice(event.newPriceMinor, event.currency, event.priceBasis), meta].filter(Boolean).join(', ');
  }
  if (event.priceDirection === 'first') {
    return [title, 'started tracking', formatPrice(event.newPriceMinor, event.currency, event.priceBasis), meta].filter(Boolean).join(', ');
  }
  const oldPrice = event.previousPriceMinor !== undefined ? formatPrice(event.previousPriceMinor, event.currency, event.priceBasis) : undefined;
  return [
    title,
    oldPrice ? `${oldPrice} to ${formatPrice(event.newPriceMinor, event.currency, event.priceBasis)}` : formatPrice(event.newPriceMinor, event.currency, event.priceBasis),
    deltaLabel(event),
    meta
  ].filter(Boolean).join(', ');
}

export function ActivityList({ events, productsById, onOpenProduct, now }: ActivityListProps) {
  const groups = groupActivityEventsByDay(events, now);
  if (!groups.length) { return null; }

  return (
    <View style={styles.container}>
      {groups.map((group) => (
        <View key={group.key} style={styles.group}>
          <View
            accessible
            accessibilityRole="header"
            accessibilityLabel={`${group.label}, ${group.count} ${group.count === 1 ? 'change' : 'changes'}`}
            style={styles.dayHeader}
          >
            <AppText weight="semibold" style={styles.dayLabel}>{group.label}</AppText>
            <AppText muted style={styles.dayCount}>{group.count} {group.count === 1 ? 'change' : 'changes'}</AppText>
          </View>
          <Surface padding="none" style={styles.dayCard}>
            {group.events.map((event, index) => {
              const product = productsById.get(event.trackedProductId);
              const exists = Boolean(product);
              const meta = [
                product ? getSiteByKey(product.siteKey).shortName : undefined,
                snapshotSourceLabel(event.source),
                formatActivityTime(event.checkedAt)
              ].filter(Boolean).join(' · ');
              const label = `${eventLabel(event, meta)}${exists ? ', open product' : ', product removed'}`;

              return (
                <View key={event.id}>
                  {index > 0 ? <View style={styles.divider} /> : null}
                  <Pressable
                    accessibilityRole={exists ? 'button' : undefined}
                    accessibilityLabel={label}
                    disabled={!exists}
                    onPress={() => { if (exists) { onOpenProduct(event.trackedProductId); } }}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  >
                    {event.productImageUrl ? (
                      <Image source={{ uri: event.productImageUrl }} style={styles.thumb} resizeMode="contain" />
                    ) : (
                      <View style={styles.thumbPlaceholder}>
                        <ImageOff size={18} color={colors.textMuted} />
                      </View>
                    )}
                    <View style={styles.body}>
                      <AppText weight="semibold" numberOfLines={2} style={styles.title}>{event.productTitle}</AppText>
                      <View style={styles.priceRow}>
                        <View style={styles.priceContent}>{priceLine(event)}</View>
                        {statusBadge(event)}
                      </View>
                      <AppText muted style={styles.meta}>
                        {meta}{exists ? '' : ' · Product removed'}
                      </AppText>
                    </View>
                    {exists ? <ChevronRight size={18} color={colors.textSoft} /> : null}
                  </Pressable>
                </View>
              );
            })}
          </Surface>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 18 },
  group: { gap: 2 },
  dayHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingVertical: 8 },
  dayLabel: { fontSize: 15 },
  dayCount: { fontSize: 13 },
  dayCard: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, minHeight: 72 },
  rowPressed: { opacity: 0.7 },
  thumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  thumbPlaceholder: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 15, lineHeight: 20 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceContent: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  oldPrice: { fontSize: 13, textDecorationLine: 'line-through' },
  arrow: { fontSize: 13 },
  newPrice: { fontSize: 16 },
  priceDown: { color: colors.green },
  priceUp: { color: colors.amber },
  primaryLabel: { fontSize: 14, color: colors.primary },
  oosLabel: { fontSize: 14, color: colors.amber },
  meta: { fontSize: 12, lineHeight: 16 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 74 },
  badge: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 5 },
  badgePrimary: { backgroundColor: colors.blueSoft },
  badgePrimaryText: { fontSize: 12, color: colors.primary },
});
