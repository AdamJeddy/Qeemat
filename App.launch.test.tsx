import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-native-clipboard/clipboard', () => ({ setString: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: require('react-native').View, SafeAreaView: require('react-native').View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('./src/domain/onboarding', () => ({ getOnboardingState: jest.fn().mockResolvedValue({ completed: true }), markOnboardingCompleted: jest.fn() }));
jest.mock('./src/components/UpdateNotice', () => ({ UpdateNotice: () => null }));
jest.mock('./src/domain/discoveryCatalog', () => ({ loadDiscoveryCatalog: jest.fn().mockResolvedValue({ products: [], stale: false, failedCollectionIds: [] }) }));

import App from './App';
import { AppText } from './src/components/AppText';

test('opens on the watchlist when onboarding is complete', async () => {
  let tree: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<App />); await new Promise<void>(resolve => setImmediate(resolve)); });
  const labels = tree!.root.findAllByType(AppText).map(node => node.props.children);
  expect(labels).toContain('Track supported product prices locally.');
  expect(labels).not.toContain('Discover it. Track the price.');
  await act(async () => tree!.unmount());
});
