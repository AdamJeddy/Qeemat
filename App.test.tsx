import React from 'react';
import { Image, Linking, TextInput } from 'react-native';
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

import { AddScreen, DetailScreen, getTrackedProductLink, OpportunityScreen, rotateDiscoveryProducts, TabsScreen } from './App';
import { AppText } from './src/components/AppText';
import { DiscoveryFilterChip, DiscoveryProductGrid } from './src/components/Discovery';
import { DiscoveryBrowseSheet } from './src/components/DiscoveryBrowseSheet';
import { DISCOVERY_SOURCE_MAPS } from './src/domain/discoverySources';
import { ProductCard } from './src/components/ProductCard';
import { PrimaryButton } from './src/components/PrimaryButton';
import { ProductCategoryPicker } from './src/components/ProductCategoryPicker';
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

  it('reveals H&M and Zara behind the supported-stores disclosure before a URL is entered', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<AddScreen navigate={jest.fn()} />); });
    const collapsedLabels = tree!.root.findAllByType(AppText).map((item) => item.props.children);
    expect(collapsedLabels).toEqual(expect.arrayContaining(['Supported stores', [20, ' stores']]));
    expect(collapsedLabels).not.toContain('H&M');

    const disclosure = tree!.root.findAll((node) => node.props.accessibilityState?.expanded === false && typeof node.props.onPress === 'function')[0];
    expect(disclosure).toBeDefined();
    act(() => { disclosure.props.onPress(); });

    const expandedLabels = tree!.root.findAllByType(AppText).map((item) => item.props.children);
    expect(expandedLabels).toEqual(expect.arrayContaining(['H&M', 'Zara']));
  });

  it('labels the header back control and exposes the screen title as a heading', () => {
    const navigate = jest.fn();
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<AddScreen navigate={navigate} />); });
    const backButton = tree!.root.findAll((node) => node.props.accessibilityLabel === 'Go back' && typeof node.props.onPress === 'function')[0];
    expect(backButton).toBeDefined();
    expect(backButton.props.accessibilityRole).toBe('button');
    act(() => { backButton.props.onPress(); });
    expect(navigate).toHaveBeenCalledWith({ name: 'tabs', tab: 'watchlist' });
    const headings = tree!.root.findAllByProps({ accessibilityRole: 'header' }).map((node) => node.props.children);
    expect(headings).toEqual(expect.arrayContaining(['Add Product']));
    act(() => tree!.unmount());
  });

  it('saves the selected category when tracking a shared URL', async () => {
    const create = jest.spyOn(require('./src/data/database'), 'createTrackedProduct').mockResolvedValue(22);
    mockFetchAndParseProduct.mockResolvedValueOnce({ ok: true, product: { siteKey: 'noon', title: 'Shoe', canonicalUrl: 'https://www.noon.com/shoe', priceMinor: 10000, currency: 'AED', availability: 'in_stock' } });
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<AddScreen initialUrl="https://www.noon.com/shoe" shareEventId={1} navigate={jest.fn()} />); await Promise.resolve(); });
    act(() => tree!.root.findByType(ProductCategoryPicker).props.onChange('footwear'));
    await act(async () => { await tree!.root.findByProps({ label: 'Confirm Tracking' }).props.onPress(); });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ category: 'footwear' }));
    create.mockRestore();
  });

  it('uses a retailer category as a suggestion without saving it as a manual choice', async () => {
    const create = jest.spyOn(require('./src/data/database'), 'createTrackedProduct').mockResolvedValue(23);
    mockFetchAndParseProduct.mockResolvedValueOnce({ ok: true, product: { siteKey: 'noon', title: 'Runner X', canonicalUrl: 'https://www.noon.com/runner', priceMinor: 10000, currency: 'AED', availability: 'in_stock', sourceMetadata: { categoryPath: ['Shoes'] } } });
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<AddScreen initialUrl="https://www.noon.com/runner" shareEventId={1} navigate={jest.fn()} />); await Promise.resolve(); });
    expect(tree!.root.findByType(ProductCategoryPicker).props.value).toBe('footwear');
    await act(async () => { await tree!.root.findByProps({ label: 'Confirm Tracking' }).props.onPress(); });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ category: undefined, parsed: expect.objectContaining({ sourceMetadata: { categoryPath: ['Shoes'] } }) }));
    create.mockRestore();
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
  it('shows the retailer category, product type, and attributes when available', async () => {
    mockGetProductWithSnapshots.mockResolvedValueOnce({ product: { id: 80, url: 'https://www.nike.ae/en/example.html', canonicalUrl: 'https://www.nike.ae/en/example.html', siteKey: 'nike_uae', title: 'Example', currency: 'AED', currentPriceMinor: 10000, alertMode: 'price_drop', checkPreference: 'daily', isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', sourceMetadata: { categoryPath: ['Women', 'Shoes'], productType: 'Running shoes', attributes: { material: 'Mesh' } } }, snapshots: [] });
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<DetailScreen productId={80} navigate={jest.fn()} />); await Promise.resolve(); });
    const labels = tree!.root.findAllByType(AppText).map((node) => [node.props.children].flat().join('')).join(' ');
    expect(labels).toContain('About this item');
    expect(labels).toContain('Store category Women  ›  Shoes');
    expect(labels).toContain('Product type Running shoes');
    expect(labels).toContain('Material Mesh');
    expect(labels.indexOf('Price History')).toBeLessThan(labels.indexOf('About this item'));
    await act(async () => tree!.unmount());
  });
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

describe('Watchlist header', () => {
  it('opens Search and recent price activity from their shortcuts', async () => {
    mockListProductsWithSnapshots.mockResolvedValue([]);
    const navigate = jest.fn();
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<TabsScreen tab="watchlist" navigate={navigate} />); await new Promise<void>(resolve => setImmediate(resolve)); });
    act(() => tree!.root.findByProps({ accessibilityLabel: 'Open Search' }).props.onPress());
    expect(navigate).toHaveBeenCalledWith({ name: 'tabs', tab: 'opportunities' });
    act(() => tree!.root.findByProps({ accessibilityLabel: 'Open recent activity' }).props.onPress());
    expect(navigate).toHaveBeenCalledWith({ name: 'tabs', tab: 'activity' });
    const headings = tree!.root.findAllByProps({ accessibilityRole: 'header' }).map((node) => node.props.children);
    expect(headings).toEqual(expect.arrayContaining(['Watchlist']));
    expect(tree!.root.findAllByProps({ accessibilityLabel: 'Filter and sort' }).length).toBeGreaterThan(0);
    await act(async () => tree!.unmount());
  });
});

describe('OpportunityScreen', () => {
  it('keeps the search screen mounted when switching tabs', async () => {
    mockListProductsWithSnapshots.mockResolvedValue([]);
    mockGetDiscoveryPreferences.mockResolvedValue({ completed: false, categories: [], favoriteBrands: [], budgetsByCategory: {}, dismissedProductIds: [], seenProductIds: [] });
    mockLoadDiscoveryCatalog.mockResolvedValue({ products: [], stale: false });
    const navigate = jest.fn();
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<TabsScreen tab="opportunities" navigate={navigate} />); await new Promise<void>(resolve => setImmediate(resolve)); });
    const screen = tree!.root.findByType(OpportunityScreen);
    await act(async () => { tree!.update(<TabsScreen tab="watchlist" navigate={navigate} />); await new Promise<void>(resolve => setImmediate(resolve)); });
    expect(tree!.root.findByType(OpportunityScreen)).toBe(screen);
    await act(async () => { tree!.update(<TabsScreen tab="opportunities" navigate={navigate} />); await new Promise<void>(resolve => setImmediate(resolve)); });
    expect(tree!.root.findByType(OpportunityScreen)).toBe(screen);
    await act(async () => tree!.unmount());
  });
  it('varies the first products without losing items or moving later results', () => {
    const products = Array.from({ length: 30 }, (_, index) => index);
    const rotated = rotateDiscoveryProducts(products, 5);
    expect(rotated.slice(0, 3)).toEqual([5, 6, 7]);
    expect(rotated.slice(24)).toEqual(products.slice(24));
    expect([...rotated].sort((a, b) => a - b)).toEqual(products);
    expect(rotateDiscoveryProducts(products, 5)).toEqual(rotated);
  });
  it('shows the price change for a previously observed listing', () => {
    const product = { id: 'shoe', siteKey: 'noon' as const, category: 'footwear' as const, brand: 'Brand', title: 'Shoe', url: 'https://www.noon.com/shoe', priceMinor: 8000, previousPriceMinor: 10000, currency: 'AED', availability: 'in_stock' as const, observedAt: '2026-11-07T00:00:00Z' };
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<DiscoveryProductGrid products={[product]} trackedProducts={[]} onTrack={jest.fn()} onDismiss={jest.fn()} onMoreLikeThis={jest.fn()} onViewAtRetailer={jest.fn()} />); });
    const text = tree!.root.findAllByType(AppText).map(node => [node.props.children].flat().join('')).join(' ');
    expect(text).toContain('AED 20 lower');
    expect(text).not.toContain('was AED 100');
  });
  it('does not display a price change when the price is unchanged', () => {
    const product = { id: 'shoe', siteKey: 'noon' as const, category: 'footwear' as const, brand: 'Brand', title: 'Shoe', url: 'https://www.noon.com/shoe', priceMinor: 8000, previousPriceMinor: 8000, currency: 'AED', availability: 'in_stock' as const, observedAt: '2026-11-07T00:00:00Z' };
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<DiscoveryProductGrid products={[product]} trackedProducts={[]} onTrack={jest.fn()} onDismiss={jest.fn()} onMoreLikeThis={jest.fn()} onViewAtRetailer={jest.fn()} />); });
    const text = tree!.root.findAllByType(AppText).map(node => [node.props.children].flat().join('')).join(' ');
    expect(text).not.toContain('lower');
    expect(text).not.toContain('higher');
  });
  it('uses an existing uncategorised watched product to show related products', async () => {
    const listTracked = jest.spyOn(require('./src/data/database'), 'listTrackedProducts').mockResolvedValue([{ id: 1, title: 'Running sneakers', isActive: true, canonicalUrl: 'https://www.noon.com/watched', url: 'https://www.noon.com/watched' }]);
    const base = { siteKey: 'noon', brand: 'Brand', currency: 'AED', availability: 'in_stock', observedAt: '2026-11-01T00:00:00Z', priceMinor: 10000 };
    mockGetDiscoveryPreferences.mockResolvedValue({ completed: false, categories: [], favoriteBrands: [], budgetsByCategory: {}, dismissedProductIds: [], seenProductIds: [] });
    mockLoadDiscoveryCatalog.mockResolvedValue({ products: [{ ...base, id: 'shoe', title: 'Shoe', category: 'footwear', url: 'https://www.noon.com/shoe' }, { ...base, id: 'shirt', title: 'Shirt', category: 'clothing', url: 'https://www.noon.com/shirt' }], stale: false });
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<OpportunityScreen navigate={jest.fn()} />); await new Promise<void>(resolve => setImmediate(resolve)); });
    expect(tree!.root.findByType(DiscoveryProductGrid).props.products.map((product: { id: string }) => product.id)).toEqual(['shoe']);
    const text = tree!.root.findAllByType(AppText).map(node => [node.props.children].flat().join('')).join(' ');
    expect(text).toContain('Based on your watchlist');
    expect(text).toContain('Footwear');
    expect(mockLoadDiscoveryCatalog).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ scope: expect.objectContaining({ categories: ['footwear'] }) }));
    await act(async () => tree!.unmount());
    listTracked.mockRestore();
  });
  it('shows the store without an unknown brand and preserves known brands', () => {
    const base = { siteKey: 'hm_uae' as const, category: 'clothing' as const, currency: 'AED', availability: 'unknown' as const, observedAt: '2026-11-07T00:00:00Z', url: 'https://ae.hm.com/en/buy-shirt', priceMinor: 10000 };
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<DiscoveryProductGrid products={[{ ...base, id: '1', title: 'Shirt', brand: 'Other brands' }, { ...base, id: '2', title: 'Shoes', brand: 'Puma' }]} trackedProducts={[]} onTrack={jest.fn()} onDismiss={jest.fn()} onMoreLikeThis={jest.fn()} onViewAtRetailer={jest.fn()} />); });
    const labels = tree!.root.findAllByType(AppText).map((item) => item.props.children);
    expect(labels).toEqual(expect.arrayContaining(['H&M', 'Puma · H&M']));
    expect(labels).not.toContain('Other brands · H&M');
  });
  it('retains expanded discovery results after searching and filtering results', async () => {
    const base = { siteKey: 'noon', category: 'general', brand: 'Apple', currency: 'AED', availability: 'in_stock', observedAt: '2026-10-28T09:00:00Z', priceMinor: 1000 };
    const products = Array.from({ length: 50 }, (_, index) => ({ ...base, id: `item-${index}`, title: `Product ${index}`, url: `https://www.noon.com/item-${index}` }));
    mockLoadDiscoveryCatalog.mockResolvedValue({ products, stale: false, failedCollectionIds: [] });
    mockLoadProductSearch.mockResolvedValue({ query: 'iphone', products, sources: [] });
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<OpportunityScreen navigate={jest.fn()} />); await new Promise<void>((resolve) => setImmediate(resolve)); });
    act(() => tree!.root.findAllByType(PrimaryButton).find((button) => button.props.label === 'Show more (26 remaining)')!.props.onPress());
    expect(tree!.root.findByType(DiscoveryProductGrid).props.products).toHaveLength(48);
    const input = tree!.root.findByProps({ accessibilityLabel: 'Search products across stores' });
    act(() => input.props.onChangeText('iphone'));
    await act(async () => { input.props.onSubmitEditing(); await new Promise<void>((resolve) => setImmediate(resolve)); });
    expect(tree!.root.findByType(DiscoveryProductGrid).props.products).toHaveLength(24);
    act(() => tree!.root.findAllByType(DiscoveryFilterChip).find((chip) => chip.props.label === 'Noon (50)')!.props.onPress());
    await act(async () => { tree!.root.findByProps({ accessibilityLabel: 'Clear product search' }).props.onPress(); await new Promise<void>((resolve) => setImmediate(resolve)); });
    expect(tree!.root.findByType(DiscoveryProductGrid).props.products).toHaveLength(48);
    await act(async () => tree!.unmount());
  }, 20000);
  it('hides a search result when the matching catalogue product was dismissed', async () => {
    const listing = { id: 'decathlon_uae:123', siteKey: 'decathlon_uae', category: 'footwear', brand: 'Kiprun', title: 'Running shoes', url: 'https://decathlon.ae/products/shoe', priceMinor: 9000, currency: 'AED', availability: 'in_stock', observedAt: '2026-10-28T09:00:00Z' };
    mockGetDiscoveryPreferences.mockResolvedValue({ completed: true, categories: [], favoriteBrands: [], budgetsByCategory: {}, dismissedProductIds: [listing.id], seenProductIds: [] });
    mockLoadDiscoveryCatalog.mockResolvedValue({ products: [listing], stale: false, failedCollectionIds: [] });
    mockLoadProductSearch.mockResolvedValue({ query: 'running shoes', products: [{ ...listing, id: 'decathlon_uae:/products/shoe' }], sources: [] });
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<OpportunityScreen navigate={jest.fn()} />); await new Promise<void>((resolve) => setImmediate(resolve)); });
    const input = tree!.root.findByProps({ accessibilityLabel: 'Search products across stores' });
    act(() => input.props.onChangeText('running shoes'));
    await act(async () => { input.props.onSubmitEditing(); await new Promise<void>((resolve) => setImmediate(resolve)); });
    expect(tree!.root.findByType(DiscoveryProductGrid).props.products).toHaveLength(0);
    await act(async () => tree!.unmount());
  });
  it('browses a department without applying the old personalization budget', async () => {
    const navigate = jest.fn();
    mockGetDiscoveryPreferences.mockResolvedValue({ completed: true, categories: ['footwear'], favoriteBrands: [], budgetsByCategory: { footwear: 10000 }, dismissedProductIds: [], seenProductIds: [] });
    const base = { siteKey: 'noon', category: 'footwear', brand: 'Brand', currency: 'AED', availability: 'in_stock', observedAt: '2026-10-28T09:00:00Z' };
    mockLoadDiscoveryCatalog.mockResolvedValue({ products: [
      { ...base, id: 'shoe', title: 'Everyday shoe', url: 'https://www.noon.com/shoe', priceMinor: 9000 },
      { ...base, id: 'expensive-shoe', title: 'Expensive shoe', url: 'https://www.noon.com/expensive-shoe', priceMinor: 20000 }
    ], stale: false });
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<OpportunityScreen navigate={navigate} />); await new Promise<void>((resolve) => setImmediate(resolve)); });
    await act(async () => { tree!.root.findByProps({ accessibilityLabel: 'Browse Footwear' }).props.onPress(); await new Promise<void>((resolve) => setImmediate(resolve)); });
    expect(mockLoadDiscoveryCatalog).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ scope: expect.objectContaining({ categories: ['footwear'] }) }));
    expect(tree!.root.findByType(DiscoveryProductGrid).props.products.map((product: { id: string }) => product.id)).toEqual(['shoe', 'expensive-shoe']);
    expect(tree!.root.findByProps({ accessibilityLabel: 'Browse Footwear' }).props.accessibilityState.selected).toBe(true);
    await act(async () => { tree!.root.findByProps({ accessibilityLabel: 'Clear discovery filters' }).props.onPress(); await new Promise<void>((resolve) => setImmediate(resolve)); });
    expect(tree!.root.findByProps({ accessibilityLabel: 'Browse Footwear' }).props.accessibilityState.selected).toBe(false);
    expect(mockLoadDiscoveryCatalog).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ scope: expect.objectContaining({ categories: [] }) }));
    expect(navigate).not.toHaveBeenCalled();
    await act(async () => tree!.unmount());
  });

  it('keeps department choices available when no products have loaded', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<OpportunityScreen navigate={jest.fn()} />); await new Promise<void>((resolve) => setImmediate(resolve)); });
    expect(tree!.root.findByProps({ accessibilityLabel: 'Browse Phones' })).toBeDefined();
    expect(tree!.root.findByProps({ accessibilityLabel: 'Browse all departments and retailers' })).toBeDefined();
    await act(async () => tree!.unmount());
  });
  it('only offers search retailers with visible matches and removes an empty active filter', async () => {
    const phone = { id: 'phone', title: 'iPhone 16', siteKey: 'noon', category: 'general', priceMinor: 300000, currency: 'AED', url: 'https://www.noon.com/phone/p/', observedAt: '2026-10-28T09:00:00Z', availability: 'unknown' };
    mockLoadProductSearch.mockResolvedValue({ query: 'iphone', products: [phone], sources: [] });
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<OpportunityScreen navigate={jest.fn()} />); await new Promise<void>((resolve) => setImmediate(resolve)); });
    const input = tree!.root.findByProps({ accessibilityLabel: 'Search products across stores' });
    act(() => input.props.onChangeText('iphone'));
    await act(async () => { input.props.onSubmitEditing(); await new Promise<void>((resolve) => setImmediate(resolve)); });
    const chips = () => tree!.root.findAllByType(DiscoveryFilterChip);
    expect(chips().map((chip) => chip.props.label)).toEqual(['All results (1)', 'Noon (1)']);
    act(() => chips()[1].props.onPress());
    mockLoadProductSearch.mockResolvedValue({ query: 'iphone', products: [], sources: [] });
    await act(async () => { input.props.onSubmitEditing(); await new Promise<void>((resolve) => setImmediate(resolve)); });
    expect(chips().map((chip) => chip.props.label)).toEqual(['All results (0)']);
    expect(chips()[0].props.selected).toBe(true);
    await act(async () => tree!.unmount());
  });
  it('offers a manual refresh that bypasses the daily discovery cache', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<OpportunityScreen navigate={jest.fn()} />); await new Promise<void>((resolve) => setImmediate(resolve)); });
    await act(async () => { tree!.root.findByProps({ accessibilityLabel: 'Refresh discovery products' }).props.onPress(); await new Promise<void>((resolve) => setImmediate(resolve)); });
    expect(mockLoadDiscoveryCatalog).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ force: true }));
    await act(async () => tree!.unmount());
  });
  it('ignores an older search response after a new query is submitted', async () => {
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
    expect(tree!.root.findAllByType(AppText).map((node) => [node.props.children].flat().join('')).join(' ')).toContain('1 title and brand match · 1 retailer');
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
    mockLoadProductSearch.mockReset();
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

  it('does not prompt for the old personalization quiz', async () => {
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

    const text = tree!.root.findAllByType(AppText).map((node) => [node.props.children].flat().join('')).join(' ');
    expect(text).not.toContain('Make Search yours');
    expect(tree!.root.findAllByProps({ accessibilityLabel: 'Browse all departments and retailers' }).length).toBeGreaterThan(0);
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
    expect(text).toContain('Explore products');
    expect(text).toContain('Domyos training mat');
    expect(text).toContain('AED 89');
    expect(text).toContain('Track price');
    expect(text).toContain('1 product');

    await act(async () => { tree!.root.findByType(DiscoveryBrowseSheet).props.onCategory('fitness'); await new Promise<void>((resolve) => setImmediate(resolve)); });

    expect(navigate).not.toHaveBeenCalled();
    expect(tree!.root.findByProps({ accessibilityLabel: 'Browse Fitness' }).props.accessibilityState.selected).toBe(true);
    await act(async () => tree!.unmount());
  });

  it('browses explicit categories independently of saved quiz interests', async () => {
    const navigate = jest.fn();
    const initial = { completed: true, categories: [], favoriteBrands: [], budgetsByCategory: {}, dismissedProductIds: [], seenProductIds: [] };
    mockGetDiscoveryPreferences.mockResolvedValueOnce(initial);
    const base = { siteKey: 'faces_uae', category: 'skincare', brand: 'Dior', currency: 'AED', availability: 'in_stock', observedAt: '2026-10-25T10:00:00Z' };
    mockLoadDiscoveryCatalog.mockResolvedValue({ products: [
      { ...base, id: 'serum', title: 'Affordable serum', url: 'https://www.faces.ae/en/serum', priceMinor: 9000 },
      { ...base, id: 'premium-serum', title: 'Premium serum', url: 'https://www.faces.ae/en/premium-serum', priceMinor: 25000 },
      { ...base, id: 'shoes', title: 'Running shoes', category: 'footwear', url: 'https://decathlon.ae/products/shoes', siteKey: 'decathlon_uae', priceMinor: 8000 }
    ], stale: false });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<OpportunityScreen navigate={navigate} />);
      await new Promise<void>((resolve) => setImmediate(resolve));
    });
    expect(tree!.root.findByType(DiscoveryProductGrid).props.products).toHaveLength(3);
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

  it('prioritizes the price while retaining the selected variant and folder', () => {
    const item = { ...product, folder: 'Running', variant: { id: 'size-40', label: 'Size: 40', attributes: [{ name: 'Size', value: '40' }] } };
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<ProductCard product={item} onPress={jest.fn()} />); });
    const labels = tree!.root.findAllByType(AppText).map((node) => [node.props.children].flat().join(''));
    expect(labels.join(' ')).toContain('Size: 40');
    expect(labels.join(' ')).toContain('Running');
    expect(labels.indexOf('AED 719.40')).toBeLessThan(labels.findIndex((label) => label.includes('Size: 40')));
  });

  it('shows a fallback for missing or failed product images and retries a changed image', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<ProductCard product={product} onPress={jest.fn()} />); });
    expect(tree!.root.findAllByProps({ accessibilityLabel: 'Product image unavailable' }).length).toBeGreaterThan(0);
    act(() => { tree!.update(<ProductCard product={{ ...product, imageUrl: 'https://example.com/a.jpg' }} onPress={jest.fn()} />); });
    act(() => { tree!.root.findAllByType(Image).find((image) => image.props.onError)!.props.onError(); });
    expect(tree!.root.findAllByProps({ accessibilityLabel: 'Product image unavailable' }).length).toBeGreaterThan(0);
    act(() => { tree!.update(<ProductCard product={{ ...product, imageUrl: 'https://example.com/b.jpg' }} onPress={jest.fn()} />); });
    expect(tree!.root.findAllByType(Image).find((image) => image.props.onError)!.props.source.uri).toBe('https://example.com/b.jpg');
    act(() => tree!.unmount());
  });

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
