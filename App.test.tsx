import React from 'react';
import { TextInput } from 'react-native';
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

import { AddScreen } from './App';
import { AppText } from './src/components/AppText';

const mockFetchAndParseProduct = jest.requireMock('./src/domain/parser').fetchAndParseProduct as jest.Mock;

describe('AddScreen', () => {
  beforeEach(() => {
    mockFetchAndParseProduct.mockReset();
    mockFetchAndParseProduct.mockImplementation(() => new Promise(() => undefined));
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
