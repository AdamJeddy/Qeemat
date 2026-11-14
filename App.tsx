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
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  useWindowDimensions,
  View
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  Archive,
  ArrowLeft,
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  Clock,
  Copy,
  Download,
  FolderInput,
  ImageOff,
  Link2,
  Pause,
  Plus,
  RefreshCcw,
  Search,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Trash2,
  X
} from 'lucide-react-native';

import { AppText } from './src/components/AppText';
import { AppTextInput } from './src/components/AppTextInput';
import { ActivityList } from './src/components/ActivityList';
import { Surface } from './src/components/Surface';
import { FontScaleContext } from './src/theme/FontScaleContext';
import { OptionGroup } from './src/components/OptionGroup';
import { SiteIcon } from './src/components/SiteIcon';
import { PriceChart } from './src/components/PriceChart';
import { PrimaryButton } from './src/components/PrimaryButton';
import { ProductCard } from './src/components/ProductCard';
import { ProductCategoryPicker } from './src/components/ProductCategoryPicker';
import { SourceLabel } from './src/components/SourceLabel';
import { DISCOVERY_CATEGORY_LABELS as SHOPPING_CATEGORY_LABELS, ShoppingCategory } from './src/domain/discoveryCategories';
import { inferWatchlistCategory, watchlistCategories } from './src/domain/watchlistDiscovery';
import { mergeProductMetadata } from './src/domain/productMetadata';
import { StatusPill } from './src/components/StatusPill';
import { VariantSelector } from './src/components/VariantSelector';
import { UpdateNotice } from './src/components/UpdateNotice';
import { clearUpdateNotificationHistory } from './src/domain/updateBackground';
import { AvailableUpdate } from './src/domain/updates';
import { checkForUpdateForDevice } from './src/domain/appUpdate';
import { clearDismissedUpdateVersion, dismissUpdateVersion, getDismissedUpdateVersion, shouldBadgeUpdate } from './src/domain/updatePrompt';
import {
  DiscoveryFilterChip,
  DiscoveryProductGrid,
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
  advanceDiscoveryOffset,
  clearDiscoveryData,
  dismissDiscoveryProduct,
  getDiscoveryPreferences,
  markDiscoveryProductsSeen
} from './src/data/discovery';
import { runBackgroundCheckOnce, scheduleBackgroundChecks, scheduleUpdateChecks, scheduleDiscoveryChecks, checkBatteryOptimizationExempt, requestBatteryOptimizationExemption, openAppSystemSettings } from './src/domain/backgroundScheduler';
import { checkAllActiveProducts, checkProductById } from './src/domain/checker';
import { availableCheckPreferences, formatRelativeTime, formatSnapshotTime } from './src/domain/dates';
import { getOnboardingState, markOnboardingCompleted } from './src/domain/onboarding';
import { ensureNotificationPermission, openNotificationSettings } from './src/domain/notifications';
import { fetchAndParseProduct, fetchTheDealVariantForSaving } from './src/domain/parser';
import { calculatePriceInsights } from './src/domain/priceInsights';
import { formatPrice, parseTargetPriceInput } from './src/domain/price';
import { priceBasisSuffix, verifyDiscoveryTrackingBasis } from './src/domain/priceBasis';
import { cleanUrl, detectSharedUrl, detectSupportedSite, getSiteByKey, normalizeUrl, SUPPORTED_SITES } from './src/domain/sites';
import { ActivityEvent, AlertMode, CheckPreference, DiscoveryCategory, DiscoveryPreferences, DiscoveryProduct, ParsedProduct, PriceSnapshot, ProductWithSnapshots, SiteKey, TrackedProduct } from './src/domain/types';
import { colors, layoutMetrics, radius, shadow, typography } from './src/theme/theme';
import { isCompactLayout } from './src/theme/layout';
import {
  filterWatchlistProducts,
  getWatchlistFolders,
  getWatchlistSites,
  searchWatchlistProducts,
  sortWatchlistProducts,
  WatchlistSort
} from './src/domain/watchlist';
import { findTrackingMatches, trackingOptionLabel, TrackingMatch } from './src/domain/duplicates';
import { resolveSelectedVariant, toVariantSelection, updateSelectedVariantAttributes, VariantAttributes } from './src/domain/variants';
import {
  buildDiscoverySections,
  DISCOVERY_CATEGORY_LABELS,
  discoveryVariantChoices,
  discoveryFeedbackId,
  uniqueDiscoveryBrands,
  filterDiscoveryProducts,
  isDiscoveryProductDismissed
} from './src/domain/discovery';
import { DiscoveryCatalogResult, loadDiscoveryCatalog } from './src/domain/discoveryCatalog';
import { DiscoveryBrowseSheet } from './src/components/DiscoveryBrowseSheet';
import { DiscoveryDepartments } from './src/components/DiscoveryDepartments';
import { DiscoverySearch } from './src/components/DiscoverySearch';
import { loadProductSearch, ProductSearchResult } from './src/domain/discoverySearchCatalog';
import { DISCOVERY_SOURCE_MAPS, selectDiscoveryCollections } from './src/domain/discoverySources';

type TabKey = 'watchlist' | 'opportunities' | 'activity' | 'settings';
type Route =
  | { name: 'tabs'; tab: TabKey }
  | { name: 'add'; initialUrl?: string; shareEventId?: number; returnTab?: TabKey }
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
  const { fontScale } = useWindowDimensions();
  const [route, setRoute] = useState<Route>({ name: 'tabs', tab: 'watchlist' });
  const [discoveryOffset, setDiscoveryOffset] = useState(0);
  const [lastTab, setLastTab] = useState<TabKey>('watchlist');
  const [tabsRefreshKey, setTabsRefreshKey] = useState(0);
  const previousRouteName = useRef(route.name);
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const shareEventId = useRef(0);
  const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdate>();
  const [dismissedUpdateVersion, setDismissedUpdateVersion] = useState<string>();
  const [updatePopupVisible, setUpdatePopupVisible] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      await initializeDatabase();
      const offset = await advanceDiscoveryOffset().catch(() => 0);
      if (active) { setDiscoveryOffset(offset); }
      const [backgroundStatus, onboarding] = await Promise.all([
        getBackgroundStatus(),
        getOnboardingState()
      ]);

      if (!onboarding.completed) {
        if (active) {
          setShowOnboarding(true);
        }
      }

      await scheduleUpdateChecks().catch(() => false);
      await scheduleDiscoveryChecks().catch(() => false);
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
    let active = true;
    const installedVersion = Platform.OS === 'android' ? NativeModules.QeematBackgroundCheck?.getConstants?.()?.appVersion : undefined;
    (async () => {
      const [dismissedVersion, update] = await Promise.all([
        getDismissedUpdateVersion(),
        typeof installedVersion === 'string' ? checkForUpdateForDevice(installedVersion) : Promise.resolve(undefined)
      ]);
      if (!active) {
        return;
      }
      setDismissedUpdateVersion(dismissedVersion);
      if (update) {
        setAvailableUpdate(update);
        setUpdatePopupVisible(dismissedVersion !== update.version);
      }
    })().catch(() => undefined);
    return () => { active = false; };
  }, []);

  const dismissUpdate = useCallback((version: string) => {
    setUpdatePopupVisible(false);
    setDismissedUpdateVersion(version);
    dismissUpdateVersion(version).catch(() => undefined);
  }, []);

  const openUpdatePopup = useCallback(() => {
    if (availableUpdate) {
      setUpdatePopupVisible(true);
    }
  }, [availableUpdate]);

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
    if (route.name === 'tabs') {
      setLastTab(route.tab);
    }
  }, [route]);

  // The tab stack stays mounted so lists keep their state. When a flow (Add,
  // product detail, tracking settings) returns to the tabs, bump a refresh key
  // so the visible tab reloads its stored data instead of showing stale rows.
  useEffect(() => {
    if (previousRouteName.current !== 'tabs' && route.name === 'tabs') {
      setTabsRefreshKey((value) => value + 1);
    }
    previousRouteName.current = route.name;
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

  const blueStatusBar = route.name === 'tabs' && route.tab === 'watchlist' && !showOnboarding;
  const activeTab: TabKey = route.name === 'tabs' ? route.tab : lastTab;

  return (
    <FontScaleContext.Provider value={fontScale}>
    <SafeAreaProvider>
      <StatusBar barStyle={blueStatusBar ? 'light-content' : 'dark-content'} backgroundColor={blueStatusBar ? colors.primary : colors.background} />
      <SafeAreaView edges={['top']} style={[styles.app, blueStatusBar && styles.watchlistSystemBar]}>
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.app}>
        <UpdateNotice update={availableUpdate} visible={updatePopupVisible && !showOnboarding} onDismiss={dismissUpdate} />
        <View style={route.name === 'tabs' ? styles.flex : styles.hiddenTab}>
          <TabsScreen
            tab={activeTab}
            navigate={setRoute}
            discoveryOffset={discoveryOffset}
            refreshKey={tabsRefreshKey}
            availableUpdate={availableUpdate}
            showUpdateDot={shouldBadgeUpdate(availableUpdate, dismissedUpdateVersion)}
            onOpenUpdate={openUpdatePopup}
          />
        </View>
        {route.name === 'add' ? <AddScreen initialUrl={route.initialUrl} shareEventId={route.shareEventId} returnTab={route.returnTab} navigate={setRoute} /> : null}
        {route.name === 'detail' ? <DetailScreen productId={route.id} navigate={setRoute} /> : null}
        {route.name === 'trackingSettings' ? <TrackingSettingsScreen productId={route.id} navigate={setRoute} /> : null}
        {showOnboarding ? <OnboardingOverlay onClose={() => setShowOnboarding(false)} /> : null}
      </SafeAreaView>
      </SafeAreaView>
    </SafeAreaProvider>
    </FontScaleContext.Provider>
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
        <AppText weight="bold" accessibilityRole="header" style={onboardingStyles.title}>
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


  if (route.name === 'detail') {
    return { name: 'tabs', tab: 'watchlist' };
  }

  if (route.name === 'trackingSettings') {
    return { name: 'detail', id: route.id };
  }

  return undefined;
}

export function TabsScreen({
  tab,
  navigate,
  discoveryOffset,
  refreshKey = 0,
  availableUpdate,
  showUpdateDot = false,
  onOpenUpdate
}: {
  tab: TabKey;
  navigate: (route: Route) => void;
  discoveryOffset?: number;
  refreshKey?: number;
  availableUpdate?: AvailableUpdate;
  showUpdateDot?: boolean;
  onOpenUpdate?: () => void;
}) {
  const [searchOpened, setSearchOpened] = useState(tab === 'opportunities');
  useEffect(() => { if (tab === 'opportunities') { setSearchOpened(true); } }, [tab]);
  return (
    <View style={styles.app}>
      {tab === 'watchlist' ? <WatchlistScreen navigate={navigate} refreshKey={refreshKey} showUpdateDot={showUpdateDot} /> : null}
      {searchOpened || tab === 'opportunities' ? <View style={tab === 'opportunities' ? styles.flex : styles.hiddenTab}><OpportunityScreen navigate={navigate} active={tab === 'opportunities'} sessionOffset={discoveryOffset} /></View> : null}
      {tab === 'activity' ? <ActivityScreen navigate={navigate} refreshKey={refreshKey} availableUpdate={availableUpdate} onOpenUpdate={onOpenUpdate} /> : null}
      {tab === 'settings' ? <SettingsScreen refreshKey={refreshKey} /> : null}
      <View style={styles.tabBar}>
        <TabButton active={tab === 'watchlist'} label="Watchlist" icon={<Bookmark fill={tab === 'watchlist' ? colors.primary : 'none'} />} onPress={() => navigate({ name: 'tabs', tab: 'watchlist' })} />
        <TabButton active={tab === 'opportunities'} label="Search" icon={<Search />} onPress={() => navigate({ name: 'tabs', tab: 'opportunities' })} />
        <TabButton active={tab === 'activity'} label="Activity" icon={<Clock />} onPress={() => navigate({ name: 'tabs', tab: 'activity' })} showDot={showUpdateDot} />
        <TabButton active={tab === 'settings'} label="Settings" icon={<SettingsIcon />} onPress={() => navigate({ name: 'tabs', tab: 'settings' })} />
      </View>
    </View>
  );
}

function TabButton({ active, label, icon, onPress, showDot = false }: { active: boolean; label: string; icon: React.ReactElement; onPress: () => void; showDot?: boolean }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }} style={styles.tabButton} onPress={onPress}>
      <View style={[styles.tabButtonContent, active && styles.tabButtonActive]}>
      <View style={styles.tabIconWrap}>
        {React.cloneElement(icon as React.ReactElement<{ size: number; color: string }>, {
          size: 22,
          color: active ? colors.primary : colors.textMuted
        })}
        {showDot ? <View style={styles.tabUpdateDot} /> : null}
      </View>
      <AppText weight="semibold" style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {label}
      </AppText>
      </View>
    </Pressable>
  );
}

function Header({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <View style={styles.headerBar}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={styles.headerButton}>
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
      ) : (
        <View style={styles.headerButton} />
      )}
      <AppText weight="bold" accessibilityRole="header" style={styles.headerTitle} numberOfLines={1}>
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
  sites,
  folders,
  storeFilters,
  folderFilter,
  sort,
  onStoreFilters,
  onFolderFilter,
  onSort,
  onClear
}: {
  visible: boolean;
  onClose: () => void;
  sites: SiteKey[];
  folders: string[];
  storeFilters: SiteKey[];
  folderFilter?: string;
  sort: WatchlistSort;
  onStoreFilters: (value: SiteKey[]) => void;
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
        <Pressable accessible={false} importantForAccessibility="no" style={styles.controlSheetBackdrop} onPress={onClose} />
        <Animated.View style={[styles.controlSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={styles.controlSheetHeader}>
            <View>
              <AppText weight="bold" accessibilityRole="header" style={styles.controlSheetTitle}>Filter & sort</AppText>
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
            {sites.length > 1 ? (
              <View style={styles.filterSection}>
                <AppText weight="semibold" style={styles.filterLabel}>Stores</AppText>
                <AppText muted style={styles.fieldHint}>Select any number of stores.</AppText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.textFilterRail}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: storeFilters.length === 0 }}
                    onPress={() => onStoreFilters([])}
                    style={[styles.textFilterButton, storeFilters.length === 0 && styles.textFilterButtonSelected]}
                  >
                    <AppText weight="semibold" style={[styles.textFilterText, storeFilters.length === 0 && styles.textFilterTextSelected]}>All stores</AppText>
                  </Pressable>
                  {sites.map((site) => {
                    const active = storeFilters.includes(site);
                    return (
                      <Pressable
                        key={site}
                        accessibilityRole="button"
                        accessibilityLabel={`Filter by ${getSiteByKey(site).shortName}`}
                        accessibilityState={{ selected: active }}
                        onPress={() => onStoreFilters(active ? storeFilters.filter((value) => value !== site) : [...storeFilters, site])}
                        style={[styles.textFilterButton, active && styles.textFilterButtonSelected]}
                      >
                        <AppText weight="semibold" style={[styles.textFilterText, active && styles.textFilterTextSelected]}>{getSiteByKey(site).shortName}</AppText>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
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
        <Pressable accessible={false} importantForAccessibility="no" style={styles.controlSheetBackdrop} onPress={onClose} />
        <View style={styles.controlSheet}>
          <View style={styles.controlSheetHeader}>
            <View><AppText weight="bold" accessibilityRole="header" style={styles.controlSheetTitle}>Move products</AppText><AppText muted style={styles.fieldHint}>{selectedCount} selected</AppText></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.controlSheetClose}><X size={20} color={colors.text} /></Pressable>
          </View>
          <FolderPicker value={folder} folders={folders} onChange={setFolder} />
          <Pressable onPress={() => onApply({ clearFolder: true })} style={styles.bulkClearFolder}><AppText weight="semibold" style={styles.clearControlsText}>Remove from folder</AppText></Pressable>
          <PrimaryButton label="Move products" onPress={() => onApply({ folder })} disabled={!folder.trim()} />
        </View>
      </View>
    </Modal>
  );
}

function WatchlistScreen({ navigate, refreshKey = 0, showUpdateDot = false }: { navigate: (route: Route) => void; refreshKey?: number; showUpdateDot?: boolean }) {
  const [products, setProducts] = useState<TrackedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);
  const [storeFilters, setStoreFilters] = useState<SiteKey[]>([]);
  const [folderFilter, setFolderFilter] = useState<string | undefined>();
  const [sort, setSort] = useState<WatchlistSort>('recently_updated');
  const [showControls, setShowControls] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
  const [showBulkFolderPicker, setShowBulkFolderPicker] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadProducts = useCallback(async () => {
    setProducts(await listTrackedProducts());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts, refreshKey]);

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
    () =>
      searchWatchlistProducts(
        sortWatchlistProducts(filterWatchlistProducts(visibleProducts, storeFilters, { folder: folderFilter }), sort),
        searchQuery
      ),
    [visibleProducts, storeFilters, folderFilter, sort, searchQuery]
  );
  const selectedProducts = useMemo(
    () => products.filter((product) => selectedProductIds.has(product.id)),
    [products, selectedProductIds]
  );
  const shouldPauseSelected = selectedProducts.length > 0 && selectedProducts.every((product) => product.isActive);
  const inStock = filteredProducts.filter((p) => p.lastAvailability !== 'out_of_stock');
  const oos = filteredProducts.filter((p) => p.lastAvailability === 'out_of_stock');
  const activeControlCount = (storeFilters.length > 0 ? 1 : 0) + (folderFilter ? 1 : 0) + (sort !== 'recently_updated' ? 1 : 0) + (searchQuery.trim() ? 1 : 0);
  const activeControlSummary = [
    storeFilters.length > 0 ? storeFilters.map((site) => getSiteByKey(site).shortName).join(', ') : undefined,
    folderFilter,
    sort === 'recently_updated' ? undefined : WATCHLIST_SORT_OPTIONS.find((option) => option.value === sort)?.label,
    searchQuery.trim() ? `“${searchQuery.trim()}”` : undefined
  ].filter(Boolean).join(' · ');

  function clearControls() {
    setStoreFilters([]);
    setFolderFilter(undefined);
    setSort('recently_updated');
    setSearchQuery('');
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
    setStoreFilters((current) => {
      const next = current.filter((site) => trackedSites.includes(site));
      return next.length === current.length ? current : next;
    });
  }, [trackedSites]);

  useEffect(() => {
    if (folderFilter && !folders.includes(folderFilter)) {
      setFolderFilter(undefined);
    }
  }, [folderFilter, folders]);

  return (
    <View style={styles.app}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.screenContent, styles.watchlistContent]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.watchlistBanner}>
          <View style={styles.watchlistBrandRow}>
            <View style={styles.watchlistBrandLockup}>
              <Image source={require('./assets/app-icon/qeemat-q-tag.png')} style={styles.watchlistBrandIcon} />
              <AppText weight="bold" style={styles.watchlistBrand}>Qeemat</AppText>
            </View>
            <View style={styles.watchlistHeaderActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={searchExpanded ? 'Close watchlist search' : 'Search watchlist'}
                accessibilityState={{ expanded: searchExpanded }}
                onPress={() => {
                  setSearchExpanded((value) => !value);
                  if (searchExpanded) {
                    setSearchQuery('');
                  }
                }}
                style={styles.watchlistSearchButton}
              >
                <Search size={23} color={colors.surface} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={showUpdateDot ? 'Open recent activity, update available' : 'Open recent activity'} onPress={() => navigate({ name: 'tabs', tab: 'activity' })} style={styles.watchlistSearchButton}>
                <Bell size={22} color={colors.surface} />
                {showUpdateDot ? <View style={styles.watchlistUpdateDot} /> : null}
              </Pressable>
            </View>
          </View>
        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <AppText weight="bold" accessibilityRole="header" style={styles.watchlistBannerTitle}>
              Watchlist
            </AppText>
          </View>
          <View style={styles.watchlistBannerCount}>
            <Bookmark size={14} color={colors.surface} />
            <AppText weight="semibold" style={styles.watchlistBannerCountText}>
            {showArchived ? 'Archived' : `${filteredProducts.length} ${filteredProducts.length === 1 ? 'item' : 'items'}`}
            </AppText>
          </View>
        </View>
        {searchExpanded ? (
          <View style={styles.watchlistBannerSearch}>
            <Search size={18} color={colors.textMuted} />
            <AppTextInput
              bare
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search watchlist by product, store or folder"
              autoFocus
              autoCorrect={false}
              accessibilityLabel="Search watchlist products"
              returnKeyType="search"
              inputStyle={styles.watchlistSearchInput}
            />
            {searchQuery ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear watchlist search" hitSlop={8} onPress={() => setSearchQuery('')}>
                <X size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
        </View>
        <View style={styles.watchlistToolbar}>
        <Pressable accessibilityRole="button" accessibilityLabel={activeControlCount > 0 ? `Filter and sort, ${activeControlCount} active` : 'Filter and sort'} onPress={() => setShowControls(true)} style={({ pressed }) => [styles.controlsButton, pressed && styles.storeFilterButtonPressed]}>
          <SlidersHorizontal size={18} color={colors.surface} />
          <AppText weight="semibold" style={styles.watchlistFilterText}>Filter & sort</AppText>
          {activeControlCount > 0 ? <View style={styles.controlsCount}><AppText weight="bold" style={styles.controlsCountText}>{activeControlCount}</AppText></View> : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showArchived ? 'Show active products' : 'Show archived products'}
          accessibilityState={{ selected: showArchived }}
          onPress={() => { setShowArchived((value) => !value); setSelectedProductIds(new Set()); }}
          style={[styles.toolbarIconButton, showArchived && styles.toolbarIconButtonActive]}
        >
          <Archive size={18} color={showArchived ? colors.surface : colors.primary} />
        </Pressable>
        <View style={styles.flex} />
        {selectedProductIds.size === 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Recheck all prices" accessibilityState={{ disabled: !products.length || loading || checkingAll }} disabled={!products.length || loading || checkingAll} onPress={recheckAllPrices} style={({ pressed }) => [styles.watchlistRecheck, (!products.length || loading || checkingAll) && styles.watchlistRecheckDisabled, pressed && styles.storeFilterButtonPressed]}>
          {checkingAll ? <ActivityIndicator size="small" color={colors.primary} /> : <RefreshCcw size={18} color={colors.primary} />}
          <AppText weight="semibold" style={styles.controlsButtonText}>{checkingAll ? 'Checking…' : 'Recheck all'}</AppText>
        </Pressable> : null}
        </View>
        {activeControlSummary ? (
          <View style={styles.activeControlsRow}>
            <AppText muted numberOfLines={1} style={styles.activeControlsSummary}>{activeControlSummary}</AppText>
            <Pressable accessibilityRole="button" onPress={clearControls}><AppText weight="semibold" style={styles.clearControlsText}>Clear</AppText></Pressable>
          </View>
        ) : null}
        {selectedProductIds.size > 0 ? <View style={styles.selectionHeader}><AppText weight="bold">{selectedProductIds.size} selected</AppText><Pressable accessibilityRole="button" onPress={() => setSelectedProductIds(new Set())}><AppText weight="semibold" style={styles.clearControlsText}>Cancel</AppText></Pressable></View> : null}

        <WatchlistControlsSheet
          visible={showControls}
          onClose={() => setShowControls(false)}
          sites={trackedSites}
          folders={folders}
          storeFilters={storeFilters}
          folderFilter={folderFilter}
          sort={sort}
          onStoreFilters={setStoreFilters}
          onFolderFilter={setFolderFilter}
          onSort={setSort}
          onClear={clearControls}
        />

        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {!loading && products.length === 0 ? <EmptyWatchlist onAdd={() => navigate({ name: 'add' })} /> : null}
        {!loading && products.length > 0 && showArchived && visibleProducts.length === 0 ? (
          <Surface padding="lg" style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Archive size={24} color={colors.primary} />
            </View>
            <AppText weight="bold" style={styles.emptyTitle}>Nothing archived yet</AppText>
            <AppText muted style={styles.emptyCopy}>Archived products keep their price history and appear here.</AppText>
            <PrimaryButton label="Show active products" variant="outline" onPress={() => setShowArchived(false)} style={styles.emptyButton} />
          </Surface>
        ) : null}
        {!loading && visibleProducts.length > 0 && filteredProducts.length === 0 ? (
          <Surface padding="lg" style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              {searchQuery.trim() ? <Search size={24} color={colors.primary} /> : <SlidersHorizontal size={24} color={colors.primary} />}
            </View>
            <AppText weight="bold" style={styles.emptyTitle}>
              {searchQuery.trim() ? 'No products match your search' : 'No products match these filters'}
            </AppText>
            <AppText muted style={styles.emptyCopy}>
              {searchQuery.trim()
                ? `No tracked product matches “${searchQuery.trim()}”. Try a product name, store or folder.`
                : 'Change or clear the store, folder and sort controls to see your products.'}
            </AppText>
            <PrimaryButton
              label={searchQuery.trim() ? 'Clear search' : 'Clear filters'}
              variant="outline"
              onPress={searchQuery.trim() ? () => setSearchQuery('') : clearControls}
              style={styles.emptyButton}
            />
          </Surface>
        ) : null}

        {oos.length > 0 ? (
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: oosExpanded }} style={styles.oosSection} onPress={() => setOosExpanded((v) => !v)}>
            <View style={styles.oosHeader}>
              <View style={styles.oosDot} />
              <AppText weight="semibold" style={styles.oosLabel}>
                Out of Stock
              </AppText>
              <AppText style={styles.oosCount}>
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
          <View style={styles.watchlistCardList}>
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

        <View style={styles.watchlistCardList}>
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
      </View> : <Pressable accessibilityRole="button" accessibilityLabel="Add a product" style={styles.fab} onPress={() => navigate({ name: 'add' })}>
        <Plus size={30} color={colors.surface} />
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
    <Surface padding="lg" style={styles.emptyCard}>
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
    </Surface>
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
      <AppTextInput value={value} onChangeText={onChange} placeholder="e.g. Running" accessibilityLabel="Folder name" />
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
  const [productCategory, setProductCategory] = useState<ShoppingCategory>();
  const [categoryExcluded, setCategoryExcluded] = useState(false);
  const [categoryEdited, setCategoryEdited] = useState(false);
  const organizationOptions = useOrganizationOptions();
  const [selectedVariantAttributes, setSelectedVariantAttributes] = useState<VariantAttributes>({});
  const [trackingMatches, setTrackingMatches] = useState<TrackingMatch | undefined>();
  const scrollRef = useRef<ScrollView>(null);
  const shouldFocusParsedResult = useRef(false);
  const parseRequestId = useRef(0);

  const parseUrl = useCallback(async (sourceUrl: string) => {
    Keyboard.dismiss();
    setError(undefined);
    setParsedProduct(undefined);
    setProductCategory(undefined);
    setCategoryExcluded(false);
    setCategoryEdited(false);
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
      setProductCategory(inferWatchlistCategory({ ...result.product, url: sourceUrl }));
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

  useEffect(() => {
    let active = true;
    if (!parsedProduct) {
      setTrackingMatches(undefined);
      return () => { active = false; };
    }

    const selection = selectedVariant ? toVariantSelection(selectedVariant) : undefined;
    listTrackedProducts()
      .then((tracked) => {
        if (active) {
          setTrackingMatches(findTrackingMatches({ ...parsedProduct, selectedVariant: selection }, tracked));
        }
      })
      .catch(() => {
        if (active) {
          setTrackingMatches(undefined);
        }
      });

    return () => { active = false; };
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

  async function persistTracking(productToSave: ParsedProduct) {
    const id = await createTrackedProduct({
      parsed: productToSave,
      sourceUrl: normalizedUrl,
      checkPreference,
      alertMode,
      targetPriceMinor: alertMode === 'target_price' ? targetPriceMinor : undefined,
      minimumPriceDropMinor: alertMode === 'price_drop' ? parseTargetPriceInput(minimumPriceDrop) : undefined,
      restockAlertEnabled,
      folder,
      category: categoryEdited ? productCategory : undefined,
      categoryExcluded,
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
      productToSave = { ...result.product, sourceMetadata: mergeProductMetadata(parsedProduct.sourceMetadata, result.product.sourceMetadata) };
    }

    const tracked = await listTrackedProducts();
    const matches = findTrackingMatches(productToSave, tracked);

    if (matches.exact) {
      setSaving(false);
      Alert.alert(
        'Duplicate product',
        `"${productToSave.title}" is already in your watchlist${matches.exact.variant?.label ? ` (${matches.exact.variant.label})` : ''}.`,
        [
          { text: 'Open product', onPress: () => navigate({ name: 'detail', id: matches.exact!.id }) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    await persistTracking(productToSave).catch(() => {
      setSaving(false);
      setError('Could not save this product. Please try again.');
    });
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
          <AppTextInput
            leading={<Link2 size={18} color={colors.textMuted} />}
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
            containerStyle={detectedSite ? styles.inputDetected : undefined}
          />
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
        <PrimaryButton label="Find product" onPress={() => parseUrl(url)} disabled={!url.trim() || loading} loading={loading} />
        {!detectedSite ? <AddSupportedStores /> : null}
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
            {trackingMatches?.exact ? (
              <View style={styles.trackingNoticeWarning}>
                <CircleAlert size={20} color={colors.amber} />
                <View style={styles.flex}>
                  <AppText weight="bold">Duplicate product</AppText>
                  <AppText style={styles.trackingWarningCopy}>
                    This product is already in your watchlist{trackingMatches.exact.variant?.label ? ` (${trackingMatches.exact.variant.label})` : ' at page level'}. Adding it again would create a duplicate.
                  </AppText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open tracked product"
                  hitSlop={6}
                  onPress={() => navigate({ name: 'detail', id: trackingMatches.exact!.id })}
                  style={({ pressed }) => [styles.noticeActionButton, pressed && styles.storeFilterButtonPressed]}
                >
                  <AppText weight="semibold" style={styles.noticeActionText}>Open product</AppText>
                </Pressable>
              </View>
            ) : trackingMatches?.sameProduct.length ? (
              <View style={styles.trackingNoticeInfo}>
                <Check size={18} color={colors.primary} />
                <View style={styles.flex}>
                  <AppText weight="semibold">Adding another option</AppText>
                  <AppText muted style={styles.fieldHint}>
                    You already track {trackingMatches.sameProduct.map((item) => trackingOptionLabel(item)).join(', ')}. Each option is tracked as a separate item.
                  </AppText>
                </View>
              </View>
            ) : null}
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
              <AppTextInput
                leading={
                  <AppText weight="semibold" muted>
                    {selectedCurrency}{priceBasisSuffix(previewProduct?.priceBasis)}
                  </AppText>
                }
                value={targetPrice}
                onChangeText={setTargetPrice}
                keyboardType="decimal-pad"
                placeholder="250"
              />
            ) : null}
            {alertMode === 'price_drop' ? (
              <View style={styles.fieldGroup}>
                <AppText weight="semibold">Minimum price drop alert</AppText>
                <AppText muted style={styles.fieldHint}>Only notify when the price drops by at least this amount.</AppText>
                <AppTextInput
                  leading={<AppText weight="semibold" muted>{selectedCurrency}</AppText>}
                  value={minimumPriceDrop}
                  onChangeText={setMinimumPriceDrop}
                  keyboardType="decimal-pad"
                  placeholder="Any drop"
                />
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
            <ProductCategoryPicker value={productCategory} onChange={(value) => { setProductCategory(value); setCategoryExcluded(value === undefined); setCategoryEdited(true); }} />
            <PrimaryButton
              label="Confirm Tracking"
              onPress={saveProduct}
              loading={saving}
              disabled={(alertMode === 'target_price' && !targetPriceMinor) || (variants.length > 0 && !selectedVariant) || Boolean(trackingMatches?.exact)}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function AddSupportedStores() {
  const [expanded, setExpanded] = useState(false);
  const stores = SUPPORTED_SITES.filter((site) => site.status === 'supported');

  return (
    <View style={styles.supportedStoresSection}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={styles.disclosureRow}
      >
        <AppText weight="semibold" style={styles.flex}>
          Supported stores
        </AppText>
        <AppText muted style={styles.caption}>
          {stores.length} stores
        </AppText>
        {expanded ? <ChevronUp size={16} color={colors.textMuted} /> : <ChevronDown size={16} color={colors.textMuted} />}
      </Pressable>
      {expanded ? (
        <View style={styles.chips}>
          {stores.map((site) => (
            <View key={site.key} style={styles.chip}>
              <SiteIcon siteKey={site.key} size={14} />
              <AppText weight="medium" style={styles.chipText}>
                {site.shortName}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
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
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [product.imageUrl]);

  return (
    <View style={[styles.previewCard, compact && styles.previewCardCompact]}>
      <View style={[styles.previewImageWrap, compact && styles.previewImageWrapCompact]}>
        {product.imageUrl && !imageFailed ? (
          <Image source={{ uri: product.imageUrl }} style={styles.previewImage} resizeMode="contain" onError={() => setImageFailed(true)} />
        ) : (
          <View accessible accessibilityLabel="Product image unavailable">
            <ImageOff size={28} color={colors.textMuted} />
          </View>
        )}
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
          {awaitingVariantSelection ? 'Choose an option' : formatPrice(product.priceMinor, product.currency, product.priceBasis)}
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
  const [imageFailed, setImageFailed] = useState(false);

  const load = useCallback(async () => setData(await getProductWithSnapshots(productId)), [productId]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setImageFailed(false);
  }, [data?.product.imageUrl]);

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
        <AppText weight="bold" accessibilityRole="header" style={styles.detailTitle}>
          {product.title}
        </AppText>
        <View style={styles.detailMetaRow}>
          {product.variant ? <AppText muted style={[styles.caption, styles.flex]}>Tracking {product.variant.label}</AppText> : <View style={styles.flex} />}
          <View style={styles.detailHeaderActions}>
            <Pressable
              accessibilityLabel="Copy product link"
              accessibilityRole="button"
              hitSlop={5}
              style={styles.iconButton}
              onPress={copyProductLink}
            >
              <Copy size={20} color={colors.text} />
            </Pressable>
            <Pressable
              accessibilityLabel="Tracking settings"
              accessibilityRole="button"
              hitSlop={5}
              style={styles.iconButton}
              onPress={() => navigate({ name: 'trackingSettings', id: product.id })}
            >
              <SettingsIcon size={20} color={colors.text} />
            </Pressable>
          </View>
        </View>
        <View style={[styles.detailHero, compact && styles.detailHeroCompact]}>
          <View style={[styles.detailImageWrap, compact && styles.detailImageWrapCompact]}>
            {product.imageUrl && !imageFailed ? (
              <Image source={{ uri: product.imageUrl }} style={styles.detailImage} resizeMode="contain" onError={() => setImageFailed(true)} />
            ) : (
              <View accessible accessibilityLabel="Product image unavailable">
                <ImageOff size={28} color={colors.textMuted} />
              </View>
            )}
          </View>
          <View style={styles.detailPriceBlock}>
            <AppText muted style={styles.caption}>
              {checkFailed || isOos ? 'Last known price' : 'Current price'}
            </AppText>
            <AppText weight="bold" style={styles.currentPrice}>
              {formatPrice(product.currentPriceMinor, product.currency, product.priceBasis)}
            </AppText>
            {product.targetPriceMinor ? (
              <AppText weight="semibold">Target {formatPrice(product.targetPriceMinor, product.currency, product.priceBasis)}</AppText>
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
          <StatCard label="Lowest price" price={insights.lowestPriceMinor} currency={product.currency} priceBasis={product.priceBasis} tone="green" />
          <StatCard label="Highest price" price={insights.highestPriceMinor} currency={product.currency} priceBasis={product.priceBasis} tone="red" />
        </View>
        <StatCard label="Average price" price={insights.averagePriceMinor} currency={product.currency} priceBasis={product.priceBasis} tone="neutral" />
        <AppText muted style={styles.insightCaption}>{insights.observations} {insights.observations === 1 ? 'priced check' : 'priced checks'} recorded locally.</AppText>
        <SectionTitle title="Price History" />
        {product.priceBasis ? <AppText muted>Prices, chart and targets use{priceBasisSuffix(product.priceBasis)}. Weighted grocery totals depend on the final delivered weight.</AppText> : null}
        <PriceChart snapshots={snapshots} currency={product.currency} />
        <ProductInformation product={product} />
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

function ProductInformation({ product }: { product: TrackedProduct }) {
  const metadata = product.sourceMetadata;
  if (!metadata) { return null; }
  const selectedAttributes = new Set(product.variant?.attributes.map((attribute) => attribute.name.toLowerCase().replace('colour', 'color')) ?? []);
  const attributeLabels: Record<string, string> = {
    material: 'Material', color: 'Color', gender: 'For', fit: 'Fit', style: 'Style',
    garment_length: 'Length', sleeve_length: 'Sleeve length', age_group: 'Age group'
  };
  const rows = [
    ...(metadata.brand ? [{ label: 'Brand', value: metadata.brand }] : []),
    ...(metadata.productType ? [{ label: 'Product type', value: metadata.productType }] : []),
    ...Object.entries(attributeLabels).flatMap(([key, label]) => {
      const value = metadata.attributes?.[key];
      return value && !selectedAttributes.has(key) ? [{ label, value }] : [];
    }),
    ...(metadata.categoryPath?.length ? [{ label: 'Store category', value: metadata.categoryPath.join('  ›  ') }] : [])
  ];
  if (!rows.length) { return null; }
  return (
    <>
      <SectionTitle title="About this item" />
      <View style={styles.productInformation}>
        {rows.map((row, index) => (
          <View key={row.label} style={[styles.productInformationRow, index > 0 && styles.productInformationDivider]}>
            <AppText muted style={styles.productInformationLabel}>{row.label}</AppText>
            <AppText weight="medium" style={styles.productInformationValue}>{row.value}</AppText>
          </View>
        ))}
      </View>
    </>
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
      {groups.map((group, index) => {
        const first = group.snapshots[0];
        const rest = group.snapshots.slice(1);
        const isExpanded = expandedKeys.has(group.key);
        const older = groups[index + 1]?.snapshots[0];
        const direction =
          first.priceMinor !== undefined && older?.priceMinor !== undefined && first.priceMinor !== older.priceMinor
            ? first.priceMinor < older.priceMinor
              ? 'down'
              : 'up'
            : undefined;

        return (
          <View key={group.key}>
            <SnapshotRow snapshot={first} currency={currency} direction={direction} />
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
  direction,
}: {
  snapshot: PriceSnapshot;
  currency: string;
  subtle?: boolean;
  direction?: 'up' | 'down';
}) {
  return (
    <View style={[styles.snapshotRow, subtle && styles.snapshotRowSubtle]}>
      <View style={styles.flex}>
        <View style={styles.snapshotMetaRow}>
          <AppText weight={subtle ? 'regular' : 'medium'} muted={subtle}>
            {formatSnapshotTime(snapshot.checkedAt)}
          </AppText>
          <SourceLabel source={snapshot.source} />
        </View>
        {snapshot.errorCode ? <AppText muted>{snapshot.rawPriceText?.slice(0, 400) ?? snapshot.errorCode}</AppText> : null}
      </View>
      <View style={styles.snapshotPriceBlock}>
        <AppText
          weight="bold"
          muted={subtle}
          style={[
            !subtle && direction === 'down' && styles.snapshotPriceDown,
            !subtle && direction === 'up' && styles.snapshotPriceUp
          ]}
        >
          {snapshot.priceMinor !== undefined
            ? formatPrice(snapshot.priceMinor, snapshot.currency ?? currency, snapshot.priceBasis)
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
  const [isActive, setIsActive] = useState(true);
  const [folder, setFolder] = useState('');
  const [productCategory, setProductCategory] = useState<ShoppingCategory>();
  const [categoryEdited, setCategoryEdited] = useState(false);
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
      setIsActive(row.isActive);
      setFolder(row.folder ?? '');
      setProductCategory(inferWatchlistCategory(row));
      setCategoryEdited(false);
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
      category: categoryEdited ? productCategory ?? null : undefined,
      isActive
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
        <AppText weight="bold" accessibilityRole="header" style={styles.detailTitle} numberOfLines={2}>
          {product?.title ?? 'Product'}
        </AppText>
        <AppText weight="semibold">Check preference</AppText>
        <OptionGroup value={checkPreference} options={CHECK_OPTIONS.filter((opt) => availableCheckPreferences(product?.siteKey).includes(opt.value))} onChange={setCheckPreference} />
        <AppText weight="semibold">Alert mode</AppText>
        <OptionGroup value={alertMode} options={ALERT_OPTIONS} onChange={setAlertMode} />
        {alertMode === 'target_price' ? (
          <AppTextInput
            leading={
              <AppText weight="semibold" muted>
                {product?.currency ?? 'AED'}{priceBasisSuffix(product?.priceBasis)}
              </AppText>
            }
            value={targetPrice}
            onChangeText={setTargetPrice}
            keyboardType="decimal-pad"
          />
        ) : null}
        {alertMode === 'price_drop' ? (
          <View style={styles.fieldGroup}>
            <AppText weight="semibold">Minimum price drop alert</AppText>
            <AppText muted style={styles.fieldHint}>Only notify when the price drops by at least this amount.</AppText>
            <AppTextInput
              leading={<AppText weight="semibold" muted>{product?.currency ?? 'AED'}{priceBasisSuffix(product?.priceBasis)}</AppText>}
              value={minimumPriceDrop}
              onChangeText={setMinimumPriceDrop}
              keyboardType="decimal-pad"
              placeholder="Any drop"
            />
          </View>
        ) : null}
        <View style={styles.settingToggleRow}>
          <View style={styles.flex}>
            <AppText weight="semibold">Back-in-stock alerts</AppText>
            <AppText muted style={styles.fieldHint}>Notify when this unavailable product returns.</AppText>
          </View>
          <Switch value={restockAlertEnabled} onValueChange={setRestockAlertEnabled} trackColor={{ true: colors.primary }} />
        </View>
        <View style={styles.settingToggleRow}>
          <View style={styles.flex}>
            <AppText weight="semibold">Active</AppText>
            <AppText muted style={styles.fieldHint}>Paused products stay in the watchlist but are skipped by price checks.</AppText>
          </View>
          <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: colors.primary }} />
        </View>
        <FolderPicker value={folder} folders={organizationOptions.folders} onChange={setFolder} />
        <ProductCategoryPicker value={productCategory} onChange={(value) => { setProductCategory(value); setCategoryEdited(true); }} />
        <PrimaryButton label="Save settings" onPress={save} />
        <PrimaryButton label="Delete product" variant="danger" onPress={confirmDelete} icon={<Trash2 size={18} color={colors.red} />} />
      </ScrollView>
    </View>
  );
}

function ActivityScreen({
  navigate,
  refreshKey = 0,
  availableUpdate,
  onOpenUpdate
}: {
  navigate: (route: Route) => void;
  refreshKey?: number;
  availableUpdate?: AvailableUpdate;
  onOpenUpdate?: () => void;
}) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [products, setProducts] = useState<TrackedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [loadedEvents, loadedProducts] = await Promise.all([
        listActivityEvents(),
        listTrackedProducts()
      ]);
      if (!active) {
        return;
      }
      setEvents(loadedEvents);
      setProducts(loadedProducts);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [refreshKey]);

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <AppText weight="bold" accessibilityRole="header" style={styles.heading}>
        Activity
      </AppText>
      <AppText muted>Price and stock changes from your watchlist.</AppText>
      {availableUpdate && onOpenUpdate ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Update available: Qeemat ${availableUpdate.version}. Open update dialog.`}
          onPress={onOpenUpdate}
          style={({ pressed }) => [styles.updatePinCard, pressed && styles.storeFilterButtonPressed]}
        >
          <View style={styles.updatePinBadge}>
            <Download size={20} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <AppText weight="semibold" style={styles.updatePinTitle}>Qeemat update available</AppText>
            <AppText muted style={styles.updatePinBody}>Version {availableUpdate.version} is ready to download and install.</AppText>
          </View>
          <ChevronRight size={18} color={colors.textSoft} />
        </Pressable>
      ) : null}
      {events.length === 0 ? <EmptyActivity /> : (
        <ActivityList
          events={events}
          productsById={productsById}
          onOpenProduct={(productId) => navigate({ name: 'detail', id: productId })}
        />
      )}
    </ScrollView>
  );
}

function EmptyActivity() {
  return (
    <Surface padding="lg" style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Clock size={24} color={colors.primary} />
      </View>
      <AppText weight="bold" style={styles.emptyTitle}>
        No price changes yet
      </AppText>
      <AppText muted style={styles.emptyCopy}>
        Tracked product prices will appear here when they change.
      </AppText>
    </Surface>
  );
}

export function rotateDiscoveryProducts<T>(products: T[], offset: number): T[] {
  const first = products.slice(0, 24);
  if (first.length < 2) { return products; }
  const shift = offset % first.length;
  return [...first.slice(shift), ...first.slice(0, shift), ...products.slice(24)];
}

export function OpportunityScreen({ navigate, active = true, sessionOffset }: { navigate: (route: Route) => void; active?: boolean; sessionOffset?: number }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<ProductSearchResult>();
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchRetailer, setSearchRetailer] = useState<DiscoveryProduct['siteKey']>();
  const searchGeneration = useRef(0);
  const discoveryScroll = useRef(0);
  const savedDiscoveryScroll = useRef(0);
  const restoreScroll = useRef(false);
  const [discoveryProducts, setDiscoveryProducts] = useState<DiscoveryProduct[]>([]);
  const [preferences, setPreferences] = useState<DiscoveryPreferences>();
  const [trackedProducts, setTrackedProducts] = useState<TrackedProduct[]>([]);
  const watchedCategories = useMemo(() => watchlistCategories(trackedProducts), [trackedProducts]);
  const watchedCategoryKey = watchedCategories.join(',');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trackingProductId, setTrackingProductId] = useState<string>();
  const [category, setCategory] = useState<DiscoveryCategory>();
  const [brand, setBrand] = useState<string>();
  const [retailer, setRetailer] = useState<DiscoveryProduct['siteKey']>();
  const [browseAll, setBrowseAll] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [collectionId, setCollectionId] = useState<string>();
  const [batchLimit, setBatchLimit] = useState(24);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const loadGeneration = useRef(0);
  const [catalog, setCatalog] = useState<DiscoveryCatalogResult>();
  const [discoveryVisibleCount, setDiscoveryVisibleCount] = useState(24);
  const [searchVisibleCount, setSearchVisibleCount] = useState(24);
  const [notice, setNotice] = useState<{ message: string; trackedId?: number }>();
  const [pendingProduct, setPendingProduct] = useState<{ listing: DiscoveryProduct; parsed: ParsedProduct }>();
  const [variantAttributes, setVariantAttributes] = useState<VariantAttributes>({});
  const [savingVariant, setSavingVariant] = useState(false);
  const [variantError, setVariantError] = useState<string>();
  const trackingBusy = useRef(false);
  const [maximumPrice, setMaximumPrice] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const [catalogState, setCatalogState] = useState<{ refreshedAt?: string; stale: boolean }>({ stale: false });
  useEffect(() => {
    if (active) { listTrackedProducts().then(setTrackedProducts).catch(() => {}); }
  }, [active]);

  const load = useCallback(async (force = false) => {
    if (!preferences || searchQuery) { return; }
    const generation = ++loadGeneration.current;
    const isCancelled = () => generation !== loadGeneration.current;
    const tracked = await listTrackedProducts();
    if (isCancelled()) { return; }
    setTrackedProducts(tracked);
    const update = (next: DiscoveryCatalogResult) => {
      if (isCancelled()) { return; }
      setCatalog(next);
      setCatalogBusy(Boolean(next.refreshing));
      setDiscoveryProducts(next.products);
      setCatalogState({ refreshedAt: next.refreshedAt, stale: next.stale });
      setLoading(false);
    };
    try {
      update(await loadDiscoveryCatalog(undefined, { force, onUpdate: update, isCancelled, scope: {
        categories: category ? [category] : browseAll || retailer || collectionId ? [] : watchedCategoryKey ? watchedCategoryKey.split(',') as ShoppingCategory[] : watchlistCategories(tracked),
        siteKey: retailer, collectionId, limit: batchLimit
      } }));
    } finally { if (!isCancelled()) { setCatalogBusy(false); } }
  }, [preferences, category, retailer, collectionId, browseAll, batchLimit, searchQuery, watchedCategoryKey]);

  useEffect(() => { getDiscoveryPreferences().then(setPreferences).catch(() => setLoading(false)); }, []);
  const cancelLoad = useCallback(() => { loadGeneration.current++; }, []);
  useEffect(() => () => { searchGeneration.current++; }, []);

  async function runProductSearch(query: string, force = false, previous?: ProductSearchResult) {
    const generation = ++searchGeneration.current;
    const isCancelled = () => generation !== searchGeneration.current;
    cancelLoad(); setCatalogBusy(false);
    if (!searchQuery) { savedDiscoveryScroll.current = discoveryScroll.current; }
    if (query !== searchQuery) { setSearchResult(undefined); setSearchRetailer(undefined); }
    setSearchQuery(query); setSearchBusy(true); setNotice(undefined);
    if (!previous) { setSearchVisibleCount(24); scrollRef.current?.scrollTo({ y: 0, animated: false }); }
    const update = (result: ProductSearchResult) => { if (!isCancelled()) { setSearchResult(result); } };
    try {
      const tracked = await listTrackedProducts();
      if (isCancelled()) { return; }
      setTrackedProducts(tracked);
      update(await loadProductSearch(query, { force, previous, loadMore: Boolean(previous), isCancelled, onUpdate: update }));
    } catch { if (!isCancelled()) { setNotice({ message: 'Search could not finish. Pull down to retry; saved matches remain available.' }); } }
    finally { if (!isCancelled()) { setSearchBusy(false); } }
  }

  function clearProductSearch() {
    searchGeneration.current++; setSearchBusy(false); setSearchQuery(''); setSearchResult(undefined); setSearchRetailer(undefined);
    restoreScroll.current = true;
  }

  useEffect(() => {
    load().catch(() => setNotice({ message: 'Could not refresh products. Pull to try again.' })).finally(() => setLoading(false));
    return cancelLoad;
  }, [load, cancelLoad]);

  async function refresh() {
    setRefreshing(true);
    if (searchQuery) {
      try { await runProductSearch(searchQuery, true); } finally { setRefreshing(false); }
      return;
    }
    try { await load(true); } catch { setNotice({ message: 'Could not refresh products. Your saved listings are still available.' }); }
    finally { setRefreshing(false); }
  }

  const effectivePreferences = useMemo(() => {
    if (!preferences) { return undefined; }
    const dismissed = new Set(preferences.dismissedProductIds);
    for (const product of discoveryProducts) {
      if (dismissed.has(product.id)) { dismissed.add(discoveryFeedbackId(product)); }
    }
    return { ...preferences, categories: watchedCategories, favoriteBrands: [], budgetsByCategory: {}, dismissedProductIds: [...dismissed] };
  }, [preferences, discoveryProducts, watchedCategories]);
  const sections = useMemo(
    () => effectivePreferences ? buildDiscoverySections(discoveryProducts, browseAll || category || retailer || collectionId ? {
      ...effectivePreferences, categories: category ? [category] : [], budgetsByCategory: browseAll ? {} : effectivePreferences.budgetsByCategory
    } : effectivePreferences) : { picks: [], newlyDiscovered: [], exploreDifferent: [] },
    [discoveryProducts, effectivePreferences, browseAll, category, retailer, collectionId]
  );
  const searchProducts = useMemo(() => {
    const dismissed = new Set(effectivePreferences?.dismissedProductIds ?? []);
    return (searchResult?.products ?? []).filter((product) => !isDiscoveryProductDismissed(product, dismissed));
  }, [searchResult, effectivePreferences?.dismissedProductIds]);
  useEffect(() => {
    if (searchRetailer && !searchProducts.some((product) => product.siteKey === searchRetailer)) { setSearchRetailer(undefined); }
  }, [searchProducts, searchRetailer]);
  const filteredProducts = useMemo(() => searchQuery ? filterDiscoveryProducts(searchProducts, { siteKey: searchRetailer }) : filterDiscoveryProducts(sections.picks, {
    category, brand, siteKey: retailer, collectionId, maximumPriceMinor: parseTargetPriceInput(maximumPrice)
  }), [sections.picks, category, brand, retailer, collectionId, maximumPrice, searchQuery, searchProducts, searchRetailer]);
  const brands = useMemo(() => uniqueDiscoveryBrands(filterDiscoveryProducts(discoveryProducts, { category }).map((product) => product.brand)), [category, discoveryProducts]);
  const retailers = useMemo(() => [...new Set(DISCOVERY_SOURCE_MAPS.map((source) => source.siteKey))], []);
  const selectedCollection = DISCOVERY_SOURCE_MAPS.find((source) => source.id === collectionId);
  const hasMoreListings = !searchQuery && !collectionId && selectDiscoveryCollections({ categories: category ? [category] : browseAll || retailer ? [] : watchedCategories, siteKey: retailer, offset: batchLimit, limit: 1 }).length > 0;
  const visibleCount = searchQuery ? searchVisibleCount : discoveryVisibleCount;
  const visibleProducts = (!searchQuery && !category && !retailer && !collectionId && !brand && !maximumPrice
    ? rotateDiscoveryProducts(filteredProducts, sessionOffset ?? 0) : filteredProducts).slice(0, visibleCount);
  const resultRetailerCount = new Set(filteredProducts.map((product) => product.siteKey)).size;
  const variantChoices = discoveryVariantChoices(pendingProduct?.parsed.variants ?? []);
  const selectedChoice = resolveSelectedVariant(variantChoices, variantAttributes);
  const selectedVariant = pendingProduct?.parsed.variants?.find((variant) => variant.id === selectedChoice?.id);
  const activeFilter = Boolean(category || brand || retailer || collectionId || maximumPrice);

  useEffect(() => { setDiscoveryVisibleCount(24); }, [category, brand, retailer, maximumPrice, browseAll]);
  useEffect(() => { setSearchVisibleCount(24); }, [searchRetailer]);
  const preferenceKey = watchedCategoryKey;
  useEffect(() => { setBatchLimit(24); }, [category, retailer, collectionId, browseAll, preferenceKey]);

  function resetBrowse() { setCategory(undefined); setBrand(undefined); setRetailer(undefined); setCollectionId(undefined); setMaximumPrice(''); }
  function selectDepartment(selected: DiscoveryCategory) {
    const deselect = selected === category && !retailer && !collectionId;
    resetBrowse();
    if (!deselect) { setCategory(selected); }
    setBrowseAll(false);
  }
  async function handleDismiss(productId: string) {
    const product = (searchResult?.products ?? []).find((item) => item.id === productId) ?? discoveryProducts.find((item) => item.id === productId);
    await dismissDiscoveryProduct(productId, product);
    setPreferences(await getDiscoveryPreferences());
  }

  async function handleTrack(product: DiscoveryProduct) {
    if (trackingBusy.current) { return; }
    const known = trackedProducts.find((tracked) => cleanUrl(tracked.canonicalUrl || tracked.url) === cleanUrl(product.url));
    if (known) {
      navigate({ name: 'detail', id: known.id });
      return;
    }

    trackingBusy.current = true;
    setTrackingProductId(product.id);
    try {
      const result = await fetchAndParseProduct(product.url).catch(() => ({
        ok: false as const,
        code: 'network_error' as const,
        message: 'Qeemat could not reach this product right now. Try again in a moment.'
      }));
      if (!result.ok) {
        setNotice({ message: result.message });
        return;
      }

      const verified = verifyDiscoveryTrackingBasis(product, result.product);
      if (!verified) {
        setNotice({ message: 'Could not verify this product’s pack size or pricing unit. Please try again when the retailer shows these details.' });
        return;
      }
      if (verified.variants?.length) {
        setVariantAttributes({});
        setVariantError(undefined);
        setPendingProduct({ listing: product, parsed: verified });
        return;
      }

      const id = await createTrackedProduct({
        parsed: verified,
        sourceUrl: product.url,
        brand: product.brand === 'Other brands' ? undefined : product.brand,
        category: Object.prototype.hasOwnProperty.call(SHOPPING_CATEGORY_LABELS, product.category) ? product.category as ShoppingCategory : undefined,
        checkPreference: availableCheckPreferences(result.product.siteKey)[0] ?? 'daily',
        alertMode: 'price_drop',
        restockAlertEnabled: true
      });
      setTrackedProducts(await listTrackedProducts());
      setNotice({ message: `Tracking ${result.product.title}`, trackedId: id });
      await markDiscoveryProductsSeen([product.id]);
    } catch { setNotice({ message: 'Could not save this product. Please try again.' }); }
    finally { trackingBusy.current = false; setTrackingProductId(undefined); }
  }

  async function handleViewAtRetailer(product: DiscoveryProduct) {
    try {
      await Linking.openURL(product.url);
    } catch {
      Alert.alert('Could not open retailer', 'Please try again in a moment.');
    }
  }

  function openBrandListing(selectedBrand: string) {
    if (searchQuery) { runProductSearch(selectedBrand); return; }
    setBrand(selectedBrand);
    setCategory(undefined);
    setBrowseAll(true);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  async function saveVariant() {
    if (!pendingProduct || !selectedVariant || savingVariant) { return; }
    setSavingVariant(true);
    try {
      let parsed: ParsedProduct = { ...pendingProduct.parsed, imageUrl: selectedVariant.imageUrl ?? pendingProduct.parsed.imageUrl,
        priceMinor: selectedVariant.priceMinor, currency: selectedVariant.currency ?? pendingProduct.parsed.currency,
        availability: selectedVariant.availability, sku: selectedVariant.sku ?? pendingProduct.parsed.sku,
        selectedVariant: { ...toVariantSelection(selectedVariant), label: selectedChoice?.attributes.map((attribute) => attribute.value).join(' · ') ?? selectedVariant.label } };
      if (parsed.siteKey === 'the_deal') {
        const result = await fetchTheDealVariantForSaving(parsed, toVariantSelection(selectedVariant));
        if (!result.ok) { setVariantError(result.message); return; }
        parsed = result.product;
      }
      const existing = (await listTrackedProducts()).find((item) => cleanUrl(item.canonicalUrl || item.url) === cleanUrl(parsed.canonicalUrl || pendingProduct.listing.url) && item.variant?.id === selectedVariant.id);
      const id = existing?.id ?? await createTrackedProduct({ parsed, sourceUrl: pendingProduct.listing.url,
        brand: pendingProduct.listing.brand === 'Other brands' ? undefined : pendingProduct.listing.brand,
        category: Object.prototype.hasOwnProperty.call(SHOPPING_CATEGORY_LABELS, pendingProduct.listing.category) ? pendingProduct.listing.category as ShoppingCategory : undefined,
        variant: parsed.selectedVariant, checkPreference: availableCheckPreferences(parsed.siteKey)[0] ?? 'daily', alertMode: 'price_drop', restockAlertEnabled: true });
      setTrackedProducts(await listTrackedProducts());
      setNotice({ message: existing ? 'You are already tracking this option.' : `Tracking ${parsed.selectedVariant?.label ?? selectedVariant.label}`, trackedId: id });
      await markDiscoveryProductsSeen([pendingProduct.listing.id]);
      setPendingProduct(undefined);
    } catch { setVariantError('Could not save this option. Please try again.'); }
    finally { setSavingVariant(false); }
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
      ref={scrollRef}
      contentContainerStyle={[styles.screenContent, styles.discoveryScreenContent]}
      showsVerticalScrollIndicator={false}
      onScroll={(event) => { if (!searchQuery) { discoveryScroll.current = event.nativeEvent.contentOffset.y; } }}
      scrollEventThrottle={100}
      onContentSizeChange={() => { if (!searchQuery && restoreScroll.current) { restoreScroll.current = false; scrollRef.current?.scrollTo({ y: savedDiscoveryScroll.current, animated: false }); } }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <View style={styles.discoveryHeader}>
        <View style={styles.flex}>
          <AppText weight="bold" accessibilityRole="header" style={styles.heading}>Search</AppText>
          <AppText muted>Discover it. Track the price.</AppText>
        </View>
      </View>

      <DiscoverySearch query={searchQuery} result={searchResult} products={searchProducts} busy={searchBusy} retailer={searchRetailer} onRetailer={setSearchRetailer} onSearch={(query) => { runProductSearch(query); }} onClear={clearProductSearch} />

      {!searchQuery ? <DiscoveryDepartments selected={category} products={discoveryProducts} preferredCategories={watchedCategories} onSelect={selectDepartment} onBrowse={() => setShowSources(true)} /> : null}
      {!searchQuery && selectedCollection ? <AppText weight="semibold">{getSiteByKey(selectedCollection.siteKey).shortName} · {selectedCollection.label}</AppText> : null}
      {notice ? <View accessibilityLiveRegion="polite" style={styles.discoveryNotice}><AppText style={styles.flex}>{notice.message}</AppText>{notice.trackedId ? <Pressable accessibilityRole="button" onPress={() => navigate({ name: 'trackingSettings', id: notice.trackedId! })}><AppText style={styles.discoveryLink}>Set target price</AppText></Pressable> : null}<Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={() => setNotice(undefined)}><X size={18} color={colors.textMuted} /></Pressable></View> : null}

      {searchQuery ? <View style={styles.discoverySection}>
        <AppText weight="bold" accessibilityRole="header" style={styles.discoverySectionTitle}>Results for “{searchQuery}”</AppText>
        <AppText muted>{filteredProducts.length} title and brand {filteredProducts.length === 1 ? 'match' : 'matches'} · {resultRetailerCount} {resultRetailerCount === 1 ? 'retailer' : 'retailers'}</AppText>
        {!filteredProducts.length ? <AppText muted>{searchBusy ? 'Searching stores. Matches appear as each store responds.' : 'No matching product names in the returned results. Try a brand, model, or fewer words; check Coverage for unavailable stores.'}</AppText> : null}
        <DiscoveryProductGrid products={visibleProducts} trackedProducts={trackedProducts} trackingProductId={trackingProductId} onTrack={handleTrack} onDismiss={handleDismiss} onMoreLikeThis={openBrandListing} onViewAtRetailer={handleViewAtRetailer} />
        {filteredProducts.length > visibleCount ? <PrimaryButton label={`Show more (${filteredProducts.length - visibleCount} remaining)`} variant="outline" onPress={() => setSearchVisibleCount((count) => count + 24)} /> : null}
        {searchResult?.sources.some((source) => source.nextUrl) ? <PrimaryButton label="Load more search results" variant="outline" loading={searchBusy} onPress={() => runProductSearch(searchQuery, false, searchResult)} /> : null}
        {searchResult?.sources.some((source) => source.status === 'unavailable') ? <AppText muted>Some stores could not be searched. Saved matches may be older; see Coverage for details. Pull down to retry.</AppText> : null}
      </View> : discoveryProducts.length > 0 || category || retailer || collectionId ? (
        <>
          <View style={styles.discoverySection}>
            <View style={styles.titleRow}><AppText weight="bold" accessibilityRole="header" style={styles.discoverySectionTitle}>{category ? DISCOVERY_CATEGORY_LABELS[category] : 'Explore products'}</AppText><Pressable accessibilityRole="button" onPress={() => { resetBrowse(); setBrowseAll(!browseAll && !category); }} style={styles.discoveryToolbarAction}><AppText style={styles.discoveryLink}>{category || browseAll ? 'Watchlist picks' : 'All products'}</AppText></Pressable></View>
            {!browseAll && !category && !retailer && !collectionId && watchedCategories.length ? <AppText muted style={styles.watchlistReason}>Based on your watchlist · {watchedCategories.map((item) => SHOPPING_CATEGORY_LABELS[item]).join(', ')}</AppText> : null}
            {!browseAll && !category && !retailer && !collectionId && !watchedCategories.length ? <AppText muted>Track products to see related finds here.</AppText> : null}
            <View style={styles.discoveryToolbar}>
              <AppText muted style={styles.discoveryResultCount}>{filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} · {resultRetailerCount} {resultRetailerCount === 1 ? 'retailer' : 'retailers'}</AppText>
              <Pressable accessibilityRole="button" accessibilityLabel="Refresh discovery products" accessibilityState={{ disabled: catalogBusy || refreshing }} disabled={catalogBusy || refreshing} onPress={refresh} style={styles.discoveryToolbarAction}><RefreshCcw size={16} color={colors.primary} /><AppText style={styles.discoveryLink}>{catalogBusy || refreshing ? 'Refreshing…' : 'Refresh'}</AppText></Pressable>
              <Pressable accessibilityRole="button" onPress={() => setShowFilters((value) => !value)} style={styles.discoveryToolbarAction}><SlidersHorizontal size={16} color={colors.primary} /><AppText style={styles.discoveryLink}>Filters{activeFilter ? ' •' : ''}</AppText></Pressable>
            </View>
            {showFilters ? <View style={styles.listingFilters}>
              <AppText weight="semibold">Retailer</AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discoveryFilterRail}>
                <DiscoveryFilterChip label="Any retailer" selected={!retailer} onPress={() => setRetailer(undefined)} />
                {retailers.map((site) => <DiscoveryFilterChip key={site} label={getSiteByKey(site).shortName} selected={retailer === site} onPress={() => { setCollectionId(undefined); setRetailer(retailer === site ? undefined : site); }} />)}
              </ScrollView>
              <AppText weight="semibold">Brand</AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discoveryFilterRail}>
                <DiscoveryFilterChip label="Any brand" selected={!brand} onPress={() => setBrand(undefined)} />
                {brands.map((item) => <DiscoveryFilterChip key={item} label={item} selected={brand === item} onPress={() => setBrand(brand === item ? undefined : item)} />)}
              </ScrollView>
              <AppTextInput accessibilityLabel="Maximum discovery price in AED" value={maximumPrice} onChangeText={setMaximumPrice} keyboardType="decimal-pad" placeholder="Maximum price (AED)" />
            </View> : null}
            {activeFilter ? <View style={styles.titleRow}><AppText muted>{[category && DISCOVERY_CATEGORY_LABELS[category], brand, retailer && getSiteByKey(retailer).shortName, maximumPrice && `Under AED ${maximumPrice}`].filter(Boolean).join(' · ')}</AppText><Pressable accessibilityRole="button" accessibilityLabel="Clear discovery filters" onPress={() => { resetBrowse(); setBrowseAll(true); }}><AppText style={styles.discoveryLink}>Clear filters</AppText></Pressable></View> : null}
            {!filteredProducts.length ? <View style={styles.discoverySection}><AppText muted>{catalogBusy ? 'Loading products for this selection…' : 'No products match your interests, budgets, and filters right now.'}</AppText>{!catalogBusy ? <PrimaryButton label="Explore all products" variant="outline" onPress={() => { resetBrowse(); setBrowseAll(true); }} /> : null}</View> : null}
            {filteredProducts.length ? <DiscoveryProductGrid products={visibleProducts} trackedProducts={trackedProducts} trackingProductId={trackingProductId} onTrack={handleTrack} onDismiss={handleDismiss} onMoreLikeThis={openBrandListing} onViewAtRetailer={handleViewAtRetailer} /> : null}
            {filteredProducts.length > visibleCount ? <PrimaryButton label={`Show more (${filteredProducts.length - visibleCount} remaining)`} variant="outline" onPress={() => setDiscoveryVisibleCount((count) => count + 24)} /> : null}
          </View>
        </>
      ) : <View style={styles.discoverySection}><Pressable accessibilityRole="button" accessibilityLabel="Refresh discovery products" accessibilityState={{ disabled: catalogBusy || refreshing }} disabled={catalogBusy || refreshing} onPress={refresh} style={styles.discoveryToolbarAction}><RefreshCcw size={16} color={colors.primary} /><AppText style={styles.discoveryLink}>{catalogBusy || refreshing ? 'Refreshing…' : 'Refresh'}</AppText></Pressable>{catalogBusy ? <><ActivityIndicator color={colors.primary} /><AppText muted>Loading matching listings. Products appear as each retailer responds.</AppText></> : <EmptyDiscovery onPreferences={() => setShowSources(true)} />}</View>}

      {hasMoreListings ? <PrimaryButton label="Load more listings" variant="outline" loading={catalogBusy} onPress={() => setBatchLimit((current) => current + 24)} /> : null}
      {!searchQuery && catalogState.refreshedAt ? <AppText muted style={styles.discoveryFreshness}>{catalogState.stale ? 'Showing saved discovery products from ' : 'Product prices observed '}{formatRelativeTime(catalogState.refreshedAt)}.</AppText> : null}
      {!searchQuery && catalog?.failedCollectionIds?.length ? <Pressable accessibilityRole="button" onPress={() => setShowSources(true)}><AppText muted style={styles.discoveryFreshness}>{catalog.failedCollectionIds.length} collections could not refresh. View source status.</AppText></Pressable> : null}
      {(searchQuery ? searchResult?.historyUnavailable : catalog?.historyUnavailable) ? <AppText muted style={styles.discoveryFreshness}>Could not save listing price history. Refresh to retry.</AppText> : null}
      <DiscoveryBrowseSheet visible={showSources} sources={catalog?.sources} onClose={() => setShowSources(false)} onCategory={(selected) => { resetBrowse(); setCategory(selected); setBrowseAll(false); setShowSources(false); }} onRetailer={(selected) => { resetBrowse(); setRetailer(selected); setBrowseAll(true); setShowSources(false); }} onCollection={(source) => { resetBrowse(); setCollectionId(source.id); setRetailer(source.siteKey); setBrowseAll(true); setShowSources(false); }} />
      <Modal visible={Boolean(pendingProduct)} transparent animationType="slide" onRequestClose={() => !savingVariant && setPendingProduct(undefined)}>
        <View style={styles.discoveryModalBackdrop}><SafeAreaView edges={['bottom']} style={styles.discoveryOptionSheet}><Header title="Choose your option" onBack={() => !savingVariant && setPendingProduct(undefined)} /><ScrollView contentContainerStyle={styles.screenContent}>
          <AppText weight="bold" accessibilityRole="header" style={styles.discoverySectionTitle}>{pendingProduct?.parsed.title}</AppText>
          <VariantSelector variants={variantChoices} selectedAttributes={variantAttributes} onSelect={(name, value) => setVariantAttributes((current) => updateSelectedVariantAttributes(variantChoices, current, name, value))} />
          <AppText muted>{selectedVariant ? `${selectedChoice?.attributes.map((attribute) => attribute.value).join(' · ')} · ${formatPrice(selectedVariant.priceMinor, selectedVariant.currency ?? pendingProduct?.parsed.currency ?? 'AED', selectedVariant.priceBasis ?? pendingProduct?.parsed.priceBasis)}` : 'Choose an available option to track its exact price and stock.'}</AppText>
          {variantError ? <AppText accessibilityLiveRegion="polite">{variantError}</AppText> : null}
          <PrimaryButton label="Track this option" onPress={saveVariant} disabled={!selectedVariant} loading={savingVariant} />
        </ScrollView></SafeAreaView></View>
      </Modal>
    </ScrollView>
  );
}


function SettingsScreen({ refreshKey = 0 }: { refreshKey?: number }) {
  const { width, fontScale } = useWindowDimensions();
  const compact = isCompactLayout(width, fontScale);
  const [backgroundStatus, setBackgroundStatus] = useState<BackgroundStatus>();
  const [notificationEnabled, setNotificationEnabled] = useState<boolean>();
  const [queueingCheck, setQueueingCheck] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [requestingNotifications, setRequestingNotifications] = useState(false);
  const [batteryExempt, setBatteryExempt] = useState<boolean>();
  const [requestingBattery, setRequestingBattery] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showStores, setShowStores] = useState(false);

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
  }, [loadStatus, refreshKey]);

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
      <AppText weight="bold" accessibilityRole="header" style={styles.heading}>
        Settings
      </AppText>
      <AppText muted style={styles.settingsIntro}>
        Manage notifications and when Qeemat checks prices.
      </AppText>
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
            Price alerts and app update notices need Android notification access. If Android still blocks them after the prompt, open the app notification settings directly.
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
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showDiagnostics }}
            onPress={() => setShowDiagnostics((value) => !value)}
            style={styles.disclosureRow}
          >
            <View style={styles.flex}>
              <AppText weight="semibold">Run diagnostics</AppText>
              <AppText muted style={styles.settingsBodyText}>
                Last completed: {backgroundStatus?.lastCompletedAt ? formatRelativeTime(backgroundStatus.lastCompletedAt) : 'never'}
              </AppText>
            </View>
            {showDiagnostics ? <ChevronUp size={16} color={colors.textMuted} /> : <ChevronDown size={16} color={colors.textMuted} />}
          </Pressable>
          {showDiagnostics ? (
            <>
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
            </>
          ) : null}
        </View>
      </View>
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
            Track product links from these stores, including selected Amazon regions.
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showStores }}
            onPress={() => setShowStores((value) => !value)}
            style={styles.disclosureRow}
          >
            <AppText weight="semibold" style={styles.flex}>
              {showStores ? 'Hide stores' : 'View supported stores'}
            </AppText>
            {showStores ? <ChevronUp size={16} color={colors.textMuted} /> : <ChevronDown size={16} color={colors.textMuted} />}
          </Pressable>
          {showStores ? (
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
          ) : null}
        </View>
      </View>
      <PrimaryButton
        label="Delete all local data"
        variant="danger"
        onPress={() =>
          Alert.alert('Delete local data?', 'This removes all tracked products and price history from this device.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => Promise.all([deleteAllLocalData(), clearDiscoveryData(), clearUpdateNotificationHistory(), clearDismissedUpdateVersion()]) }
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

function StatCard({ label, price, currency, priceBasis, tone }: { label: string; price?: number; currency: string; priceBasis?: import('./src/domain/priceBasis').PriceBasis; tone: 'green' | 'red' | 'neutral' }) {
  return (
    <Surface padding="md" style={styles.statCard}>
      <AppText muted>{label}</AppText>
      <AppText weight="bold" style={[styles.statPrice, tone === 'green' ? styles.greenText : tone === 'red' ? styles.redText : undefined]}>
        {formatPrice(price, currency, priceBasis)}
      </AppText>
    </Surface>
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
    width: layoutMetrics.touchTarget,
    height: layoutMetrics.touchTarget,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    ...typography.sheetTitle,
    flex: 1,
    minWidth: 0,
    textAlign: 'center'
  },
  screenContent: {
    padding: layoutMetrics.screenGutter,
    paddingBottom: 110,
    gap: layoutMetrics.sectionGap
  },
  discoveryScreenContent: { padding: 16, gap: 10 },
  watchlistContent: { backgroundColor: colors.surface, paddingTop: 0, paddingBottom: 110 },
  watchlistSystemBar: { backgroundColor: colors.primary },
  watchlistBanner: { backgroundColor: colors.primary, marginHorizontal: -layoutMetrics.screenGutter, paddingHorizontal: layoutMetrics.screenGutter, paddingTop: 14, paddingBottom: 18, gap: 12 },
  watchlistBrandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  watchlistBrandLockup: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  watchlistBrandIcon: { width: 30, height: 30, borderRadius: 7 },
  watchlistHeaderActions: { flexDirection: 'row', alignItems: 'center' },
  watchlistBrand: { color: colors.surface, fontSize: 20, lineHeight: 26 },
  watchlistSearchButton: { width: layoutMetrics.touchTarget, height: layoutMetrics.touchTarget, alignItems: 'center', justifyContent: 'center' },
  watchlistUpdateDot: { position: 'absolute', top: 4, right: 6, width: 13, height: 13, borderRadius: 7, backgroundColor: colors.red, borderWidth: 2, borderColor: colors.primary },
  watchlistBannerTitle: { color: colors.surface, ...typography.screenTitle },
  watchlistBannerCount: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primaryDark, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 7 },
  watchlistBannerCountText: { color: colors.surface, fontSize: 12 },
  watchlistFilterText: { color: colors.surface, fontSize: 14 },
  addScreenContent: {
    paddingTop: 28,
    gap: 18
  },
  addIntroText: {
    fontSize: 16,
    lineHeight: 24
  },
  heading: {
    ...typography.screenTitle
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
    minHeight: layoutMetrics.touchTarget,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
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
    backgroundColor: colors.surface
  },
  controlsCountText: {
    color: colors.primary,
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
    ...typography.sheetTitle
  },
  controlSheetClose: {
    width: layoutMetrics.touchTarget,
    height: layoutMetrics.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted
  },
  controlSheetContent: {
    gap: 20
  },
  watchlistToolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10
  },
  toolbarIconButton: {
    minWidth: layoutMetrics.touchTarget,
    minHeight: layoutMetrics.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted
  },
  toolbarIconButtonActive: {
    backgroundColor: colors.primary
  },
  watchlistBannerSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface
  },
  watchlistSearchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8
  },
  watchlistRecheck: {
    minHeight: layoutMetrics.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface
  },
  watchlistRecheckDisabled: { opacity: 0.5 },
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
    minHeight: layoutMetrics.touchTarget,
    justifyContent: 'center',
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
  watchlistCardList: { gap: 0 },
  oosSection: {
    backgroundColor: colors.blueSoft,
    borderRadius: radius.md,
    borderWidth: 0,
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
    alignItems: 'center'
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
    justifyContent: 'center'
  },
  tabBar: {
    height: 74,
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabButtonContent: { alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 10, paddingVertical: 5 },
  tabButtonActive: { backgroundColor: colors.blueSoft, borderRadius: radius.lg },
  tabIconWrap: { position: 'relative' },
  tabUpdateDot: { position: 'absolute', top: -4, right: -9, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.red, borderWidth: 2, borderColor: colors.background },
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
    minHeight: layoutMetrics.touchTarget,
    justifyContent: 'center',
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
  inputDetected: {
    borderColor: colors.green
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
  supportedStoresSection: {
    gap: 10
  },
  disclosureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: layoutMetrics.touchTarget,
    paddingHorizontal: 2
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
    backgroundColor: colors.surface
  },
  previewCardCompact: {
    flexDirection: 'column'
  },
  trackingNoticeWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.amber,
    backgroundColor: colors.amberSoft
  },
  trackingWarningCopy: {
    color: colors.text,
    marginTop: 2
  },
  noticeActionButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.primary
  },
  noticeActionText: {
    color: colors.surface
  },
  trackingNoticeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.blueSoft
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
  detailPriceBlock: {
    flex: 1,
    minWidth: 0,
    gap: 6
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2
  },
  detailHeaderActions: {
    flexDirection: 'row',
    gap: 4
  },
  detailTitle: {
    ...typography.detailTitle
  },
  iconButton: {
    width: layoutMetrics.touchTarget,
    height: layoutMetrics.touchTarget,
    borderRadius: layoutMetrics.touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  currentPrice: {
    ...typography.price
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
    ...typography.sectionTitle
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12
  },
  insightCaption: {
    fontSize: 12,
    marginTop: -8
  },
  productInformation: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16
  },
  productInformationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12
  },
  productInformationDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  productInformationLabel: {
    width: 105,
    fontSize: 13
  },
  productInformationValue: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20
  },
  statCard: {
    flex: 1
  },
  statPrice: {
    marginTop: 4,
    ...typography.priceSmall
  },
  greenText: {
    color: colors.green
  },
  redText: {
    color: colors.red
  },
  snapshotPriceDown: {
    color: colors.green
  },
  snapshotPriceUp: {
    color: colors.red
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
  watchlistReason: { fontSize: 12, lineHeight: 18 },
  discoveryToolbarAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 6 },
  discoveryModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  discoveryOptionSheet: { height: '75%', backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, overflow: 'hidden' },
  discoveryToolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  discoveryResultCount: { flex: 1, fontSize: 12 },
  discoveryLink: { color: colors.primary, fontSize: 13 },
  discoveryNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.blueSoft },
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
    ...typography.sectionTitle
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
  listingCount: {
    fontSize: 13,
    marginTop: -2
  },
  updatePinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    marginBottom: 4,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.blueSoft
  },
  updatePinBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  updatePinTitle: {
    fontSize: 15,
    lineHeight: 20
  },
  updatePinBody: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2
  },
  settingsCard: {
    padding: 20,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
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
  hiddenTab: { display: 'none' },
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
    width: '100%'
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
