import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Circle, Line } from 'react-native-svg';

import { AppText } from '../AppText';
import { PriceChart } from '../PriceChart';
import { PriceSnapshot } from '../../domain/types';
import { colors } from '../../theme/theme';

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

  it('exposes a horizontal scrub responder without blocking page scroll', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<PriceChart snapshots={snapshots} currency="AED" />); });

    const canvas = tree!.root.findByProps({ testID: 'price-chart-canvas' });
    expect(typeof canvas.props.onResponderGrant).toBe('function');
    expect(typeof canvas.props.onResponderMove).toBe('function');
  });
  it('explains how price changes are encoded on the chart', () => {
    let tree: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(<PriceChart snapshots={snapshots} currency="AED" />);
    });

    expect(renderedText(tree!)).toContain('Only points where the price changed are plotted. Dashed lines mark the high and low; drag across the chart to scrub through them; tap a point to inspect it.');
  });

  it('plots only the points where the price actually changed', () => {
    const repeatedPrices: PriceSnapshot[] = [10000, 10000, 9000, 9000, 9000, 10500].map((priceMinor, index) => ({
      id: index + 1,
      trackedProductId: 1,
      priceMinor,
      currency: 'AED',
      availability: 'in_stock',
      status: index === 0 ? 'ok' : 'price_changed',
      source: 'background',
      checkedAt: `2026-10-${String(index + 1).padStart(2, '0')}T08:30:00.000Z`
    }));
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<PriceChart snapshots={repeatedPrices} currency="AED" />); });

    // Three price levels (10,000 -> 9,000 -> 10,500), not six checks.
    expect(tree!.root.findAllByType(Circle)).toHaveLength(3);
  });
  it('marks the high and low with dashed guide lines and on-chart price labels', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<PriceChart snapshots={snapshots} currency="AED" />); });
    act(() => {
      tree!.root.findByProps({ accessibilityLabel: 'Price history chart' }).props.onLayout({
        nativeEvent: { layout: { width: 320, height: 172 } }
      });
    });

    const guides = tree!.root.findAllByType(Line).filter((line) => line.props.strokeDasharray === '4 5');
    expect(guides).toHaveLength(2);
    expect(guides.map((line) => line.props.stroke)).toEqual([colors.red, colors.green]);
    const labelText = tree!.root.findAllByType(AppText).map((node) => [node.props.children].flat().join(''));
    expect(labelText).toContain('AED 105');
    expect(labelText).toContain('AED 97.50');
    expect(labelText).toContain('AED 90');
  });
  it('uses the shared direction colors for chart points', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<PriceChart snapshots={snapshots} currency="AED" />); });

    const chart = tree!.root.findByProps({ accessibilityLabel: 'Price history chart' });
    act(() => { chart.props.onLayout({ nativeEvent: { layout: { width: 320, height: 172 } } }); });
    act(() => { chart.props.onPress({ nativeEvent: { locationX: 18 } }); });

    const fills = tree!.root.findAllByType(Circle).map((circle) => circle.props.fill);
    // Sorted oldest → newest: 100, 90 (drop) and 105 (increase); the oldest point is selected (white fill).
    expect(fills).toContain(colors.green);
    expect(fills).toContain(colors.red);
    expect(fills).not.toContain(colors.amber);
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

