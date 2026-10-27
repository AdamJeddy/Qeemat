import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ExternalLink, X } from 'lucide-react-native';
import { AppText } from './AppText';
import { DiscoveryFilterChip } from './Discovery';
import { DiscoveryCollection, DISCOVERY_CATEGORY_LABELS, discoveryCollectionPageUrl } from '../domain/discovery';
import { DISCOVERY_CATEGORY_GROUPS } from '../domain/discoveryCategories';
import { DISCOVERY_SOURCE_MAPS } from '../domain/discoverySources';
import { DiscoverySourceStatus } from '../domain/discoveryCatalog';
import { DiscoveryCategory, SiteKey } from '../domain/types';
import { getSiteByKey, SUPPORTED_SITES } from '../domain/sites';
import { formatRelativeTime } from '../domain/dates';
import { colors, radius } from '../theme/theme';

type Props = {
  visible: boolean;
  sources?: DiscoverySourceStatus[];
  onClose: () => void;
  onCategory: (category: DiscoveryCategory) => void;
  onRetailer: (site: SiteKey) => void;
  onCollection: (source: DiscoveryCollection) => void;
};

/** Virtualized source browser: every mapped PLP is available without fetching it first. */
export function DiscoveryBrowseSheet({ visible, sources, onClose, onCategory, onRetailer, onCollection }: Props) {
  const [mode, setMode] = useState<'categories' | 'retailers' | 'collections'>('categories');
  const [site, setSite] = useState<SiteKey>();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string>();
  useEffect(() => { if (visible) { setQuery(''); setGroup(undefined); } }, [visible]);
  const states = useMemo(() => new Map(sources?.map((source) => [source.id, source])), [sources]);
  const search = query.trim().toLocaleLowerCase();
  const collections = useMemo(() => DISCOVERY_SOURCE_MAPS.filter((source) =>
    (!site || source.siteKey === site) && (!search || [source.label, getSiteByKey(source.siteKey).displayName, ...(source.path ?? [])].join(' ').toLocaleLowerCase().includes(search))), [search, site]);

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={styles.sheet}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close browsing" onPress={onClose} style={styles.iconButton}><X size={22} color={colors.text} /></Pressable>
        <AppText weight="bold" style={styles.title}>Explore departments</AppText>
      </View>
      <View style={styles.controls}>
        <View style={styles.chips}>{(['categories', 'retailers', 'collections'] as const).map((item) => <DiscoveryFilterChip key={item} label={item === 'collections' ? 'All listings' : item === 'categories' ? 'Interests' : 'Retailers'} selected={mode === item} onPress={() => { setMode(item); setQuery(''); setSite(undefined); }} />)}</View>
        <TextInput accessibilityLabel="Search interests, retailers or listings" placeholder={mode === 'collections' ? 'Search category or listing…' : mode === 'retailers' ? 'Search retailers…' : 'Search interests…'} placeholderTextColor={colors.textSoft} value={query} onChangeText={setQuery} style={styles.search} />
      </View>
      {mode === 'categories' ? <ScrollView contentContainerStyle={styles.content}>
        <AppText muted>Choose an interest to update your current feed. Your saved preferences stay available in Personalise.</AppText>
        {DISCOVERY_CATEGORY_GROUPS.map((item) => {
          const categories = item.categories.filter((category) => !search || DISCOVERY_CATEGORY_LABELS[category].toLowerCase().includes(search) || item.label.toLowerCase().includes(search));
          if (!categories.length) { return null; }
          return <View key={item.id} style={styles.group}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: group === item.id || Boolean(search) }} onPress={() => setGroup(group === item.id ? undefined : item.id)} style={styles.groupHeading}><AppText weight="bold">{item.label}</AppText><AppText muted>{group === item.id ? '−' : '+'}</AppText></Pressable>
            {group === item.id || search ? <View style={styles.chips}>{categories.map((category) => <DiscoveryFilterChip key={category} label={DISCOVERY_CATEGORY_LABELS[category]} selected={false} onPress={() => onCategory(category)} />)}</View> : <AppText muted>{categories.map((category) => DISCOVERY_CATEGORY_LABELS[category]).join(' · ')}</AppText>}
          </View>;
        })}
      </ScrollView> : mode === 'retailers' ? <FlatList data={SUPPORTED_SITES.filter((retailer) => !search || retailer.displayName.toLowerCase().includes(search))} keyExtractor={(item) => item.key} contentContainerStyle={styles.content} renderItem={({ item }) => <View style={styles.row}>
        <AppText weight="bold">{item.displayName}</AppText>
        <AppText muted>{DISCOVERY_SOURCE_MAPS.filter((source) => source.siteKey === item.key).length} mapped listings{item.key === 'brands_for_less' ? ' · extraction under investigation' : ''}</AppText>
        <View style={styles.chips}><DiscoveryFilterChip label="Browse products" selected={false} onPress={() => onRetailer(item.key)} /><DiscoveryFilterChip label="Choose a listing" selected={false} onPress={() => { setSite(item.key); setMode('collections'); setQuery(''); }} /></View>
      </View>} /> : <>
        {site ? <View style={styles.controls}><Pressable accessibilityRole="button" onPress={() => setSite(undefined)} style={styles.chips}><ArrowLeft size={18} color={colors.primary} /><AppText>{getSiteByKey(site).displayName} · Show all retailers</AppText></Pressable></View> : null}
        <FlatList data={collections} keyExtractor={(item) => item.id} initialNumToRender={12} windowSize={5} contentContainerStyle={styles.content} ListHeaderComponent={<AppText muted>{collections.length} mapped listings. Products load when selected; availability varies by retailer. Prices use the retailer’s default delivery context.</AppText>} ListEmptyComponent={<AppText>No matching listings. Try another search.</AppText>} renderItem={({ item }) => {
          const state = states.get(item.id);
          const pageUrl = discoveryCollectionPageUrl(item);
          return <View style={styles.row}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Browse ${item.label} at ${getSiteByKey(item.siteKey).shortName}`} onPress={() => onCollection(item)} style={styles.listingButton}>
              <AppText muted>{getSiteByKey(item.siteKey).shortName} · {DISCOVERY_CATEGORY_LABELS[item.category]}</AppText>
              <AppText weight="bold">{item.label}</AppText>
              <AppText muted>{(item.path ?? []).join(' › ')}</AppText>
              <AppText muted>{state?.failed ? state.count ? `Refresh failed · ${state.count} saved products` : 'Could not load products · tap to retry' : state?.count ? `${state.count} products · ${formatRelativeTime(state.fetchedAt)}` : 'Not loaded on this visit'}</AppText>
              <AppText style={styles.link}>Browse this listing</AppText>
            </Pressable>
            <Pressable accessibilityRole="link" accessibilityLabel={`Review source URL for ${item.label}`} onPress={() => Linking.openURL(pageUrl).catch(() => undefined)} style={styles.sourceLink}><ExternalLink size={15} color={colors.primary} /><AppText style={styles.url}>{pageUrl}</AppText></Pressable>
          </View>;
        }} />
      </>}
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, flex: 1 },
  controls: { padding: 16, gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  search: { minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, color: colors.text, backgroundColor: colors.surface },
  content: { padding: 16, gap: 16 },
  group: { padding: 16, gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  groupHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  row: { padding: 16, gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  listingButton: { gap: 6, paddingVertical: 4 },
  link: { color: colors.primary, marginTop: 4 },
  sourceLink: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingTop: 8 },
  url: { color: colors.primary, fontSize: 12, flex: 1 }
});
