import React from 'react';
import renderer, { act } from 'react-test-renderer';

import { ProductCard } from './ProductCard';
import { AppText } from './AppText';
import { TrackedProduct } from '../domain/types';

const base: TrackedProduct = {
  id: 1,
  url: 'https://www.noon.com/shoe',
  canonicalUrl: 'https://www.noon.com/shoe',
  siteKey: 'noon',
  title: 'Running shoe',
  currency: 'AED',
  currentPriceMinor: 9000,
  previousPriceMinor: 9000,
  lastPriceChangeMinor: 10000,
  lastPriceChangeAt: '2026-11-01T00:00:00.000Z',
  alertMode: 'price_drop',
  checkPreference: 'daily',
  isActive: true,
  lastCheckedAt: '2026-11-10T00:00:00.000Z',
  lastAvailability: 'in_stock',
  lastErrorCode: 'ok',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-11-10T00:00:00.000Z'
};

function cardText(product: TrackedProduct): string {
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<ProductCard product={product} onPress={jest.fn()} />);
  });
  return tree!.root.findAllByType(AppText).map((node) => [node.props.children].flat().join('')).join(' ');
}

it('keeps showing the last actual price change after unchanged checks', () => {
  const text = cardText(base);
  expect(text).toContain('AED 10 lower');
});

it('updates the direction when a new price change is recorded', () => {
  const text = cardText({ ...base, currentPriceMinor: 10500, lastPriceChangeMinor: 10000 });
  expect(text).toContain('AED 5 higher');
});

it('hides the price change badge while the product is out of stock', () => {
  const text = cardText({ ...base, lastAvailability: 'out_of_stock' });
  expect(text).not.toContain('lower');
  expect(text).not.toContain('higher');
});

it('shows no direction badge when the product never changed price', () => {
  const text = cardText({ ...base, lastPriceChangeMinor: undefined, lastPriceChangeAt: undefined });
  expect(text).not.toContain('lower');
  expect(text).not.toContain('higher');
});
