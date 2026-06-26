import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ActivityEvent,
  AlertMode,
  CheckPreference,
  CheckStatus,
  ParsedProduct,
  PriceDirection,
  PriceSnapshot,
  ProductDraft,
  ProductWithSnapshots,
  SnapshotSource,
  TrackedProduct
} from '../domain/types';
import { nowIso } from '../domain/dates';
import { normalizeCheckPreference } from '../domain/dates';

const STORE_KEY = 'qeemat.local-store.v1';

type LocalStore = {
  nextProductId: number;
  nextSnapshotId: number;
  nextActivityId: number;
  products: TrackedProduct[];
  snapshots: PriceSnapshot[];
  activity: ActivityEvent[];
};

const EMPTY_STORE: LocalStore = {
  nextProductId: 1,
  nextSnapshotId: 1,
  nextActivityId: 1,
  products: [],
  snapshots: [],
  activity: []
};

let initialized = false;

export async function initializeDatabase(): Promise<void> {
  if (initialized) {
    return;
  }

  const existing = await AsyncStorage.getItem(STORE_KEY);
  if (!existing) {
    await writeStore(EMPTY_STORE);
  }

  initialized = true;

  // One-time migration: backfill activity events from existing snapshot data
  await migrateActivityEventsIfNeeded();
}

export async function listTrackedProducts(): Promise<TrackedProduct[]> {
  const store = await readStore();
  return [...store.products].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getTrackedProduct(id: number): Promise<TrackedProduct | undefined> {
  const store = await readStore();
  return store.products.find((product) => product.id === id);
}

export async function getProductWithSnapshots(id: number): Promise<ProductWithSnapshots | undefined> {
  const product = await getTrackedProduct(id);
  if (!product) {
    return undefined;
  }

  return {
    product,
    snapshots: await listSnapshots(id)
  };
}

export async function listSnapshots(productId: number, limit = 60): Promise<PriceSnapshot[]> {
  const store = await readStore();
  return store.snapshots
    .filter((snapshot) => snapshot.trackedProductId === productId)
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))
    .slice(0, limit);
}

export async function createTrackedProduct(draft: ProductDraft): Promise<number> {
  const store = await readStore();
  const now = nowIso();
  const productId = store.nextProductId;
  const parsed = draft.parsed;

  const product: TrackedProduct = {
    id: productId,
    url: draft.sourceUrl,
    canonicalUrl: parsed.canonicalUrl,
    siteKey: parsed.siteKey,
    title: parsed.title,
    imageUrl: parsed.imageUrl,
    currency: parsed.currency ?? 'AED',
    currentPriceMinor: parsed.priceMinor,
    targetPriceMinor: draft.targetPriceMinor,
    alertMode: draft.alertMode,
    checkPreference: draft.checkPreference,
    isActive: true,
    lastCheckedAt: now,
    lastSuccessAt: now,
    createdAt: now,
    updatedAt: now
  };

  const snapshot = createSnapshot(store.nextSnapshotId, productId, parsed, 'ok', 'manual_single', undefined, now);

  await writeStore({
    ...store,
    nextProductId: store.nextProductId + 1,
    nextSnapshotId: store.nextSnapshotId + 1,
    products: [product, ...store.products],
    snapshots: [snapshot, ...store.snapshots]
  });

  // Record initial price as first activity event
  if (product.currentPriceMinor !== undefined) {
    await recordActivityEvent({
      trackedProductId: productId,
      productTitle: product.title,
      productImageUrl: product.imageUrl,
      newPriceMinor: product.currentPriceMinor,
      currency: product.currency,
      priceDirection: 'first',
      source: 'manual_single',
      checkedAt: now
    });
  }

  return productId;
}

export async function updateTrackingSettings(
  id: number,
  settings: {
    alertMode: AlertMode;
    checkPreference: CheckPreference;
    targetPriceMinor?: number;
    isActive: boolean;
  }
): Promise<void> {
  const store = await readStore();
  const now = nowIso();

  await writeStore({
    ...store,
    products: store.products.map((product) =>
      product.id === id
        ? {
            ...product,
            alertMode: settings.alertMode,
            checkPreference: settings.checkPreference,
            targetPriceMinor: settings.targetPriceMinor,
            isActive: settings.isActive,
            updatedAt: now
          }
        : product
    )
  });
}

export async function deleteTrackedProduct(id: number): Promise<void> {
  const store = await readStore();
  await writeStore({
    ...store,
    products: store.products.filter((product) => product.id !== id),
    snapshots: store.snapshots.filter((snapshot) => snapshot.trackedProductId !== id)
  });
}

export async function deleteAllLocalData(): Promise<void> {
  await writeStore(EMPTY_STORE);
}

const MAX_ACTIVITY_EVENTS = 100;

export async function recordActivityEvent(
  event: Omit<ActivityEvent, 'id'>
): Promise<void> {
  const store = await readStore();
  const entry: ActivityEvent = {
    ...event,
    id: store.nextActivityId
  };

  const trimmed = [entry, ...store.activity].slice(0, MAX_ACTIVITY_EVENTS);

  await writeStore({
    ...store,
    nextActivityId: store.nextActivityId + 1,
    activity: trimmed
  });
}

export async function listActivityEvents(limit = 50): Promise<ActivityEvent[]> {
  const store = await readStore();
  return [...store.activity]
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))
    .slice(0, limit);
}

const MIGRATION_KEY = 'qeemat.migrated-activity.v1';

async function migrateActivityEventsIfNeeded(): Promise<void> {
  const alreadyMigrated = await AsyncStorage.getItem(MIGRATION_KEY);
  if (alreadyMigrated) {
    return;
  }

  const store = await readStore();

  // Only migrate if there's snapshot data and no activity events yet
  if (store.snapshots.length === 0 || store.activity.length > 0) {
    return;
  }

  const events: ActivityEvent[] = [];
  let nextId = store.nextActivityId;

  for (const product of store.products) {
    const productSnapshots = store.snapshots
      .filter((s) => s.trackedProductId === product.id)
      .sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));

    let lastPriceMinor: number | undefined;

    for (const snapshot of productSnapshots) {
      if (snapshot.priceMinor === undefined) {
        continue;
      }

      const direction = resolveMigrationDirection(lastPriceMinor, snapshot.priceMinor);
      if (!direction) {
        lastPriceMinor = snapshot.priceMinor;
        continue;
      }

      events.push({
        id: nextId++,
        trackedProductId: product.id,
        productTitle: product.title,
        productImageUrl: product.imageUrl,
        previousPriceMinor: lastPriceMinor,
        newPriceMinor: snapshot.priceMinor,
        currency: snapshot.currency ?? product.currency,
        priceDirection: direction,
        source: snapshot.source,
        checkedAt: snapshot.checkedAt
      });

      lastPriceMinor = snapshot.priceMinor;
    }
  }

  // Sort events newest-first and cap at MAX_ACTIVITY_EVENTS
  events.sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
  const trimmed = events.slice(0, MAX_ACTIVITY_EVENTS);

  await writeStore({
    ...store,
    nextActivityId: nextId,
    activity: trimmed
  });

  await AsyncStorage.setItem(MIGRATION_KEY, 'done');
}

function resolveMigrationDirection(
  previousPriceMinor: number | undefined,
  newPriceMinor: number
): PriceDirection | undefined {
  if (previousPriceMinor === undefined) {
    return 'first';
  }

  if (newPriceMinor < previousPriceMinor) {
    return 'down';
  }

  if (newPriceMinor > previousPriceMinor) {
    return 'up';
  }

  return undefined;
}

export async function recordSuccessfulCheck(
  product: TrackedProduct,
  parsed: ParsedProduct,
  source: SnapshotSource
): Promise<{ status: CheckStatus; previousPriceMinor?: number; newPriceMinor?: number }> {
  const store = await readStore();
  const checkedAt = nowIso();
  const previousPriceMinor = product.currentPriceMinor;
  const newPriceMinor = parsed.priceMinor;
  const status: CheckStatus =
    previousPriceMinor !== undefined && newPriceMinor !== undefined && previousPriceMinor !== newPriceMinor
      ? 'price_changed'
      : 'ok';
  const snapshot = createSnapshot(store.nextSnapshotId, product.id, parsed, status, source, undefined, checkedAt);

  await writeStore({
    ...store,
    nextSnapshotId: store.nextSnapshotId + 1,
    products: store.products.map((item) =>
      item.id === product.id
        ? {
            ...item,
            canonicalUrl: parsed.canonicalUrl,
            title: parsed.title,
            imageUrl: parsed.imageUrl ?? item.imageUrl,
            currency: parsed.currency ?? item.currency,
            currentPriceMinor: newPriceMinor,
            lastCheckedAt: checkedAt,
            lastSuccessAt: checkedAt,
            lastErrorAt: undefined,
            lastErrorCode: undefined,
            updatedAt: checkedAt
          }
        : item
    ),
    snapshots: [snapshot, ...store.snapshots]
  });

  return {
    status,
    previousPriceMinor,
    newPriceMinor
  };
}

export async function recordFailedCheck(
  product: TrackedProduct,
  code: CheckStatus,
  source: SnapshotSource,
  rawMessage?: string
): Promise<void> {
  const store = await readStore();
  const checkedAt = nowIso();

  const snapshot: PriceSnapshot = {
    id: store.nextSnapshotId,
    trackedProductId: product.id,
    currency: product.currency,
    availability: 'unknown',
    status: code,
    errorCode: code,
    rawPriceText: rawMessage,
    source,
    checkedAt
  };

  await writeStore({
    ...store,
    nextSnapshotId: store.nextSnapshotId + 1,
    products: store.products.map((item) =>
      item.id === product.id
        ? {
            ...item,
            lastCheckedAt: checkedAt,
            lastErrorAt: checkedAt,
            lastErrorCode: code,
            updatedAt: checkedAt
          }
        : item
    ),
    snapshots: [snapshot, ...store.snapshots]
  });
}

function createSnapshot(
  id: number,
  productId: number,
  parsed: ParsedProduct,
  status: CheckStatus,
  source: SnapshotSource,
  errorCode?: CheckStatus,
  checkedAt = nowIso()
): PriceSnapshot {
  return {
    id,
    trackedProductId: productId,
    priceMinor: parsed.priceMinor,
    currency: parsed.currency ?? 'AED',
    availability: parsed.availability,
    status,
    errorCode,
    rawPriceText: parsed.rawPriceText,
    source,
    checkedAt
  };
}

async function readStore(): Promise<LocalStore> {
  await initializeDatabase();
  const raw = await AsyncStorage.getItem(STORE_KEY);
  if (!raw) {
    return EMPTY_STORE;
  }

  try {
    const parsed = JSON.parse(raw) as LocalStore;

    return {
      ...parsed,
      nextActivityId: parsed.nextActivityId ?? 1,
      products: parsed.products.map((product) => ({
        ...product,
        checkPreference: normalizeCheckPreference(product.checkPreference)
      })),
      snapshots: parsed.snapshots.map((snapshot) => ({
        ...snapshot,
        source: snapshot.source ?? 'unknown'
      })),
      activity: parsed.activity ?? []
    };
  } catch {
    await writeStore(EMPTY_STORE);
    return EMPTY_STORE;
  }
}

async function writeStore(store: LocalStore): Promise<void> {
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(store));
}
