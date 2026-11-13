import React from 'react';
import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import type { ReactTestRendererJSON } from 'react-test-renderer';
import { CheckCircle2, TrendingDown } from 'lucide-react-native';

import { StatusPill } from './StatusPill';
import { colors } from '../theme/theme';

function rootJSON(tree: renderer.ReactTestRenderer): ReactTestRendererJSON {
  const json = tree.toJSON();
  if (!json) {
    throw new Error('expected a rendered tree');
  }
  return Array.isArray(json) ? json[0] : json;
}

it('shows a neutral check rather than implying a price drop for a price change', () => {
  let tree: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<StatusPill status="price_changed" label="Checked recently" />); });
  expect(tree!.root.findAllByType(TrendingDown)).toHaveLength(0);
  expect(tree!.root.findByType(CheckCircle2).props.color).toBe(colors.primary);
});

it('shows a successful check as neutral blue rather than a green success state', () => {
  let tree: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<StatusPill status="ok" />); });

  const icon = tree!.root.findByType(CheckCircle2);
  expect(icon.props.color).toBe(colors.primary);
  expect(icon.props.color).not.toBe(colors.green);

  const text = tree!.root.findByType(Text);
  expect(text.props.children).toBe('Checked');
  const textStyle = StyleSheet.flatten(text.props.style);
  expect(textStyle.color).toBe(colors.primary);
  expect(textStyle.color).not.toBe(colors.green);

  const pillStyle = StyleSheet.flatten(rootJSON(tree!).props.style);
  expect(pillStyle.backgroundColor).toBe(colors.blueSoft);
  expect(pillStyle.backgroundColor).not.toBe(colors.greenSoft);

  expect(tree!.root.findAll((node) => node.props.color === colors.green)).toHaveLength(0);
});
