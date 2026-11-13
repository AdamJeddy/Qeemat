import React from 'react';
import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import type { ReactTestRendererJSON } from 'react-test-renderer';
import { TrendingDown, TrendingUp } from 'lucide-react-native';

import { PriceDirectionBadge } from './PriceDirectionBadge';
import { colors } from '../theme/theme';

function rootJSON(tree: renderer.ReactTestRenderer): ReactTestRendererJSON {
  const json = tree.toJSON();
  if (!json) {
    throw new Error('expected a rendered tree');
  }
  return Array.isArray(json) ? json[0] : json;
}

it('renders a price drop in green with a down trend', () => {
  let tree: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<PriceDirectionBadge direction="down" text="AED 10 lower" />); });

  const icon = tree!.root.findByType(TrendingDown);
  expect(icon.props.color).toBe(colors.green);
  expect(icon.props.size).toBe(13);
  expect(tree!.root.findAllByType(TrendingUp)).toHaveLength(0);

  expect(StyleSheet.flatten(rootJSON(tree!).props.style).backgroundColor).toBe(colors.greenSoft);

  const text = tree!.root.findByType(Text);
  expect(text.props.children).toBe('AED 10 lower');
  expect(StyleSheet.flatten(text.props.style)).toMatchObject({ color: colors.green, fontSize: 12, fontWeight: '600' });
});

it('renders a price rise in amber with an up trend', () => {
  let tree: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<PriceDirectionBadge direction="up" text="AED 25 higher" />); });

  const icon = tree!.root.findByType(TrendingUp);
  expect(icon.props.color).toBe(colors.amber);
  expect(icon.props.size).toBe(13);
  expect(tree!.root.findAllByType(TrendingDown)).toHaveLength(0);

  expect(StyleSheet.flatten(rootJSON(tree!).props.style).backgroundColor).toBe(colors.amberSoft);

  const text = tree!.root.findByType(Text);
  expect(text.props.children).toBe('AED 25 higher');
  expect(StyleSheet.flatten(text.props.style)).toMatchObject({ color: colors.amber, fontSize: 12, fontWeight: '600' });
});
