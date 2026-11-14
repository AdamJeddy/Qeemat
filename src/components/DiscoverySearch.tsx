import React, { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { AppText } from './AppText';
import { DiscoveryFilterChip } from './Discovery';
import { buildSearchRequests } from '../domain/discoverySearch';
import type { ProductSearchResult } from '../domain/discoverySearchCatalog';
import type { DiscoveryProductGroup, SiteKey } from '../domain/types';
import { getSiteByKey } from '../domain/sites';
import { formatRelativeTime } from '../domain/dates';
import { colors, radius } from '../theme/theme';

const STORES = [...new Set(buildSearchRequests('products').map((request) => request.siteKey))];
const EXCLUDED: { siteKey: SiteKey; reason: string }[] = [
  { siteKey: 'sharaf_dg', reason: 'Search products could not be verified.' }
];

/** Search progress, per-store narrowing and coverage for the Search tab. */
export function DiscoverySearch({ query, result, groups, busy, retailer, onRetailer }: {
  query: string;
  result?: ProductSearchResult;
  groups: DiscoveryProductGroup[];
  busy: boolean;
  retailer?: SiteKey;
  onRetailer: (site?: SiteKey) => void;
}) {
  const [showCoverage, setShowCoverage] = useState(false);
  const counts = new Map<SiteKey, number>();
  for (const group of groups) {
    for (const siteKey of new Set(group.offers.map((offer) => offer.product.siteKey))) {
      counts.set(siteKey, (counts.get(siteKey) ?? 0) + 1);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <View style={styles.flex} />
        <Pressable accessibilityRole="button" accessibilityLabel="Search coverage" onPress={() => setShowCoverage(true)} style={styles.action}>
          <AppText style={styles.link}>Coverage</AppText>
        </Pressable>
      </View>
      {groups.length || !busy ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          <DiscoveryFilterChip label={`All results (${groups.length})`} selected={!retailer} onPress={() => onRetailer(undefined)} />
          {STORES.filter((site) => counts.has(site)).map((site) => <DiscoveryFilterChip key={site} label={`${getSiteByKey(site).shortName} (${counts.get(site)})`} selected={retailer === site} onPress={() => onRetailer(site === retailer ? undefined : site)} />)}
        </ScrollView>
      ) : null}
      <Modal visible={showCoverage} transparent animationType="slide" onRequestClose={() => setShowCoverage(false)}>
        <View style={styles.backdrop}><SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.statusRow}><AppText weight="bold">Search coverage</AppText><Pressable accessibilityRole="button" accessibilityLabel="Close search coverage" onPress={() => setShowCoverage(false)} style={styles.action}><X size={22} color={colors.text} /></Pressable></View>
          <AppText muted>Stores respond separately. Saved results retain their observed age when a refresh fails.</AppText>
          <FlatList data={STORES} keyExtractor={(site) => site} renderItem={({ item: site }) => {
            const sources = result?.sources.filter((source) => source.request.siteKey === site) ?? [];
            const count = counts.get(site) ?? 0;
            const failed = sources.some((source) => source.status === 'unavailable');
            const pending = sources.some((source) => source.status === 'loading');
            const observed = sources.map((source) => source.observedAt).filter((date): date is string => Boolean(date)).sort()[0];
            return <View style={styles.source}><AppText weight="semibold">{getSiteByKey(site).shortName}</AppText><AppText muted>{!query ? 'Included in search' : !sources.length || pending ? 'Searching…' : failed ? `${count ? `${count} saved products · ` : ''}Some results unavailable` : count ? `${count} ${count === 1 ? 'product' : 'products'} across stores` : 'No title or brand matches in returned results'}</AppText>{observed ? <AppText muted>Observed {formatRelativeTime(observed)}</AppText> : null}</View>;
          }} ListFooterComponent={<View><AppText weight="bold">Not included in search</AppText>{EXCLUDED.map((source) => <View key={source.siteKey} style={styles.source}><AppText>{getSiteByKey(source.siteKey).shortName}</AppText><AppText muted>{source.reason}</AppText></View>)}</View>} />
        </SafeAreaView></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  link: { color: colors.primary },
  rail: { gap: 8 },
  action: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '85%', padding: 16, gap: 12 },
  source: { paddingVertical: 12, gap: 4, borderBottomWidth: 1, borderColor: colors.border }
});
