import React from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { AppText } from './AppText';
import { FontScaleContext } from '../theme/FontScaleContext';

it('updates measured text sizes when the system font scale changes', () => {
  let tree: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<FontScaleContext.Provider value={0.9}><AppText>Watchlist</AppText></FontScaleContext.Provider>); });
  const initialSize = tree!.root.findByType(Text).props.style[1].fontSize;
  act(() => { tree!.update(<FontScaleContext.Provider value={1.3}><AppText>Watchlist</AppText></FontScaleContext.Provider>); });
  expect(tree!.root.findByType(Text).props.style[1].fontSize).toBeGreaterThan(initialSize);
});
