import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { Surface } from './Surface';
import { colors, radius, spacing } from '../theme/theme';

function render(element: React.ReactElement): renderer.ReactTestRenderer {
  let tree: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(element); });
  return tree!;
}

function surfaceStyle(tree: renderer.ReactTestRenderer) {
  return StyleSheet.flatten(tree.root.findByType(View).props.style) as Record<string, unknown>;
}

describe('Surface', () => {
  it('renders the flat bordered card role by default', () => {
    const tree = render(<Surface><Text>content</Text></Surface>);
    const style = surfaceStyle(tree);
    expect(style.backgroundColor).toBe(colors.surface);
    expect(style.borderWidth).toBe(1);
    expect(style.borderColor).toBe(colors.border);
    expect(style.borderRadius).toBe(radius.md);
    expect(style.padding).toBe(spacing.lg);
    expect(tree.root.findByType(Text).props.children).toBe('content');
  });

  it('supports muted, accent and plain variants for inset and tinted areas', () => {
    expect(surfaceStyle(render(<Surface variant="muted" />)).backgroundColor).toBe(colors.surfaceMuted);
    expect(surfaceStyle(render(<Surface variant="muted" />)).borderWidth).toBeUndefined();
    expect(surfaceStyle(render(<Surface variant="accent" />)).backgroundColor).toBe(colors.blueSoft);
    expect(surfaceStyle(render(<Surface variant="plain" />)).borderWidth).toBeUndefined();
  });

  it('maps padding and radius tokens', () => {
    expect(surfaceStyle(render(<Surface padding="none" />)).padding).toBe(0);
    expect(surfaceStyle(render(<Surface padding="sm" />)).padding).toBe(spacing.md);
    expect(surfaceStyle(render(<Surface padding="lg" />)).padding).toBe(spacing.xl);
    expect(surfaceStyle(render(<Surface radius="sm" />)).borderRadius).toBe(radius.sm);
    expect(surfaceStyle(render(<Surface radius="lg" />)).borderRadius).toBe(radius.lg);
  });

  it('merges layout overrides and forwards view props', () => {
    const onPress = jest.fn();
    const tree = render(<Surface style={{ flexDirection: 'row', marginTop: 7 }} accessibilityLabel="activity card" />);
    const style = surfaceStyle(tree);
    expect(style.flexDirection).toBe('row');
    expect(style.marginTop).toBe(7);
    expect(tree.root.findByType(View).props.accessibilityLabel).toBe('activity card');
    expect(onPress).not.toHaveBeenCalled();
  });
});
