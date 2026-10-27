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

const wideSnapshots: PriceSnapshot[] = Array.from({ length: 24 }, (_, index) => ({
  id: index + 10,
  trackedProductId: 1,
  priceMinor: 10000 + index * 100,
  currency: 'AED',
  availability: 'in_stock',
  status: 'price_changed',
  source: 'background',
  checkedAt: `2026-10-${String(index + 1).padStart(2, '0')}T08:30:00.000Z`
}));

function renderedText(tree: renderer.ReactTestRenderer): string {
  return tree.root.findAllByType(AppText)
    .map((node) => [node.props.children].flat().join(''))
    .join(' ');
}

describe('PriceChart', () => {
  it('keeps the kilogram basis visible for historical prices and changes', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<PriceChart snapshots={snapshots.map((snapshot) => ({ ...snapshot, priceBasis: 'kg' }))} currency="AED" />); });
    expect(renderedText(tree!)).toContain('AED 105 /kg');
    expect(renderedText(tree!)).toContain('↑ AED 15 /kg increase');
  });
  it('shows the latest price first and reveals a tapped historical price with its change', () => {
    let tree: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(<PriceChart snapshots={snapshots} currency="AED" />);
    });

    expect(renderedText(tree!)).toContain('AED 105');
    expect(renderedText(tree!)).toContain('↑ AED 15 increase');

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: 'Price history chart' }).props.onLayout({
        nativeEvent: { layout: { width: 320, height: 172 } }
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

  it('maps a tap on the first visible point correctly in a wide layout', () => {
    let tree: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(<PriceChart snapshots={wideSnapshots} currency="AED" />);
    });

    const chart = tree!.root.findByProps({ accessibilityLabel: 'Price history chart' });
    act(() => {
      chart.props.onLayout({ nativeEvent: { layout: { width: 600, height: 172 } } });
    });
    act(() => {
      chart.props.onPress({ nativeEvent: { locationX: 141 } });
    });

    expect(renderedText(tree!)).toContain('AED 100');
    expect(renderedText(tree!)).toContain('First price');
  });
});

