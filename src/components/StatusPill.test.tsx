import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { CheckCircle2, TrendingDown } from 'lucide-react-native';

import { StatusPill } from './StatusPill';
import { colors } from '../theme/theme';

it('shows a neutral check rather than implying a price drop for a price change', () => {
  let tree: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<StatusPill status="price_changed" label="Checked recently" />); });
  expect(tree!.root.findAllByType(TrendingDown)).toHaveLength(0);
  expect(tree!.root.findByType(CheckCircle2).props.color).toBe(colors.primary);
});
