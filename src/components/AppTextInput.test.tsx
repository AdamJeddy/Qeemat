import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { AppText } from './AppText';
import { AppTextInput } from './AppTextInput';
import { FontScaleContext } from '../theme/FontScaleContext';
import { colors, typography } from '../theme/theme';

function render(element: React.ReactElement): renderer.ReactTestRenderer {
  let tree: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(element); });
  return tree!;
}

function fieldBorderColor(tree: renderer.ReactTestRenderer): string | undefined {
  const fields = tree.root.findAllByType(View).filter((node) => {
    const style = StyleSheet.flatten(node.props.style) as { minHeight?: number } | undefined;
    return style?.minHeight === 52;
  });
  return fields.length ? (StyleSheet.flatten(fields[0].props.style) as { borderColor?: string }).borderColor : undefined;
}

describe('AppTextInput', () => {
  it('renders its label and hint and associates the label for accessibility', () => {
    const change = jest.fn();
    const tree = render(
      <AppTextInput label="Product URL" hint="Paste a link" value="" onChangeText={change} placeholder="https://" />
    );
    expect(tree.root.findAllByType(AppText).some((item) => item.props.children === 'Product URL')).toBe(true);
    expect(tree.root.findAllByType(AppText).some((item) => item.props.children === 'Paste a link')).toBe(true);
    const input = tree.root.findByType(TextInput);
    expect(input.props.accessibilityLabel).toBe('Product URL');
    expect(input.props.placeholderTextColor).toBe(colors.textMuted);
    act(() => { input.props.onChangeText('https://www.noon.com'); });
    expect(change).toHaveBeenCalledWith('https://www.noon.com');
  });

  it('keeps the accessibility label override and the same 1.3 text cap as AppText', () => {
    const tree = render(
      <FontScaleContext.Provider value={1.5}>
        <AppTextInput label="URL" accessibilityLabel="Product URL field" value="" onChangeText={jest.fn()} />
      </FontScaleContext.Provider>
    );
    const input = tree.root.findByType(TextInput);
    const style = StyleSheet.flatten(input.props.style) as { fontSize: number; lineHeight: number };
    expect(input.props.accessibilityLabel).toBe('Product URL field');
    expect(input.props.allowFontScaling).toBe(false);
    expect(style.fontSize).toBeCloseTo(typography.body.fontSize * 1.3);
    expect(style.lineHeight).toBeCloseTo(typography.body.lineHeight * 1.3);
  });

  it('marks focus and errors on the field and announces the error', () => {
    const tree = render(<AppTextInput value="" onChangeText={jest.fn()} />);
    expect(fieldBorderColor(tree)).toBe(colors.borderStrong);
    act(() => { tree.root.findByType(TextInput).props.onFocus({}); });
    expect(fieldBorderColor(tree)).toBe(colors.primary);
    act(() => { tree.root.findByType(TextInput).props.onBlur({}); });
    act(() => { tree.update(<AppTextInput value="" onChangeText={jest.fn()} error="Enter a valid URL" />); });
    expect(fieldBorderColor(tree)).toBe(colors.red);
    expect(tree.root.findAllByType(AppText).some((item) => item.props.children === 'Enter a valid URL')).toBe(true);
    expect(tree.root.findAllByType(AppText).some((item) => item.props.accessibilityLiveRegion === 'polite')).toBe(true);
  });

  it('fills the whole field so the visible control is the touch target', () => {
    const tree = render(<AppTextInput value="" onChangeText={jest.fn()} />);
    const field = tree.root.findAllByType(View).find((node) => {
      const style = StyleSheet.flatten(node.props.style) as { minHeight?: number } | undefined;
      return style?.minHeight === 52;
    });
    const fieldStyle = StyleSheet.flatten(field!.props.style) as { alignItems?: string };
    const inputStyle = StyleSheet.flatten(tree.root.findByType(TextInput).props.style) as {
      flex?: number;
      textAlignVertical?: string;
    };
    expect(fieldStyle.alignItems).toBe('stretch');
    expect(inputStyle.flex).toBe(1);
    expect(inputStyle.textAlignVertical).toBe('center');
  });

  it('renders leading and trailing accessories around the input', () => {
    const tree = render(
      <AppTextInput leading={<AppText>AED</AppText>} trailing={<AppText>Clear</AppText>} value="" onChangeText={jest.fn()} />
    );
    expect(tree.root.findAllByType(AppText).map((item) => item.props.children)).toEqual(['AED', 'Clear']);
  });

  it('renders only the input in bare mode so it can live in a custom row', () => {
    const tree = render(
      <AppTextInput bare label="Search" value="" onChangeText={jest.fn()} placeholder="Search products" />
    );
    expect(tree.root.findAllByType(View)).toHaveLength(0);
    expect(tree.root.findAllByType(AppText)).toHaveLength(0);
    expect(tree.root.findByType(TextInput).props.placeholder).toBe('Search products');
  });
});
