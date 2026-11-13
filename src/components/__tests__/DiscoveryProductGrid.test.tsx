import React from 'react';
import { Image } from 'react-native';
import renderer, { act } from 'react-test-renderer';

jest.mock('../../data/discoveryHistory', () => ({
  getDiscoveryHistory: jest.fn().mockResolvedValue([])
}));

import { DiscoveryProductGrid } from '../Discovery';
import { DiscoveryProduct } from '../../domain/types';

const product: DiscoveryProduct = {
  id: 'discovery-1',
  siteKey: 'noon',
  category: 'footwear',
  brand: 'Sun & Sand Sports',
  title: 'Adizero EVO SL Shoes',
  url: 'https://www.noon.com/uae-en/adizero-evo-sl-shoes',
  imageUrl: 'https://example.com/adizero.png',
  priceMinor: 69900,
  currency: 'AED',
  availability: 'in_stock',
  observedAt: '2026-11-13T09:00:00.000Z'
};

function renderGrid(item: DiscoveryProduct) {
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <DiscoveryProductGrid
        products={[item]}
        trackedProducts={[]}
        onTrack={jest.fn().mockResolvedValue(undefined)}
        onDismiss={jest.fn().mockResolvedValue(undefined)}
        onMoreLikeThis={jest.fn()}
        onViewAtRetailer={jest.fn().mockResolvedValue(undefined)}
      />
    );
  });
  return tree!;
}

function fallbacks(tree: renderer.ReactTestRenderer) {
  return tree.root.findAllByProps({ accessibilityLabel: 'Product image unavailable' });
}

it('shows a placeholder immediately when a listing has no image', () => {
  const tree = renderGrid({ ...product, imageUrl: undefined });
  expect(fallbacks(tree).length).toBeGreaterThan(0);
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
});

it('replaces a failed listing image with the placeholder', () => {
  const tree = renderGrid(product);
  expect(fallbacks(tree)).toHaveLength(0);
  expect(tree.root.findAllByType(Image)).toHaveLength(1);

  act(() => {
    tree.root.findByType(Image).props.onError();
  });

  expect(fallbacks(tree).length).toBeGreaterThan(0);
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
});

it('replaces a failed preview image with the placeholder', async () => {
  const tree = renderGrid(product);
  const imageButton = tree.root.findAll((node) => node.props.accessibilityLabel === `View ${product.title}` && typeof node.props.onPress === 'function')[0];
  await act(async () => {
    imageButton.props.onPress();
    await Promise.resolve();
  });

  const images = tree.root.findAllByType(Image);
  expect(images.length).toBeGreaterThan(1);
  await act(async () => {
    images.forEach((image) => {
      if (typeof image.props.onError === 'function') {
        image.props.onError();
      }
    });
    await Promise.resolve();
  });

  expect(fallbacks(tree).length).toBeGreaterThanOrEqual(2);
  act(() => tree.unmount());
});
