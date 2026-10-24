import React from 'react';
import renderer, { act } from 'react-test-renderer';

import { AppText } from '../AppText';
import { PriceChart } from '../PriceChart';
import { PriceSnapshot } from '../../domain/types';

const snapshots: PriceSnapshot[] = [
  {
    id: 3,
    trackedProductId: 1,
    priceMinor: 10500,
    currency: 'AED',
    availability: 'in_stock',
    status: 'price_changed',
    source: 'background',
    checkedAt: '2026-10-03T08:30:00.000Z'
  },
  {
    id: 2,
    trackedProductId: 1,
    priceMinor: 9000,
    currency: 'AED',
    availability: 'in_stock',
    status: 'price_changed',
    source: 'background',
    checkedAt: '2026-10-02T08:30:00.000Z'
  },
  {
    id: 1,
    trackedProductId: 1,
    priceMinor: 10000,
    currency: 'AED',
    availability: 'in_stock',
    status: 'ok',
    source: 'manual_single',
    checkedAt: '2026-10-01T08:30:00.000Z'
  }
];

function renderedText(tree: renderer.ReactTestRenderer): string {
  return tree.root.findAllByType(AppText)
    .map((node) => [node.props.children].flat().join(''))
    .join(' ');
}

describe('PriceChart', () => {
  it('shows the latest price first and reveals a tapped historical price with its change', () => {
    let tree: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(<PriceChart snapshots={snapshots} currency="AED" />);
    });

    expect(renderedText(tree!)).toContain('AED 105');
    expect(renderedText(tree!)).toContain('↑ AED 15 increase');

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: 'Price history chart' }).props.onLayout({
        nativeEvent: { layout: { width: 320 } }
      });
    });

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: 'Price history chart' }).props.onPress({
        nativeEvent: { locationX: 160 }
      });
    });

    expect(renderedText(tree!)).toContain('AED 90');
    expect(renderedText(tree!)).toContain('↓ AED 10 drop');
  });

  it('explains how price changes are encoded on the chart', () => {
    let tree: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(<PriceChart snapshots={snapshots} currency="AED" />);
    });

    expect(renderedText(tree!)).toContain('Tap a point to view its date and price. Green marks a drop; orange marks an increase.');
  });
});

