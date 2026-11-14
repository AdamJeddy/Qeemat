import React from 'react';
import { Alert, Linking } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { UpdateNotice } from './UpdateNotice';
import { AppText } from './AppText';
import {
  cancelInAppUpdateDownload,
  installInAppUpdate,
  openInAppInstallSettings,
  readInAppUpdateDownloadState,
  startInAppUpdateDownload,
  supportsInAppUpdate
} from '../domain/appUpdate';

jest.mock('../domain/appUpdate', () => ({
  supportsInAppUpdate: jest.fn(),
  startInAppUpdateDownload: jest.fn(),
  readInAppUpdateDownloadState: jest.fn(),
  installInAppUpdate: jest.fn(),
  openInAppInstallSettings: jest.fn(),
  cancelInAppUpdateDownload: jest.fn()
}));

const supported = supportsInAppUpdate as jest.Mock;
const startDownload = startInAppUpdateDownload as jest.Mock;
const readState = readInAppUpdateDownloadState as jest.Mock;
const install = installInAppUpdate as jest.Mock;
const openSettings = openInAppInstallSettings as jest.Mock;
const cancelDownload = cancelInAppUpdateDownload as jest.Mock;

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const apk = {
  url: 'https://github.com/AdamJeddy/Qeemat/releases/download/v0.6.1-alpha/qeemat.apk',
  name: 'qeemat.apk',
  size: 1000,
  sha256: 'a'.repeat(64)
};
const update = {
  version: '0.6.1-alpha',
  url: 'https://github.com/AdamJeddy/Qeemat/releases/tag/v0.6.1-alpha',
  apk
};

const trees: renderer.ReactTestRenderer[] = [];

function findButton(tree: renderer.ReactTestRenderer, label: string) {
  const matches = tree.root.findAllByProps({ accessibilityLabel: label }).filter((node) => typeof node.props.onPress === 'function');
  if (!matches.length) { throw new Error(`No pressable with label ${label}`); }
  return matches[0];
}

async function renderNotice(props: Partial<React.ComponentProps<typeof UpdateNotice>> = {}) {
  const onDismiss = jest.fn();
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<UpdateNotice update={update} onDismiss={onDismiss} {...props} />);
  });
  trees.push(tree!);
  return { tree: tree!, onDismiss };
}

describe('UpdateNotice', () => {
  beforeEach(() => {
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

  it('shows the update popup and dismisses it for this version', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { tree, onDismiss } = await renderNotice();
    expect(tree.root.findAllByType(AppText).some((item) => item.props.children === 'Update available')).toBe(true);
    expect(tree.root.findAllByType(AppText).some((item) => item.props.children === 'Qeemat 0.6.1-alpha is ready to install.')).toBe(true);
    expect(findButton(tree, 'Download and install Qeemat 0.6.1-alpha')).toBeDefined();

    await act(async () => { findButton(tree, 'Release notes for Qeemat 0.6.1-alpha').props.onPress(); });
    expect(open).toHaveBeenCalledWith(update.url);

    act(() => { findButton(tree, 'Dismiss update notice').props.onPress(); });
    expect(onDismiss).toHaveBeenCalledWith('0.6.1-alpha');
    open.mockRestore();
  });

  it('renders nothing when there is no update or it is hidden', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<UpdateNotice onDismiss={jest.fn()} />); });
    expect(tree!.toJSON()).toBeNull();
    const hidden = await renderNotice({ visible: false });
    expect(hidden.tree.toJSON()).toBeNull();
  });

  it('offers the GitHub release page when in-app installs are unavailable', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { tree } = await renderNotice({ update: { version: '0.6.1-alpha', url: update.url } });
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Download and install Qeemat 0.6.1-alpha' })).toHaveLength(0);
    await act(async () => { tree.root.findByProps({ accessibilityRole: 'link' }).props.onPress(); });
    expect(open).toHaveBeenCalledWith(update.url);
    open.mockRestore();
  });

  it('downloads the update and opens the installer', async () => {
    readState
      .mockResolvedValueOnce({ state: 'downloading', downloadedBytes: 500, totalBytes: 1000 })
      .mockResolvedValueOnce({ state: 'ready', downloadedBytes: 1000, totalBytes: 1000 });
    const { tree } = await renderNotice();
    await act(async () => { findButton(tree, 'Download and install Qeemat 0.6.1-alpha').props.onPress(); });
    await act(async () => { await wait(1000); });

    expect(startDownload).toHaveBeenCalledWith(apk);
    expect(install).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType(AppText).some((item) => item.props.children === 'Follow the Android prompt to finish installing.')).toBe(true);
  });

  it('asks for install permission and opens the Android settings', async () => {
    readState.mockResolvedValue({ state: 'ready', downloadedBytes: 1000, totalBytes: 1000 });
    install.mockResolvedValue({ started: false, permissionRequired: true });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { tree } = await renderNotice();
    await act(async () => { findButton(tree, 'Download and install Qeemat 0.6.1-alpha').props.onPress(); });
    await act(async () => { await wait(900); });

    const permissionAlert = alert.mock.calls.find((call) => call[0] === 'Allow updates from Qeemat');
    expect(permissionAlert).toBeDefined();
    const openButton = (permissionAlert?.[2] as { text: string; onPress?: () => void }[]).find((button) => button.text === 'Open settings');
    await act(async () => { openButton?.onPress?.(); });
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(findButton(tree, 'Install Qeemat 0.6.1-alpha update')).toBeDefined();
    alert.mockRestore();
  });

  it('shows a download error and retries', async () => {
    readState.mockResolvedValue({ state: 'failed', downloadedBytes: 0, totalBytes: 1000, error: 'The downloaded update was incomplete. Please try again.' });
    const { tree } = await renderNotice();
    await act(async () => { findButton(tree, 'Download and install Qeemat 0.6.1-alpha').props.onPress(); });
    await act(async () => { await wait(900); });
    expect(tree.root.findAllByType(AppText).some((item) => item.props.children === 'The downloaded update was incomplete. Please try again.')).toBe(true);
    expect(tree.root.findAllByType(AppText).some((item) => item.props.children === 'Update download failed')).toBe(true);

    await act(async () => { findButton(tree, 'Download and install Qeemat 0.6.1-alpha').props.onPress(); });
    await act(async () => { await wait(100); });
    expect(startDownload).toHaveBeenCalledTimes(2);
  });

  it('cancels a running download and returns to the download action', async () => {
    readState.mockResolvedValue({ state: 'downloading', downloadedBytes: 100, totalBytes: 1000 });
    const { tree } = await renderNotice();
    await act(async () => { findButton(tree, 'Download and install Qeemat 0.6.1-alpha').props.onPress(); });
    await act(async () => { await wait(500); });
    expect(findButton(tree, 'Cancel update download')).toBeDefined();

    await act(async () => { findButton(tree, 'Cancel update download').props.onPress(); });
    expect(cancelDownload).toHaveBeenCalledTimes(1);
    await act(async () => { await wait(500); });
    expect(findButton(tree, 'Download and install Qeemat 0.6.1-alpha')).toBeDefined();
  });

  it('dismissing during a download cancels it and reports the dismissal', async () => {
    readState.mockResolvedValue({ state: 'downloading', downloadedBytes: 100, totalBytes: 1000 });
    const { tree, onDismiss } = await renderNotice();
    await act(async () => { findButton(tree, 'Download and install Qeemat 0.6.1-alpha').props.onPress(); });
    await act(async () => { await wait(500); });

    await act(async () => { findButton(tree, 'Close update dialog').props.onPress(); });
    expect(cancelDownload).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith('0.6.1-alpha');
    act(() => { tree.update(<UpdateNotice update={update} visible={false} onDismiss={onDismiss} />); });
    expect(tree.toJSON()).toBeNull();
  });
});
