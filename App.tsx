import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
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
  Link2,
  Plus,
  RefreshCcw,
  Settings as SettingsIcon,
  SquareStack,
  Store,
  Trash2
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
  listTrackedProducts,
  updateTrackingSettings
} from './src/data/database';
import { runBackgroundCheckOnce, scheduleBackgroundChecks } from './src/domain/backgroundScheduler';
import { checkAllActiveProducts, checkProductById } from './src/domain/checker';
import { formatRelativeTime, formatSnapshotTime } from './src/domain/dates';
import { ensureNotificationPermission, openNotificationSettings } from './src/domain/notifications';
import { fetchAndParseProduct } from './src/domain/parser';
import { formatPrice, parseTargetPriceInput } from './src/domain/price';
import { detectSupportedSite, normalizeUrl, SUPPORTED_SITES } from './src/domain/sites';
import { AlertMode, CheckPreference, ParsedProduct, PriceSnapshot, ProductWithSnapshots, SnapshotSource, TrackedProduct } from './src/domain/types';
import { colors, radius, shadow } from './src/theme/theme';

type TabKey = 'watchlist' | 'alerts' | 'settings';
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

  useEffect(() => {
    let active = true;

    (async () => {
      await initializeDatabase();
      const backgroundStatus = await getBackgroundStatus();
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
      <SafeAreaView style={styles.app}>
        {route.name === 'tabs' ? <TabsScreen tab={route.tab} navigate={setRoute} /> : null}
        {route.name === 'add' ? <AddScreen navigate={setRoute} /> : null}
        {route.name === 'detail' ? <DetailScreen productId={route.id} navigate={setRoute} /> : null}
        {route.name === 'trackingSettings' ? <TrackingSettingsScreen productId={route.id} navigate={setRoute} /> : null}
      </SafeAreaView>
    </SafeAreaProvider>
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
      {tab === 'alerts' ? <AlertsScreen navigate={navigate} /> : null}
      {tab === 'settings' ? <SettingsScreen /> : null}
      <View style={styles.tabBar}>
        <TabButton active={tab === 'watchlist'} label="Watchlist" icon={<SquareStack />} onPress={() => navigate({ name: 'tabs', tab: 'watchlist' })} />
        <TabButton active={tab === 'alerts'} label="Alerts" icon={<Bell />} onPress={() => navigate({ name: 'tabs', tab: 'alerts' })} />
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
        Paste a Noon, Nike UAE, Sun & Sand Sports, Level Shoes, or Amazon.ae link to start a local price history.
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
            <OptionGroup value={checkPreference} options={CHECK_OPTIONS} onChange={setCheckPreference} />
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
      <View style={styles.bottomAction}>
        <PrimaryButton
          label="Check now"
          variant="outline"
          onPress={checkNow}
          loading={checking}
          icon={!checking ? <RefreshCcw size={18} color={colors.primary} /> : undefined}
        />
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
      setCheckPreference(row.checkPreference);
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
        <OptionGroup value={checkPreference} options={CHECK_OPTIONS} onChange={setCheckPreference} />
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

function AlertsScreen({ navigate }: { navigate: (route: Route) => void }) {
  const [products, setProducts] = useState<TrackedProduct[]>([]);
  useEffect(() => {
    listTrackedProducts().then(setProducts);
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <AppText weight="bold" style={styles.heading}>
        Local alerts
      </AppText>
      <AppText muted>Alert rules are stored on this device. Native notification delivery will be added after the Android build is stable.</AppText>
      {products.length === 0 ? <EmptyWatchlist onAdd={() => navigate({ name: 'add' })} /> : null}
      <View style={styles.cardList}>
        {products.map((product) => (
          <View key={product.id} style={styles.ruleCard}>
            <Bell size={20} color={colors.primary} />
            <View style={styles.flex}>
              <AppText weight="semibold" numberOfLines={1}>
                {product.title}
              </AppText>
              <AppText muted>{alertModeLabel(product.alertMode)}</AppText>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function SettingsScreen() {
  const [backgroundStatus, setBackgroundStatus] = useState<BackgroundStatus>();
  const [notificationEnabled, setNotificationEnabled] = useState<boolean>();
  const [queueingCheck, setQueueingCheck] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [requestingNotifications, setRequestingNotifications] = useState(false);

  const loadStatus = useCallback(async () => {
    const [status, notificationsAllowed] = await Promise.all([
      getBackgroundStatus(),
      ensureNotificationPermission(false)
    ]);

    setBackgroundStatus(status);
    setNotificationEnabled(notificationsAllowed);
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
            Product links are currently supported for these UAE stores. Amazon support is kept intentionally lightweight for the MVP.
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
            <View style={styles.flex}>
              <AppText weight="bold">Daily background check time</AppText>
              <AppText muted style={styles.settingsBodyText}>
                Android will try to run the worker around the selected hour each day using this device's local time.
              </AppText>
            </View>
            <View style={[styles.settingsBadge, styles.settingsBadgeSuccess]}>
              <AppText weight="semibold" style={[styles.settingsBadgeText, styles.settingsBadgeSuccessText]}>
                {preferredHourLabel}
              </AppText>
            </View>
          </View>
          <AppText weight="semibold" muted>
            Pick a time
          </AppText>
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
          <AppText muted style={styles.settingsHint}>
            Tap an option to save it immediately. Product check preferences still decide which items are actually due when the worker wakes up.
          </AppText>
          <View style={styles.settingsMetaCard}>
            <InfoRow label="Saved daily target" value={preferredHourLabel} />
            <InfoRow label="Last scheduled" value={formatStatusTime(backgroundStatus?.lastScheduledAt)} />
            <InfoRow label="Last started" value={formatStatusTime(backgroundStatus?.lastStartedAt)} />
            <InfoRow label="Last completed" value={formatStatusTime(backgroundStatus?.lastCompletedAt)} />
            <InfoRow
              label="Last source"
              value={backgroundStatus?.lastSource ? formatRunSource(backgroundStatus.lastSource, backgroundStatus.lastForceRun) : 'No background run yet'}
            />
            {backgroundStatus?.lastRunError ? <AppText style={styles.errorText}>Last run error: {backgroundStatus.lastRunError}</AppText> : null}
          </View>
          <AppText muted style={styles.settingsHint}>
            WorkManager is best-effort. Battery saving, idle mode, vendor restrictions, or force-stopping the app can delay future runs.
          </AppText>
          <AppText muted style={styles.settingsHint}>
            No extra background permission is normally required. Notification permission is separate and only affects alerts.
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

function alertModeLabel(mode: AlertMode): string {
  if (mode === 'any_change') {
    return 'Any price change';
  }
  if (mode === 'target_price') {
    return 'Target price';
  }
  return 'Price drops only';
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
  ruleCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
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
  }
});
