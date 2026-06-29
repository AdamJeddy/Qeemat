import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Bell,
  Check,
  CircleAlert,
  Clock,
  Link2,
  Plus,
  RefreshCcw,
  Settings as SettingsIcon,
  SquareStack,
  Store,
  Trash2,
  TrendingDown,
  TrendingUp
} from 'lucide-react-native';

import { AppText } from './src/components/AppText';
import { OptionGroup } from './src/components/OptionGroup';
import { PriceChart } from './src/components/PriceChart';
import { PrimaryButton } from './src/components/PrimaryButton';
import { ProductCard } from './src/components/ProductCard';
import { StatusPill } from './src/components/StatusPill';
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
  getProductWithSnapshots,
  getTrackedProduct,
  initializeDatabase,
  listActivityEvents,
  listTrackedProducts,
  updateTrackingSettings
} from './src/data/database';
import { runBackgroundCheckOnce, scheduleBackgroundChecks, checkBatteryOptimizationExempt, requestBatteryOptimizationExemption, openAppSystemSettings } from './src/domain/backgroundScheduler';
import { checkAllActiveProducts, checkProductById } from './src/domain/checker';
import { availableCheckPreferences, formatRelativeTime, formatSnapshotTime } from './src/domain/dates';
import { getOnboardingState, markOnboardingCompleted } from './src/domain/onboarding';
import { ensureNotificationPermission, openNotificationSettings } from './src/domain/notifications';
import { fetchAndParseProduct } from './src/domain/parser';
import { formatPrice, parseTargetPriceInput } from './src/domain/price';
import { detectSupportedSite, normalizeUrl, SUPPORTED_SITES } from './src/domain/sites';
import { ActivityEvent, AlertMode, CheckPreference, ParsedProduct, PriceSnapshot, ProductWithSnapshots, SnapshotSource, TrackedProduct } from './src/domain/types';
import { colors, radius, shadow } from './src/theme/theme';

type TabKey = 'watchlist' | 'activity' | 'settings';
type Route =
  | { name: 'tabs'; tab: TabKey }
  | { name: 'add' }
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

const BACKGROUND_TIME_PRESETS = [
  { label: 'Morning', hour: 9 },
  { label: 'Afternoon', hour: 14 },
  { label: 'Evening', hour: 20 }
];

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'tabs', tab: 'watchlist' });
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingLoading, setOnboardingLoading] = useState(false);

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
        {route.name === 'add' ? <AddScreen navigate={setRoute} /> : null}
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
    return { name: 'tabs', tab: 'watchlist' };
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
      {tab === 'activity' ? <ActivityScreen navigate={navigate} /> : null}
      {tab === 'settings' ? <SettingsScreen /> : null}
      <View style={styles.tabBar}>
        <TabButton active={tab === 'watchlist'} label="Watchlist" icon={<SquareStack />} onPress={() => navigate({ name: 'tabs', tab: 'watchlist' })} />
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
      <AppText weight="bold" style={styles.headerTitle}>
        {title}
      </AppText>
      <View style={styles.headerButton} />
    </View>
  );
}

function WatchlistScreen({ navigate }: { navigate: (route: Route) => void }) {
  const [products, setProducts] = useState<TrackedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);

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
              {products.length} {products.length === 1 ? 'item' : 'items'}
            </AppText>
          </View>
        </View>
        <PrimaryButton
          label="Recheck all prices"
          variant="outline"
          onPress={recheckAllPrices}
          loading={checkingAll}
          disabled={!products.length || loading}
          icon={!checkingAll ? <RefreshCcw size={18} color={colors.primary} /> : undefined}
        />

        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {!loading && products.length === 0 ? <EmptyWatchlist onAdd={() => navigate({ name: 'add' })} /> : null}
        <View style={styles.cardList}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} onPress={() => navigate({ name: 'detail', id: product.id })} />
          ))}
        </View>
      </ScrollView>
      <Pressable style={styles.fab} onPress={() => navigate({ name: 'add' })}>
        <Plus size={30} color="#FFFFFF" />
      </Pressable>
    </View>
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
        Paste a Noon, Nike UAE, Sun & Sand Sports, Level Shoes, AYM Accessories, Ounass, or Amazon product link to start a local price history.
      </AppText>
      <PrimaryButton label="Add product" onPress={onAdd} style={styles.emptyButton} />
    </View>
  );
}

function AddScreen({ navigate }: { navigate: (route: Route) => void }) {
  const [url, setUrl] = useState('');
  const [parsedProduct, setParsedProduct] = useState<ParsedProduct | undefined>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [checkPreference, setCheckPreference] = useState<CheckPreference>('daily');
  const [alertMode, setAlertMode] = useState<AlertMode>('price_drop');
  const [targetPrice, setTargetPrice] = useState('');

  const normalizedUrl = normalizeUrl(url);
  const detectedSite = useMemo(() => detectSupportedSite(normalizedUrl), [normalizedUrl]);
  const targetPriceMinor = parseTargetPriceInput(targetPrice);

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

  async function parseUrl() {
    setError(undefined);
    setParsedProduct(undefined);
    setLoading(true);
    const result = await fetchAndParseProduct(url);
    if (result.ok) {
      setParsedProduct(result.product);
    } else {
      setError(result.message);
    }
    setLoading(false);
  }

  async function saveProduct() {
    if (!parsedProduct) {
      return;
    }
    setSaving(true);
    const id = await createTrackedProduct({
      parsed: parsedProduct,
      sourceUrl: normalizedUrl,
      checkPreference,
      alertMode,
      targetPriceMinor: alertMode === 'target_price' ? targetPriceMinor : undefined
    });
    setSaving(false);
    navigate({ name: 'detail', id });
  }

  return (
    <View style={styles.app}>
      <Header title="Add Product" onBack={() => navigate({ name: 'tabs', tab: 'watchlist' })} />
      <ScrollView
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
                setUrl(value);
                setParsedProduct(undefined);
                setError(undefined);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://www.noon.com/..."
              placeholderTextColor={colors.textSoft}
              style={styles.input}
            />
          </View>
          {detectedSite ? (
            <View style={styles.inlineStatus}>
              <Check size={15} color={colors.green} />
              <AppText weight="medium" style={styles.detectedText}>
                {detectedSite.displayName}
              </AppText>
            </View>
          ) : null}
        </View>
        <View style={styles.chips}>
          {SUPPORTED_SITES.map((site) => (
            <View key={site.key} style={[styles.chip, detectedSite?.key === site.key && styles.chipSelected]}>
              <AppText weight="medium" style={[styles.chipText, detectedSite?.key === site.key && styles.chipTextSelected]}>
                {site.shortName}
              </AppText>
            </View>
          ))}
        </View>
        <PrimaryButton label="Find product" onPress={parseUrl} disabled={!url.trim() || loading} loading={loading} />
        {error ? (
          <View style={styles.errorBox}>
            <CircleAlert size={18} color={colors.red} />
            <AppText style={styles.errorBoxText}>{error}</AppText>
          </View>
        ) : null}
        {parsedProduct ? (
          <View style={styles.previewSection}>
            <ProductPreview product={parsedProduct} storeName={detectedSite?.shortName ?? 'Store'} />
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
                  AED
                </AppText>
                <TextInput
                  value={targetPrice}
                  onChangeText={setTargetPrice}
                  keyboardType="decimal-pad"
                  placeholder="250"
                  placeholderTextColor={colors.textSoft}
                  style={styles.input}
                />
              </View>
            ) : null}
            <PrimaryButton
              label="Confirm Tracking"
              onPress={saveProduct}
              loading={saving}
              disabled={alertMode === 'target_price' && !targetPriceMinor}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ProductPreview({ product, storeName }: { product: ParsedProduct; storeName: string }) {
  return (
    <View style={styles.previewCard}>
      <View style={styles.previewImageWrap}>
        {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.previewImage} resizeMode="contain" /> : null}
      </View>
      <View style={styles.previewCopy}>
        <AppText weight="bold" numberOfLines={2} style={styles.previewTitle}>
          {product.title}
        </AppText>
        <View style={styles.storePill}>
          <AppText style={styles.storePillText}>{storeName}</AppText>
        </View>
        <AppText muted style={styles.caption}>
          Current price
        </AppText>
        <AppText weight="bold" style={styles.previewPrice}>
          {formatPrice(product.priceMinor, product.currency)}
        </AppText>
      </View>
    </View>
  );
}

function DetailScreen({ productId, navigate }: { productId: number; navigate: (route: Route) => void }) {
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
  const stats = getPriceStats(snapshots);

  return (
    <View style={styles.app}>
      <Header title="Qeemat" onBack={() => navigate({ name: 'tabs', tab: 'watchlist' })} />
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <View style={styles.detailHero}>
          <View style={styles.detailImageWrap}>
            {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.detailImage} resizeMode="contain" /> : null}
          </View>
          <View style={styles.detailCopy}>
            <View style={styles.titleRow}>
              <AppText weight="bold" style={styles.detailTitle} numberOfLines={3}>
                {product.title}
              </AppText>
              <Pressable style={styles.iconButton} onPress={() => navigate({ name: 'trackingSettings', id: product.id })}>
                <SettingsIcon size={20} color={colors.text} />
              </Pressable>
            </View>
            <AppText muted style={styles.caption}>
              Current price
            </AppText>
            <AppText weight="bold" style={styles.currentPrice}>
              {formatPrice(product.currentPriceMinor, product.currency)}
            </AppText>
            {product.targetPriceMinor ? (
              <AppText weight="semibold">Target {formatPrice(product.targetPriceMinor, product.currency)}</AppText>
            ) : null}
            <StatusPill status={product.lastErrorCode ?? snapshots[0]?.status ?? 'ok'} label={`Checked ${formatRelativeTime(product.lastCheckedAt)}`} />
          </View>
        </View>
        <SectionTitle title="Price History" />
        <PriceChart snapshots={snapshots} />
        <View style={styles.statsRow}>
          <StatCard label="Lowest price" price={stats.lowest} currency={product.currency} tone="green" />
          <StatCard label="Highest price" price={stats.highest} currency={product.currency} tone="red" />
        </View>
        <SectionTitle title="Price Snapshots" />
        <View style={styles.snapshotList}>
          {snapshots.slice(0, 12).map((snapshot) => (
            <View key={snapshot.id} style={styles.snapshotRow}>
              <View style={styles.flex}>
                <View style={styles.snapshotMetaRow}>
                  <AppText weight="medium">{formatSnapshotTime(snapshot.checkedAt)}</AppText>
                  <View style={[styles.sourceBadge, snapshotSourceBadgeStyle(snapshot.source)]}>
                    <AppText weight="semibold" style={styles.sourceBadgeText}>
                      {snapshotSourceLabel(snapshot.source)}
                    </AppText>
                  </View>
                </View>
                {snapshot.errorCode ? <AppText muted>{snapshot.errorCode}</AppText> : null}
              </View>
              <View style={styles.snapshotPriceBlock}>
                <AppText weight="bold" style={snapshot.status === 'price_changed' && styles.changedPrice}>
                  {snapshot.priceMinor !== undefined ? formatPrice(snapshot.priceMinor, snapshot.currency ?? product.currency) : 'Failed'}
                </AppText>
                <AppText muted style={styles.snapshotAvailability}>
                  {snapshot.availability.replace(/_/g, ' ')}
                </AppText>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.bottomActionRow}>
        <PrimaryButton label="Check now" variant="outline" onPress={checkNow} loading={checking} style={styles.bottomActionHalf}
          icon={!checking ? <RefreshCcw size={18} color={colors.primary} /> : undefined} />
        <PrimaryButton label="Open link" variant="outline" onPress={() => Linking.openURL(product.canonicalUrl || product.url)} style={styles.bottomActionHalf}
          icon={<Link2 size={18} color={colors.primary} />} />
      </View>
    </View>
  );
}

function TrackingSettingsScreen({ productId, navigate }: { productId: number; navigate: (route: Route) => void }) {
  const [product, setProduct] = useState<TrackedProduct | undefined>();
  const [checkPreference, setCheckPreference] = useState<CheckPreference>('daily');
  const [alertMode, setAlertMode] = useState<AlertMode>('price_drop');
  const [targetPrice, setTargetPrice] = useState('');

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
    });
  }, [productId]);

  async function save() {
    await updateTrackingSettings(productId, {
      alertMode,
      checkPreference,
      targetPriceMinor: alertMode === 'target_price' ? parseTargetPriceInput(targetPrice) : undefined,
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
              AED
            </AppText>
            <TextInput value={targetPrice} onChangeText={setTargetPrice} keyboardType="decimal-pad" style={styles.input} />
          </View>
        ) : null}
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
                    </View>
                    <View style={styles.activityMetaRow}>
                      {event.priceDirection === 'first' ? (
                        <View style={styles.activityFirstBadge}>
                          <AppText weight="semibold" style={styles.activityFirstBadgeText}>
                            Started tracking
                          </AppText>
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

function SettingsScreen() {
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
                {SUPPORTED_SITES.length} live
              </AppText>
            </View>
          </View>
          <AppText muted style={styles.settingsBodyText}>
            Product links are currently supported for these stores. Amazon support is kept intentionally lightweight for the MVP across selected regional domains.
          </AppText>
          <View style={styles.settingsChipWrap}>
            {SUPPORTED_SITES.map((site) => (
              <View key={site.key} style={styles.settingsChip}>
                <Store size={14} color={colors.primary} />
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
          <View style={styles.settingsPresetRow}>
            {BACKGROUND_TIME_PRESETS.map((preset) => {
              const selected = preset.hour === selectedPresetHour;
              return (
                <Pressable
                  key={preset.label}
                  style={[styles.settingsPreset, selected && styles.settingsPresetActive, savingSchedule && styles.settingsPresetDisabled]}
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
            { text: 'Delete', style: 'destructive', onPress: () => deleteAllLocalData() }
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

function StatCard({ label, price, currency, tone }: { label: string; price?: number; currency: string; tone: 'green' | 'red' }) {
  return (
    <View style={styles.statCard}>
      <AppText muted>{label}</AppText>
      <AppText weight="bold" style={[styles.statPrice, tone === 'green' ? styles.greenText : styles.redText]}>
        {formatPrice(price, currency)}
      </AppText>
    </View>
  );
}

function getPriceStats(snapshots: PriceSnapshot[]) {
  const prices = snapshots.map((snapshot) => snapshot.priceMinor).filter((price): price is number => price !== undefined);
  return {
    lowest: prices.length ? Math.min(...prices) : undefined,
    highest: prices.length ? Math.max(...prices) : undefined
  };
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
    fontSize: 20
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
  cardList: {
    gap: 12
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
    right: 22,
    bottom: 86,
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
  formLabel: {
    fontSize: 17
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
  inlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  detectedText: {
    color: colors.green,
    fontSize: 15
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  chip: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    paddingVertical: 14
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F8FBFF'
  },
  chipText: {
    fontSize: 15
  },
  chipTextSelected: {
    color: colors.primary
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
  previewImageWrap: {
    width: 118,
    height: 136,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center'
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
  detailImageWrap: {
    width: 112,
    height: 142,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center'
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
  sectionTitle: {
    fontSize: 18
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12
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
  statPrice: {
    marginTop: 4,
    fontSize: 20
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
