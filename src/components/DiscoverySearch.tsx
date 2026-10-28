import React, { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X } from 'lucide-react-native';
import { AppText } from './AppText';
import { DiscoveryFilterChip } from './Discovery';
import { buildSearchRequests, normalizeSearchQuery } from '../domain/discoverySearch';
import type { ProductSearchResult } from '../domain/discoverySearchCatalog';
import type { SiteKey } from '../domain/types';
import { getSiteByKey } from '../domain/sites';
import { formatRelativeTime } from '../domain/dates';
import { colors, radius } from '../theme/theme';

const STORES = [...new Set(buildSearchRequests('products').map((request) => request.siteKey))];
const EXCLUDED: { siteKey: SiteKey; reason: string }[] = [
  { siteKey: 'sharaf_dg', reason: 'Search products could not be verified.' }
];

export function DiscoverySearch({ query, result, busy, retailer, onRetailer, onSearch, onClear }: {
  query: string; result?: ProductSearchResult; busy: boolean; retailer?: SiteKey;
  onRetailer: (site?: SiteKey) => void; onSearch: (query: string) => void; onClear: () => void;
}) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [showCoverage, setShowCoverage] = useState(false);
  useEffect(() => { setInput(query); }, [query]);
  const completed = STORES.filter((site) => {
    const sources = result?.sources.filter((source) => source.request.siteKey === site) ?? [];
    return sources.length && sources.every((source) => source.status !== 'loading');
  }).length;
  function submit() {
    const value = normalizeSearchQuery(input);
    if (!buildSearchRequests(value).length) { setError('Enter at least two letters or numbers.'); return; }
    setError(''); onSearch(value);
  }
  return <View style={styles.container}>
    <View style={styles.inputRow}>
      <TextInput accessibilityLabel="Search products across stores" value={input} onChangeText={setInput} onSubmitEditing={submit} returnKeyType="search" maxLength={120} placeholder="Search products across stores" placeholderTextColor={colors.textSoft} style={styles.input} />
      <Pressable accessibilityRole="button" accessibilityLabel="Search products" onPress={submit} style={styles.action}><Search size={21} color={colors.primary} /></Pressable>
      {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear product search" onPress={() => { setInput(''); setError(''); onClear(); }} style={styles.action}><X size={21} color={colors.textMuted} /></Pressable> : null}
    </View>
    {error ? <AppText accessibilityLiveRegion="polite">{error}</AppText> : null}
    <View style={styles.statusRow}>
      <AppText muted accessibilityLiveRegion="polite" style={styles.flex}>{query ? `${completed} of ${STORES.length} stores checked${busy ? ' · Searching…' : ''}` : `Search by product name or model across ${STORES.length} stores.`}</AppText>
      <Pressable accessibilityRole="button" onPress={() => setShowCoverage(true)} style={styles.action}><AppText style={styles.link}>Coverage</AppText></Pressable>
    </View>
    {query ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      <DiscoveryFilterChip label="All search stores" selected={!retailer} onPress={() => onRetailer(undefined)} />
      {STORES.map((site) => <DiscoveryFilterChip key={site} label={getSiteByKey(site).shortName} selected={retailer === site} onPress={() => onRetailer(site === retailer ? undefined : site)} />)}
    </ScrollView> : null}
    <Modal visible={showCoverage} transparent animationType="slide" onRequestClose={() => setShowCoverage(false)}>
      <View style={styles.backdrop}><SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.statusRow}><AppText weight="bold">Search coverage</AppText><Pressable accessibilityRole="button" accessibilityLabel="Close search coverage" onPress={() => setShowCoverage(false)} style={styles.action}><X size={22} color={colors.text} /></Pressable></View>
        <AppText muted>Stores respond separately. Saved results retain their observed age when a refresh fails.</AppText>
        <FlatList data={STORES} keyExtractor={(site) => site} renderItem={({ item: site }) => {
          const sources = result?.sources.filter((source) => source.request.siteKey === site) ?? [];
          const count = new Set(sources.flatMap((source) => source.products.map((product) => product.id))).size;
          const failed = sources.some((source) => source.status === 'unavailable');
          const pending = sources.some((source) => source.status === 'loading');
          const observed = sources.map((source) => source.observedAt).filter((date): date is string => Boolean(date)).sort()[0];
          return <View style={styles.source}><AppText weight="semibold">{getSiteByKey(site).shortName}</AppText><AppText muted>{!query ? 'Included in search' : !sources.length || pending ? 'Searching…' : failed ? `${count ? `${count} saved matches · ` : ''}Some results unavailable` : count ? `${count} matches` : 'No title or brand matches in returned results'}</AppText>{observed ? <AppText muted>Observed {formatRelativeTime(observed)}</AppText> : null}</View>;
        }} ListFooterComponent={<View><AppText weight="bold">Not included in search</AppText>{EXCLUDED.map((source) => <View key={source.siteKey} style={styles.source}><AppText>{getSiteByKey(source.siteKey).shortName}</AppText><AppText muted>{source.reason}</AppText></View>)}</View>} />
      </SafeAreaView></View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 8 }, inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  input: { flex: 1, minHeight: 48, paddingHorizontal: 12, color: colors.text, fontSize: 15 }, action: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, flex: { flex: 1 }, link: { color: colors.primary }, rail: { gap: 8 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim }, sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '85%', padding: 16, gap: 12 },
  source: { paddingVertical: 12, gap: 4, borderBottomWidth: 1, borderColor: colors.border }
});
