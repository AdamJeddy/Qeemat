import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { AppText } from './AppText';
import { SourceLabel } from './SourceLabel';
import { colors, typography } from '../theme/theme';

it('renders provenance as muted text, never a colored success badge', () => {
  let tree: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<SourceLabel source="background" />); });

  const label = tree!.root.findByType(AppText);
  expect(label.props.children).toBe('Background');
  expect(label.props.muted).toBe(true);

  const text = tree!.root.findByType(Text);
  const textStyle = StyleSheet.flatten(text.props.style);
  expect(textStyle.color).toBe(colors.textMuted);
  expect(textStyle.color).not.toBe(colors.green);
  expect(textStyle.backgroundColor).toBeUndefined();
  expect(textStyle.fontSize).toBe(typography.caption.fontSize);
  expect(textStyle.lineHeight).toBe(typography.caption.lineHeight);

  // No green tone is applied anywhere, and provenance has no badge container.
  expect(JSON.stringify(tree!.toJSON())).not.toContain(colors.green);
  expect(JSON.stringify(tree!.toJSON())).not.toContain(colors.greenSoft);
  expect(tree!.root.findAll((node) => node.props.color === colors.green || node.props.backgroundColor === colors.greenSoft)).toHaveLength(0);
  expect(tree!.root.findAll((node) => node.type === View)).toHaveLength(0);
});

it('keeps the existing source labels', () => {
  let tree: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<SourceLabel source="manual_batch" />); });

  expect(tree!.root.findByType(AppText).props.children).toBe('Recheck all');
});
