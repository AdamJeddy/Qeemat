import React from 'react';
import { Alert, Linking, NativeModules, Platform, Pressable } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { UpdateNotice } from './UpdateNotice';
import { AppText } from './AppText';
import { checkForUpdate } from '../domain/updates';
import {
  cancelInAppUpdateDownload,
  installInAppUpdate,
  openInAppInstallSettings,
  readInAppUpdateDownloadState,
  startInAppUpdateDownload,
  supportsInAppUpdate
} from '../domain/appUpdate';

jest.mock('../domain/updates', () => ({ checkForUpdate: jest.fn() }));
jest.mock('../domain/appUpdate', () => ({
  supportsInAppUpdate: jest.fn(),
  startInAppUpdateDownload: jest.fn(),
  readInAppUpdateDownloadState: jest.fn(),
  installInAppUpdate: jest.fn(),
  openInAppInstallSettings: jest.fn(),
  cancelInAppUpdateDownload: jest.fn()
}));

const check = checkForUpdate as jest.Mock;
const supported = supportsInAppUpdate as jest.Mock;
const startDownload = startInAppUpdateDownload as jest.Mock;
const readState = readInAppUpdateDownloadState as jest.Mock;
const install = installInAppUpdate as jest.Mock;
const openSettings = openInAppInstallSettings as jest.Mock;
const cancelDownload = cancelInAppUpdateDownload as jest.Mock;

const trees: renderer.ReactTestRenderer[] = [];

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const apk = {
  url: 'https://github.com/AdamJeddy/Qeemat/releases/download/v0.6.1-alpha/qeemat.apk',
  name: 'qeemat.apk',
  size: 1000,
  sha256: 'a'.repeat(64)
};
const release = (version = '0.6.1-alpha') => ({
  version,
  url: `https://github.com/AdamJeddy/Qeemat/releases/tag/v${version}`,
  apk
});

function findButton(tree: renderer.ReactTestRenderer, label: string) {
  const matches = tree.root.findAllByProps({ accessibilityLabel: label }).filter((node) => typeof node.props.onPress === 'function');
  if (!matches.length) { throw new Error(`No pressable with label ${label}`); }
  return matches[0];
}

describe('UpdateNotice', () => {
  beforeEach(() => {
    Platform.OS = 'android';
    NativeModules.QeematBackgroundCheck = { getConstants: () => ({ appVersion: '0.5.5-alpha' }) };
    check.mockReset();
    supported.mockReset().mockReturnValue(true);
    startDownload.mockReset().mockResolvedValue(undefined);
    readState.mockReset();
    install.mockReset().mockResolvedValue({ started: true });
    openSettings.mockReset().mockResolvedValue(true);
    cancelDownload.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => { trees.splice(0).forEach((tree) => tree.unmount()); });
  });

  it('shows a newer release, opens GitHub, and can be dismissed', async () => {
    const url = 'https://github.com/AdamJeddy/Qeemat/releases/tag/v0.6-alpha';
    check.mockResolvedValue({ version: '0.6-alpha', url });
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<UpdateNotice />); });
    trees.push(tree!);
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
    trees.push(tree!);
    expect(tree!.toJSON()).toBeNull();
    act(() => { tree!.update(<UpdateNotice visible />); });
    expect(tree!.root.findAllByProps({ accessibilityLabel: 'Dismiss update notice' }).length).toBeGreaterThan(0);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('shows nothing if there is no newer release', async () => {
    check.mockResolvedValue(undefined);
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<UpdateNotice />); });
    trees.push(tree!);
    expect(tree!.toJSON()).toBeNull();
  });

  it('reports if the release page cannot be opened', async () => {
    check.mockResolvedValue({ version: '0.6-alpha', url: 'https://github.com/AdamJeddy/Qeemat/releases/tag/v0.6-alpha' });
    const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('unavailable'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<UpdateNotice />); });
    trees.push(tree!);
    await act(async () => { tree!.root.findByProps({ accessibilityRole: 'link' }).props.onPress(); });
    expect(alert).toHaveBeenCalledWith('Could not open GitHub', 'Please try again later.');
    open.mockRestore(); alert.mockRestore();
  });

  it('downloads the update in the app and opens the installer', async () => {
    check.mockResolvedValue(release());
    readState
      .mockResolvedValueOnce({ state: 'downloading', downloadedBytes: 500, totalBytes: 1000 })
      .mockResolvedValueOnce({ state: 'ready', downloadedBytes: 1000, totalBytes: 1000 });
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<UpdateNotice />); });
    trees.push(tree!);
    expect(findButton(tree!, 'Download and install Qeemat 0.6.1-alpha')).toBeDefined();

    await act(async () => { findButton(tree!, 'Download and install Qeemat 0.6.1-alpha').props.onPress(); });
    await act(async () => { await wait(1000); });

    expect(startDownload).toHaveBeenCalledWith(apk);
    expect(install).toHaveBeenCalledTimes(1);
    expect(tree!.root.findAllByType(AppText).some((item) => item.props.children === 'Follow the Android prompt to finish installing the update.')).toBe(true);
  });

  it('asks for install permission and opens the Android settings', async () => {
    check.mockResolvedValue(release());
    readState.mockResolvedValue({ state: 'ready', downloadedBytes: 1000, totalBytes: 1000 });
    install.mockResolvedValue({ started: false, permissionRequired: true });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<UpdateNotice />); });
    trees.push(tree!);
    await act(async () => { findButton(tree!, 'Download and install Qeemat 0.6.1-alpha').props.onPress(); });
    await act(async () => { await wait(900); });

    const permissionAlert = alert.mock.calls.find((call) => call[0] === 'Allow updates from Qeemat');
    expect(permissionAlert).toBeDefined();
    const openButton = (permissionAlert?.[2] as { text: string; onPress?: () => void }[]).find((button) => button.text === 'Open settings');
    await act(async () => { openButton?.onPress?.(); });
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(findButton(tree!, 'Install Qeemat 0.6.1-alpha update')).toBeDefined();
    alert.mockRestore();
  });

  it('shows a download error and retries', async () => {
    check.mockResolvedValue(release());
    readState.mockResolvedValue({ state: 'failed', downloadedBytes: 0, totalBytes: 1000, error: 'The downloaded update was incomplete. Please try again.' });
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<UpdateNotice />); });
    trees.push(tree!);
    await act(async () => { findButton(tree!, 'Download and install Qeemat 0.6.1-alpha').props.onPress(); });
    await act(async () => { await wait(900); });
    expect(tree!.root.findAllByType(AppText).some((item) => item.props.children === 'The downloaded update was incomplete. Please try again.')).toBe(true);
    expect(tree!.root.findAllByType(AppText).some((item) => item.props.children === 'Try again')).toBe(true);

    readState.mockReset().mockResolvedValue({ state: 'failed', downloadedBytes: 0, totalBytes: 1000, error: 'still failing' });
    await act(async () => { findButton(tree!, 'Download and install Qeemat 0.6.1-alpha').props.onPress(); });
    await act(async () => { await wait(100); });
    expect(startDownload).toHaveBeenCalledTimes(2);
  });

  it('cancels a running download and returns to the download action', async () => {
    check.mockResolvedValue(release());
    readState.mockResolvedValue({ state: 'downloading', downloadedBytes: 100, totalBytes: 1000 });
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<UpdateNotice />); });
    trees.push(tree!);
    await act(async () => { findButton(tree!, 'Download and install Qeemat 0.6.1-alpha').props.onPress(); });
    await act(async () => { await wait(500); });
    expect(findButton(tree!, 'Cancel update download')).toBeDefined();

    await act(async () => { findButton(tree!, 'Cancel update download').props.onPress(); });
    expect(cancelDownload).toHaveBeenCalledTimes(1);
    await act(async () => { await wait(500); });
    expect(findButton(tree!, 'Download and install Qeemat 0.6.1-alpha')).toBeDefined();
  });
});
