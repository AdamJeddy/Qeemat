import React from 'react';
import { Image, StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { AppText } from '../AppText';
import { SearchProductRow } from '../SearchProductRow';
import { DiscoveryOffer, DiscoveryProduct, DiscoveryProductGroup, TrackedProduct } from '../../domain/types';

const noonProduct: DiscoveryProduct = {
  id: 'noon-adizero-evo-sl',
  siteKey: 'noon',
  category: 'footwear',
  brand: 'Adidas',
  title: 'Adidas Adizero EVO SL Running Shoes',
  url: 'https://www.noon.com/uae-en/adizero-evo-sl-shoes',
  imageUrl: 'https://images.example/adizero-evo-sl.jpg',
  priceMinor: 69900,
  previousPriceMinor: 71900,
  currency: 'AED',
  availability: 'in_stock',
  observedAt: '2026-11-13T09:00:00.000Z'
};

const amazonProduct: DiscoveryProduct = {
  ...noonProduct,
  id: 'amazon-adizero-evo-sl',
  siteKey: 'amazon_ae',
  title: 'adidas Adizero EVO SL Shoes',
  url: 'https://www.amazon.ae/dp/B0EXAMPLE',
  priceMinor: 74900,
  previousPriceMinor: undefined
};

const comparableOffers: DiscoveryOffer[] = [
  { product: noonProduct, order: 0, comparable: true, priceDeltaMinor: 0 },
  { product: amazonProduct, order: 1, comparable: true, priceDeltaMinor: 5000 }
];

function makeGroup(overrides: Partial<DiscoveryProductGroup> = {}): DiscoveryProductGroup {
  return {
    id: 'adidas-adizero-evo-sl',
    title: 'Adidas Adizero EVO SL Running Shoes',
    brand: 'Adidas',
    category: 'footwear',
    categories: ['footwear'],
    imageUrl: 'https://images.example/adizero-evo-sl.jpg',
    currency: 'AED',
    offers: comparableOffers,
    bestOffer: comparableOffers[0],
    comparableOfferCount: 2,
    priceSpreadMinor: 5000,
    observedAt: '2026-11-13T09:00:00.000Z',
    ...overrides
  };
}

function makeTrackedProduct(overrides: Partial<TrackedProduct> = {}): TrackedProduct {
  return {
    id: 1,
    url: 'https://www.noon.com/uae-en/adizero-evo-sl-shoes',
    canonicalUrl: 'https://www.noon.com/uae-en/adizero-evo-sl-shoes',
    siteKey: 'noon',
    title: 'Adidas Adizero EVO SL Running Shoes',
    currency: 'AED',
    currentPriceMinor: 69900,
    alertMode: 'price_drop',
    checkPreference: 'daily',
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-13T00:00:00.000Z',
    ...overrides
  };
}

function renderRow(element: React.ReactElement): renderer.ReactTestRenderer {
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(element);
  });
  return tree!;
}

function rowText(tree: renderer.ReactTestRenderer): string {
  return tree.root.findAllByType(AppText).map((node) => [node.props.children].flat().join('')).join(' ');
}

function findPressable(tree: renderer.ReactTestRenderer, accessibilityLabel: string) {
  return tree.root.findAllByProps({ accessibilityLabel }).find((node) => typeof node.props.onPress === 'function');
}

function productImages(tree: renderer.ReactTestRenderer) {
  return tree.root.findAllByType(Image).filter((node) => String(node.props.source?.uri ?? '').includes('images.example'));
}

it('renders the brand, title, price and lowest store for a comparable group', () => {
  const tree = renderRow(<SearchProductRow group={makeGroup()} onPress={jest.fn()} />);
  const text = rowText(tree);

  expect(text).toContain('Adidas Adizero EVO SL Running Shoes');
  expect(text).toContain('Adidas · Footwear');
  expect(text).toContain('AED 699');
  expect(text).toContain('AED 20 lower');
  expect(text).toContain('Lowest at Noon');
  expect(text).toContain('2 stores');
  expect(findPressable(tree, 'Adidas Adizero EVO SL Running Shoes, Adidas, AED 699, Lowest at Noon')).toBeDefined();
});

it('renders the relevance reason and the tracked-product annotation', () => {
  const tree = renderRow(
    <SearchProductRow
      group={makeGroup({
        relevance: { score: 92, tier: 2, reason: 'Because you track running shoes' },
        trackedProduct: makeTrackedProduct()
      })}
      onPress={jest.fn()}
    />
  );
  const text = rowText(tree);

  expect(text).toContain('Because you track running shoes');
  expect(text).toContain('On your watchlist');
});

it('shows the saving across comparable stores only when there is a spread', () => {
  const withSaving = rowText(renderRow(<SearchProductRow group={makeGroup()} onPress={jest.fn()} />));
  expect(withSaving).toContain('Save AED 50');

  const withoutSaving = rowText(renderRow(<SearchProductRow group={makeGroup({ priceSpreadMinor: 0 })} onPress={jest.fn()} />));
  expect(withoutSaving).not.toContain('Save AED');
});

it('opens compare on the row press and tracks from the Track action', () => {
  const onPress = jest.fn();
  const onTrack = jest.fn();
  const tree = renderRow(<SearchProductRow group={makeGroup()} onPress={onPress} onTrack={onTrack} />);
  const title = makeGroup().title;

  const compare = findPressable(tree, `Compare prices for ${title}`);
  const track = findPressable(tree, `Track ${title}`);
  expect(StyleSheet.flatten(compare?.props.style({ pressed: false })).minHeight).toBe(44);
  expect(StyleSheet.flatten(track?.props.style({ pressed: false })).minHeight).toBe(44);

  act(() => compare?.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);

  act(() => track?.props.onPress());
  expect(onTrack).toHaveBeenCalledTimes(1);
});

it('replaces a missing or failed product image with the unavailable placeholder', () => {
  const missing = renderRow(<SearchProductRow group={makeGroup({ imageUrl: undefined })} onPress={jest.fn()} />);
  expect(missing.root.findAllByProps({ accessibilityLabel: 'Product image unavailable' }).length).toBeGreaterThan(0);
  expect(productImages(missing)).toHaveLength(0);

  const failed = renderRow(<SearchProductRow group={makeGroup()} onPress={jest.fn()} />);
  expect(productImages(failed)).toHaveLength(1);

  act(() => productImages(failed)[0].props.onError());

  expect(failed.root.findAllByProps({ accessibilityLabel: 'Product image unavailable' }).length).toBeGreaterThan(0);
  expect(productImages(failed)).toHaveLength(0);
});

it('shows a price without a false lowest claim for a single out-of-stock offer', () => {
  const outOfStock: DiscoveryProduct = {
    ...noonProduct,
    priceMinor: 45000,
    previousPriceMinor: undefined,
    availability: 'out_of_stock'
  };
  const tree = renderRow(
    <SearchProductRow
      group={makeGroup({
        offers: [{ product: outOfStock, order: 0, comparable: false }],
        bestOffer: undefined,
        comparableOfferCount: 0,
        priceSpreadMinor: undefined
      })}
      onPress={jest.fn()}
    />
  );
  const text = rowText(tree);

  expect(text).toContain('AED 450');
  expect(text).toContain('Out of stock');
  expect(text).toContain('At Noon');
  expect(text).not.toContain('Lowest at');
  expect(text).not.toContain('Save AED');
  expect(findPressable(tree, 'Adidas Adizero EVO SL Running Shoes, Adidas, AED 450, At Noon')).toBeDefined();
});
