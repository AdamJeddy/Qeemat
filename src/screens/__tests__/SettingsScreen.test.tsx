import React from 'react';
import { Platform } from 'react-native';
import renderer, { act } from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../../domain/notifications', () => ({
  ensureNotificationPermission: jest.fn().mockResolvedValue(false),
  openNotificationSettings: jest.fn()
}));

import { AppText } from '../../components/AppText';
import { SettingsScreen } from '../SettingsScreen';

function renderedText(tree: renderer.ReactTestRenderer): unknown[] {
  return tree.root.findAllByType(AppText).map(node => node.props.children);
}

describe('SettingsScreen platform controls', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  it('shows Android battery optimization controls on Android', async () => {
    Platform.OS = 'android';
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(<SettingsScreen />);
      await Promise.resolve();
    });

    expect(renderedText(tree!).includes('Battery optimization')).toBe(true);
  });

  it('hides Android battery optimization controls on iOS', async () => {
    Platform.OS = 'ios';
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(<SettingsScreen />);
      await Promise.resolve();
    });

    expect(renderedText(tree!).includes('Battery optimization')).toBe(false);
    expect(renderedText(tree!).some(value => Array.isArray(value) && value.includes('iOS'))).toBe(true);
  });
});
