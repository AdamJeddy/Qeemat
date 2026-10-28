import React from 'react';
import { Alert, Linking, NativeModules, Platform, Pressable } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { UpdateNotice } from './UpdateNotice';
import { AppText } from './AppText';
import { checkForUpdate } from '../domain/updates';

jest.mock('../domain/updates', () => ({ checkForUpdate: jest.fn() }));
const check = checkForUpdate as jest.Mock;

describe('UpdateNotice', () => {
  beforeEach(() => {
    Platform.OS = 'android';
    NativeModules.QeematBackgroundCheck = { getConstants: () => ({ appVersion: '0.5.5-alpha' }) };
    check.mockReset();
  });
  it('shows a newer release, opens GitHub, and can be dismissed', async () => {
    const url = 'https://github.com/AdamJeddy/Qeemat/releases/tag/v0.6-alpha';
    check.mockResolvedValue({ version: '0.6-alpha', url });
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<UpdateNotice />); });
    expect(check).toHaveBeenCalledWith('0.5.5-alpha');
    expect(tree!.root.findAllByType(AppText).some((item) => Array.isArray(item.props.children) && item.props.children.join('') === 'Qeemat 0.6-alpha is available')).toBe(true);
    await act(async () => { tree!.root.findByProps({ accessibilityRole: 'link' }).props.onPress(); });
    expect(open).toHaveBeenCalledWith(url);
    act(() => { tree!.root.findByProps({ accessibilityLabel: 'Dismiss update notice' }).props.onPress(); });
    expect(tree!.root.findAllByType(Pressable)).toHaveLength(0);
    open.mockRestore();
  });
  it('hides on other screens without losing the notice or fetching again', async () => {
    check.mockResolvedValue({ version: '0.6-alpha', url: 'https://github.com/AdamJeddy/Qeemat/releases/tag/v0.6-alpha' });
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<UpdateNotice visible={false} />); });
    expect(tree!.toJSON()).toBeNull();
    act(() => { tree!.update(<UpdateNotice visible />); });
    expect(tree!.root.findAllByProps({ accessibilityLabel: 'Dismiss update notice' }).length).toBeGreaterThan(0);
    expect(check).toHaveBeenCalledTimes(1);
  });
  it('shows nothing if there is no newer release', async () => {
    check.mockResolvedValue(undefined);
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<UpdateNotice />); });
    expect(tree!.toJSON()).toBeNull();
  });
  it('reports if the release page cannot be opened', async () => {
    check.mockResolvedValue({ version: '0.6-alpha', url: 'https://github.com/AdamJeddy/Qeemat/releases/tag/v0.6-alpha' });
    const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('unavailable'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<UpdateNotice />); });
    await act(async () => { tree!.root.findByProps({ accessibilityRole: 'link' }).props.onPress(); });
    expect(alert).toHaveBeenCalledWith('Could not open GitHub', 'Please try again later.');
    open.mockRestore(); alert.mockRestore();
  });
});
