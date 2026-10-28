import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, BookOpen, ChevronDown, ChevronRight, Dumbbell, ExternalLink, Heart, House, Search, Shirt, ShoppingBasket, Smartphone, Sparkles, X } from 'lucide-react-native';
import { AppText } from './AppText';
import { SiteIcon } from './SiteIcon';
import { DiscoveryCollection, DISCOVERY_CATEGORY_LABELS, discoveryCollectionPageUrl, discoverySourceUrl } from '../domain/discovery';
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

const GROUP_ICONS = { style: Shirt, beauty: Sparkles, technology: Smartphone, home: House, media: BookOpen, everyday: Heart, groceries: ShoppingBasket, active: Dumbbell };

/** Browsing a department updates the feed; retailer listings remain available on demand. */
export function DiscoveryBrowseSheet({ visible, sources, onClose, onCategory, onRetailer, onCollection }: Props) {
  const [mode, setMode] = useState<'departments' | 'stores' | 'listings'>('departments');
  const [site, setSite] = useState<SiteKey>();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string>();
  const [details, setDetails] = useState<string>();
  useEffect(() => {
    if (visible) { setMode('departments'); setSite(undefined); setQuery(''); setGroup(undefined); setDetails(undefined); }
  }, [visible]);
  const states = useMemo(() => new Map(sources?.map((source) => [source.id, source])), [sources]);
  const search = query.trim().toLocaleLowerCase();
  const selectedGroup = DISCOVERY_CATEGORY_GROUPS.find((item) => item.id === group);
  const categories = DISCOVERY_CATEGORY_GROUPS.flatMap((item) =>
    (!selectedGroup || item.id === selectedGroup.id) ? item.categories.filter((category) =>
      !search || DISCOVERY_CATEGORY_LABELS[category].toLowerCase().includes(search) || item.label.toLowerCase().includes(search)) : []);
  const collections = useMemo(() => DISCOVERY_SOURCE_MAPS.filter((source) =>
    (!site || source.siteKey === site) && (!search || [source.label, source.url, getSiteByKey(source.siteKey).displayName, ...(source.path ?? [])].join(' ').toLocaleLowerCase().includes(search))), [search, site]);
  const stores = SUPPORTED_SITES.filter((retailer) => !search || retailer.displayName.toLowerCase().includes(search));

  function switchMode(next: 'departments' | 'stores') {
    setMode(next); setSite(undefined); setGroup(undefined); setQuery(''); setDetails(undefined);
  }
  function back() {
    if (mode === 'listings') { switchMode('stores'); }
    else if (group) { setGroup(undefined); setQuery(''); }
    else { onClose(); }
  }

  return <Modal visible={visible} animationType="slide" onRequestClose={back}>
    <SafeAreaView style={styles.sheet}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={mode === 'listings' || group ? 'Go back' : 'Close browsing'} onPress={back} style={styles.iconButton}>
          {mode === 'listings' || group ? <ArrowLeft size={22} color={colors.text} /> : <X size={22} color={colors.text} />}
        </Pressable>
        <AppText weight="bold" style={styles.title}>{mode === 'listings' ? site ? getSiteByKey(site).displayName : 'All store categories' : selectedGroup?.label ?? 'Explore'}</AppText>
      </View>

      {mode !== 'listings' && !group ? <View style={styles.tabs}>
        {(['departments', 'stores'] as const).map((tab) => <Pressable key={tab} accessibilityRole="tab" accessibilityLabel={tab === 'departments' ? 'Departments' : 'Stores'} accessibilityState={{ selected: mode === tab }} onPress={() => switchMode(tab)} style={[styles.tab, mode === tab && styles.tabSelected]}><AppText weight="semibold" style={mode === tab ? styles.tabTextSelected : undefined}>{tab === 'departments' ? 'Departments' : 'Stores'}</AppText></Pressable>)}
      </View> : null}

      <View style={styles.searchWrap}>
        <Search size={19} color={colors.textMuted} />
        <TextInput accessibilityLabel={mode === 'departments' ? 'Search departments' : mode === 'stores' ? 'Search stores' : 'Search store categories'} placeholder={mode === 'departments' ? 'Search departments' : mode === 'stores' ? 'Search stores' : 'Search store categories'} placeholderTextColor={colors.textSoft} value={query} onChangeText={setQuery} style={styles.search} />
        {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.clear}><X size={18} color={colors.textMuted} /></Pressable> : null}
      </View>

      {mode === 'departments' ? <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!group && !search ? <>
          <AppText muted style={styles.intro}>Choose a department to see products in your feed.</AppText>
          <View style={styles.list}>
            {DISCOVERY_CATEGORY_GROUPS.map((item) => {
              const Icon = GROUP_ICONS[item.id];
              return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Browse ${item.label} departments`} onPress={() => { setGroup(item.id); setQuery(''); }} style={styles.groupRow}>
                <View style={styles.groupIcon}><Icon size={20} color={colors.primary} /></View>
                <View style={styles.flex}><AppText weight="semibold">{item.label}</AppText><AppText muted numberOfLines={1} style={styles.caption}>{item.categories.slice(0, 3).map((category) => DISCOVERY_CATEGORY_LABELS[category]).join(' · ')}</AppText></View>
                <ChevronRight size={19} color={colors.textMuted} />
              </Pressable>;
            })}
          </View>
        </> : <>
          <AppText muted style={styles.intro}>{group ? 'Choose a department to explore.' : 'Choose a matching department.'}</AppText>
          {categories.length ? <View style={styles.list}>{categories.map((category) => <Pressable key={category} accessibilityRole="button" accessibilityLabel={`Browse ${DISCOVERY_CATEGORY_LABELS[category]}`} onPress={() => onCategory(category)} style={styles.categoryRow}><AppText weight="semibold" style={styles.flex}>{DISCOVERY_CATEGORY_LABELS[category]}</AppText><ChevronRight size={19} color={colors.textMuted} /></Pressable>)}</View> : <AppText muted>No departments found. Try a different search.</AppText>}
        </>}
      </ScrollView> : mode === 'stores' ? <FlatList data={stores} keyExtractor={(item) => item.key} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} ListHeaderComponent={<View><AppText muted style={styles.intro}>Choose a store or explore its categories.</AppText><Pressable accessibilityRole="button" onPress={() => { setMode('listings'); setSite(undefined); setQuery(''); }} style={styles.allListings}><AppText style={styles.link}>Browse all store categories</AppText><ChevronRight size={18} color={colors.primary} /></Pressable></View>} ListEmptyComponent={<AppText muted>No stores found. Try a different search.</AppText>} renderItem={({ item }) => <View style={styles.storeRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Browse products at ${item.displayName}`} onPress={() => onRetailer(item.key)} style={styles.storeMain}><SiteIcon siteKey={item.key} size={30} /><AppText weight="semibold" style={styles.flex}>{item.displayName}</AppText><ChevronRight size={19} color={colors.textMuted} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Choose categories at ${item.displayName}`} onPress={() => { setSite(item.key); setMode('listings'); setQuery(''); }} style={styles.storeCategories}><AppText style={styles.link}>Shop by category</AppText></Pressable>
      </View>} /> : <FlatList data={collections} keyExtractor={(item) => item.id} initialNumToRender={12} windowSize={5} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} ListHeaderComponent={<AppText muted style={styles.intro}>Choose a category to see its products. Availability can vary by store.</AppText>} ListEmptyComponent={<AppText muted>No categories found. Try a different search.</AppText>} renderItem={({ item }) => {
        const state = states.get(item.id);
        const pageUrl = discoveryCollectionPageUrl(item);
        const isOpen = details === item.id;
        return <View style={styles.listingRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Browse ${item.label} at ${getSiteByKey(item.siteKey).shortName}`} onPress={() => onCollection(item)} style={styles.listingMain}>
            <View style={styles.flex}><AppText weight="semibold">{item.label}</AppText><AppText muted numberOfLines={2} style={styles.caption}>{[site ? undefined : getSiteByKey(item.siteKey).shortName, DISCOVERY_CATEGORY_LABELS[item.category], ...(item.path ?? []).slice(-2)].filter(Boolean).join(' · ')}</AppText></View><ChevronRight size={19} color={colors.textMuted} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Source details for ${item.label} at ${getSiteByKey(item.siteKey).shortName}`} accessibilityState={{ expanded: isOpen }} onPress={() => setDetails(isOpen ? undefined : item.id)} style={styles.detailsToggle}><AppText style={styles.link}>Source details</AppText><ChevronDown size={16} color={colors.primary} /></Pressable>
          {isOpen ? <View style={styles.details}>
            {(item.path ?? []).length ? <AppText muted>{item.path?.join(' › ')}</AppText> : null}
            <AppText muted>{state?.failed ? state.count ? `Refresh failed · ${state.count} saved products` : 'Could not load products. Use Refresh in the feed to retry.' : state?.count ? `${state.count} products · ${formatRelativeTime(state.fetchedAt)}` : 'Products load when you open this category.'}</AppText>
            <Pressable accessibilityRole="link" accessibilityLabel={`Review source URL for ${item.label}`} onPress={() => Linking.openURL(pageUrl).catch(() => undefined)} style={styles.sourceLink}><ExternalLink size={15} color={colors.primary} /><AppText style={styles.url}>{pageUrl}</AppText></Pressable>
            {discoverySourceUrl(item) !== pageUrl ? <AppText selectable muted>Fetch URL: {discoverySourceUrl(item)}</AppText> : null}
          </View> : null}
        </View>;
      }} />}
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, flex: 1 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: colors.surfaceMuted, padding: 4, borderRadius: radius.md },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  tabSelected: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabTextSelected: { color: colors.primary },
  searchWrap: { marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.surface },
  search: { flex: 1, minHeight: 48, paddingVertical: 8, color: colors.text },
  clear: { minWidth: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  intro: { fontSize: 13, lineHeight: 19 },
  list: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  groupRow: { flexDirection: 'row', alignItems: 'center', minHeight: 68, gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  groupIcon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  caption: { fontSize: 12, marginTop: 2 },
  categoryRow: { minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  storeRow: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  storeMain: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 12, gap: 12 },
  storeCategories: { minHeight: 44, paddingHorizontal: 54, justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  allListings: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  listingRow: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12 },
  listingMain: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 8, paddingTop: 8 },
  detailsToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  details: { gap: 8, paddingBottom: 12 },
  link: { color: colors.primary, fontSize: 13 },
  sourceLink: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 44 },
  url: { color: colors.primary, fontSize: 12, flex: 1 }
});
