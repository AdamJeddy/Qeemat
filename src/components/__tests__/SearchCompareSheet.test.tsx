import React from 'react';
import { ActivityIndicator } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { SearchCompareSheet, SearchCompareSheetProps } from '../SearchCompareSheet';
import { AppText } from '../AppText';
import { PrimaryButton } from '../PrimaryButton';
import { DiscoveryOffer, DiscoveryProduct, DiscoveryProductGroup, TrackedProduct } from '../../domain/types';

const noonProduct: DiscoveryProduct = {
  id: 'noon:nike-af1',
  siteKey: 'noon',
  category: 'footwear',
  brand: 'Nike',
  title: 'Nike Air Force 1 07 Shoes',
  url: 'https://www.noon.com/uae-en/nike-air-force-1-07',
  imageUrl: 'https://example.com/nike-af1.png',
  priceMinor: 19900,
  previousPriceMinor: 24900,
  currency: 'AED',
  availability: 'in_stock',
  observedAt: '2026-11-14T08:00:00.000Z'
};

const amazonProduct: DiscoveryProduct = {
  id: 'amazon_ae:nike-af1',
  siteKey: 'amazon_ae',
  category: 'footwear',
  brand: 'Nike',
  title: 'Nike Air Force 1 07 Shoes',
  url: 'https://www.amazon.ae/dp/B000000001',
  priceMinor: 24900,
  currency: 'AED',
  availability: 'in_stock',
  observedAt: '2026-11-14T08:00:00.000Z'
};

const namshiProduct: DiscoveryProduct = {
  id: 'namshi:nike-af1',
  siteKey: 'namshi',
  category: 'footwear',
  brand: 'Nike',
  title: 'Nike Air Force 1 07 Shoes',
  url: 'https://www.namshi.com/nike-air-force-1-07',
  priceMinor: 21900,
  currency: 'AED',
  availability: 'in_stock',
  observedAt: '2026-11-14T08:00:00.000Z'
};

const trackedProduct: TrackedProduct = {
  id: 7,
  url: 'https://www.amazon.ae/dp/B000000001',
  canonicalUrl: 'https://www.amazon.ae/dp/B000000001',
  siteKey: 'amazon_ae',
  title: 'Nike Air Force 1 07 Shoes',
  currency: 'AED',
  currentPriceMinor: 24900,
  alertMode: 'price_drop',
  checkPreference: 'daily',
  isActive: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-11-14T08:00:00.000Z'
};

function offersFor(products: DiscoveryProduct[], comparable = true): DiscoveryOffer[] {
  return products.map((product, order) => ({ product, order, comparable, priceDeltaMinor: (product.priceMinor ?? 0) - 19900 }));
}

function makeGroup(overrides: Partial<DiscoveryProductGroup> = {}): DiscoveryProductGroup {
  const offers = offersFor([noonProduct, amazonProduct, namshiProduct]);
  return {
    id: 'nike-air-force-1-07-shoes',
    title: 'Nike Air Force 1 07 Shoes',
    brand: 'Nike',
    category: 'footwear',
    categories: ['footwear'],
    imageUrl: 'https://example.com/nike-af1.png',
    currency: 'AED',
    offers,
    bestOffer: offers[0],
    comparableOfferCount: 3,
    priceSpreadMinor: 5000,
    observedAt: '2026-11-14T08:00:00.000Z',
    ...overrides
  };
}

function renderSheet(overrides: Partial<SearchCompareSheetProps> = {}) {
  const handlers = {
    onClose: jest.fn(),
    onTrack: jest.fn(),
    onOpenOffer: jest.fn(),
    onDismiss: jest.fn(),
    onMoreLikeThis: jest.fn(),
    onOpenTracker: jest.fn()
  };
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<SearchCompareSheet visible group={makeGroup()} {...handlers} {...overrides} />);
  });
  return { tree: tree!, handlers };
}

function sheetText(tree: renderer.ReactTestRenderer): string {
  return tree.root.findAllByType(AppText).map((node) => [node.props.children].flat().join('')).join(' ');
}

describe('SearchCompareSheet', () => {
  it('claims the lowest price, best store and saving for a comparable group', () => {
    const { tree } = renderSheet();
    const text = sheetText(tree);

    expect(text).toContain('Compare prices');
    expect(text).toContain('Nike · Footwear');
    expect(text).toContain('Nike Air Force 1 07 Shoes');
    expect(text).toContain('AED 199');
    expect(text).toContain('Lowest at Noon');
    expect(text).toContain('Save AED 50 across 3 stores');
    expect(text).toContain('Prices checked');
    act(() => tree.unmount());
  });

  it('says prices are not directly comparable instead of claiming a lowest price', () => {
    const group = makeGroup({
      bestOffer: undefined,
      comparableOfferCount: 0,
      priceSpreadMinor: undefined,
      offers: offersFor([noonProduct, amazonProduct])
    });
    const { tree } = renderSheet({ group });
    const text = sheetText(tree);

    expect(text).toContain('These prices are not directly comparable');
    expect(text).not.toContain('Lowest at');
    expect(text).not.toContain('Save ');
    act(() => tree.unmount());
  });

  it('annotates the tracked product and opens the tracker', () => {
    const { tree, handlers } = renderSheet({ group: makeGroup({ trackedProduct }) });
    const text = sheetText(tree);

    expect(text).toContain('You track this at Amazon');
    act(() => tree.root.findAllByType(PrimaryButton).find((button) => button.props.label === 'Open tracker')!.props.onPress());
    expect(handlers.onOpenTracker).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('lists a row per store with availability, range, previous price and direction', () => {
    const rangeProduct: DiscoveryProduct = {
      ...noonProduct,
      id: 'noon:range',
      title: 'Nike Air Force 1 07 Shoes',
      priceMinor: 24900,
      previousPriceMinor: 29900,
      hasPriceRange: true
    };
    const outOfStockProduct: DiscoveryProduct = {
      ...amazonProduct,
      id: 'amazon_ae:oos',
      priceMinor: 27900,
      availability: 'out_of_stock'
    };
    const unknownAvailabilityProduct: DiscoveryProduct = {
      ...namshiProduct,
      id: 'hm_uae:unknown',
      siteKey: 'hm_uae',
      priceMinor: 22900,
      availability: 'unknown'
    };
    const inStockProduct: DiscoveryProduct = { ...namshiProduct, id: 'namshi:cheapest', priceMinor: 21900 };
    const offers: DiscoveryOffer[] = [
      { product: inStockProduct, order: 0, comparable: true, priceDeltaMinor: 0 },
      { product: rangeProduct, order: 1, comparable: false },
      { product: outOfStockProduct, order: 2, comparable: false },
      { product: unknownAvailabilityProduct, order: 3, comparable: true, priceDeltaMinor: 1000 }
    ];
    const { tree } = renderSheet({
      group: makeGroup({ offers, bestOffer: offers[0], comparableOfferCount: 2, priceSpreadMinor: 1000 })
    });
    const text = sheetText(tree);

    expect(text).toContain('Prices across 4 stores');
    expect(text).toContain('Namshi');
    expect(text).toContain('Noon');
    expect(text).toContain('Amazon');
    expect(text).toContain('H&M');
    expect(text).toContain('From AED 249');
    expect(text).toContain('was AED 299');
    expect(text).toContain('AED 50 lower');
    expect(text).toContain('Out of stock');
    expect(text).toContain('Availability not confirmed');
    expect(text).toContain('Checked ');
    expect(text).toContain('Not directly comparable · price varies by variant');
    expect(text).toContain('Not directly comparable · out of stock');
    act(() => tree.unmount());
  });

  it('tracks the offer on the row that was pressed and shows the tracked/spinner states', () => {
    const group = makeGroup({ trackedProduct });
    const primary = renderSheet({ group, trackingOfferId: noonProduct.id });
    expect(primary.tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(sheetText(primary.tree)).toContain('Tracked');

    const secondary = renderSheet({ group });
    const trackNoon = secondary.tree.root.findAll(
      (node) => node.props.accessibilityLabel === 'Track Noon price' && typeof node.props.onPress === 'function'
    )[0];
    act(() => trackNoon.props.onPress());
    expect(secondary.handlers.onTrack).toHaveBeenCalledWith(group.offers[0]);

    const openAmazon = secondary.tree.root.findAll(
      (node) => node.props.accessibilityLabel === 'Open Amazon offer' && typeof node.props.onPress === 'function'
    )[0];
    act(() => openAmazon.props.onPress());
    expect(secondary.handlers.onOpenOffer).toHaveBeenCalledWith(group.offers[1]);

    act(() => primary.tree.unmount());
    act(() => secondary.tree.unmount());
  });

  it('closes, tracks the lowest price, dismisses and requests more like this', () => {
    const group = makeGroup();
    const { tree, handlers } = renderSheet({ group });
    const buttons = () => tree.root.findAllByType(PrimaryButton);

    act(() => tree.root.findAll((node) => node.props.accessibilityLabel === 'Close compare prices' && typeof node.props.onPress === 'function')[0].props.onPress());
    expect(handlers.onClose).toHaveBeenCalledTimes(1);

    act(() => buttons().find((button) => button.props.label === 'Track lowest price')!.props.onPress());
    expect(handlers.onTrack).toHaveBeenCalledWith(group.bestOffer);

    act(() => buttons().find((button) => button.props.label === 'Not interested')!.props.onPress());
    expect(handlers.onDismiss).toHaveBeenCalledTimes(1);

    act(() => buttons().find((button) => button.props.label === 'More like this')!.props.onPress());
    expect(handlers.onMoreLikeThis).toHaveBeenCalledWith('Nike');
    act(() => tree.unmount());
  });
});
