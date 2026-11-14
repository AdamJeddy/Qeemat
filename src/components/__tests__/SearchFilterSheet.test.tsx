import React from 'react';
import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

jest.mock('../../data/discoveryHistory', () => ({
  getDiscoveryHistory: jest.fn().mockResolvedValue([])
}));

import { SearchFilterSheet, SearchFilterSheetProps, SearchFilters } from '../SearchFilterSheet';
import { AppText } from '../AppText';
import { DiscoveryFilterChip } from '../Discovery';
import { PrimaryButton } from '../PrimaryButton';

const baseFilters: SearchFilters = { maximumPrice: '' };

function renderSheet(overrides: Partial<SearchFilterSheetProps> = {}) {
  const handlers = {
    onChangeFilters: jest.fn(),
    onClear: jest.fn(),
    onClose: jest.fn()
  };
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <SearchFilterSheet
        visible
        filters={baseFilters}
        departments={['footwear', 'clothing']}
        stores={[{ siteKey: 'noon', count: 4 }, { siteKey: 'amazon_ae', count: 2 }]}
        brands={['Nike', 'Adidas']}
        resultCount={12}
        {...handlers}
        {...overrides}
      />
    );
  });
  return { tree: tree!, handlers };
}

function sheetText(tree: renderer.ReactTestRenderer): string {
  return tree.root.findAllByType(AppText).map((node) => [node.props.children].flat().join('')).join(' ');
}

function pressChip(tree: renderer.ReactTestRenderer, label: string) {
  act(() => tree.root.findAllByType(DiscoveryFilterChip).find((chip) => chip.props.label === label)!.props.onPress());
}

describe('SearchFilterSheet', () => {
  it('renders departments, stores, brands, the result count and selected state', () => {
    const { tree } = renderSheet({ filters: { ...baseFilters, category: 'footwear', siteKey: 'noon' } });
    const chips = () => tree.root.findAllByType(DiscoveryFilterChip);

    expect(chips().map((chip) => chip.props.label)).toEqual([
      'All departments',
      'Footwear',
      'Clothing',
      'All stores',
      'Noon (4)',
      'Amazon (2)',
      'Any brand',
      'Nike',
      'Adidas'
    ]);
    expect(chips().find((chip) => chip.props.label === 'Footwear')!.props.selected).toBe(true);
    expect(chips().find((chip) => chip.props.label === 'Clothing')!.props.selected).toBe(false);
    expect(chips().find((chip) => chip.props.label === 'All departments')!.props.selected).toBe(false);
    expect(chips().find((chip) => chip.props.label === 'Noon (4)')!.props.selected).toBe(true);
    expect(chips().find((chip) => chip.props.label === 'All stores')!.props.selected).toBe(false);
    expect(chips().find((chip) => chip.props.label === 'Nike')!.props.selected).toBe(false);
    expect(sheetText(tree)).toContain('Filter products');
    expect(sheetText(tree)).toContain('12 products');
    act(() => tree.unmount());
  });

  it('selects a department, store or brand while preserving the other filters', () => {
    const { tree, handlers } = renderSheet({
      filters: { category: 'clothing', siteKey: 'amazon_ae', brand: 'Adidas', maximumPrice: '99' }
    });

    pressChip(tree, 'Footwear');
    expect(handlers.onChangeFilters).toHaveBeenLastCalledWith({ category: 'footwear', siteKey: 'amazon_ae', brand: 'Adidas', maximumPrice: '99' });

    pressChip(tree, 'Noon (4)');
    expect(handlers.onChangeFilters).toHaveBeenLastCalledWith({ category: 'clothing', siteKey: 'noon', brand: 'Adidas', maximumPrice: '99' });

    pressChip(tree, 'Nike');
    expect(handlers.onChangeFilters).toHaveBeenLastCalledWith({ category: 'clothing', siteKey: 'amazon_ae', brand: 'Nike', maximumPrice: '99' });

    pressChip(tree, 'All departments');
    expect(handlers.onChangeFilters).toHaveBeenLastCalledWith({ category: undefined, siteKey: 'amazon_ae', brand: 'Adidas', maximumPrice: '99' });
    act(() => tree.unmount());
  });

  it('edits the maximum price with a decimal keypad', () => {
    const { tree, handlers } = renderSheet();

    const input = tree.root.findAllByType(TextInput).find((node) => node.props.accessibilityLabel === 'Maximum price')!;
    expect(input.props.keyboardType).toBe('decimal-pad');
    expect(input.props.placeholder).toBe('Maximum price (AED)');
    act(() => input.props.onChangeText('500'));
    expect(handlers.onChangeFilters).toHaveBeenCalledWith({ maximumPrice: '500' });
    act(() => tree.unmount());
  });

  it('clears the filters and closes with Show results', () => {
    const { tree, handlers } = renderSheet();

    act(() => tree.root.findAllByType(PrimaryButton).find((button) => button.props.label === 'Clear filters')!.props.onPress());
    expect(handlers.onClear).toHaveBeenCalledTimes(1);

    act(() => tree.root.findAllByType(PrimaryButton).find((button) => button.props.label === 'Show results')!.props.onPress());
    expect(handlers.onClose).toHaveBeenCalledTimes(1);

    act(() => tree.root.findAll((node) => node.props.accessibilityLabel === 'Close filters' && typeof node.props.onPress === 'function')[0].props.onPress());
    expect(handlers.onClose).toHaveBeenCalledTimes(2);
    act(() => tree.unmount());
  });
});
