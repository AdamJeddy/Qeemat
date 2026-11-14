import { mergeProductMetadata } from '../domain/productMetadata';
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
import { normalizeFolderName, uniqueOrganizationNames } from '../domain/organization';

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
  // One-time migration: remember the last actual price change for cards
  await migrateLastPriceChangeIfNeeded();
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

export async function listProductsWithSnapshots(): Promise<ProductWithSnapshots[]> {
  const store = await readStore();

  return [...store.products]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((product) => ({
      product,
      snapshots: store.snapshots
        .filter((snapshot) => snapshot.trackedProductId === product.id)
        .sort((left, right) => right.checkedAt.localeCompare(left.checkedAt))
    }));
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
  const knownFolders = uniqueOrganizationNames(store.products.map((product) => product.folder));

  const product: TrackedProduct = {
    id: productId,
    url: draft.sourceUrl,
    canonicalUrl: parsed.canonicalUrl,
    siteKey: parsed.siteKey,
    title: parsed.title,
    sourceMetadata: parsed.sourceMetadata,
    brand: draft.brand ?? parsed.sourceMetadata?.brand,
    category: draft.category,
    categoryExcluded: draft.categoryExcluded,
    imageUrl: parsed.imageUrl,
    currency: parsed.currency ?? 'AED',
    currentPriceMinor: parsed.priceMinor,
    priceBasis: parsed.priceBasis,
    previousPriceMinor: undefined,
    targetPriceMinor: draft.targetPriceMinor,
    minimumPriceDropMinor: draft.minimumPriceDropMinor,
    restockAlertEnabled: draft.restockAlertEnabled ?? true,
    folder: normalizeFolderName(draft.folder, knownFolders),
    alertMode: draft.alertMode,
    checkPreference: draft.checkPreference,
    isActive: true,
    lastCheckedAt: now,
    lastSuccessAt: now,
    lastAvailability: parsed.availability,
    variant: draft.variant,
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
      priceBasis: product.priceBasis,
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
    minimumPriceDropMinor?: number;
    restockAlertEnabled?: boolean;
    folder?: string;
    category?: import('../domain/discoveryCategories').ShoppingCategory | null;
    isActive: boolean;
  }
): Promise<void> {
  const store = await readStore();
  const now = nowIso();
  const knownFolders = uniqueOrganizationNames(store.products.map((product) => product.folder));

  await writeStore({
    ...store,
    products: store.products.map((product) =>
      product.id === id
        ? {
            ...product,
            alertMode: settings.alertMode,
            checkPreference: settings.checkPreference,
            targetPriceMinor: settings.targetPriceMinor,
            minimumPriceDropMinor: settings.minimumPriceDropMinor,
            restockAlertEnabled: settings.restockAlertEnabled ?? product.restockAlertEnabled ?? true,
            folder: normalizeFolderName(settings.folder, knownFolders),
            category: settings.category === undefined ? product.category : settings.category ?? undefined,
            categoryExcluded: settings.category === undefined ? product.categoryExcluded : settings.category === null,
            isActive: settings.isActive,
            updatedAt: now
          }
        : product
    )
  });
}

export async function deleteTrackedProduct(id: number): Promise<void> {
  await deleteTrackedProducts([id]);
}

export async function deleteTrackedProducts(ids: number[]): Promise<void> {
  if (!ids.length) {
    return;
  }

  const idsToDelete = new Set(ids);
  const store = await readStore();
  await writeStore({
    ...store,
    products: store.products.filter((product) => !idsToDelete.has(product.id)),
    snapshots: store.snapshots.filter((snapshot) => !idsToDelete.has(snapshot.trackedProductId))
  });
}

export type BulkTrackingUpdate = {
  folder?: string;
  clearFolder?: boolean;
  isActive?: boolean;
  isArchived?: boolean;
};

export async function updateTrackedProducts(ids: number[], update: BulkTrackingUpdate): Promise<void> {
  if (!ids.length) {
    return;
  }

  const selectedIds = new Set(ids);
  const store = await readStore();
  const now = nowIso();
  const knownFolders = uniqueOrganizationNames(store.products.map((product) => product.folder));

  await writeStore({
    ...store,
    products: store.products.map((product) => {
      if (!selectedIds.has(product.id)) {
        return product;
      }

      return {
        ...product,
        folder: update.clearFolder ? undefined : update.folder === undefined ? product.folder : normalizeFolderName(update.folder, knownFolders),
        isActive: update.isActive ?? product.isActive,
        isArchived: update.isArchived ?? product.isArchived ?? false,
        updatedAt: now
      };
    })
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
const PRICE_CHANGE_MIGRATION_KEY = 'qeemat.migrated-price-change.v1';

/**
 * The most recent check where the price actually changed, derived from stored
 * snapshots (oldest to newest). Returns the price before that change and when
 * it was detected. Flat checks after a change do not affect the result.
 */
export function deriveLastPriceChange(
  snapshots: PriceSnapshot[]
): { previousPriceMinor: number; at: string } | undefined {
  const priced = snapshots
    .filter((snapshot): snapshot is PriceSnapshot & { priceMinor: number } => snapshot.priceMinor !== undefined)
    .sort((left, right) => left.checkedAt.localeCompare(right.checkedAt));

  let previousPriceMinor: number | undefined;
  let change: { previousPriceMinor: number; at: string } | undefined;

  for (const snapshot of priced) {
    if (previousPriceMinor !== undefined && snapshot.priceMinor !== previousPriceMinor) {
      change = { previousPriceMinor, at: snapshot.checkedAt };
    }
    previousPriceMinor = snapshot.priceMinor;
  }

  return change;
}

async function migrateLastPriceChangeIfNeeded(): Promise<void> {
  if (await AsyncStorage.getItem(PRICE_CHANGE_MIGRATION_KEY)) {
    return;
  }

  const store = await readStore();
  let changed = false;
  const products = store.products.map((product) => {
    if (product.lastPriceChangeAt !== undefined) {
      return product;
    }

    const derived = deriveLastPriceChange(store.snapshots.filter((snapshot) => snapshot.trackedProductId === product.id));
    if (!derived) {
      return product;
    }

    changed = true;
    return {
      ...product,
      lastPriceChangeMinor: derived.previousPriceMinor,
      lastPriceChangeAt: derived.at
    };
  });

  if (changed) {
    await writeStore({ ...store, products });
  }

  await AsyncStorage.setItem(PRICE_CHANGE_MIGRATION_KEY, 'done');
}


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

  // When OOS and no price is available, preserve the last known price on the product
  // record so the UI still shows a price. The snapshot correctly records no price.
  const isOosWithoutPrice = parsed.availability === 'out_of_stock' && parsed.priceMinor === undefined;
  const effectivePriceMinor = isOosWithoutPrice
    ? product.currentPriceMinor  // preserve last known price
    : parsed.priceMinor;

  const newPriceMinor = effectivePriceMinor;
  const status: CheckStatus =
    previousPriceMinor !== undefined && newPriceMinor !== undefined && previousPriceMinor !== newPriceMinor
      ? 'price_changed'
      : 'ok';
  const priceChanged = status === 'price_changed';
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
            sourceMetadata: mergeProductMetadata(item.sourceMetadata, parsed.sourceMetadata),
            brand: item.brand ?? parsed.sourceMetadata?.brand,
            imageUrl: parsed.imageUrl ?? item.imageUrl,
            currency: parsed.currency ?? item.currency,
            currentPriceMinor: newPriceMinor,
            priceBasis: parsed.priceBasis ?? item.priceBasis,
            lastAvailability: parsed.availability,
            previousPriceMinor,
            lastPriceChangeMinor: priceChanged ? previousPriceMinor : item.lastPriceChangeMinor,
            lastPriceChangeAt: priceChanged ? checkedAt : item.lastPriceChangeAt,
            lastCheckedAt: checkedAt,
            lastSuccessAt: checkedAt,
            lastErrorAt: undefined,
            lastErrorCode: status,
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
    priceBasis: parsed.priceBasis,
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

    const knownFolders = uniqueOrganizationNames(parsed.products.map((product) => product.folder));

    return {
      ...parsed,
      nextActivityId: parsed.nextActivityId ?? 1,
      products: parsed.products.map((product) => ({
        ...product,
        checkPreference: normalizeCheckPreference(product.checkPreference),
        lastAvailability: product.lastAvailability ?? 'unknown',
        minimumPriceDropMinor: normalizeMinimumPriceDrop(product.minimumPriceDropMinor),
        restockAlertEnabled: product.restockAlertEnabled ?? true,
        isArchived: product.isArchived ?? false,
        folder: normalizeFolderName(product.folder, knownFolders)
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

function normalizeMinimumPriceDrop(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0 ? Math.round(value) : undefined;
}
