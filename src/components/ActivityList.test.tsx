import React from 'react';
import renderer, { act } from 'react-test-renderer';

import { ActivityList } from './ActivityList';
import { AppText } from './AppText';
import type { ActivityEvent, TrackedProduct } from '../domain/types';

const now = new Date(2026, 10, 14, 15, 0);

const product: TrackedProduct = {
  id: 1,
  url: 'https://www.noon.com/shoe',
  canonicalUrl: 'https://www.noon.com/shoe',
  siteKey: 'noon',
  title: 'Running shoe',
  currency: 'AED',
  currentPriceMinor: 39900,
  previousPriceMinor: 36000,
  alertMode: 'price_drop',
  checkPreference: 'daily',
  isActive: true,
  lastCheckedAt: '2026-11-14T09:05:00.000Z',
  lastAvailability: 'in_stock',
  lastErrorCode: 'ok',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-11-14T09:05:00.000Z'
};

function event(id: number, date: Date, overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id,
    trackedProductId: 1,
    productTitle: 'Running shoe',
    newPriceMinor: 39900,
    currency: 'AED',
    priceDirection: 'up',
    previousPriceMinor: 36000,
    source: 'manual_batch',
    checkedAt: date.toISOString(),
    ...overrides
  };
}

function texts(tree: renderer.ReactTestRenderer): string {
  return tree.root.findAllByType(AppText).map((node) => [node.props.children].flat().join('')).join(' | ');
}

describe('ActivityList', () => {
  it('groups events by calendar day with counts and relative labels', () => {
    const events = [
      event(1, new Date(2026, 10, 14, 9, 5)),
      event(2, new Date(2026, 10, 13, 23, 30)),
      event(3, new Date(2026, 10, 10, 12, 0), { trackedProductId: 2 })
    ];
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <ActivityList events={events} productsById={new Map([[1, product]])} onOpenProduct={jest.fn()} now={now} />
      );
    });
    const content = texts(tree!);
    expect(content).toContain('Today');
    expect(content).toContain('1 change');
    expect(content).toContain('Yesterday');
    expect(content).toContain('Tue, 10 Nov');
    expect(tree!.root.findAllByProps({ accessibilityRole: 'header' }).length).toBeGreaterThanOrEqual(3);
    expect(tree!.root.findAllByProps({ accessibilityLabel: 'Today, 1 change' }).length).toBeGreaterThan(0);
  });

  it('renders price changes with an explicit delta, source and time', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <ActivityList events={[event(1, new Date(2026, 10, 14, 9, 5))]} productsById={new Map([[1, product]])} onOpenProduct={jest.fn()} now={now} />
      );
    });
    const content = texts(tree!);
    expect(content).toContain('AED 360');
    expect(content).toContain('AED 399');
    expect(content).toContain('+AED 39');
    expect(content).toContain('Recheck all');
    expect(content).toContain('9:05 AM');
  });

  it('labels first observation, restock and out-of-stock rows', () => {
    const events = [
      event(1, new Date(2026, 10, 14, 9, 5), { priceDirection: 'first', previousPriceMinor: undefined }),
      event(2, new Date(2026, 10, 13, 9, 5), { availability: 'in_stock', priceDirection: 'first', previousPriceMinor: 14900, newPriceMinor: 14900 }),
      event(3, new Date(2026, 10, 12, 9, 5), { availability: 'out_of_stock', priceDirection: 'first', previousPriceMinor: 14900, newPriceMinor: 14900 })
    ];
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <ActivityList events={events} productsById={new Map([[1, product]])} onOpenProduct={jest.fn()} now={now} />
      );
    });
    const content = texts(tree!);
    expect(content).toContain('Started tracking');
    expect(content).toContain('New');
    expect(content).toContain('Back in stock');
    expect(content).toContain('Out of stock');
  });

  it('marks deleted products and does not make their row tappable', () => {
    let tree: renderer.ReactTestRenderer;
    const open = jest.fn();
    act(() => {
      tree = renderer.create(
        <ActivityList
          events={[event(1, new Date(2026, 10, 14, 9, 5), { trackedProductId: 99 })]}
          productsById={new Map()}
          onOpenProduct={open}
          now={now}
        />
      );
    });
    expect(texts(tree!)).toContain('Product removed');
    expect(tree!.root.findAllByProps({ accessibilityRole: 'button' })).toHaveLength(0);
    expect(open).not.toHaveBeenCalled();
  });

  it('opens the product from a tappable row and exposes a descriptive label', () => {
    let tree: renderer.ReactTestRenderer;
    const open = jest.fn();
    act(() => {
      tree = renderer.create(
        <ActivityList events={[event(1, new Date(2026, 10, 14, 9, 5))]} productsById={new Map([[1, product]])} onOpenProduct={open} now={now} />
      );
    });
    const row = tree!.root.findAllByProps({}).find((node) => typeof node.props.onPress === 'function' && String(node.props.accessibilityLabel ?? '').includes('open product'));
    expect(row?.props.accessibilityLabel).toContain('Running shoe');
    expect(row?.props.accessibilityLabel).toContain('AED 360 to AED 399');
    expect(row?.props.accessibilityLabel).toContain('open product');
    act(() => { row?.props.onPress(); });
    expect(open).toHaveBeenCalledWith(1);
  });
});
