import React from 'react';
import { Animated, ScrollView } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { AppText } from '../AppText';
import { SearchProgress } from '../SearchProgress';
import type { ProductSearchResult, SearchSourceResult } from '../../domain/discoverySearchCatalog';
import { DiscoveryProduct, SiteKey } from '../../domain/types';

type AnimationStub = {
  start: jest.Mock;
  stop: jest.Mock;
  reset: jest.Mock;
};

/** Animations started by the component; the component must stop every one on unmount. */
let startedAnimations: AnimationStub[] = [];

function mockAnimations() {
  startedAnimations = [];
  const makeStub = (): AnimationStub => {
    const stub: AnimationStub = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
    stub.start.mockImplementation(() => {
      startedAnimations.push(stub);
    });
    return stub;
  };
  jest.spyOn(Animated, 'timing').mockImplementation(() => makeStub());
  jest.spyOn(Animated, 'loop').mockImplementation(() => makeStub());
}

function product(id: string, siteKey: SiteKey): DiscoveryProduct {
  return {
    id,
    siteKey,
    category: 'electronics',
    brand: 'Apple',
    title: 'Apple AirPods Pro 2',
    url: `https://example.com/${id}`,
    currency: 'AED',
    availability: 'in_stock',
    observedAt: '2026-11-14T08:00:00.000Z'
  };
}

function source(
  siteKey: SiteKey,
  status: SearchSourceResult['status'],
  products: DiscoveryProduct[] = [],
  suffix = ''
): SearchSourceResult {
  return {
    request: {
      id: `search-${siteKey}${suffix}`,
      siteKey,
      label: 'Product search',
      category: 'general',
      provider: 'html',
      url: `https://example.com/${siteKey}${suffix}`
    },
    status,
    products
  };
}

function makeResult(sources: SearchSourceResult[]): ProductSearchResult {
  return { query: 'airpods', products: sources.flatMap((entry) => entry.products), sources };
}

function renderSearchProgress(element: React.ReactElement): renderer.ReactTestRenderer {
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(element);
  });
  return tree!;
}

function renderedText(tree: renderer.ReactTestRenderer): string {
  return tree.root.findAllByType(AppText).map((node) => [node.props.children].flat().join('')).join(' ');
}

function summaryText(tree: renderer.ReactTestRenderer): string {
  return tree.root.findAllByType(AppText)
    .filter((node) => node.props.accessibilityRole === 'header')
    .map((node) => [node.props.children].flat().join(''))
    .join(' ');
}

beforeEach(() => {
  mockAnimations();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SearchProgress', () => {
  const checkingResult = makeResult([
    source('noon', 'loading'),
    source('zara_uae', 'ready', [product('zara-1', 'zara_uae'), product('zara-2', 'zara_uae')]),
    source('zara_uae', 'ready', [product('zara-2', 'zara_uae')], '-women'),
    source('hm_uae', 'empty'),
    source('namshi', 'unavailable')
  ]);

  it('shows the checked-store summary live while a search is running', () => {
    const tree = renderSearchProgress(<SearchProgress result={checkingResult} storeCount={4} busy />);
    const summary = tree.root.findAllByType(AppText).find((node) => node.props.accessibilityRole === 'header');

    expect(summary).toBeDefined();
    expect(summaryText(tree)).toBe('2 of 4 stores checked · Searching…');
    expect(summary!.props.accessibilityLiveRegion).toBe('polite');
  });

  it('labels each store pill with its checking, product, empty or unavailable state', () => {
    const tree = renderSearchProgress(<SearchProgress result={checkingResult} storeCount={4} busy />);
    const labelCount = (expected: string) => tree.root.findAllByProps({ accessibilityLabel: expected }).length;

    expect(labelCount('Noon, checking')).toBeGreaterThan(0);
    expect(labelCount('Zara, 2 products')).toBeGreaterThan(0);
    expect(labelCount('H&M, no matching products')).toBeGreaterThan(0);
    expect(labelCount('Namshi, unavailable')).toBeGreaterThan(0);
    // The ready pill shows the unique product count, not one row per source response.
    expect(tree.root.findAllByType(AppText).some((node) => node.props.children === 2)).toBe(true);
  });

  it('shows the completed summary without a searching state once checks finish', () => {
    const finished = makeResult([
      source('noon', 'ready', [product('noon-1', 'noon')]),
      source('amazon_ae', 'ready', [product('amazon-1', 'amazon_ae'), product('amazon-2', 'amazon_ae')]),
      source('hm_uae', 'empty')
    ]);
    const complete = renderSearchProgress(<SearchProgress result={finished} storeCount={3} busy={false} />);

    expect(summaryText(complete)).toBe('3 of 3 stores checked');
    expect(renderedText(complete)).not.toContain('Searching');

    const withFailure = makeResult([
      source('noon', 'ready', [product('noon-1', 'noon')]),
      source('amazon_ae', 'unavailable'),
      source('hm_uae', 'empty')
    ]);
    const partial = renderSearchProgress(<SearchProgress result={withFailure} storeCount={3} busy={false} />);

    expect(summaryText(partial)).toBe('2 of 3 stores checked');
    expect(renderedText(partial)).not.toContain('Searching');
  });

  it('starts with a generic checking state before any result arrives', () => {
    const tree = renderSearchProgress(<SearchProgress storeCount={20} busy />);

    expect(renderedText(tree)).toContain('Starting checks across 20 stores…');
    expect(renderedText(tree)).not.toContain('stores checked');
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(0);
  });

  it('renders nothing when there is no result and no search is running', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<SearchProgress storeCount={20} busy={false} />);
    });

    expect(tree!.toJSON()).toBeNull();
  });

  it('stops its animations when unmounted', () => {
    const tree = renderSearchProgress(<SearchProgress storeCount={20} busy />);

    expect(startedAnimations.length).toBeGreaterThan(0);

    act(() => {
      tree.unmount();
    });

    expect(startedAnimations.every((animation) => animation.stop.mock.calls.length > 0)).toBe(true);
  });
});
