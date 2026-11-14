import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, ScrollView, StyleSheet, View } from 'react-native';
import { Check, CircleAlert, Clock } from 'lucide-react-native';

import { AppText } from './AppText';
import { SiteIcon } from './SiteIcon';
import { Surface } from './Surface';
import { getSiteByKey } from '../domain/sites';
import type { ProductSearchResult, SearchSourceResult } from '../domain/discoverySearchCatalog';
import type { SiteKey } from '../domain/types';
import { colors, layoutMetrics, radius, spacing } from '../theme/theme';

export type SearchProgressProps = {
  result?: ProductSearchResult;
  storeCount: number;
  busy: boolean;
};

type StoreStatus = 'checking' | 'ready' | 'empty' | 'unavailable';

type StoreProgress = {
  siteKey: SiteKey;
  status: StoreStatus;
  productCount: number;
};

/** Opacity floor for the gentle activity pulse while stores stream in. */
const PULSE_OPACITY = 0.45;
/** Keep the busy bar visible before the first store has finished checking. */
const MIN_BUSY_FILL = 0.06;

/** One status per store, derived from the streaming per-source search responses. */
function storeProgress(result: ProductSearchResult, busy: boolean): StoreProgress[] {
  const sourcesByStore = new Map<SiteKey, SearchSourceResult[]>();
  for (const source of result.sources) {
    const existing = sourcesByStore.get(source.request.siteKey);
    if (existing) {
      existing.push(source);
    } else {
      sourcesByStore.set(source.request.siteKey, [source]);
    }
  }
  return Array.from(sourcesByStore.entries()).map(([siteKey, sources]) => {
    const productCount = new Set(sources.flatMap((source) => source.products.map((product) => product.id))).size;
    const finished = sources.filter((source) => source.status !== 'loading');
    let status: StoreStatus;
    if (sources.some((source) => source.status === 'loading') || (busy && finished.length === 0)) {
      status = 'checking';
    } else if (productCount > 0) {
      status = 'ready';
    } else if (finished.every((source) => source.status === 'empty')) {
      status = 'empty';
    } else {
      status = 'unavailable';
    }
    return { siteKey, status, productCount };
  });
}

function storeCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'store' : 'stores'}`;
}

function storeAccessibilityLabel(store: StoreProgress, shortName: string): string {
  if (store.status === 'checking') {
    return `${shortName}, checking`;
  }
  if (store.status === 'ready') {
    return `${shortName}, ${store.productCount} ${store.productCount === 1 ? 'product' : 'products'}`;
  }
  if (store.status === 'unavailable') {
    return `${shortName}, unavailable`;
  }
  return `${shortName}, no matching products`;
}

function StatusGlyph({ status }: { status: StoreStatus }) {
  if (status === 'checking') {
    return <ActivityIndicator color={colors.primary} size="small" />;
  }
  if (status === 'ready') {
    return <Check color={colors.green} size={14} />;
  }
  if (status === 'unavailable') {
    return <CircleAlert color={colors.amber} size={14} />;
  }
  return <Clock color={colors.textMuted} size={14} />;
}

function StorePill({ store, pulse }: { store: StoreProgress; pulse: Animated.Value }) {
  const site = getSiteByKey(store.siteKey);
  const pulseStyle = { opacity: pulse };
  return (
    <Animated.View
      accessible
      accessibilityLabel={storeAccessibilityLabel(store, site.shortName)}
      style={[styles.pill, store.status === 'unavailable' && styles.pillUnavailable, store.status === 'checking' && pulseStyle]}
    >
      <SiteIcon siteKey={store.siteKey} size={16} />
      <AppText weight="medium" style={styles.pillName}>{site.shortName}</AppText>
      <StatusGlyph status={store.status} />
      {store.status === 'ready' ? <AppText weight="semibold" style={styles.pillCount}>{store.productCount}</AppText> : null}
    </Animated.View>
  );
}

/**
 * Live store-checking progress for a product search. Shown above the result
 * grid so a running query reads as work in progress rather than an empty page.
 */
export function SearchProgress({ result, storeCount, busy }: SearchProgressProps) {
  const fill = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  const starting = busy && !result;
  const pulsing = busy && Boolean(result);
  const stores = useMemo(() => (result ? storeProgress(result, busy) : []), [result, busy]);
  // A failed store finished its check attempt, but only ready and empty stores
  // count as checked, matching the "N of M stores checked" summary.
  const checkedCount = stores.filter((store) => store.status === 'ready' || store.status === 'empty').length;
  const progress = storeCount > 0 ? Math.min(checkedCount / storeCount, 1) : 0;
  const targetProgress = busy ? Math.max(progress, MIN_BUSY_FILL) : progress;

  useEffect(() => {
    const animation = Animated.timing(fill, {
      toValue: targetProgress,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false
    });
    animation.start();
    return () => animation.stop();
  }, [fill, targetProgress]);

  useEffect(() => {
    if (!pulsing) {
      pulse.setValue(1);
      return undefined;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: PULSE_OPACITY, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: false })
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse, pulsing]);

  useEffect(() => {
    if (!starting) {
      sweep.setValue(0);
      return undefined;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(sweep, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(sweep, { toValue: 0, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: false })
    ]));
    animation.start();
    return () => animation.stop();
  }, [starting, sweep]);

  if (!result && !busy) {
    return null;
  }

  const summary = starting
    ? `Starting checks across ${storeCountLabel(storeCount)}…`
    : `${checkedCount} of ${storeCountLabel(storeCount)} checked${busy ? ' · Searching…' : ''}`;
  const determinateFillStyle = {
    width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
    opacity: busy ? pulse : 1
  };
  const indeterminateFillStyle = { width: sweep.interpolate({ inputRange: [0, 1], outputRange: ['18%', '100%'] }) };

  return (
    <Surface variant="muted" padding="sm" radius="md" style={styles.card}>
      <AppText accessibilityLiveRegion="polite" accessibilityRole="header" weight="semibold" style={styles.summary}>{summary}</AppText>
      {starting ? (
        <View style={styles.track}>
          <Animated.View style={[styles.fill, indeterminateFillStyle]} />
        </View>
      ) : (
        <>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, determinateFillStyle]} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail} contentContainerStyle={styles.railContent}>
            {stores.map((store) => <StorePill key={store.siteKey} store={store} pulse={pulse} />)}
          </ScrollView>
        </>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm
  },
  summary: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.text
  },
  track: {
    height: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
    overflow: 'hidden'
  },
  fill: {
    height: '100%',
    borderRadius: radius.sm,
    backgroundColor: colors.primary
  },
  rail: {
    minHeight: layoutMetrics.touchTarget
  },
  railContent: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 30,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  pillUnavailable: {
    backgroundColor: colors.amberSoft,
    borderColor: colors.amberSoft
  },
  pillName: {
    fontSize: 12,
    lineHeight: 16
  },
  pillCount: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.green
  }
});
