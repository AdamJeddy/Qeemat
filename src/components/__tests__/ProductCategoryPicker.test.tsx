import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { ProductCategoryPicker } from '../ProductCategoryPicker';

test('allows a shopper to assign a watched product to a category', () => {
  const onChange = jest.fn();
  let tree: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<ProductCategoryPicker onChange={onChange} />); });
  act(() => tree!.root.findByProps({ accessibilityLabel: 'Choose product category' }).props.onPress());
  act(() => tree!.root.findByProps({ accessibilityLabel: 'Choose Footwear' }).props.onPress());
  expect(onChange).toHaveBeenCalledWith('footwear');
});
