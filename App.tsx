import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Easing,
  Image,
  Keyboard,
  Linking,
  Modal,
  NativeEventEmitter,
  NativeModules,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  TextInput,
  useWindowDimensions,
  View
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  Archive,
  ArrowLeft,
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock,
  Copy,
  FolderInput,
  Link2,
  PackageX,
  Pause,
  Plus,
  RefreshCcw,
  Settings as SettingsIcon,
  SlidersHorizontal,
  SquareStack,
  Sparkles,
  Store,
  Trash2,
  TrendingDown,
  TrendingUp,
  X
} from 'lucide-react-native';

import { AppText } from './src/components/AppText';
import { OptionGroup } from './src/components/OptionGroup';
import { SiteIcon } from './src/components/SiteIcon';
import { PriceChart } from './src/components/PriceChart';
import { PrimaryButton } from './src/components/PrimaryButton';
import { ProductCard } from './src/components/ProductCard';
import { StatusPill } from './src/components/StatusPill';
import { VariantSelector } from './src/components/VariantSelector';
import {
  DiscoveryFilterChip,
  DiscoveryPreferencesSheet,
  DiscoveryProductGrid,
  DiscoverySetupCard,
  EmptyDiscovery
} from './src/components/Discovery';
import {
  getBackgroundStatus,
  BackgroundStatus,
  markBackgroundSchedule,
  setBackgroundPreferredHour
} from './src/domain/backgroundStatus';
import {
  createTrackedProduct,
  deleteAllLocalData,
  deleteTrackedProduct,
  deleteTrackedProducts,
  getProductWithSnapshots,
  getTrackedProduct,
  initializeDatabase,
  listActivityEvents,
  listTrackedProducts,
  updateTrackedProducts,
  updateTrackingSettings
} from './src/data/database';
import {
  clearDiscoveryData,
  dismissDiscoveryProduct,
  getDiscoveryPreferences,
  markDiscoveryProductsSeen,
  saveDiscoveryPreferences
} from './src/data/discovery';
import { runBackgroundCheckOnce, scheduleBackgroundChecks, checkBatteryOptimizationExempt, requestBatteryOptimizationExemption, openAppSystemSettings } from './src/domain/backgroundScheduler';
import { checkAllActiveProducts, checkProductById } from './src/domain/checker';
import { availableCheckPreferences, formatRelativeTime, formatSnapshotTime } from './src/domain/dates';
import { getOnboardingState, markOnboardingCompleted } from './src/domain/onboarding';
import { ensureNotificationPermission, openNotificationSettings } from './src/domain/notifications';
import { fetchAndParseProduct, fetchTheDealVariantForSaving } from './src/domain/parser';
import { calculatePriceInsights } from './src/domain/priceInsights';
import { formatPrice, parseTargetPriceInput } from './src/domain/price';
import { cleanUrl, detectSharedUrl, detectSupportedSite, getSiteByKey, normalizeUrl, SUPPORTED_SITES } from './src/domain/sites';
import { ActivityEvent, AlertMode, CheckPreference, DiscoveryCategory, DiscoveryFilter, DiscoveryPreferences, DiscoveryProduct, ParsedProduct, PriceSnapshot, ProductWithSnapshots, SnapshotSource, TrackedProduct } from './src/domain/types';
import { colors, radius, shadow } from './src/theme/theme';
import { isCompactLayout } from './src/theme/layout';
import {
  filterWatchlistProducts,
  getWatchlistFolders,
  getWatchlistSites,
  sortWatchlistProducts,
  WatchlistSort,
  WatchlistStoreFilter
} from './src/domain/watchlist';
import { resolveSelectedVariant, toVariantSelection, updateSelectedVariantAttributes, VariantAttributes } from './src/domain/variants';
import {
  buildDiscoverySections,
  DISCOVERY_CATEGORY_LABELS,
  filterDiscoveryProducts
} from './src/domain/discovery';
import { loadDiscoveryCatalog } from './src/domain/discoveryCatalog';

type TabKey = 'watchlist' | 'opportunities' | 'activity' | 'settings';
type Route =
  | { name: 'tabs'; tab: TabKey }
  | { name: 'add'; initialUrl?: string; shareEventId?: number; returnTab?: TabKey }
  | { name: 'listing'; title: string; filter?: DiscoveryFilter; withinBudget?: boolean }
  | { name: 'detail'; id: number }
  | { name: 'trackingSettings'; id: number };

const CHECK_OPTIONS: { value: CheckPreference; label: string; description: string }[] = [
  { value: 'daily', label: 'Daily', description: 'Once a day' },
  { value: 'every_3_days', label: 'Every 3 days', description: 'Once every 3 days' },
  { value: 'weekly', label: 'Weekly', description: 'Once a week' }
];

const ALERT_OPTIONS: { value: AlertMode; label: string; description: string }[] = [
  { value: 'price_drop', label: 'Price drops', description: 'Default' },
  { value: 'any_change', label: 'Any change', description: 'More alerts' },
  { value: 'target_price', label: 'Target', description: 'Below price' }
];

const WATCHLIST_SORT_OPTIONS: { value: WatchlistSort; label: string }[] = [
  { value: 'recently_updated', label: 'Recent' },
  { value: 'lowest_price', label: 'Lowest price' },
  { value: 'largest_drop', label: 'Biggest drop' },
  { value: 'closest_to_target', label: 'Closest target' },
  { value: 'name', label: 'Name' }
];

const BACKGROUND_TIME_PRESETS = [
  { label: 'Morning', hour: 9 },
  { label: 'Afternoon', hour: 14 },
  { label: 'Evening', hour: 20 }
];

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'tabs', tab: 'opportunities' });
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const shareEventId = useRef(0);

  useEffect(() => {
    let active = true;

    (async () => {
      await initializeDatabase();
      const [backgroundStatus, onboarding] = await Promise.all([
        getBackgroundStatus(),
        getOnboardingState()
      ]);

      if (!onboarding.completed) {
        if (active) {
          setShowOnboarding(true);
        }
      }

      const scheduled = await scheduleBackgroundChecks(backgroundStatus.preferredHour).catch(() => false);
      if (scheduled) {
        await markBackgroundSchedule(backgroundStatus.preferredHour);
      }
    })().finally(() => {
      if (active) {
        setReady(true);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const backRoute = getBackRoute(route);
      if (!backRoute) {
        return false;
      }

      setRoute(backRoute);
      return true;
    });

    return () => subscription.remove();
  }, [route]);

  useEffect(() => {
    const shareModule = NativeModules.QeematShare;
    if (!shareModule) {
      return;
    }

    const openSharedProduct = (sharedText: string) => {
      const sharedUrl = detectSharedUrl(sharedText);
      if (sharedUrl) {
        setRoute({ name: 'add', initialUrl: sharedUrl, shareEventId: ++shareEventId.current });
      }
    };

    shareModule.getInitialSharedText().then(openSharedProduct).catch(() => undefined);
    const subscription = new NativeEventEmitter(shareModule).addListener('qeematShareReceived', openSharedProduct);

    return () => subscription.remove();
  }, []);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <SafeAreaView style={styles.app}>
        {route.name === 'tabs' ? <TabsScreen tab={route.tab} navigate={setRoute} /> : null}
        {route.name === 'add' ? <AddScreen initialUrl={route.initialUrl} shareEventId={route.shareEventId} returnTab={route.returnTab} navigate={setRoute} /> : null}
        {route.name === 'listing' ? <DiscoveryListingScreen title={route.title} initialFilter={route.filter} initialWithinBudget={route.withinBudget} navigate={setRoute} /> : null}
        {route.name === 'detail' ? <DetailScreen productId={route.id} navigate={setRoute} /> : null}
        {route.name === 'trackingSettings' ? <TrackingSettingsScreen productId={route.id} navigate={setRoute} /> : null}
        {showOnboarding ? <OnboardingOverlay onClose={() => setShowOnboarding(false)} /> : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function OnboardingOverlay({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  async function handleNotifications() {
    setLoading(true);
    await ensureNotificationPermission(true).catch(() => false);
    setLoading(false);
    setStep(1);
  }

  async function skipNotifications() {
    setStep(1);
  }

  async function handleBattery() {
    setLoading(true);
    const exempt = await checkBatteryOptimizationExempt().catch(() => false);
    if (exempt) {
      setLoading(false);
      await markOnboardingCompleted();
      onClose();
      return;
    }
    await openAppSystemSettings().catch(() => false);
    setLoading(false);
    Alert.alert(
      'Battery optimization',
      'Find Qeemat in the list and set it to "Don\'t optimize".\n\nThen tap "Done" below.',
      [{ text: 'Done', onPress: async () => {
        await markOnboardingCompleted();
        onClose();
      }}]
    );
  }

  async function skipBattery() {
    await markOnboardingCompleted();
    onClose();
  }

  return (
    <View style={onboardingStyles.overlay}>
      <View style={onboardingStyles.card}>
        <View style={onboardingStyles.iconCircle}>
          {step === 0 ? <Bell size={28} color={colors.primary} /> : <SettingsIcon size={28} color={colors.primary} />}
        </View>
        <AppText weight="bold" style={onboardingStyles.title}>
          {step === 0 ? 'Stay on top of prices' : 'Run checks in background'}
        </AppText>
        <AppText muted style={onboardingStyles.body}>
          {step === 0
            ? 'Get notified when a tracked product drops in price or hits your target.'
            : 'Android can block checks when the app is closed. Disable battery restrictions so Qeemat runs daily.'}
        </AppText>
        <View style={onboardingStyles.dots}>
          <View style={[onboardingStyles.dot, step === 0 && onboardingStyles.dotActive]} />
          <View style={[onboardingStyles.dot, step === 1 && onboardingStyles.dotActive]} />
        </View>
        {step === 0 ? (
          <View style={onboardingStyles.actions}>
            <PrimaryButton label="Enable notifications" onPress={handleNotifications} loading={loading} />
            <Pressable onPress={skipNotifications} disabled={loading} style={({ pressed }) => [onboardingStyles.skipBtn, pressed && { opacity: 0.6 }]}>
              <AppText style={onboardingStyles.skipLabel}>Skip</AppText>
            </Pressable>
          </View>
        ) : (
          <View style={onboardingStyles.actions}>
            <PrimaryButton label="Open system settings" onPress={handleBattery} loading={loading} />
            <Pressable onPress={skipBattery} disabled={loading} style={({ pressed }) => [onboardingStyles.skipBtn, pressed && { opacity: 0.6 }]}>
              <AppText style={onboardingStyles.skipLabel}>Skip</AppText>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function getBackRoute(route: Route): Route | undefined {
  if (route.name === 'add') {
    return { name: 'tabs', tab: route.returnTab ?? 'watchlist' };
  }

  if (route.name === 'listing') {
    return { name: 'tabs', tab: 'opportunities' };
  }

  if (route.name === 'detail') {
    return { name: 'tabs', tab: 'watchlist' };
  }

  if (route.name === 'trackingSettings') {
    return { name: 'detail', id: route.id };
  }

  return undefined;
}

function TabsScreen({ tab, navigate }: { tab: TabKey; navigate: (route: Route) => void }) {
  return (
    <View style={styles.app}>
      {tab === 'watchlist' ? <WatchlistScreen navigate={navigate} /> : null}
      {tab === 'opportunities' ? <OpportunityScreen navigate={navigate} /> : null}
      {tab === 'activity' ? <ActivityScreen navigate={navigate} /> : null}
      {tab === 'settings' ? <SettingsScreen /> : null}
      <View style={styles.tabBar}>
        <TabButton active={tab === 'watchlist'} label="Watchlist" icon={<SquareStack />} onPress={() => navigate({ name: 'tabs', tab: 'watchlist' })} />
        <TabButton active={tab === 'opportunities'} label="For you" icon={<Sparkles />} onPress={() => navigate({ name: 'tabs', tab: 'opportunities' })} />
        <TabButton active={tab === 'activity'} label="Activity" icon={<Clock />} onPress={() => navigate({ name: 'tabs', tab: 'activity' })} />
        <TabButton active={tab === 'settings'} label="Settings" icon={<SettingsIcon />} onPress={() => navigate({ name: 'tabs', tab: 'settings' })} />
      </View>
    </View>
  );
}

function TabButton({ active, label, icon, onPress }: { active: boolean; label: string; icon: React.ReactElement; onPress: () => void }) {
  return (
    <Pressable style={styles.tabButton} onPress={onPress}>
      {React.cloneElement(icon as React.ReactElement<{ size: number; color: string }>, {
        size: 22,
        color: active ? colors.primary : colors.textMuted
      })}
      <AppText weight="semibold" style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {label}
      </AppText>
    </Pressable>
  );
}

function Header({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <View style={styles.headerBar}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.headerButton}>
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
      ) : (
        <View style={styles.headerButton} />
      )}
      <AppText weight="bold" style={styles.headerTitle} numberOfLines={1}>
        {title}
      </AppText>
      <View style={styles.headerButton} />
    </View>
  );
}

function WatchlistFilterRail({
  label,
  options,
  selected,
  onSelect
}: {
  label: string;
  options: { value?: string; label: string }[];
  selected?: string;
  onSelect: (value?: string) => void;
}) {
  return (
    <View style={styles.filterSection}>
      <AppText weight="semibold" style={styles.filterLabel}>{label}</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.textFilterRail}>
        {options.map((option) => {
          const active = selected === option.value;
          return (
            <Pressable
              key={option.value ?? 'all'}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(option.value)}
              style={({ pressed }) => [styles.textFilterButton, active && styles.textFilterButtonSelected, pressed && styles.storeFilterButtonPressed]}
            >
              <AppText weight="semibold" style={[styles.textFilterText, active && styles.textFilterTextSelected]}>{option.label}</AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function WatchlistControlsSheet({
  visible,
  onClose,
  trackedSites,
  folders,
  storeFilter,
  folderFilter,
  sort,
  onStoreFilter,
  onFolderFilter,
  onSort,
  onClear
}: {
  visible: boolean;
  onClose: () => void;
  trackedSites: WatchlistStoreFilter[];
  folders: string[];
  storeFilter: WatchlistStoreFilter;
  folderFilter?: string;
  sort: WatchlistSort;
  onStoreFilter: (value: WatchlistStoreFilter) => void;
  onFolderFilter: (value?: string) => void;
  onSort: (value: WatchlistSort) => void;
  onClear: () => void;
}) {
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const transition = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = transition.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0]
  });
  const backdropOpacity = transition.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.34]
  });

  useEffect(() => {
    if (visible) {
      setMounted(true);
    }

    const animation = Animated.timing(transition, {
      toValue: visible ? 1 : 0,
      duration: visible ? 260 : 180,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true
    });

    animation.start(({ finished }) => {
      if (finished && !visible) {
        setMounted(false);
      }
    });

    return () => animation.stop();
  }, [transition, visible]);

  if (!mounted) {
    return null;
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.controlSheetOverlay}>
        <Animated.View pointerEvents="none" style={[styles.controlSheetScrim, { opacity: backdropOpacity }]} />
        <Pressable accessibilityRole="button" accessibilityLabel="Close filters" style={styles.controlSheetBackdrop} onPress={onClose} />
        <Animated.View style={[styles.controlSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={styles.controlSheetHeader}>
            <View>
              <AppText weight="bold" style={styles.controlSheetTitle}>Filter & sort</AppText>
              <AppText muted style={styles.fieldHint}>Choose what you want to see.</AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close filters" onPress={onClose} style={styles.controlSheetClose}>
              <X size={20} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.controlSheetContent}>
            <WatchlistFilterRail
              label="Sort by"
              options={WATCHLIST_SORT_OPTIONS}
              selected={sort}
              onSelect={(value) => onSort((value as WatchlistSort | undefined) ?? 'recently_updated')}
            />
            {trackedSites.length > 1 ? (
              <WatchlistFilterRail
                label="Store"
                options={[{ value: 'all', label: 'All stores' }, ...trackedSites.filter((site): site is Exclude<WatchlistStoreFilter, 'all'> => site !== 'all').map((site) => ({ value: site, label: getSiteByKey(site).shortName }))]}
                selected={storeFilter}
                onSelect={(value) => onStoreFilter((value as WatchlistStoreFilter | undefined) ?? 'all')}
              />
            ) : null}
            {folders.length > 0 ? (
              <WatchlistFilterRail
                label="Folder"
                options={[{ label: 'All folders' }, ...folders.map((folder) => ({ value: folder, label: folder }))]}
                selected={folderFilter}
                onSelect={onFolderFilter}
              />
            ) : null}
            <PrimaryButton label="Clear filters" variant="outline" onPress={onClear} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function BulkEditSheet({ visible, folders, selectedCount, onClose, onApply }: {
  visible: boolean;
  folders: string[];
  selectedCount: number;
  onClose: () => void;
  onApply: (update: Parameters<typeof updateTrackedProducts>[1]) => Promise<void>;
}) {
  const [folder, setFolder] = useState('');

  useEffect(() => {
    if (visible) {
      setFolder('');
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.controlSheetOverlay}>
        <Pressable style={styles.controlSheetBackdrop} onPress={onClose} />
        <View style={styles.controlSheet}>
          <View style={styles.controlSheetHeader}>
            <View><AppText weight="bold" style={styles.controlSheetTitle}>Move products</AppText><AppText muted style={styles.fieldHint}>{selectedCount} selected</AppText></View>
            <Pressable onPress={onClose} style={styles.controlSheetClose}><X size={20} color={colors.text} /></Pressable>
          </View>
          <FolderPicker value={folder} folders={folders} onChange={setFolder} />
          <Pressable onPress={() => onApply({ clearFolder: true })} style={styles.bulkClearFolder}><AppText weight="semibold" style={styles.clearControlsText}>Remove from folder</AppText></Pressable>
          <PrimaryButton label="Move products" onPress={() => onApply({ folder })} disabled={!folder.trim()} />
        </View>
      </View>
    </Modal>
  );
}

function WatchlistScreen({ navigate }: { navigate: (route: Route) => void }) {
  const [products, setProducts] = useState<TrackedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);
  const [storeFilter, setStoreFilter] = useState<WatchlistStoreFilter>('all');
  const [folderFilter, setFolderFilter] = useState<string | undefined>();
  const [sort, setSort] = useState<WatchlistSort>('recently_updated');
  const [showControls, setShowControls] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
  const [showBulkFolderPicker, setShowBulkFolderPicker] = useState(false);

  const loadProducts = useCallback(async () => {
    setProducts(await listTrackedProducts());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  async function refresh() {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  }

  async function recheckAllPrices() {
    if (!products.length) {
      return;
    }

    setCheckingAll(true);
    try {
      await checkAllActiveProducts(products.length);
      await loadProducts();
    } catch {
      Alert.alert('Recheck failed', 'Qeemat could not recheck all prices right now.');
    } finally {
      setCheckingAll(false);
    }
  }

  function handleRemoveProduct(product: TrackedProduct) {
    Alert.alert('Remove product?', `Remove "${product.title}" from your watchlist?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteTrackedProduct(product.id);
          await loadProducts();
        }
      }
    ]);
  }

  const [oosExpanded, setOosExpanded] = useState(false);

  const visibleProducts = useMemo(() => products.filter((product) => Boolean(product.isArchived) === showArchived), [products, showArchived]);
  const trackedSites = useMemo(() => getWatchlistSites(visibleProducts), [visibleProducts]);
  const folders = useMemo(() => getWatchlistFolders(products), [products]);
  const filteredProducts = useMemo(
    () => sortWatchlistProducts(filterWatchlistProducts(visibleProducts, storeFilter, { folder: folderFilter }), sort),
    [visibleProducts, storeFilter, folderFilter, sort]
  );
  const selectedProducts = useMemo(
    () => products.filter((product) => selectedProductIds.has(product.id)),
    [products, selectedProductIds]
  );
  const shouldPauseSelected = selectedProducts.length > 0 && selectedProducts.every((product) => product.isActive);
  const inStock = filteredProducts.filter((p) => p.lastAvailability !== 'out_of_stock');
  const oos = filteredProducts.filter((p) => p.lastAvailability === 'out_of_stock');
  const activeControlCount = (storeFilter !== 'all' ? 1 : 0) + (folderFilter ? 1 : 0) + (sort !== 'recently_updated' ? 1 : 0);
  const activeControlSummary = [
    storeFilter === 'all' ? undefined : getSiteByKey(storeFilter).shortName,
    folderFilter,
    sort === 'recently_updated' ? undefined : WATCHLIST_SORT_OPTIONS.find((option) => option.value === sort)?.label
  ].filter(Boolean).join(' · ');

  function clearControls() {
    setStoreFilter('all');
    setFolderFilter(undefined);
    setSort('recently_updated');
  }

  function toggleSelection(id: number) {
    setSelectedProductIds((selected) => {
      const next = new Set(selected);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function startSelection(id: number) {
    setSelectedProductIds((selected) => new Set(selected).add(id));
  }

  async function applyBulk(update: Parameters<typeof updateTrackedProducts>[1]) {
    await updateTrackedProducts([...selectedProductIds], update);
    setSelectedProductIds(new Set());
    setShowBulkFolderPicker(false);
    await loadProducts();
  }

  function confirmBulkDelete() {
    const count = selectedProductIds.size;
    Alert.alert(`Delete ${count} ${count === 1 ? 'product' : 'products'}?`, 'Their saved price history will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteTrackedProducts([...selectedProductIds]);
        setSelectedProductIds(new Set());
        await loadProducts();
      } }
    ]);
  }

  useEffect(() => {
    if (storeFilter !== 'all' && !trackedSites.includes(storeFilter)) {
      setStoreFilter('all');
    }
  }, [storeFilter, trackedSites]);

  useEffect(() => {
    if (folderFilter && !folders.includes(folderFilter)) {
      setFolderFilter(undefined);
    }
  }, [folderFilter, folders]);

  return (
    <View style={styles.app}>
      <Header title="Qeemat" />
      <ScrollView
        contentContainerStyle={styles.screenContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <View>
            <AppText weight="bold" style={styles.heading}>
              Watchlist
            </AppText>
            <AppText muted>Track supported product prices locally.</AppText>
          </View>
          <View style={styles.countPill}>
            <AppText weight="semibold" style={styles.countText}>
            {showArchived ? 'Archived' : `${filteredProducts.length} ${filteredProducts.length === 1 ? 'item' : 'items'}`}
            </AppText>
          </View>
        </View>
        <View style={styles.watchlistToolbar}>
        <Pressable accessibilityRole="button" onPress={() => setShowControls(true)} style={({ pressed }) => [styles.controlsButton, pressed && styles.storeFilterButtonPressed]}>
          <SlidersHorizontal size={18} color={colors.primary} />
          <AppText weight="semibold" style={styles.controlsButtonText}>Filter & sort</AppText>
          {activeControlCount > 0 ? <View style={styles.controlsCount}><AppText weight="bold" style={styles.controlsCountText}>{activeControlCount}</AppText></View> : null}
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => { setShowArchived((value) => !value); setSelectedProductIds(new Set()); }} style={styles.archiveToggle}>
          <AppText weight="semibold" style={styles.archiveToggleText}>{showArchived ? 'Show active' : 'Archived'}</AppText>
        </Pressable>
        </View>
        {activeControlSummary ? (
          <View style={styles.activeControlsRow}>
            <AppText muted numberOfLines={1} style={styles.activeControlsSummary}>{activeControlSummary}</AppText>
            <Pressable accessibilityRole="button" onPress={clearControls}><AppText weight="semibold" style={styles.clearControlsText}>Clear</AppText></Pressable>
          </View>
        ) : null}
        {selectedProductIds.size === 0 ? <PrimaryButton
          label="Recheck all prices"
          variant="outline"
          onPress={recheckAllPrices}
          loading={checkingAll}
          disabled={!products.length || loading}
          icon={!checkingAll ? <RefreshCcw size={18} color={colors.primary} /> : undefined}
        /> : <View style={styles.selectionHeader}><AppText weight="bold">{selectedProductIds.size} selected</AppText><Pressable onPress={() => setSelectedProductIds(new Set())}><AppText weight="semibold" style={styles.clearControlsText}>Cancel</AppText></Pressable></View>}

        <WatchlistControlsSheet
          visible={showControls}
          onClose={() => setShowControls(false)}
          trackedSites={trackedSites}
          folders={folders}
          storeFilter={storeFilter}
          folderFilter={folderFilter}
          sort={sort}
          onStoreFilter={setStoreFilter}
          onFolderFilter={setFolderFilter}
          onSort={setSort}
          onClear={clearControls}
        />

        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {!loading && products.length === 0 ? <EmptyWatchlist onAdd={() => navigate({ name: 'add' })} /> : null}

        {oos.length > 0 ? (
          <Pressable style={styles.oosSection} onPress={() => setOosExpanded((v) => !v)}>
            <View style={styles.oosHeader}>
              <View style={styles.oosDot} />
              <AppText weight="semibold" style={styles.oosLabel}>
                Out of Stock
              </AppText>
              <AppText muted style={styles.oosCount}>
                {oos.length} {oos.length === 1 ? 'item' : 'items'}
              </AppText>
              <View style={styles.oosThumbnails}>
                {oos.slice(0, 4).map((p, i) => (
                  p.imageUrl ? (
                    <Image
                      key={p.id}
                      source={{ uri: p.imageUrl }}
                      style={[styles.oosThumb, i > 0 && { marginLeft: -8 }]}
                      resizeMode="cover"
                    />
                  ) : null
                ))}
              </View>
              {oosExpanded ? (
                <ChevronUp size={16} color={colors.textMuted} />
              ) : (
                <ChevronDown size={16} color={colors.textMuted} />
              )}
            </View>
          </Pressable>
        ) : null}

        {oos.length > 0 && oosExpanded ? (
          <View style={styles.cardList}>
            {oos.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onPress={() => selectedProductIds.size ? toggleSelection(product.id) : navigate({ name: 'detail', id: product.id })}
                onLongPress={() => startSelection(product.id)} selected={selectedProductIds.has(product.id)}
                onRemove={selectedProductIds.size ? undefined : () => handleRemoveProduct(product)}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.cardList}>
          {inStock.map((product) => (
            <ProductCard key={product.id} product={product} onPress={() => selectedProductIds.size ? toggleSelection(product.id) : navigate({ name: 'detail', id: product.id })} onLongPress={() => startSelection(product.id)} selected={selectedProductIds.has(product.id)} />
          ))}
        </View>
      </ScrollView>
      {selectedProductIds.size > 0 ? <View style={styles.bulkActionBar}>
        <BulkActionButton label="Move" icon={<FolderInput size={20} color={colors.primary} />} onPress={() => setShowBulkFolderPicker(true)} />
        <BulkActionButton label={shouldPauseSelected ? 'Pause' : 'Resume'} icon={<Pause size={20} color={colors.primary} />} onPress={() => applyBulk({ isActive: !shouldPauseSelected })} />
        <BulkActionButton label={showArchived ? 'Restore' : 'Archive'} icon={<Archive size={20} color={colors.primary} />} onPress={() => applyBulk({ isArchived: !showArchived })} />
        <BulkActionButton label="Delete" icon={<Trash2 size={20} color={colors.red} />} destructive onPress={confirmBulkDelete} />
      </View> : <Pressable style={styles.fab} onPress={() => navigate({ name: 'add' })}>
        <Plus size={30} color="#FFFFFF" />
      </Pressable>}
      <BulkEditSheet visible={showBulkFolderPicker} folders={folders} selectedCount={selectedProductIds.size} onClose={() => setShowBulkFolderPicker(false)} onApply={applyBulk} />
    </View>
  );
}

function BulkActionButton({ label, icon, destructive, onPress }: { label: string; icon: React.ReactNode; destructive?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} selected products`} onPress={onPress} style={({ pressed }) => [styles.bulkActionButton, pressed && styles.bulkActionButtonPressed]}>
      {icon}
      <AppText weight="semibold" style={destructive ? styles.bulkDeleteText : styles.bulkActionText}>{label}</AppText>
    </Pressable>
  );
}

function EmptyWatchlist({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Bell size={24} color={colors.primary} />
      </View>
      <AppText weight="bold" style={styles.emptyTitle}>
        Track your first product
      </AppText>
      <AppText muted style={styles.emptyCopy}>
        Paste a supported product link to start a local price history.
      </AppText>
      <PrimaryButton label="Add product" onPress={onAdd} style={styles.emptyButton} />
    </View>
  );
}

function useOrganizationOptions() {
  const [products, setProducts] = useState<TrackedProduct[]>([]);

  useEffect(() => {
    let active = true;
    listTrackedProducts().then((items) => {
      if (active && items.length > 0) {
        setProducts(items);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return useMemo(() => ({
    folders: getWatchlistFolders(products)
  }), [products]);
}

function FolderPicker({ value, folders, onChange }: { value: string; folders: string[]; onChange: (value: string) => void }) {
  return (
    <View style={styles.fieldGroup}>
      <AppText weight="semibold">Folder</AppText>
      <AppText muted style={styles.fieldHint}>Choose an existing folder or name a new one.</AppText>
      {folders.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionPickerRail}>
          {folders.map((folder) => {
            const selected = folder.localeCompare(value, undefined, { sensitivity: 'accent' }) === 0;
            return (
              <Pressable
                key={folder}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onChange(folder)}
                style={({ pressed }) => [styles.collectionPickerChip, selected && styles.collectionPickerChipSelected, pressed && styles.storeFilterButtonPressed]}
              >
                <AppText weight="semibold" style={[styles.collectionPickerChipText, selected && styles.collectionPickerChipTextSelected]}>{folder}</AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      <View style={styles.inputWrap}>
        <TextInput value={value} onChangeText={onChange} placeholder="e.g. Running" placeholderTextColor={colors.textSoft} maxFontSizeMultiplier={1.3} style={styles.input} />
      </View>
    </View>
  );
}

export function AddScreen({ initialUrl, shareEventId, returnTab, navigate }: { initialUrl?: string; shareEventId?: number; returnTab?: TabKey; navigate: (route: Route) => void }) {
  const [url, setUrl] = useState(initialUrl ?? '');
  const [parsedProduct, setParsedProduct] = useState<ParsedProduct | undefined>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [checkPreference, setCheckPreference] = useState<CheckPreference>('daily');
  const [alertMode, setAlertMode] = useState<AlertMode>('price_drop');
  const [targetPrice, setTargetPrice] = useState('');
  const [minimumPriceDrop, setMinimumPriceDrop] = useState('');
  const [restockAlertEnabled, setRestockAlertEnabled] = useState(true);
  const [folder, setFolder] = useState('');
  const organizationOptions = useOrganizationOptions();
  const [selectedVariantAttributes, setSelectedVariantAttributes] = useState<VariantAttributes>({});
  const scrollRef = useRef<ScrollView>(null);
  const shouldFocusParsedResult = useRef(false);
  const parseRequestId = useRef(0);

  const parseUrl = useCallback(async (sourceUrl: string) => {
    Keyboard.dismiss();
    setError(undefined);
    setParsedProduct(undefined);
    setSelectedVariantAttributes({});
    shouldFocusParsedResult.current = true;
    setLoading(true);
    const requestId = ++parseRequestId.current;
    const result = await fetchAndParseProduct(sourceUrl);
    if (requestId !== parseRequestId.current) {
      return;
    }
    if (result.ok) {
      setParsedProduct(result.product);
    } else {
      shouldFocusParsedResult.current = false;
      setError(result.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!initialUrl) {
      return;
    }

    parseRequestId.current += 1;
    setUrl(initialUrl);
    setParsedProduct(undefined);
    setSelectedVariantAttributes({});
    shouldFocusParsedResult.current = false;
    setError(undefined);
    setLoading(false);

    if (shareEventId !== undefined) {
      parseUrl(initialUrl);
    }
  }, [initialUrl, shareEventId, parseUrl]);

  const normalizedUrl = cleanUrl(normalizeUrl(url));
  const detectedSite = useMemo(() => detectSupportedSite(normalizedUrl), [normalizedUrl]);
  const targetPriceMinor = parseTargetPriceInput(targetPrice);
  const variants = useMemo(() => parsedProduct?.variants ?? [], [parsedProduct]);
  const selectedVariant = useMemo(
    () => resolveSelectedVariant(variants, selectedVariantAttributes),
    [variants, selectedVariantAttributes]
  );
  const selectedCurrency = selectedVariant?.currency ?? parsedProduct?.currency ?? 'AED';
  const previewProduct = useMemo(() => {
    if (!parsedProduct || !selectedVariant) {
      return parsedProduct;
    }

    return {
      ...parsedProduct,
      imageUrl: selectedVariant.imageUrl ?? parsedProduct.imageUrl,
      priceMinor: selectedVariant.priceMinor,
      currency: selectedVariant.currency ?? parsedProduct.currency,
      availability: selectedVariant.availability,
      sku: selectedVariant.sku ?? parsedProduct.sku,
      selectedVariant: toVariantSelection(selectedVariant)
    };
  }, [parsedProduct, selectedVariant]);

  const siteKeyForPrefs = parsedProduct?.siteKey ?? detectedSite?.key;
  const checkOptions = useMemo(
    () => CHECK_OPTIONS.filter((opt) => availableCheckPreferences(siteKeyForPrefs).includes(opt.value)),
    [siteKeyForPrefs]
  );

  // Reset check preference if the current one is no longer valid for the site
  useEffect(() => {
    const valid = availableCheckPreferences(siteKeyForPrefs);
    if (valid.length > 0 && !valid.includes(checkPreference)) {
      setCheckPreference(valid[0]);
    }
  }, [siteKeyForPrefs]); // eslint-disable-line react-hooks/exhaustive-deps

  const focusParsedResult = useCallback((top: number) => {
    if (!shouldFocusParsedResult.current) {
      return;
    }

    shouldFocusParsedResult.current = false;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, top - 12), animated: true });
    });
  }, []);

  async function saveProduct() {
    if (!parsedProduct) {
      return;
    }
    setSaving(true);
    let productToSave = previewProduct ?? parsedProduct;
    if (parsedProduct.siteKey === 'the_deal' && selectedVariant) {
      const result = await fetchTheDealVariantForSaving(parsedProduct, toVariantSelection(selectedVariant));
      if (!result.ok) {
        setError(result.message);
        setSaving(false);
        return;
      }
      productToSave = result.product;
    }
    const id = await createTrackedProduct({
      parsed: productToSave,
      sourceUrl: normalizedUrl,
      checkPreference,
      alertMode,
      targetPriceMinor: alertMode === 'target_price' ? targetPriceMinor : undefined,
      minimumPriceDropMinor: alertMode === 'price_drop' ? parseTargetPriceInput(minimumPriceDrop) : undefined,
      restockAlertEnabled,
      folder,
      variant: productToSave.selectedVariant
    });
    setSaving(false);
    if (returnTab === 'opportunities') {
      Alert.alert(
        'Now tracking',
        'Qeemat will keep an eye on this option and let you know about meaningful price or stock changes.',
        [
          { text: 'Keep browsing', onPress: () => navigate({ name: 'tabs', tab: 'opportunities' }) },
          { text: 'Set target price', onPress: () => navigate({ name: 'trackingSettings', id }) }
        ]
      );
      return;
    }
    navigate({ name: 'detail', id });
  }

  return (
    <View style={styles.app}>
      <Header title="Add Product" onBack={() => navigate({ name: 'tabs', tab: returnTab ?? 'watchlist' })} />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.screenContent, styles.addScreenContent]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppText muted style={styles.addIntroText}>
          Paste a supported product URL to start tracking locally.
        </AppText>
        <View style={styles.formSection}>
          <AppText weight="semibold" style={styles.formLabel}>
            Product URL
          </AppText>
          <View style={[styles.inputWrap, detectedSite && styles.inputDetected]}>
            <Link2 size={18} color={colors.textMuted} />
            <TextInput
              value={url}
              onChangeText={(value) => {
                parseRequestId.current += 1;
                setUrl(value);
                setParsedProduct(undefined);
                setSelectedVariantAttributes({});
                shouldFocusParsedResult.current = false;
                setError(undefined);
                setLoading(false);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://www.noon.com/..."
              placeholderTextColor={colors.textSoft}
              maxFontSizeMultiplier={1.3}
              style={styles.input}
            />
          </View>
          {detectedSite ? (
            <View style={styles.detectedSource}>
              <View style={styles.detectedSourceIcon}>
                <SiteIcon siteKey={detectedSite.key} size={18} />
                <Check size={14} color={colors.green} />
              </View>
              <View style={styles.detectedSourceCopy}>
                <AppText weight="semibold" style={styles.detectedText}>
                  {detectedSite.displayName} link detected
                </AppText>
                <AppText muted style={styles.detectedHint}>
                  Find the product to set your alerts. Select an option when the page provides one.
                </AppText>
              </View>
            </View>
          ) : null}
        </View>
        {!detectedSite ? (
          <View style={styles.chips}>
            {SUPPORTED_SITES.filter(s => s.status === 'supported').map((site) => (
              <View key={site.key} style={styles.chip}>
                <SiteIcon siteKey={site.key} size={14} />
                <AppText weight="medium" style={styles.chipText}>
                  {site.shortName}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
        <PrimaryButton label="Find product" onPress={() => parseUrl(url)} disabled={!url.trim() || loading} loading={loading} />
        {error ? (
          <View style={styles.errorBox}>
            <CircleAlert size={18} color={colors.red} />
            <AppText style={styles.errorBoxText}>{error}</AppText>
          </View>
        ) : null}
        {parsedProduct ? (
          <View style={styles.previewSection} onLayout={({ nativeEvent }) => focusParsedResult(nativeEvent.layout.y)}>
            <ProductPreview
              product={previewProduct ?? parsedProduct}
              storeName={detectedSite?.shortName ?? 'Store'}
              siteKey={parsedProduct.siteKey}
              awaitingVariantSelection={variants.length > 0 && !selectedVariant}
            />
            {variants.length > 0 ? (
              <View style={styles.variantSection}>
                <AppText weight="semibold" style={styles.formLabel}>
                  Choose variant
                </AppText>
                <VariantSelector
                  variants={variants}
                  selectedAttributes={selectedVariantAttributes}
                  onSelect={(name, value) =>
                    setSelectedVariantAttributes((current) => updateSelectedVariantAttributes(variants, current, name, value))
                  }
                />
                {!selectedVariant ? <AppText muted style={styles.variantHint}>Select an available option to continue.</AppText> : null}
              </View>
            ) : (
              <AppText muted style={styles.variantHint}>No selectable options found. This product will be tracked at page level.</AppText>
            )}
            <AppText weight="semibold" style={styles.formLabel}>
              Check preference
            </AppText>
            <OptionGroup value={checkPreference} options={checkOptions} onChange={setCheckPreference} />
            <AppText weight="semibold" style={styles.formLabel}>
              Alert mode
            </AppText>
            <OptionGroup value={alertMode} options={ALERT_OPTIONS} onChange={setAlertMode} />
            {alertMode === 'target_price' ? (
              <View style={styles.inputWrap}>
                <AppText weight="semibold" muted>
                  {selectedCurrency}
                </AppText>
                <TextInput
                  value={targetPrice}
                  onChangeText={setTargetPrice}
                  keyboardType="decimal-pad"
                  placeholder="250"
                  placeholderTextColor={colors.textSoft}
                  maxFontSizeMultiplier={1.3}
                  style={styles.input}
                />
              </View>
            ) : null}
            {alertMode === 'price_drop' ? (
              <View style={styles.fieldGroup}>
                <AppText weight="semibold">Minimum price drop alert</AppText>
                <AppText muted style={styles.fieldHint}>Only notify when the price drops by at least this amount.</AppText>
                <View style={styles.inputWrap}>
                  <AppText weight="semibold" muted>{selectedCurrency}</AppText>
                  <TextInput
                    value={minimumPriceDrop}
                    onChangeText={setMinimumPriceDrop}
                    keyboardType="decimal-pad"
                    placeholder="Any drop"
                    placeholderTextColor={colors.textSoft}
                    maxFontSizeMultiplier={1.3}
                    style={styles.input}
                  />
                </View>
              </View>
            ) : null}
            <View style={styles.settingToggleRow}>
              <View style={styles.flex}>
                <AppText weight="semibold">Back-in-stock alerts</AppText>
                <AppText muted style={styles.fieldHint}>Let me know when an unavailable item returns.</AppText>
              </View>
              <Switch value={restockAlertEnabled} onValueChange={setRestockAlertEnabled} trackColor={{ true: colors.primary }} />
            </View>
            <FolderPicker value={folder} folders={organizationOptions.folders} onChange={setFolder} />
            <PrimaryButton
              label="Confirm Tracking"
              onPress={saveProduct}
              loading={saving}
              disabled={(alertMode === 'target_price' && !targetPriceMinor) || (variants.length > 0 && !selectedVariant)}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ProductPreview({
  product,
  storeName,
  siteKey,
  awaitingVariantSelection = false
}: {
  product: ParsedProduct;
  storeName: string;
  siteKey: string;
  awaitingVariantSelection?: boolean;
}) {
  const { width, fontScale } = useWindowDimensions();
  const compact = isCompactLayout(width, fontScale);

  return (
    <View style={[styles.previewCard, compact && styles.previewCardCompact]}>
      <View style={[styles.previewImageWrap, compact && styles.previewImageWrapCompact]}>
        {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.previewImage} resizeMode="contain" /> : null}
      </View>
      <View style={styles.previewCopy}>
        <AppText weight="bold" numberOfLines={2} style={styles.previewTitle}>
          {product.title}
        </AppText>
        <View style={styles.storePill}>
          <SiteIcon siteKey={siteKey as import('./src/domain/types').SiteKey} size={14} />
          <AppText style={styles.storePillText}>{storeName}</AppText>
        </View>
        <AppText muted style={styles.caption}>
          Current price
        </AppText>
        <AppText weight="bold" style={styles.previewPrice}>
          {awaitingVariantSelection ? 'Choose an option' : formatPrice(product.priceMinor, product.currency)}
        </AppText>
      </View>
    </View>
  );
}

export function getTrackedProductLink(product: Pick<TrackedProduct, 'url' | 'canonicalUrl' | 'siteKey' | 'variant'>): string {
  const customerFacingUrl = product.siteKey === 'the_deal'
    ? product.canonicalUrl || product.url
    : product.variant?.url || product.canonicalUrl || product.url;
  return cleanUrl(customerFacingUrl);
}

export function DetailScreen({ productId, navigate }: { productId: number; navigate: (route: Route) => void }) {
  const { width, fontScale } = useWindowDimensions();
  const compact = isCompactLayout(width, fontScale);
  const [data, setData] = useState<ProductWithSnapshots | undefined>();
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => setData(await getProductWithSnapshots(productId)), [productId]);
  useEffect(() => {
    load();
  }, [load]);

  async function checkNow() {
    setChecking(true);
    await checkProductById(productId).catch(() => undefined);
    await load();
    setChecking(false);
  }

  if (!data) {
    return (
      <View style={styles.app}>
        <Header title="Qeemat" onBack={() => navigate({ name: 'tabs', tab: 'watchlist' })} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  const { product, snapshots } = data;
  const productLink = getTrackedProductLink(product);
  const insights = calculatePriceInsights(snapshots);
  const status = product.lastErrorCode ?? snapshots[0]?.status ?? 'ok';
  const checkFailed = status !== 'ok' && status !== 'price_changed';
  const isOos = product.lastAvailability === 'out_of_stock';

  function copyProductLink() {
    Clipboard.setString(productLink);
    Alert.alert('Link copied', 'The product link is ready to paste.');
  }

  return (
    <View style={styles.app}>
      <Header title="Qeemat" onBack={() => navigate({ name: 'tabs', tab: 'watchlist' })} />
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.detailHero, compact && styles.detailHeroCompact]}>
          <View style={[styles.detailImageWrap, compact && styles.detailImageWrapCompact]}>
            {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.detailImage} resizeMode="contain" /> : null}
          </View>
          <View style={styles.detailCopy}>
            <View style={styles.titleRow}>
              <AppText weight="bold" style={styles.detailTitle} numberOfLines={3}>
                {product.title}
              </AppText>
              <View style={styles.detailHeaderActions}>
                <Pressable
                  accessibilityLabel="Copy product link"
                  accessibilityRole="button"
                  style={styles.iconButton}
                  onPress={copyProductLink}
                >
                  <Copy size={20} color={colors.text} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Tracking settings"
                  accessibilityRole="button"
                  style={styles.iconButton}
                  onPress={() => navigate({ name: 'trackingSettings', id: product.id })}
                >
                  <SettingsIcon size={20} color={colors.text} />
                </Pressable>
              </View>
            </View>
            {product.variant ? <AppText muted style={styles.caption}>Tracking {product.variant.label}</AppText> : null}
            <AppText muted style={styles.caption}>
              {checkFailed || isOos ? 'Last known price' : 'Current price'}
            </AppText>
            <AppText weight="bold" style={styles.currentPrice}>
              {formatPrice(product.currentPriceMinor, product.currency)}
            </AppText>
            {product.targetPriceMinor ? (
              <AppText weight="semibold">Target {formatPrice(product.targetPriceMinor, product.currency)}</AppText>
            ) : null}
            <StatusPill
              status={status}
              label={status === 'variant_not_found' ? 'Variant unavailable' : `${checkFailed ? 'Check failed' : 'Checked'} ${formatRelativeTime(product.lastCheckedAt)}`}
              availability={checkFailed ? 'unknown' : product.lastAvailability}
            />
            {checkFailed ? (
              <AppText muted style={styles.caption}>
                {product.lastSuccessAt ? `Last successful check: ${formatRelativeTime(product.lastSuccessAt)}` : 'No successful check recorded'}
              </AppText>
            ) : null}
          </View>
        </View>
        {product.lastAvailability === 'out_of_stock' ? (
          <View style={styles.oosBanner}>
            <CircleAlert size={16} color={colors.amber} />
            <AppText weight="medium" style={styles.oosBannerText}>
              {product.currentPriceMinor !== undefined
                ? 'Out of stock — last known price shown'
                : 'Out of stock — no price recorded'}
            </AppText>
          </View>
        ) : null}
        <SectionTitle title="Price insights" />
        <View style={styles.statsRow}>
          <StatCard label="Lowest price" price={insights.lowestPriceMinor} currency={product.currency} tone="green" />
          <StatCard label="Highest price" price={insights.highestPriceMinor} currency={product.currency} tone="red" />
        </View>
        <StatCard label="Average price" price={insights.averagePriceMinor} currency={product.currency} tone="neutral" emphasized />
        <AppText muted style={styles.insightCaption}>{insights.observations} {insights.observations === 1 ? 'priced check' : 'priced checks'} recorded locally.</AppText>
        <SectionTitle title="Price History" />
        <PriceChart snapshots={snapshots} currency={product.currency} />
        <SectionTitle title="Price Snapshots" />
        <SnapshotList snapshots={snapshots} currency={product.currency} />
      </ScrollView>
      <View style={styles.bottomActionRow}>
        <PrimaryButton label="Check now" variant="outline" onPress={checkNow} loading={checking} style={styles.bottomActionHalf}
          icon={!checking ? <RefreshCcw size={18} color={colors.primary} /> : undefined} />
        <PrimaryButton label="Open link" variant="outline" onPress={() => Linking.openURL(productLink)} style={styles.bottomActionHalf}
          icon={<Link2 size={18} color={colors.primary} />} />
      </View>
    </View>
  );
}

function SnapshotList({ snapshots, currency }: { snapshots: PriceSnapshot[]; currency: string }) {
  const groups = useMemo(() => groupSnapshots(snapshots.slice(0, 30)), [snapshots]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <View style={styles.snapshotList}>
      {groups.map((group) => {
        const first = group.snapshots[0];
        const rest = group.snapshots.slice(1);
        const isExpanded = expandedKeys.has(group.key);

        return (
          <View key={group.key}>
            <SnapshotRow snapshot={first} currency={currency} />
            {rest.length > 0 && !isExpanded && (
              <Pressable style={styles.snapshotCollapsed} onPress={() => toggle(group.key)}>
                <AppText muted style={styles.snapshotCollapsedText}>
                  +{rest.length} earlier {rest.length === 1 ? 'check' : 'checks'}, no change
                </AppText>
              </Pressable>
            )}
            {rest.length > 0 && isExpanded && (
              <>
                {rest.map((s) => (
                  <SnapshotRow key={s.id} snapshot={s} currency={currency} subtle />
                ))}
                <Pressable style={styles.snapshotCollapsed} onPress={() => toggle(group.key)}>
                  <AppText muted style={styles.snapshotCollapsedText}>
                    Collapse
                  </AppText>
                </Pressable>
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}

function SnapshotRow({
  snapshot,
  currency,
  subtle,
}: {
  snapshot: PriceSnapshot;
  currency: string;
  subtle?: boolean;
}) {
  return (
    <View style={[styles.snapshotRow, subtle && styles.snapshotRowSubtle]}>
      <View style={styles.flex}>
        <View style={styles.snapshotMetaRow}>
          <AppText weight={subtle ? 'regular' : 'medium'} muted={subtle}>
            {formatSnapshotTime(snapshot.checkedAt)}
          </AppText>
          <View style={[styles.sourceBadge, snapshotSourceBadgeStyle(snapshot.source)]}>
            <AppText weight="semibold" style={styles.sourceBadgeText}>
              {snapshotSourceLabel(snapshot.source)}
            </AppText>
          </View>
        </View>
        {snapshot.errorCode ? <AppText muted>{snapshot.errorCode}</AppText> : null}
      </View>
      <View style={styles.snapshotPriceBlock}>
        <AppText weight="bold" muted={subtle} style={snapshot.status === 'price_changed' && !subtle && styles.changedPrice}>
          {snapshot.priceMinor !== undefined
            ? formatPrice(snapshot.priceMinor, snapshot.currency ?? currency)
            : snapshot.availability === 'out_of_stock' ? 'Out of stock' : 'Failed'}
        </AppText>
        <AppText muted style={styles.snapshotAvailability}>
          {snapshot.availability.replace(/_/g, ' ')}
        </AppText>
      </View>
    </View>
  );
}

function TrackingSettingsScreen({ productId, navigate }: { productId: number; navigate: (route: Route) => void }) {
  const [product, setProduct] = useState<TrackedProduct | undefined>();
  const [checkPreference, setCheckPreference] = useState<CheckPreference>('daily');
  const [alertMode, setAlertMode] = useState<AlertMode>('price_drop');
  const [targetPrice, setTargetPrice] = useState('');
  const [minimumPriceDrop, setMinimumPriceDrop] = useState('');
  const [restockAlertEnabled, setRestockAlertEnabled] = useState(true);
  const [folder, setFolder] = useState('');
  const organizationOptions = useOrganizationOptions();

  useEffect(() => {
    getTrackedProduct(productId).then((row) => {
      if (!row) {
        return;
      }
      setProduct(row);

      // Clamp check preference to valid options for this site
      const valid = availableCheckPreferences(row.siteKey);
      const clampedPref = valid.includes(row.checkPreference) ? row.checkPreference : valid[0] ?? row.checkPreference;
      setCheckPreference(clampedPref);

      setAlertMode(row.alertMode);
      setTargetPrice(row.targetPriceMinor ? String(row.targetPriceMinor / 100) : '');
      setMinimumPriceDrop(row.minimumPriceDropMinor ? String(row.minimumPriceDropMinor / 100) : '');
      setRestockAlertEnabled(row.restockAlertEnabled ?? true);
      setFolder(row.folder ?? '');
    });
  }, [productId]);

  async function save() {
    await updateTrackingSettings(productId, {
      alertMode,
      checkPreference,
      targetPriceMinor: alertMode === 'target_price' ? parseTargetPriceInput(targetPrice) : undefined,
      minimumPriceDropMinor: alertMode === 'price_drop' ? parseTargetPriceInput(minimumPriceDrop) : undefined,
      restockAlertEnabled,
      folder,
      isActive: product?.isActive ?? true
    });
    navigate({ name: 'detail', id: productId });
  }

  function confirmDelete() {
    Alert.alert('Delete product?', 'This removes the product and all local price history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTrackedProduct(productId);
          navigate({ name: 'tabs', tab: 'watchlist' });
        }
      }
    ]);
  }

  return (
    <View style={styles.app}>
      <Header title="Tracking Settings" onBack={() => navigate({ name: 'detail', id: productId })} />
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <AppText weight="bold" style={styles.detailTitle} numberOfLines={2}>
          {product?.title ?? 'Product'}
        </AppText>
        <AppText weight="semibold">Check preference</AppText>
        <OptionGroup value={checkPreference} options={CHECK_OPTIONS.filter((opt) => availableCheckPreferences(product?.siteKey).includes(opt.value))} onChange={setCheckPreference} />
        <AppText weight="semibold">Alert mode</AppText>
        <OptionGroup value={alertMode} options={ALERT_OPTIONS} onChange={setAlertMode} />
        {alertMode === 'target_price' ? (
          <View style={styles.inputWrap}>
            <AppText weight="semibold" muted>
              {product?.currency ?? 'AED'}
            </AppText>
            <TextInput value={targetPrice} onChangeText={setTargetPrice} keyboardType="decimal-pad" maxFontSizeMultiplier={1.3} style={styles.input} />
          </View>
        ) : null}
        {alertMode === 'price_drop' ? (
          <View style={styles.fieldGroup}>
            <AppText weight="semibold">Minimum price drop alert</AppText>
            <AppText muted style={styles.fieldHint}>Only notify when the price drops by at least this amount.</AppText>
            <View style={styles.inputWrap}>
              <AppText weight="semibold" muted>{product?.currency ?? 'AED'}</AppText>
              <TextInput value={minimumPriceDrop} onChangeText={setMinimumPriceDrop} keyboardType="decimal-pad" placeholder="Any drop" placeholderTextColor={colors.textSoft} maxFontSizeMultiplier={1.3} style={styles.input} />
            </View>
          </View>
        ) : null}
        <View style={styles.settingToggleRow}>
          <View style={styles.flex}>
            <AppText weight="semibold">Back-in-stock alerts</AppText>
            <AppText muted style={styles.fieldHint}>Notify when this unavailable product returns.</AppText>
          </View>
          <Switch value={restockAlertEnabled} onValueChange={setRestockAlertEnabled} trackColor={{ true: colors.primary }} />
        </View>
        <FolderPicker value={folder} folders={organizationOptions.folders} onChange={setFolder} />
        <PrimaryButton label="Save settings" onPress={save} />
        <PrimaryButton label="Delete product" variant="danger" onPress={confirmDelete} icon={<Trash2 size={18} color={colors.red} />} />
      </ScrollView>
    </View>
  );
}

function ActivityScreen({ navigate }: { navigate: (route: Route) => void }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [products, setProducts] = useState<TrackedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [loadedEvents, loadedProducts] = await Promise.all([
        listActivityEvents(),
        listTrackedProducts()
      ]);
      setEvents(loadedEvents);
      setProducts(loadedProducts);
      setLoading(false);
    })();
  }, []);

  const existingProductIds = useMemo(() => new Set(products.map((p) => p.id)), [products]);

  const groupedEvents = useMemo(() => {
    const groups: { label: string; events: ActivityEvent[] }[] = [];
    for (const event of events) {
      const label = formatRelativeTime(event.checkedAt);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.label === label) {
        lastGroup.events.push(event);
      } else {
        groups.push({ label, events: [event] });
      }
    }
    return groups;
  }, [events]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <AppText weight="bold" style={styles.heading}>
        Activity
      </AppText>
      <AppText muted>Recent price changes across all tracked products.</AppText>
      {events.length === 0 ? <EmptyActivity /> : null}
      {groupedEvents.map((group) => (
        <View key={group.label}>
          <View style={styles.activityDateHeader}>
            <AppText weight="semibold" style={styles.activityDateHeaderText}>
              {group.label}
            </AppText>
          </View>
          <View style={styles.cardList}>
            {group.events.map((event) => {
              const productExists = existingProductIds.has(event.trackedProductId);
              const cardContent = (
                <View style={styles.activityCard}>
                  {event.productImageUrl ? (
                    <Image source={{ uri: event.productImageUrl }} style={styles.activityThumb} resizeMode="contain" />
                  ) : (
                    <View style={styles.activityThumbPlaceholder}>
                      <Store size={18} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.activityBody}>
                    <AppText weight="semibold" numberOfLines={2} style={styles.activityTitle}>
                      {event.productTitle}
                    </AppText>
                    <View style={styles.activityPriceRow}>
                      {event.availability === 'out_of_stock' ? (
                        <>
                          <PackageX size={18} color={colors.amber} />
                          <AppText weight="semibold" style={styles.oosActivityLabel}>
                            Out of stock
                          </AppText>
                          {event.previousPriceMinor !== undefined ? (
                            <AppText muted style={styles.activityOldPrice}>
                              {formatPrice(event.previousPriceMinor, event.currency)}
                            </AppText>
                          ) : null}
                        </>
                      ) : event.availability === 'in_stock' ? (
                        <>
                          <Check size={18} color={colors.green} />
                          <AppText weight="semibold" style={styles.restockActivityLabel}>Back in stock</AppText>
                          <AppText weight="bold" style={styles.activityNewPrice}>{formatPrice(event.newPriceMinor, event.currency)}</AppText>
                        </>
                      ) : (
                        <>
                          {event.previousPriceMinor !== undefined ? (
                            <AppText muted style={styles.activityOldPrice}>
                              {formatPrice(event.previousPriceMinor, event.currency)}
                            </AppText>
                          ) : null}
                          <View style={styles.activityDirectionIcon}>
                            {event.priceDirection === 'down' ? (
                              <TrendingDown size={16} color={colors.green} />
                            ) : event.priceDirection === 'up' ? (
                              <TrendingUp size={16} color={colors.red} />
                            ) : (
                              <View style={styles.activityFirstDot} />
                            )}
                          </View>
                          {event.priceDirection === 'first' ? (
                            <AppText weight="bold" style={styles.activityFirstPrice}>
                              {formatPrice(event.newPriceMinor, event.currency)}
                            </AppText>
                          ) : (
                            <AppText weight="bold" style={[
                              styles.activityNewPrice,
                              event.priceDirection === 'down' && styles.activityPriceDown,
                              event.priceDirection === 'up' && styles.activityPriceUp
                            ]}>
                              {formatPrice(event.newPriceMinor, event.currency)}
                            </AppText>
                          )}
                        </>
                      )}
                    </View>
                    <View style={styles.activityMetaRow}>
                      {event.priceDirection === 'first' && !event.availability ? (
                        <View style={styles.activityFirstBadge}>
                          <AppText weight="semibold" style={styles.activityFirstBadgeText}>
                            Started tracking
                          </AppText>
                        </View>
                      ) : null}
                      {event.availability === 'out_of_stock' ? (
                        <View style={styles.oosActivityBadge}>
                          <AppText weight="semibold" style={styles.oosActivityBadgeText}>
                            Out of stock
                          </AppText>
                        </View>
                      ) : null}
                      {event.availability === 'in_stock' ? (
                        <View style={styles.restockActivityBadge}>
                          <AppText weight="semibold" style={styles.restockActivityBadgeText}>Back in stock</AppText>
                        </View>
                      ) : null}
                      <View style={[styles.sourceBadge, snapshotSourceBadgeStyle(event.source)]}>
                        <AppText weight="semibold" style={styles.sourceBadgeText}>
                          {snapshotSourceLabel(event.source)}
                        </AppText>
                      </View>
                    </View>
                  </View>
                </View>
              );

              if (!productExists) {
                return (
                  <View key={event.id}>
                    {cardContent}
                  </View>
                );
              }

              return (
                <Pressable
                  key={event.id}
                  onPress={() => navigate({ name: 'detail', id: event.trackedProductId })}
                  style={({ pressed }) => pressed && { opacity: 0.7 }}
                >
                  {cardContent}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function EmptyActivity() {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Clock size={24} color={colors.primary} />
      </View>
      <AppText weight="bold" style={styles.emptyTitle}>
        No price changes yet
      </AppText>
      <AppText muted style={styles.emptyCopy}>
        Tracked product prices will appear here when they change.
      </AppText>
    </View>
  );
}

export function OpportunityScreen({ navigate }: { navigate: (route: Route) => void }) {
  const [discoveryProducts, setDiscoveryProducts] = useState<DiscoveryProduct[]>([]);
  const [preferences, setPreferences] = useState<DiscoveryPreferences>();
  const [trackedProducts, setTrackedProducts] = useState<TrackedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [trackingProductId, setTrackingProductId] = useState<string>();
  const [catalogState, setCatalogState] = useState<{ refreshedAt?: string; stale: boolean }>({ stale: false });

  const load = useCallback(async () => {
    const [nextPreferences, catalog, tracked] = await Promise.all([
      getDiscoveryPreferences(),
      loadDiscoveryCatalog(),
      listTrackedProducts()
    ]);
    setPreferences(nextPreferences);
    setDiscoveryProducts(catalog.products);
    setTrackedProducts(tracked);
    setCatalogState({ refreshedAt: catalog.refreshedAt, stale: catalog.stale });
    await markDiscoveryProductsSeen(catalog.products.map((product) => product.id));
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const sections = useMemo(
    () => preferences ? buildDiscoverySections(discoveryProducts, preferences) : { picks: [], newlyDiscovered: [], exploreDifferent: [] },
    [discoveryProducts, preferences]
  );
  const availableCategories = useMemo(
    () => [...new Set(discoveryProducts.map((product) => product.category))],
    [discoveryProducts]
  );
  const favouriteBrandProducts = useMemo(
    () => sections.picks.filter((product) => preferences?.favoriteBrands.includes(product.brand)),
    [preferences?.favoriteBrands, sections.picks]
  );
  async function handleSavePreferences(update: Pick<DiscoveryPreferences, 'completed' | 'categories' | 'favoriteBrands' | 'budgetsByCategory'>) {
    const saved = await saveDiscoveryPreferences(update);
    setPreferences(saved);
    setShowPreferences(false);
  }

  async function handleDismissInvitation() {
    if (!preferences) {
      return;
    }
    setPreferences(await saveDiscoveryPreferences({
      completed: true,
      categories: preferences.categories,
      favoriteBrands: preferences.favoriteBrands,
      budgetsByCategory: preferences.budgetsByCategory
    }));
  }

  async function handleDismiss(productId: string) {
    await dismissDiscoveryProduct(productId);
    setPreferences(await getDiscoveryPreferences());
  }

  async function handleTrack(product: DiscoveryProduct) {
    const known = trackedProducts.find((tracked) => cleanUrl(tracked.canonicalUrl || tracked.url) === cleanUrl(product.url));
    if (known) {
      navigate({ name: 'detail', id: known.id });
      return;
    }

    setTrackingProductId(product.id);
    const result = await fetchAndParseProduct(product.url).catch(() => ({
      ok: false as const,
      code: 'network_error' as const,
      message: 'Qeemat could not reach this product right now. Try again in a moment.'
    }));
    setTrackingProductId(undefined);
    if (!result.ok) {
      Alert.alert('Could not start tracking', result.message);
      return;
    }

    if (result.product.variants?.length) {
      navigate({ name: 'add', initialUrl: product.url, shareEventId: Date.now(), returnTab: 'opportunities' });
      return;
    }

    const id = await createTrackedProduct({
      parsed: result.product,
      sourceUrl: product.url,
      checkPreference: 'daily',
      alertMode: 'price_drop',
      restockAlertEnabled: true
    });
    setTrackedProducts(await listTrackedProducts());
    Alert.alert(
      'Now tracking',
      'Qeemat will keep an eye on the observed price and stock on this device.',
      [
        { text: 'Keep browsing' },
        { text: 'Set target price', onPress: () => navigate({ name: 'trackingSettings', id }) }
      ]
    );
  }

  async function handleViewAtRetailer(product: DiscoveryProduct) {
    try {
      await Linking.openURL(product.url);
    } catch {
      Alert.alert('Could not open retailer', 'Please try again in a moment.');
    }
  }

  function openBrandListing(brand: string) {
    navigate({ name: 'listing', title: `${brand} products`, filter: { brand } });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <View style={styles.discoveryHeader}>
        <View style={styles.discoveryHeaderIcon}>
          <Sparkles size={22} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <AppText weight="bold" style={styles.heading}>For you</AppText>
          <AppText muted>Find things you want. Let Qeemat watch the price.</AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Edit discovery preferences" onPress={() => setShowPreferences(true)} style={styles.discoveryPreferencesButton}>
          <SlidersHorizontal size={19} color={colors.primary} />
        </Pressable>
      </View>

      {!preferences?.completed ? <DiscoverySetupCard onPress={() => setShowPreferences(true)} onDismiss={handleDismissInvitation} /> : null}

      {discoveryProducts.length > 0 ? (
        <>
          <View style={styles.discoverySection}>
            <AppText weight="bold" style={styles.discoverySectionTitle}>Picks for you</AppText>
            <AppText muted style={styles.discoverySectionCopy}>Observed product prices from a supported UAE retailer.</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discoveryFilterRail}>
              <DiscoveryFilterChip label="All" selected onPress={() => navigate({ name: 'listing', title: 'All products' })} />
              {availableCategories.map((category) => <DiscoveryFilterChip key={category} label={DISCOVERY_CATEGORY_LABELS[category]} selected={false} onPress={() => navigate({ name: 'listing', title: DISCOVERY_CATEGORY_LABELS[category], filter: { category } })} />)}
              {preferences?.categories.some((category) => preferences.budgetsByCategory[category] !== undefined) ? <DiscoveryFilterChip label="Within budget" selected={false} onPress={() => navigate({ name: 'listing', title: 'Within your budgets', withinBudget: true })} /> : null}
            </ScrollView>
            <DiscoveryProductGrid products={sections.picks.slice(0, 6)} trackedProducts={trackedProducts} trackingProductId={trackingProductId} onTrack={handleTrack} onDismiss={handleDismiss} onMoreLikeThis={openBrandListing} onViewAtRetailer={handleViewAtRetailer} />
          </View>

          {favouriteBrandProducts.length > 0 ? (
            <View style={styles.discoverySection}>
              <AppText weight="bold" style={styles.discoverySectionTitle}>Explore your favourite brands</AppText>
              <DiscoveryProductGrid products={favouriteBrandProducts.slice(0, 4)} trackedProducts={trackedProducts} trackingProductId={trackingProductId} onTrack={handleTrack} onDismiss={handleDismiss} onMoreLikeThis={openBrandListing} onViewAtRetailer={handleViewAtRetailer} />
            </View>
          ) : null}

          {sections.newlyDiscovered.length > 0 ? (
            <View style={styles.discoverySection}>
              <AppText weight="bold" style={styles.discoverySectionTitle}>Newly discovered</AppText>
              <AppText muted style={styles.discoverySectionCopy}>Products this device has not shown you before.</AppText>
              <DiscoveryProductGrid products={sections.newlyDiscovered.slice(0, 4)} trackedProducts={trackedProducts} trackingProductId={trackingProductId} onTrack={handleTrack} onDismiss={handleDismiss} onMoreLikeThis={openBrandListing} onViewAtRetailer={handleViewAtRetailer} />
            </View>
          ) : null}

          {sections.exploreDifferent.length > 0 ? (
            <View style={styles.discoverySection}>
              <AppText weight="bold" style={styles.discoverySectionTitle}>Explore something different</AppText>
              <DiscoveryProductGrid products={sections.exploreDifferent.slice(0, 4)} trackedProducts={trackedProducts} trackingProductId={trackingProductId} onTrack={handleTrack} onDismiss={handleDismiss} onMoreLikeThis={openBrandListing} onViewAtRetailer={handleViewAtRetailer} />
            </View>
          ) : null}
        </>
      ) : <EmptyDiscovery onPreferences={() => setShowPreferences(true)} />}

      {catalogState.refreshedAt ? <AppText muted style={styles.discoveryFreshness}>{catalogState.stale ? 'Showing saved discovery products from ' : 'Product prices observed '}{formatRelativeTime(catalogState.refreshedAt)}.</AppText> : null}
      <DiscoveryPreferencesSheet visible={showPreferences} initialPreferences={preferences} onClose={() => setShowPreferences(false)} onSave={handleSavePreferences} />
    </ScrollView>
  );
}

function DiscoveryListingScreen({
  title,
  initialFilter = {},
  initialWithinBudget = false,
  navigate
}: {
  title: string;
  initialFilter?: DiscoveryFilter;
  initialWithinBudget?: boolean;
  navigate: (route: Route) => void;
}) {
  const [products, setProducts] = useState<DiscoveryProduct[]>([]);
  const [preferences, setPreferences] = useState<DiscoveryPreferences>();
  const [trackedProducts, setTrackedProducts] = useState<TrackedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trackingProductId, setTrackingProductId] = useState<string>();
  const [catalogState, setCatalogState] = useState<{ refreshedAt?: string; stale: boolean }>({ stale: false });
  const [category, setCategory] = useState<DiscoveryCategory | undefined>(initialFilter.category);
  const [brand, setBrand] = useState(initialFilter.brand);
  const [siteKey, setSiteKey] = useState(initialFilter.siteKey);
  const [maximumPrice, setMaximumPrice] = useState(initialFilter.maximumPriceMinor ? String(initialFilter.maximumPriceMinor / 100) : '');
  const [withinBudget, setWithinBudget] = useState(initialWithinBudget);

  const load = useCallback(async () => {
    const [nextPreferences, catalog, tracked] = await Promise.all([
      getDiscoveryPreferences(),
      loadDiscoveryCatalog(),
      listTrackedProducts()
    ]);
    setPreferences(nextPreferences);
    setProducts(catalog.products);
    setTrackedProducts(tracked);
    setCatalogState({ refreshedAt: catalog.refreshedAt, stale: catalog.stale });
    await markDiscoveryProductsSeen(catalog.products.map((product) => product.id));
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const sections = useMemo(
    () => preferences ? buildDiscoverySections(products, preferences) : { picks: [], newlyDiscovered: [], exploreDifferent: [] },
    [preferences, products]
  );
  const categories = useMemo(() => [...new Set(products.map((product) => product.category))], [products]);
  const brands = useMemo(() => [...new Set(products.map((product) => product.brand))].sort(), [products]);
  const retailers = useMemo(() => [...new Set(products.map((product) => product.siteKey))], [products]);
  const filteredProducts = useMemo(() => {
    const priceLimit = parseTargetPriceInput(maximumPrice);
    const filtered = filterDiscoveryProducts(sections.picks, {
      category,
      brand,
      siteKey,
      maximumPriceMinor: priceLimit
    });
    return withinBudget
      ? filtered.filter((product) => {
        const budget = preferences?.budgetsByCategory[product.category];
        return budget !== undefined && product.priceMinor !== undefined && product.priceMinor <= budget;
      })
      : filtered;
  }, [brand, category, maximumPrice, preferences?.budgetsByCategory, sections.picks, siteKey, withinBudget]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleDismiss(productId: string) {
    await dismissDiscoveryProduct(productId);
    setPreferences(await getDiscoveryPreferences());
  }

  async function handleTrack(product: DiscoveryProduct) {
    const known = trackedProducts.find((tracked) => cleanUrl(tracked.canonicalUrl || tracked.url) === cleanUrl(product.url));
    if (known) {
      navigate({ name: 'detail', id: known.id });
      return;
    }

    setTrackingProductId(product.id);
    const result = await fetchAndParseProduct(product.url).catch(() => ({
      ok: false as const,
      code: 'network_error' as const,
      message: 'Qeemat could not reach this product right now. Try again in a moment.'
    }));
    setTrackingProductId(undefined);
    if (!result.ok) {
      Alert.alert('Could not start tracking', result.message);
      return;
    }

    if (result.product.variants?.length) {
      navigate({ name: 'add', initialUrl: product.url, shareEventId: Date.now(), returnTab: 'opportunities' });
      return;
    }

    const id = await createTrackedProduct({
      parsed: result.product,
      sourceUrl: product.url,
      checkPreference: 'daily',
      alertMode: 'price_drop',
      restockAlertEnabled: true
    });
    setTrackedProducts(await listTrackedProducts());
    Alert.alert('Now tracking', 'Qeemat will keep an eye on the observed price and stock on this device.', [
      { text: 'Keep browsing' },
      { text: 'Set target price', onPress: () => navigate({ name: 'trackingSettings', id }) }
    ]);
  }

  async function handleViewAtRetailer(product: DiscoveryProduct) {
    try {
      await Linking.openURL(product.url);
    } catch {
      Alert.alert('Could not open retailer', 'Please try again in a moment.');
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View style={styles.app}>
      <Header title={title} onBack={() => navigate({ name: 'tabs', tab: 'opportunities' })} />
      <ScrollView
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <View style={styles.listingFilters}>
          <AppText weight="bold" style={styles.listingFilterLabel}>Category</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discoveryFilterRail}>
            <DiscoveryFilterChip label="All" selected={!category} onPress={() => setCategory(undefined)} />
            {categories.map((item) => <DiscoveryFilterChip key={item} label={DISCOVERY_CATEGORY_LABELS[item]} selected={category === item} onPress={() => setCategory(item)} />)}
          </ScrollView>
          <AppText weight="bold" style={styles.listingFilterLabel}>Brand</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discoveryFilterRail}>
            <DiscoveryFilterChip label="All" selected={!brand} onPress={() => setBrand(undefined)} />
            {brands.map((item) => <DiscoveryFilterChip key={item} label={item} selected={brand === item} onPress={() => setBrand(item)} />)}
          </ScrollView>
          <AppText weight="bold" style={styles.listingFilterLabel}>Retailer</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discoveryFilterRail}>
            <DiscoveryFilterChip label="All" selected={!siteKey} onPress={() => setSiteKey(undefined)} />
            {retailers.map((item) => <DiscoveryFilterChip key={item} label={getSiteByKey(item).shortName} selected={siteKey === item} onPress={() => setSiteKey(item)} />)}
          </ScrollView>
          <View style={styles.listingPriceRow}>
            <View style={styles.listingPriceInputWrap}>
              <AppText muted>AED</AppText>
              <TextInput value={maximumPrice} onChangeText={setMaximumPrice} keyboardType="decimal-pad" placeholder="Maximum price" placeholderTextColor={colors.textSoft} style={styles.listingPriceInput} />
            </View>
            {preferences?.categories.some((item) => preferences.budgetsByCategory[item] !== undefined) ? <DiscoveryFilterChip label="Within my budgets" selected={withinBudget} onPress={() => setWithinBudget((current) => !current)} /> : null}
          </View>
        </View>
        <AppText muted style={styles.listingCount}>{filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} with observed prices</AppText>
        <DiscoveryProductGrid
          products={filteredProducts}
          trackedProducts={trackedProducts}
          trackingProductId={trackingProductId}
          onTrack={handleTrack}
          onDismiss={handleDismiss}
          onMoreLikeThis={setBrand}
          onViewAtRetailer={handleViewAtRetailer}
        />
        {catalogState.refreshedAt ? <AppText muted style={styles.discoveryFreshness}>{catalogState.stale ? 'Showing saved discovery products from ' : 'Product prices observed '}{formatRelativeTime(catalogState.refreshedAt)}.</AppText> : null}
      </ScrollView>
    </View>
  );
}

function SettingsScreen() {
  const { width, fontScale } = useWindowDimensions();
  const compact = isCompactLayout(width, fontScale);
  const [backgroundStatus, setBackgroundStatus] = useState<BackgroundStatus>();
  const [notificationEnabled, setNotificationEnabled] = useState<boolean>();
  const [queueingCheck, setQueueingCheck] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [requestingNotifications, setRequestingNotifications] = useState(false);
  const [batteryExempt, setBatteryExempt] = useState<boolean>();
  const [requestingBattery, setRequestingBattery] = useState(false);

  const loadStatus = useCallback(async () => {
    const [status, notificationsAllowed, batteryOptExempt] = await Promise.all([
      getBackgroundStatus(),
      ensureNotificationPermission(false),
      checkBatteryOptimizationExempt().catch(() => false),
    ]);

    setBackgroundStatus(status);
    setNotificationEnabled(notificationsAllowed);
    setBatteryExempt(batteryOptExempt);
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const selectedPresetHour = backgroundStatus?.preferredHour ?? 9;
  const preferredHourLabel = formatPreferredHour(backgroundStatus?.preferredHour ?? 9);
  const notificationLabel = notificationEnabled === undefined ? 'Checking' : notificationEnabled ? 'Allowed' : 'Blocked';

  async function queueBackgroundCheck() {
    setQueueingCheck(true);
    const queued = await runBackgroundCheckOnce().catch(() => false);
    setQueueingCheck(false);
    Alert.alert(
      queued ? 'Background check queued' : 'Background check unavailable',
      queued
        ? 'Android WorkManager will run a one-off check through the background task. Reopen the product detail after a moment to see a new snapshot.'
        : 'This build could not reach the Android background scheduler.'
    );
    await loadStatus();
  }

  async function requestNotifications() {
    setRequestingNotifications(true);
    const granted = await ensureNotificationPermission(true).catch(() => false);
    setRequestingNotifications(false);
    setNotificationEnabled(granted);

    if (!granted) {
      Alert.alert(
        'Notifications still blocked',
        'Android is still blocking notifications for Qeemat. Open the app notification settings and allow them there.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open settings', onPress: () => openNotificationSettings() }
        ]
      );
      return;
    }

    Alert.alert('Notifications enabled', 'Qeemat can now show local price alerts on this device.');
  }

  async function requestBatteryOptimize() {
    setRequestingBattery(true);

    // Try the standard API first
    const alreadyExempt = await requestBatteryOptimizationExemption().catch(() => false);
    if (alreadyExempt) {
      setRequestingBattery(false);
      setBatteryExempt(true);
      return;
    }

    // Then open the app system settings page as a reliable fallback
    const opened = await openAppSystemSettings().catch(() => false);
    setRequestingBattery(false);

    if (!opened) {
      Alert.alert('Could not open system settings');
      return;
    }

    Alert.alert(
      'App system settings opened',
      'Find "Battery" or "Battery optimization" in the app info screen and set Qeemat to "Unrestricted" / "Don\'t optimize".\n\nOn Samsung: Battery → Background usage limits → Never auto-disable.\nOn Xiaomi: Battery → App battery saver → No restrictions.\nOn other devices: Look for "Battery optimization" or "App power management".',
      [
        { text: 'Check status', onPress: async () => {
          const exempt = await checkBatteryOptimizationExempt().catch(() => false);
          setBatteryExempt(exempt);
          if (exempt) {
            Alert.alert('Qeemat is now exempt from battery optimization.');
          }
        }},
        { text: 'Done' }
      ]
    );
  }

  async function selectBackgroundSchedule(preferredHour: number) {
    if (savingSchedule || preferredHour === backgroundStatus?.preferredHour) {
      return;
    }

    setSavingSchedule(true);

    try {
      await setBackgroundPreferredHour(preferredHour);
      const scheduled = await scheduleBackgroundChecks(preferredHour).catch(() => false);
      if (!scheduled) {
        Alert.alert('Background schedule unavailable', 'This build could not update the Android background scheduler.');
        return;
      }

      const nextStatus = await markBackgroundSchedule(preferredHour);
      setBackgroundStatus(nextStatus);
    } finally {
      setSavingSchedule(false);
      await loadStatus();
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <AppText weight="bold" style={styles.heading}>
        Settings
      </AppText>
      <AppText muted style={styles.settingsIntro}>
        Control local alerts, daily background timing, and the stores Qeemat can track in this MVP.
      </AppText>
      <View style={styles.settingsCard}>
        <View style={styles.settingsStack}>
          <View style={styles.settingsHeaderRow}>
            <AppText weight="bold">Supported stores</AppText>
            <View style={styles.settingsBadge}>
              <AppText weight="semibold" style={styles.settingsBadgeText}>
                {SUPPORTED_SITES.filter(s => s.status === 'supported').length} live
              </AppText>
            </View>
          </View>
          <AppText muted style={styles.settingsBodyText}>
            Product links are currently supported for these stores. Amazon support is kept intentionally lightweight for the MVP across selected regional domains.
          </AppText>
          <View style={styles.settingsChipWrap}>
            {SUPPORTED_SITES.filter(s => s.status === 'supported').map((site) => (
              <View key={site.key} style={styles.settingsChip}>
                <SiteIcon siteKey={site.key} size={14} />
                <AppText weight="medium" style={styles.settingsChipText}>
                  {site.shortName}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={styles.settingsCard}>
        <View style={styles.settingsStack}>
          <View style={styles.settingsHeaderRow}>
            <AppText weight="bold">Notifications</AppText>
            <View style={[styles.settingsBadge, notificationEnabled ? styles.settingsBadgeSuccess : styles.settingsBadgeMuted]}>
              <AppText weight="semibold" style={[styles.settingsBadgeText, notificationEnabled && styles.settingsBadgeSuccessText]}>
                {notificationLabel}
              </AppText>
            </View>
          </View>
          <AppText muted style={styles.settingsBodyText}>
            Local price alerts need Android notification access. If Android still blocks them after the prompt, open the app notification settings directly.
          </AppText>
          <PrimaryButton
            label={notificationEnabled ? 'Open notification settings' : 'Enable notifications'}
            variant="outline"
            onPress={notificationEnabled ? openNotificationSettings : requestNotifications}
            loading={requestingNotifications}
          />
        </View>
      </View>
      <View style={styles.settingsCard}>
        <View style={styles.settingsStack}>
          <View style={styles.settingsHeaderRow}>
            <AppText weight="bold">Battery optimization</AppText>
            <View style={[styles.settingsBadge, batteryExempt ? styles.settingsBadgeSuccess : styles.settingsBadgeMuted]}>
              <AppText weight="semibold" style={[styles.settingsBadgeText, batteryExempt && styles.settingsBadgeSuccessText]}>
                {batteryExempt === undefined ? 'Checking' : batteryExempt ? 'Exempt' : 'Restricted'}
              </AppText>
            </View>
          </View>
          <AppText muted style={styles.settingsBodyText}>
            Android may block background checks when the app is closed. Exempt Qeemat from battery optimization so WorkManager can wake up the device for daily price checks.
          </AppText>
          <PrimaryButton
            label={batteryExempt === undefined ? 'Checking' : 'Open app system settings'}
            variant="outline"
            onPress={requestBatteryOptimize}
            loading={requestingBattery}
          />
        </View>
      </View>
      <View style={styles.settingsCard}>
        <View style={styles.settingsStack}>
          <View style={styles.settingsHeaderRow}>
            <View style={styles.flex}>
              <AppText weight="bold">Daily background check time</AppText>
              <AppText muted style={styles.settingsBodyText}>
                Choose when Android runs the daily price check.
              </AppText>
            </View>
            <View style={[styles.settingsBadge, styles.settingsBadgeSuccess]}>
              <AppText weight="semibold" style={[styles.settingsBadgeText, styles.settingsBadgeSuccessText]}>
                {preferredHourLabel}
              </AppText>
            </View>
          </View>
          <View style={[styles.settingsPresetRow, compact && styles.settingsPresetRowCompact]}>
            {BACKGROUND_TIME_PRESETS.map((preset) => {
              const selected = preset.hour === selectedPresetHour;
              return (
                <Pressable
                  key={preset.label}
                  style={[styles.settingsPreset, compact && styles.settingsPresetCompact, selected && styles.settingsPresetActive, savingSchedule && styles.settingsPresetDisabled]}
                  onPress={() => selectBackgroundSchedule(preset.hour)}
                  disabled={savingSchedule}
                >
                  <AppText weight="semibold" style={[styles.settingsPresetTitle, selected && styles.settingsPresetTitleActive]}>
                    {preset.label}
                  </AppText>
                  <AppText muted style={[styles.settingsPresetValue, selected && styles.settingsPresetValueActive]}>
                    {formatPreferredHour(preset.hour)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.settingsMetaCard}>
            <InfoRow label="Target" value={preferredHourLabel} />
            <InfoRow label="Scheduled" value={formatStatusTime(backgroundStatus?.lastScheduledAt)} />
            <InfoRow label="Started" value={formatStatusTime(backgroundStatus?.lastStartedAt)} />
            <InfoRow label="Completed" value={formatStatusTime(backgroundStatus?.lastCompletedAt)} />
            <InfoRow
              label="Source"
              value={backgroundStatus?.lastSource ? formatRunSource(backgroundStatus.lastSource, backgroundStatus.lastForceRun) : 'No background run yet'}
            />
            {backgroundStatus?.lastRunError ? <AppText style={styles.errorText}>Last run error: {backgroundStatus.lastRunError}</AppText> : null}
          </View>
          <AppText muted style={styles.settingsHint}>
            Best-effort — enable battery exemption above for reliability.
          </AppText>
          <PrimaryButton label="Queue background check once" variant="outline" onPress={queueBackgroundCheck} loading={queueingCheck} />
        </View>
      </View>
      <PrimaryButton
        label="Delete all local data"
        variant="danger"
        onPress={() =>
          Alert.alert('Delete local data?', 'This removes all tracked products and price history from this device.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => Promise.all([deleteAllLocalData(), clearDiscoveryData()]) }
          ])
        }
      />
    </ScrollView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <AppText weight="bold" style={styles.sectionTitle}>
      {title}
    </AppText>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <AppText muted>{label}</AppText>
      <AppText weight="medium" style={styles.infoRowValue}>
        {value}
      </AppText>
    </View>
  );
}

function StatCard({ label, price, currency, tone, emphasized = false }: { label: string; price?: number; currency: string; tone: 'green' | 'red' | 'neutral'; emphasized?: boolean }) {
  return (
    <View style={[styles.statCard, emphasized && styles.statCardEmphasized]}>
      <AppText muted>{label}</AppText>
      <AppText weight="bold" style={[styles.statPrice, emphasized && styles.statPriceEmphasized, tone === 'green' ? styles.greenText : tone === 'red' ? styles.redText : undefined]}>
        {formatPrice(price, currency)}
      </AppText>
    </View>
  );
}

type SnapshotGroup = {
  snapshots: PriceSnapshot[];
  key: string;
};

/** Group consecutive snapshots with identical price + availability into a single row. */
function groupSnapshots(snapshots: PriceSnapshot[]): SnapshotGroup[] {
  const groups: SnapshotGroup[] = [];
  for (const s of snapshots) {
    const prev = groups.length > 0 ? groups[groups.length - 1].snapshots[0] : undefined;
    const same =
      prev &&
      prev.priceMinor === s.priceMinor &&
      prev.availability === s.availability &&
      prev.source === s.source &&
      !prev.errorCode &&
      !s.errorCode;
    if (same) {
      groups[groups.length - 1].snapshots.push(s);
    } else {
      groups.push({ snapshots: [s], key: String(s.id) });
    }
  }
  return groups;
}

function formatStatusTime(iso?: string): string {
  if (!iso) {
    return 'Never';
  }

  return `${formatSnapshotTime(iso)} (${formatRelativeTime(iso)})`;
}

function formatPreferredHour(hour: number): string {
  const normalized = Number.isFinite(hour) ? Math.min(23, Math.max(0, Math.round(hour))) : 9;
  const suffix = normalized >= 12 ? 'PM' : 'AM';
  const hour12 = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${hour12}:00 ${suffix}`;
}

function snapshotSourceLabel(source: SnapshotSource): string {
  if (source === 'manual_single') {
    return 'Check now';
  }

  if (source === 'manual_batch') {
    return 'Recheck all';
  }

  if (source === 'background') {
    return 'Background';
  }

  return 'Unknown';
}

function snapshotSourceBadgeStyle(source: SnapshotSource) {
  if (source === 'manual_single') {
    return styles.sourceBadgeBlue;
  }

  if (source === 'manual_batch') {
    return styles.sourceBadgeAmber;
  }

  if (source === 'background') {
    return styles.sourceBadgeGreen;
  }

  return styles.sourceBadgeMuted;
}

function formatRunSource(source: string, forced?: boolean): string {
  if (source === 'work-manager') {
    return forced ? 'Background (forced once)' : 'Background';
  }

  return source;
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.background
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background
  },
  headerBar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  headerButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    fontSize: 20,
    flex: 1,
    minWidth: 0,
    textAlign: 'center'
  },
  screenContent: {
    padding: 20,
    paddingBottom: 110,
    gap: 16
  },
  addScreenContent: {
    paddingTop: 28,
    gap: 18
  },
  addIntroText: {
    fontSize: 16,
    lineHeight: 24
  },
  heading: {
    fontSize: 28,
    lineHeight: 34
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12
  },
  countPill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  countText: {
    fontSize: 12
  },
  storeFilterRail: {
    gap: 8,
    paddingVertical: 2
  },
  storeFilterRailCompact: {
    gap: 6
  },
  controlsButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.blueSoft,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  controlsButtonText: {
    color: colors.primary,
    fontSize: 14
  },
  controlsCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary
  },
  controlsCountText: {
    color: colors.surface,
    fontSize: 11
  },
  activeControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: -8
  },
  activeControlsSummary: {
    flex: 1,
    fontSize: 13
  },
  clearControlsText: {
    color: colors.primary,
    fontSize: 13
  },
  controlSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  controlSheetScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.34)'
  },
  controlSheetBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  controlSheet: {
    maxHeight: '80%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 28
  },
  controlSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 20
  },
  controlSheetTitle: {
    fontSize: 20
  },
  controlSheetClose: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted
  },
  controlSheetContent: {
    gap: 20
  },
  watchlistToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  archiveToggle: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted
  },
  archiveToggleText: {
    color: colors.textMuted,
    fontSize: 13
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16
  },
  bulkActionBar: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginHorizontal: 12,
    marginBottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    ...shadow
  },
  bulkActionButton: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.md,
    paddingVertical: 4
  },
  bulkActionButtonPressed: {
    opacity: 0.72
  },
  bulkActionText: {
    color: colors.primary,
    fontSize: 10
  },
  bulkDeleteText: {
    color: colors.red,
    fontSize: 10
  },
  bulkClearFolder: {
    alignSelf: 'flex-start',
    marginBottom: 14
  },
  filterSection: {
    gap: 8
  },
  filterLabel: {
    fontSize: 14
  },
  textFilterRail: {
    gap: 8,
    paddingVertical: 2
  },
  textFilterButton: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  textFilterButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.blueSoft
  },
  textFilterText: {
    fontSize: 13
  },
  textFilterTextSelected: {
    color: colors.primary
  },
  storeFilterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  storeFilterButtonSelected: {
    backgroundColor: colors.blueSoft,
    borderColor: colors.primary
  },
  storeFilterButtonPressed: {
    opacity: 0.78
  },
  cardList: {
    gap: 12
  },
  oosSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 4
  },
  oosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  oosDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.amber
  },
  oosLabel: {
    fontSize: 13
  },
  oosCount: {
    fontSize: 13,
    flex: 1
  },
  oosThumbnails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4
  },
  oosThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.surface,
    backgroundColor: colors.surfaceMuted
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    alignItems: 'center',
    ...shadow
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  emptyTitle: {
    fontSize: 20
  },
  emptyCopy: {
    textAlign: 'center',
    marginTop: 8
  },
  emptyButton: {
    marginTop: 18
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow
  },
  tabBar: {
    height: 74,
    flexDirection: 'row',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 12
  },
  tabLabelActive: {
    color: colors.primary
  },
  formSection: {
    gap: 12
  },
  previewSection: {
    gap: 16
  },
  variantSection: {
    gap: 4
  },
  variantHint: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 2
  },
  formLabel: {
    fontSize: 17
  },
  fieldGroup: {
    gap: 8
  },
  fieldHint: {
    fontSize: 13,
    lineHeight: 18
  },
  collectionPickerRail: {
    gap: 8,
    paddingVertical: 2
  },
  collectionPickerChip: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  collectionPickerChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.blueSoft
  },
  collectionPickerChipText: {
    fontSize: 13
  },
  collectionPickerChipTextSelected: {
    color: colors.primary
  },
  settingToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  inputWrap: {
    minHeight: 68,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16
  },
  inputDetected: {
    borderColor: colors.green
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    color: colors.text
  },
  detectedSource: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.greenSoft
  },
  detectedSourceIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 1
  },
  detectedSourceCopy: {
    flex: 1,
    gap: 2
  },
  detectedText: {
    color: colors.green,
    fontSize: 15
  },
  detectedHint: {
    fontSize: 13,
    lineHeight: 18
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    paddingVertical: 14
  },
  chipText: {
    fontSize: 15
  },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.redSoft
  },
  errorBoxText: {
    color: colors.red,
    flex: 1
  },
  previewCard: {
    flexDirection: 'row',
    gap: 18,
    padding: 18,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadow
  },
  previewCardCompact: {
    flexDirection: 'column'
  },
  previewImageWrap: {
    width: 118,
    height: 136,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  previewImageWrapCompact: {
    width: '100%',
    height: 160
  },
  previewImage: {
    width: 106,
    height: 124
  },
  previewCopy: {
    flex: 1,
    minWidth: 0
  },
  previewTitle: {
    fontSize: 17,
    lineHeight: 23
  },
  storePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  storePillText: {
    fontSize: 13
  },
  caption: {
    marginTop: 18,
    fontSize: 13
  },
  previewPrice: {
    fontSize: 26,
    lineHeight: 32
  },
  detailHero: {
    flexDirection: 'row',
    gap: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  detailHeroCompact: {
    flexDirection: 'column'
  },
  detailImageWrap: {
    width: 112,
    height: 142,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  detailImageWrapCompact: {
    width: '100%',
    height: 180
  },
  detailImage: {
    width: 104,
    height: 134
  },
  detailCopy: {
    flex: 1,
    minWidth: 0,
    gap: 6
  },
  detailHeaderActions: {
    flexDirection: 'row',
    gap: 4
  },
  detailTitle: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  currentPrice: {
    fontSize: 26,
    lineHeight: 32
  },
  oosBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.amberSoft,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8
  },
  oosBannerText: {
    color: colors.amber,
    fontSize: 13,
    flex: 1
  },
  sectionTitle: {
    fontSize: 18
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12
  },
  insightCaption: {
    fontSize: 12,
    marginTop: -8
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    ...shadow
  },
  statCardEmphasized: {
    backgroundColor: colors.blueSoft,
    borderColor: colors.primary
  },
  statPrice: {
    marginTop: 4,
    fontSize: 20
  },
  statPriceEmphasized: {
    color: colors.primary,
    fontSize: 24
  },
  greenText: {
    color: colors.green
  },
  redText: {
    color: colors.red
  },
  changedPrice: {
    color: colors.green
  },
  restockActivityLabel: {
    color: colors.green,
    fontSize: 14
  },
  restockActivityBadge: {
    backgroundColor: colors.greenSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  restockActivityBadgeText: {
    color: colors.green,
    fontSize: 11
  },
  snapshotList: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden'
  },
  snapshotRow: {
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  snapshotRowSubtle: {
    opacity: 0.5,
    minHeight: 42,
    paddingVertical: 6,
  },
  snapshotCollapsed: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  snapshotCollapsedText: {
    fontSize: 12,
  },
  snapshotMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  snapshotPriceBlock: {
    alignItems: 'flex-end',
    gap: 4
  },
  snapshotAvailability: {
    fontSize: 12,
    textTransform: 'capitalize'
  },
  sourceBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  sourceBadgeText: {
    fontSize: 11
  },
  sourceBadgeBlue: {
    backgroundColor: colors.blueSoft
  },
  sourceBadgeAmber: {
    backgroundColor: colors.amberSoft
  },
  sourceBadgeGreen: {
    backgroundColor: colors.greenSoft
  },
  sourceBadgeMuted: {
    backgroundColor: colors.surfaceMuted
  },
  bottomAction: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  bottomActionRow: {
    flexDirection: 'row',
    gap: 12,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  bottomActionHalf: {
    flex: 1
  },
  discoveryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  discoveryHeaderIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blueSoft
  },
  discoveryPreferencesButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blueSoft
  },
  discoverySection: {
    gap: 12
  },
  discoverySectionTitle: {
    fontSize: 18
  },
  discoverySectionCopy: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: -6
  },
  discoveryFilterRail: {
    gap: 8,
    paddingVertical: 2
  },
  discoveryFreshness: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: -2
  },
  listingFilters: {
    gap: 8
  },
  listingFilterLabel: {
    fontSize: 14,
    marginTop: 4
  },
  listingPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4
  },
  listingPriceInputWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface
  },
  listingPriceInput: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    paddingVertical: 10
  },
  listingCount: {
    fontSize: 13,
    marginTop: -2
  },
  activityCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  activityThumb: {
    width: 48,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted
  },
  activityThumbPlaceholder: {
    width: 48,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  activityBody: {
    flex: 1,
    minWidth: 0,
    gap: 6
  },
  activityTitle: {
    fontSize: 15,
    lineHeight: 20
  },
  activityPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  activityOldPrice: {
    fontSize: 13,
    textDecorationLine: 'line-through'
  },
  activityNewPrice: {
    fontSize: 16
  },
  activityFirstPrice: {
    fontSize: 16,
    color: colors.primary
  },
  activityPriceDown: {
    color: colors.green
  },
  activityPriceUp: {
    color: colors.red
  },
  activityMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  activityDirectionIcon: {
    width: 18,
    alignItems: 'center'
  },
  activityFirstDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary
  },
  activityFirstBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.blueSoft
  },
  activityFirstBadgeText: {
    fontSize: 11,
    color: colors.primary
  },
  activityDateHeader: {
    paddingVertical: 10,
    paddingHorizontal: 2,
    marginTop: 4
  },
  activityDateHeaderText: {
    fontSize: 13,
    color: colors.textMuted
  },
  oosActivityLabel: {
    fontSize: 13,
    color: colors.amber,
    flex: 1
  },
  oosActivityBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.amberSoft
  },
  oosActivityBadgeText: {
    fontSize: 11,
    color: colors.amber
  },
  settingsCard: {
    padding: 20,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadow
  },
  settingsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  settingsBodyText: {
    lineHeight: 22
  },
  settingsIntro: {
    marginTop: -4,
    lineHeight: 22
  },
  settingsStack: {
    gap: 16
  },
  settingsBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.surfaceMuted
  },
  settingsBadgeMuted: {
    backgroundColor: colors.surfaceMuted
  },
  settingsBadgeSuccess: {
    backgroundColor: colors.greenSoft
  },
  settingsBadgeText: {
    fontSize: 12,
    color: colors.textMuted
  },
  settingsBadgeSuccessText: {
    color: colors.green
  },
  settingsChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  settingsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F7FBFF',
    borderWidth: 1,
    borderColor: colors.border
  },
  settingsChipText: {
    fontSize: 13
  },
  settingsHint: {
    fontSize: 12,
    lineHeight: 18
  },
  settingsMetaCard: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    padding: 14,
    gap: 12
  },
  settingsPresetRow: {
    flexDirection: 'row',
    gap: 12
  },
  settingsPresetRowCompact: {
    flexDirection: 'column'
  },
  settingsPreset: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 6
  },
  settingsPresetCompact: {
    flexGrow: 0,
    width: '100%'
  },
  settingsPresetActive: {
    borderColor: colors.primary,
    backgroundColor: '#F7FBFF'
  },
  settingsPresetDisabled: {
    opacity: 0.7
  },
  settingsPresetTitle: {
    fontSize: 14
  },
  settingsPresetTitleActive: {
    color: colors.primary
  },
  settingsPresetValue: {
    fontSize: 12
  },
  settingsPresetValueActive: {
    color: colors.primary
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  infoRowValue: {
    flexShrink: 1,
    textAlign: 'right'
  },
  flex: {
    flex: 1,
    minWidth: 0
  },
  errorText: {
    color: colors.red
  },
  settingsDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4
  }
});

const onboardingStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    paddingHorizontal: 24
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 14,
    width: '100%',
    ...shadow
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  title: {
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: -0.3
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 8
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,
    borderRadius: 4
  },
  actions: {
    gap: 6,
    width: '100%',
    marginTop: 8,
    alignItems: 'center'
  },
  skipBtn: {
    paddingVertical: 12,
    paddingHorizontal: 10
  },
  skipLabel: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '500'
  }
});
