import React from 'react';
import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { DiscoveryBrowseSheet } from '../DiscoveryBrowseSheet';
import { AppText } from '../AppText';
import { DISCOVERY_SOURCE_MAPS } from '../../domain/discoverySources';

describe('DiscoveryBrowseSheet', () => {
  const onClose = jest.fn();
  const onCategory = jest.fn();
  const onRetailer = jest.fn();
  const onCollection = jest.fn();
  beforeEach(() => jest.clearAllMocks());

  function renderSheet() {
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<DiscoveryBrowseSheet visible onClose={onClose} onCategory={onCategory} onRetailer={onRetailer} onCollection={onCollection} />); });
    return tree!;
  }

  it('lets someone choose an individual department from a group', () => {
    const tree = renderSheet();
    act(() => tree.root.findByProps({ accessibilityLabel: 'Browse Style departments' }).props.onPress());
    act(() => tree.root.findByProps({ accessibilityLabel: 'Browse Footwear' }).props.onPress());
    expect(onCategory).toHaveBeenCalledWith('footwear');
    act(() => tree.unmount());
  });

  it('searches departments directly and explains when no results match', () => {
    const tree = renderSheet();
    const input = tree.root.findByProps({ accessibilityLabel: 'Search departments' });
    act(() => input.props.onChangeText('skincare'));
    act(() => tree.root.findByProps({ accessibilityLabel: 'Browse Skincare' }).props.onPress());
    expect(onCategory).toHaveBeenCalledWith('skincare');
    act(() => input.props.onChangeText('no such department'));
    expect(JSON.stringify(tree.toJSON())).toContain('No departments found');
    expect(tree.root.findAllByType(TextInput)).toHaveLength(1);
    act(() => tree.unmount());
  });

  it('returns from a department group to the group list', () => {
    const tree = renderSheet();
    act(() => tree.root.findByProps({ accessibilityLabel: 'Browse Style departments' }).props.onPress());
    act(() => tree.root.findByProps({ accessibilityLabel: 'Go back' }).props.onPress());
    expect(tree.root.findByProps({ accessibilityLabel: 'Browse Technology departments' })).toBeDefined();
    expect(onClose).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('lets someone browse a store or inspect its categories and source URLs', () => {
    const tree = renderSheet();
    act(() => tree.root.findByProps({ accessibilityLabel: 'Stores' }).props.onPress());
    act(() => tree.root.findByProps({ accessibilityLabel: 'Browse products at Noon UAE' }).props.onPress());
    expect(onRetailer).toHaveBeenCalledWith('noon');
    act(() => tree.root.findByProps({ accessibilityLabel: 'Choose categories at Noon UAE' }).props.onPress());
    const source = DISCOVERY_SOURCE_MAPS.find((item) => item.siteKey === 'noon')!;
    const text = () => tree.root.findAllByType(AppText).map((node) => [node.props.children].flat().join('')).join(' ');
    expect(text()).not.toContain('Accessories 16176');
    act(() => tree.root.findByProps({ accessibilityLabel: `Browse ${source.label} at Noon` }).props.onPress());
    expect(onCollection).toHaveBeenCalledWith(source);
    act(() => tree.root.findByProps({ accessibilityLabel: `Source details for ${source.label} at Noon` }).props.onPress());
    expect(tree.root.findByProps({ accessibilityLabel: `Review source URL for ${source.label}` })).toBeDefined();
    expect(text()).toContain('Accessories 16176');
    act(() => tree.unmount());
  });
});
