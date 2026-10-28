import React from 'react';
import { Linking, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn()
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('./src/domain/parser', () => ({
  ...jest.requireActual('./src/domain/parser'),
  fetchAndParseProduct: jest.fn()
}));
jest.mock('./src/data/database', () => ({
  ...jest.requireActual('./src/data/database'),
  getProductWithSnapshots: jest.fn(),
  listProductsWithSnapshots: jest.fn()
}));
jest.mock('./src/data/discovery', () => ({
  ...jest.requireActual('./src/data/discovery'),
  dismissDiscoveryProduct: jest.fn(),
  getDiscoveryPreferences: jest.fn(),
  markDiscoveryProductsSeen: jest.fn(),
  saveDiscoveryPreferences: jest.fn()
}));
jest.mock('./src/domain/discoveryCatalog', () => ({
  loadDiscoveryCatalog: jest.fn()
}));
jest.mock('./src/domain/discoverySearchCatalog', () => ({ loadProductSearch: jest.fn() }));

import { AddScreen, DetailScreen, getTrackedProductLink, OpportunityScreen } from './App';
import { AppText } from './src/components/AppText';
import { DiscoveryFilterChip, DiscoveryPreferencesSheet, DiscoveryProductGrid } from './src/components/Discovery';
import { DiscoveryBrowseSheet } from './src/components/DiscoveryBrowseSheet';
import { DISCOVERY_SOURCE_MAPS } from './src/domain/discoverySources';
import { ProductCard } from './src/components/ProductCard';
import { CheckStatus, TrackedProduct } from './src/domain/types';

const mockFetchAndParseProduct = jest.requireMock('./src/domain/parser').fetchAndParseProduct as jest.Mock;
const mockGetProductWithSnapshots = jest.requireMock('./src/data/database').getProductWithSnapshots as jest.Mock;
const mockListProductsWithSnapshots = jest.requireMock('./src/data/database').listProductsWithSnapshots as jest.Mock;
const mockClipboardSetString = jest.requireMock('@react-native-clipboard/clipboard').setString as jest.Mock;
const mockGetDiscoveryPreferences = jest.requireMock('./src/data/discovery').getDiscoveryPreferences as jest.Mock;
const mockMarkDiscoveryProductsSeen = jest.requireMock('./src/data/discovery').markDiscoveryProductsSeen as jest.Mock;
const mockLoadDiscoveryCatalog = jest.requireMock('./src/domain/discoveryCatalog').loadDiscoveryCatalog as jest.Mock;
const mockLoadProductSearch = jest.requireMock('./src/domain/discoverySearchCatalog').loadProductSearch as jest.Mock;

describe('AddScreen', () => {
  beforeEach(() => {
    mockFetchAndParseProduct.mockReset();
    mockFetchAndParseProduct.mockImplementation(() => new Promise(() => undefined));
    mockGetProductWithSnapshots.mockReset();
    mockClipboardSetString.mockReset();
  });

  it('automatically finds a product when its URL is shared to the app', async () => {
    const navigate = jest.fn();
    mockFetchAndParseProduct.mockResolvedValueOnce({
      ok: true,
      product: {
        siteKey: 'noon',
        title: 'Shared product',
        canonicalUrl: 'https://www.noon.com/shared-product',
        imageUrl: undefined,
        priceMinor: 10000,
        currency: 'AED',
        availability: 'in_stock'
      }
    });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AddScreen
          initialUrl="https://www.noon.com/shared-product"
          shareEventId={1}
          navigate={navigate}
        />
      );
      await Promise.resolve();
    });

    expect(mockFetchAndParseProduct).toHaveBeenCalledWith('https://www.noon.com/shared-product');
    expect(tree!.root.findAllByType(AppText).some((text) => text.props.children === 'Shared product')).toBe(true);
    expect(tree!.root.findAllByType(AppText).some((text) => text.props.children === 'Check preference')).toBe(true);
  });

  it('does not automatically find a product for an ordinary URL prefill', () => {
    const navigate = jest.fn();

    act(() => {
      renderer.create(
        <AddScreen initialUrl="https://www.noon.com/prefilled-product" navigate={navigate} />
      );
    });

    expect(mockFetchAndParseProduct).not.toHaveBeenCalled();
  });

  it('replaces the entered URL when a new shared URL arrives', () => {
    const navigate = jest.fn();
    let tree: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(
        <AddScreen initialUrl="https://www.noon.com/first" navigate={navigate} />
      );
    });

    act(() => {
      tree!.update(
        <AddScreen initialUrl="https://www.noon.com/second" navigate={navigate} />
      );
    });

    expect(tree!.root.findByType(TextInput).props.value).toBe('https://www.noon.com/second');
  });

  it('resets the add flow when the same URL is shared again', () => {
    const navigate = jest.fn();
    let tree: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(
        <AddScreen initialUrl="https://www.noon.com/product" shareEventId={1} navigate={navigate} />
      );
    });

    act(() => {
      tree!.root.findByType(TextInput).props.onChangeText('https://www.noon.com/edited');
    });

    act(() => {
      tree!.update(
        <AddScreen initialUrl="https://www.noon.com/product" shareEventId={2} navigate={navigate} />
      );
    });

    expect(tree!.root.findByType(TextInput).props.value).toBe('https://www.noon.com/product');
  });

  it('ignores a parse result that finishes after a newer share arrives', async () => {
    const navigate = jest.fn();
    let resolveFirstFetch: (value: unknown) => void = () => undefined;
    mockFetchAndParseProduct.mockImplementation((sourceUrl: string) => {
      if (sourceUrl.includes('/first')) {
        return new Promise((resolve) => {
          resolveFirstFetch = resolve;
        });
      }

      return Promise.resolve({
        ok: true,
        product: {
          siteKey: 'noon',
          title: 'Second product',
          canonicalUrl: 'https://www.noon.com/second',
          imageUrl: undefined,
          priceMinor: 12000,
          currency: 'AED',
          availability: 'in_stock'
        }
      });
    });
    let tree: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(
        <AddScreen initialUrl="https://www.noon.com/first" shareEventId={1} navigate={navigate} />
      );
    });

    await act(async () => {
      tree!.update(
        <AddScreen initialUrl="https://www.noon.com/second" shareEventId={2} navigate={navigate} />
      );
      await Promise.resolve();
    });

    await act(async () => {
      resolveFirstFetch({
        ok: true,
        product: {
          siteKey: 'noon',
          title: 'First product',
          canonicalUrl: 'https://www.noon.com/first',
          imageUrl: undefined,
          priceMinor: 10000,
          currency: 'AED',
          availability: 'in_stock'
        }
      });
      await Promise.resolve();
    });

    expect(tree!.root.findAllByType(AppText).some((text) => text.props.children === 'First product')).toBe(false);
    expect(tree!.root.findAllByType(AppText).some((text) => text.props.children === 'Second product')).toBe(true);
  });
});

describe('DetailScreen', () => {
  it('uses The Deal storefront URLs for customer-facing variant links', () => {
    const storefrontUrl = 'https://www.thedealoutlet.com/ae-en/serve-slide-1.0-fabric/0188147CMA0025.html?dwvar_0188147CMA0025_color=blue';
    const variationEndpoint = 'https://www.thedealoutlet.com/on/demandware.store/Sites-TheDealOutlet_AE-Site/en_AE/Product-Variation?pid=0188147CMA0025';

    expect(getTrackedProductLink({
      url: 'https://www.thedealoutlet.com/ae-en/serve-slide-1.0-fabric/0188147CMA0025.html',
      canonicalUrl: storefrontUrl,
      siteKey: 'the_deal',
      variant: { id: 'blue', label: 'Color: Blue', attributes: [], url: variationEndpoint }
    })).toBe(storefrontUrl);
  });

  it('copies and opens the saved variant URL instead of the parent product URL', async () => {
    const parentUrl = 'https://uae.sharafdg.com/product/parent-configuration/';
    const variantUrl = 'https://uae.sharafdg.com/product/selected-configuration/';
    mockGetProductWithSnapshots.mockResolvedValueOnce({
      product: {
        id: 47,
        url: parentUrl,
        canonicalUrl: parentUrl,
        siteKey: 'sharaf_dg',
        title: 'Selected configuration',
        currency: 'AED',
        currentPriceMinor: 549901,
        alertMode: 'price_drop',
        checkPreference: 'daily',
        isActive: true,
        variant: {
          id: 'selected-configuration',
          label: 'Keyboard: English',
          attributes: [{ name: 'Keyboard', value: 'English' }],
          url: variantUrl
        },
        createdAt: '2026-08-07T00:00:00.000Z',
        updatedAt: '2026-08-07T00:00:00.000Z'
      },
      snapshots: []
    });
    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(<DetailScreen productId={47} navigate={jest.fn()} />);
      await Promise.resolve();
    });

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: 'Copy product link' }).props.onPress();
    });
    await act(async () => {
      tree!.root.findByProps({ label: 'Open link' }).props.onPress();
      await Promise.resolve();
    });

    expect(mockClipboardSetString).toHaveBeenCalledWith(variantUrl);
    expect(openUrl).toHaveBeenCalledWith(variantUrl);
    openUrl.mockRestore();
  });
});

describe('OpportunityScreen', () => {
  it('ignores an older search response after a new query is submitted', async () => {
    mockLoadProductSearch.mockReset();
    let finishOlder!: (value: unknown) => void;
    mockLoadProductSearch.mockImplementationOnce(() => new Promise((resolve) => { finishOlder = resolve; }));
    mockLoadProductSearch.mockResolvedValueOnce({ query: 'new phone', products: [], sources: [] });
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<OpportunityScreen navigate={jest.fn()} />); await new Promise<void>((resolve) => setImmediate(resolve)); });
    const input = tree!.root.findAllByType(TextInput).find((node) => node.props.accessibilityLabel === 'Search products across stores')!;
    act(() => input.props.onChangeText('old phone'));
    await act(async () => { input.props.onSubmitEditing(); await new Promise<void>((resolve) => setImmediate(resolve)); });
    act(() => input.props.onChangeText('new phone'));
    await act(async () => { input.props.onSubmitEditing(); await new Promise<void>((resolve) => setImmediate(resolve)); });
    await act(async () => { finishOlder({ query: 'old phone', products: [], sources: [] }); await new Promise<void>((resolve) => setImmediate(resolve)); });
    const content = tree!.root.findAllByType(AppText).map((node) => [node.props.children].flat().join('')).join(' ');
    expect(content).toContain('new phone');
    expect(content).not.toContain('old phone');
    await act(async () => tree!.unmount());
  });
  it('searches only on submission, ignores quiz budgets, and clears back to discovery', async () => {
    mockGetDiscoveryPreferences.mockResolvedValue({ completed: true, categories: ['fitness'], favoriteBrands: [], budgetsByCategory: { fitness: 1 }, dismissedProductIds: [], seenProductIds: [] });
    mockLoadDiscoveryCatalog.mockResolvedValue({ products: [], stale: false, failedCollectionIds: [] });
    const phone = { id: 'phone', title: 'iPhone 16', siteKey: 'noon', brand: 'Apple', category: 'general', priceMinor: 300000, currency: 'AED', url: 'https://www.noon.com/phone/p/', observedAt: '2026-10-28T09:00:00Z', availability: 'unknown' };
    mockLoadProductSearch.mockResolvedValue({ query: 'iphone 16', products: [phone], sources: [] });
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<OpportunityScreen navigate={jest.fn()} />); await new Promise<void>((resolve) => setImmediate(resolve)); });
    const input = tree!.root.findAllByType(TextInput).find((node) => node.props.accessibilityLabel === 'Search products across stores');
    expect(input).toBeDefined();
    act(() => input!.props.onChangeText('iphone 16'));
    expect(mockLoadProductSearch).not.toHaveBeenCalled();
    await act(async () => { input!.props.onSubmitEditing(); await new Promise<void>((resolve) => setImmediate(resolve)); });
    expect(mockLoadProductSearch).toHaveBeenCalledWith('iphone 16', expect.anything());
    expect(tree!.root.findByType(DiscoveryProductGrid).props.products).toEqual([phone]);
    await act(async () => { tree!.root.findByProps({ accessibilityLabel: 'Clear product search' }).props.onPress(); await new Promise<void>((resolve) => setImmediate(resolve)); });
    expect(tree!.root.findAllByType(AppText).map((node) => [node.props.children].flat().join('')).join(' ')).not.toContain('Results for “iphone 16”');
    await act(async () => tree!.unmount());
  });
  beforeEach(() => {
    mockGetDiscoveryPreferences.mockResolvedValue({
      completed: true,
      categories: [],
      favoriteBrands: [],
      budgetsByCategory: {},
      dismissedProductIds: [],
      seenProductIds: []
    });
    mockMarkDiscoveryProductsSeen.mockResolvedValue(undefined);
    mockLoadDiscoveryCatalog.mockResolvedValue({ products: [], stale: false });
  });

  it('does not render tracked price opportunities in the discovery feed', async () => {
    mockListProductsWithSnapshots.mockResolvedValueOnce([{
      product: {
        id: 77,
        url: 'https://www.adidas.ae/product',
        canonicalUrl: 'https://www.adidas.ae/product',
        siteKey: 'adidas',
        title: 'Target running shoes',
        currency: 'AED',
        currentPriceMinor: 8500,
        targetPriceMinor: 9000,
        alertMode: 'target_price',
        checkPreference: 'daily',
        isActive: true,
        lastAvailability: 'in_stock',
        lastCheckedAt: '2026-10-03T09:00:00.000Z',
        lastSuccessAt: '2026-10-03T09:00:00.000Z',
        createdAt: '2026-10-01T09:00:00.000Z',
        updatedAt: '2026-10-03T09:00:00.000Z'
      },
      snapshots: [
        { id: 1, trackedProductId: 77, priceMinor: 10000, currency: 'AED', availability: 'in_stock', status: 'price_changed', source: 'background', checkedAt: '2026-10-01T09:00:00.000Z' },
        { id: 2, trackedProductId: 77, priceMinor: 9000, currency: 'AED', availability: 'in_stock', status: 'price_changed', source: 'background', checkedAt: '2026-10-02T09:00:00.000Z' },
        { id: 3, trackedProductId: 77, priceMinor: 8500, currency: 'AED', availability: 'in_stock', status: 'price_changed', source: 'background', checkedAt: '2026-10-03T09:00:00.000Z' }
      ]
    }]);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<OpportunityScreen navigate={jest.fn()} />);
      await new Promise<void>((resolve) => setImmediate(() => resolve()));
    });

    const text = tree!.root.findAllByType(AppText).map((node) => node.props.children).flat().join(' ');
    expect(text).not.toContain('Your tracked price opportunities');
    expect(text).not.toContain('Target hit');
    expect(text).not.toContain('Target running shoes');
  });

  it('offers every planned category during personalization, not just the live catalogue categories', async () => {
    mockListProductsWithSnapshots.mockResolvedValueOnce([]);
    mockGetDiscoveryPreferences.mockResolvedValueOnce({
      completed: false,
      categories: [],
      favoriteBrands: [],
      budgetsByCategory: {},
      dismissedProductIds: [],
      seenProductIds: []
    });
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(<OpportunityScreen navigate={jest.fn()} />);
      await new Promise<void>((resolve) => setImmediate(() => resolve()));
    });

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: 'Personalize discovery' }).props.onPress();
    });

    const text = tree!.root.findAllByType(AppText).map((node) => [node.props.children].flat().join('')).join(' ');
    for (const label of ['Clothing', 'Footwear', 'Makeup', 'Skincare', 'Fragrance', 'Phones', 'Computers', 'Audio', 'Fresh food', 'Pantry', 'Pets']) { expect(text).toContain(label); }
    expect(text).not.toContain('Fashion & footwear');
  });

  it('shows cached discovery products with a clear price-tracking action', async () => {
    const navigate = jest.fn();
    mockListProductsWithSnapshots.mockResolvedValueOnce([]);
    mockGetDiscoveryPreferences.mockResolvedValueOnce({
      completed: true,
      categories: ['fitness'],
      favoriteBrands: ['Domyos'],
      budgetsByCategory: { fitness: 10000 },
      dismissedProductIds: [],
      seenProductIds: []
    });
    mockLoadDiscoveryCatalog.mockResolvedValueOnce({
      products: [{
        id: 'decathlon_uae:mat',
        siteKey: 'decathlon_uae',
        category: 'fitness',
        brand: 'Domyos',
        title: 'Domyos training mat',
        url: 'https://decathlon.ae/products/training-mat',
        imageUrl: undefined,
        priceMinor: 8900,
        currency: 'AED',
        availability: 'in_stock',
        observedAt: '2026-10-25T10:00:00.000Z'
      }],
      refreshedAt: '2026-10-25T10:00:00.000Z',
      stale: false
    });
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(<OpportunityScreen navigate={navigate} />);
      await new Promise<void>((resolve) => setImmediate(() => resolve()));
    });

    const text = tree!.root.findAllByType(AppText).map((node) => [node.props.children].flat().join('')).join(' ');
    expect(text).toContain('Picks for you');
    expect(text).toContain('Domyos training mat');
    expect(text).toContain('AED 89');
    expect(text).toContain('Track price');
    expect(text).toContain('1 product');

    const categoryChip = tree!.root.findAllByType(DiscoveryFilterChip).find((node) => node.props.label === 'Fitness');
    act(() => {
      categoryChip!.findByProps({ accessibilityRole: 'button' }).props.onPress();
    });

    expect(navigate).not.toHaveBeenCalled();
    expect(tree!.root.findAllByType(DiscoveryFilterChip).find((node) => node.props.label === 'Fitness')?.props.selected).toBe(true);
  });

  it('applies saved quiz interests and budgets to the same feed immediately', async () => {
    const navigate = jest.fn();
    const initial = { completed: true, categories: [], favoriteBrands: [], budgetsByCategory: {}, dismissedProductIds: [], seenProductIds: [] };
    mockGetDiscoveryPreferences.mockResolvedValueOnce(initial);
    const base = { siteKey: 'faces_uae', category: 'skincare', brand: 'Dior', currency: 'AED', availability: 'in_stock', observedAt: '2026-10-25T10:00:00Z' };
    mockLoadDiscoveryCatalog.mockResolvedValue({ products: [
      { ...base, id: 'serum', title: 'Affordable serum', url: 'https://www.faces.ae/en/serum', priceMinor: 9000 },
      { ...base, id: 'premium-serum', title: 'Premium serum', url: 'https://www.faces.ae/en/premium-serum', priceMinor: 25000 },
      { ...base, id: 'shoes', title: 'Running shoes', category: 'footwear', url: 'https://decathlon.ae/products/shoes', siteKey: 'decathlon_uae', priceMinor: 8000 }
    ], stale: false });
    const saved = { ...initial, categories: ['skincare'], budgetsByCategory: { skincare: 10000 } };
    jest.requireMock('./src/data/discovery').saveDiscoveryPreferences.mockResolvedValueOnce(saved);
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<OpportunityScreen navigate={navigate} />);
      await new Promise<void>((resolve) => setImmediate(resolve));
    });
    expect(tree!.root.findByType(DiscoveryProductGrid).props.products).toHaveLength(3);
    await act(async () => {
      await tree!.root.findByType(DiscoveryPreferencesSheet).props.onSave(saved);
    });
    expect(tree!.root.findByType(DiscoveryProductGrid).props.products.map((product: { id: string }) => product.id)).toEqual(['serum']);
    expect(navigate).not.toHaveBeenCalled();
    expect(mockLoadDiscoveryCatalog).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ scope: expect.objectContaining({ categories: ['skincare'] }) }));
    await act(async () => tree!.root.findByType(DiscoveryBrowseSheet).props.onCategory('footwear'));
    expect(tree!.root.findByType(DiscoveryProductGrid).props.products.map((product: { id: string }) => product.id)).toEqual(['shoes']);
    expect(navigate).not.toHaveBeenCalled();
    const source = DISCOVERY_SOURCE_MAPS.find((item) => item.siteKey === 'carrefour_uae' && item.category === 'fresh_food')!;
    await act(async () => tree!.root.findByType(DiscoveryBrowseSheet).props.onCollection(source));
    expect(mockLoadDiscoveryCatalog).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ scope: expect.objectContaining({ collectionId: source.id, siteKey: 'carrefour_uae' }) }));
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('saved price freshness', () => {
  const product: TrackedProduct = {
    id: 53,
    url: 'https://www.adidas.ae/en/adizero-adios-pro-4-shoes/JR1267.html',
    canonicalUrl: 'https://www.adidas.ae/en/adizero-adios-pro-4-shoes/JR1267.html',
    siteKey: 'adidas',
    title: 'Adizero Adios Pro 4 Shoes',
    currency: 'AED',
    currentPriceMinor: 71940,
    alertMode: 'price_drop',
    checkPreference: 'daily',
    isActive: true,
    lastCheckedAt: '2026-10-20T06:35:00.000Z',
    lastSuccessAt: '2026-10-19T06:40:00.000Z',
    lastAvailability: 'in_stock',
    createdAt: '2026-10-19T06:40:00.000Z',
    updatedAt: '2026-10-20T06:35:00.000Z'
  };

  beforeEach(() => {
    mockGetProductWithSnapshots.mockReset();
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-20T06:40:00.000Z').getTime());
  });

  afterEach(() => jest.restoreAllMocks());

  it.each<CheckStatus>(['site_parser_failed', 'blocked', 'network_error'])('labels the saved price and last successful check after %s', async (status) => {
    const failedProduct = { ...product, lastErrorCode: status };
    mockGetProductWithSnapshots.mockResolvedValueOnce({ product: failedProduct, snapshots: [] });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<DetailScreen productId={53} navigate={jest.fn()} />);
    });

    const text = tree!.root.findAllByType(AppText).map((node) => [node.props.children].flat().join('')).join(' ');
    expect(text).toContain('Last known price');
    expect(text).toContain('AED 719.40');
    expect(text).toContain('Check failed 5m ago');
    expect(text).toContain('Last successful check: Yesterday');
    expect(text).not.toContain('Current price');
    expect(text).not.toContain('Checked 5m ago');

    act(() => {
      tree = renderer.create(<ProductCard product={failedProduct} onPress={jest.fn()} />);
    });
    const cardText = tree!.root.findAllByType(AppText).map((node) => [node.props.children].flat().join('')).join(' ');
    expect(cardText).toContain('Last known price');
    expect(cardText).toContain('Last attempt: 5m ago');
  });

  it('shows a current price again after a successful check', async () => {
    mockGetProductWithSnapshots.mockResolvedValueOnce({
      product: { ...product, lastErrorCode: 'ok', lastSuccessAt: product.lastCheckedAt },
      snapshots: []
    });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<DetailScreen productId={53} navigate={jest.fn()} />);
    });

    const text = tree!.root.findAllByType(AppText).map((node) => [node.props.children].flat().join('')).join(' ');
    expect(text).toContain('Current price');
    expect(text).toContain('Checked 5m ago');
    expect(text).not.toContain('Last known price');
  });

  it('shows an out-of-stock snapshot without a price as a stock result', async () => {
    mockGetProductWithSnapshots.mockResolvedValueOnce({
      product: { ...product, siteKey: 'namshi', lastErrorCode: 'ok', lastAvailability: 'out_of_stock' },
      snapshots: [{
        id: 1, trackedProductId: 53, status: 'ok', availability: 'out_of_stock',
        currency: 'AED', source: 'background', checkedAt: product.lastCheckedAt
      }]
    });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<DetailScreen productId={53} navigate={jest.fn()} />);
    });

    const text = tree!.root.findAllByType(AppText).map((node) => [node.props.children].flat().join('')).join(' ');
    expect(text).toContain('Last known price');
    expect(text).toContain('Out of stock');
    expect(text).not.toContain('Failed');
    expect(text).not.toContain('Current price');
  });
});
