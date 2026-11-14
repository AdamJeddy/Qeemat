import { findNewerRelease, checkForUpdate, selectUpdateApk } from '../updates';

const release = (tag: string, prerelease = true) => ({ tag_name: tag, prerelease, draft: false, assets: [{ name: 'qeemat.apk' }] });
const asset = (name: string, overrides: Record<string, unknown> = {}) => ({
  name,
  browser_download_url: `https://github.com/AdamJeddy/Qeemat/releases/download/v0.6.0-alpha/${name}`,
  size: 25621040,
  digest: `sha256:${'a'.repeat(64)}`,
  ...overrides
});
const releaseWithAssets = (tag: string, assets: unknown[], prerelease = true) => ({ tag_name: tag, prerelease, draft: false, assets });

describe('GitHub releases', () => {
  it('finds the highest newer downloadable alpha or stable version for an alpha install', () => {
    expect(findNewerRelease('0.5.5-alpha', [release('v0.5-alpha'), release('v0.6-alpha.2'), release('v0.6-alpha.10')])).toEqual({
      version: '0.6-alpha.10', url: 'https://github.com/AdamJeddy/Qeemat/releases/tag/v0.6-alpha.10'
    });
  });
  it('only offers stable releases to stable installs and handles prerelease ordering', () => {
    expect(findNewerRelease('0.6.0', [release('v0.7.0-beta'), release('v0.6.1', false)])?.version).toBe('0.6.1');
    expect(findNewerRelease('0.6.0-alpha.2', [release('v0.6.0-alpha.1'), release('v0.6.0', false)])?.version).toBe('0.6.0');
  });
  it('ignores invalid versions, drafts, releases without APKs, and same or older builds', () => {
    expect(findNewerRelease('0.5.5-alpha', [release('Alpha'), release('v0.5.5-alpha'), { ...release('v9.0'), draft: true }, { ...release('v10.0'), assets: [] }])).toBeUndefined();
    expect(findNewerRelease('unknown', [release('v10.0')])).toBeUndefined();
  });
  it('fails quietly if GitHub is unreachable or returns an error', async () => {
    const failed = jest.fn().mockRejectedValue(new Error('offline'));
    expect(await checkForUpdate('0.5.5-alpha', failed)).toBeUndefined();
    const badResponse = jest.fn().mockResolvedValue({ ok: false });
    expect(await checkForUpdate('0.5.5-alpha', badResponse)).toBeUndefined();
  });
  it('reads published releases from GitHub', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => [release('v0.6-alpha')] });
    expect((await checkForUpdate('0.5.5-alpha', fetcher))?.version).toBe('0.6-alpha');
    expect(fetcher).toHaveBeenCalledWith('https://api.github.com/repos/AdamJeddy/Qeemat/releases?per_page=100', expect.any(Object));
  });
});

describe('update APK assets', () => {
  it('exposes the APK download link, size and SHA-256 digest', () => {
    const update = findNewerRelease('0.5.5-alpha', [releaseWithAssets('v0.6.0-alpha', [asset('qeemat-v0_6_0_alpha.apk')])]);
    expect(update?.apk).toEqual({
      url: 'https://github.com/AdamJeddy/Qeemat/releases/download/v0.6.0-alpha/qeemat-v0_6_0_alpha.apk',
      name: 'qeemat-v0_6_0_alpha.apk',
      size: 25621040,
      sha256: 'a'.repeat(64)
    });
  });
  it('prefers the arm64 build for a device release over other ABI assets', () => {
    const update = findNewerRelease('0.5.5-alpha', [releaseWithAssets('v0.6.0-alpha', [
      asset('qeemat-x86_64.apk'), asset('qeemat-universal.apk'), asset('qeemat-arm64-v8a.apk')
    ])]);
    expect(update?.apk?.name).toBe('qeemat-arm64-v8a.apk');
  });
  it('keeps the release but omits an APK when the asset data is incomplete', () => {
    const update = findNewerRelease('0.5.5-alpha', [releaseWithAssets('v0.6.0-alpha', [
      asset('qeemat.apk', { browser_download_url: undefined }),
      asset('qeemat-2.apk', { size: 0 })
    ])]);
    expect(update?.version).toBe('0.6.0-alpha');
    expect(update?.apk).toBeUndefined();
  });
  it('accepts an asset without a digest so older releases still install', () => {
    const update = findNewerRelease('0.5.5-alpha', [releaseWithAssets('v0.6.0-alpha', [asset('qeemat.apk', { digest: undefined })])]);
    expect(update?.apk).toEqual({
      url: 'https://github.com/AdamJeddy/Qeemat/releases/download/v0.6.0-alpha/qeemat.apk',
      name: 'qeemat.apk', size: 25621040, sha256: undefined
    });
    const unrecognized = findNewerRelease('0.5.5-alpha', [releaseWithAssets('v0.6.0-alpha', [asset('qeemat.apk', { digest: 'md5:1234' })])]);
    expect(unrecognized?.apk?.sha256).toBeUndefined();
  });
  it('ignores non-APK assets', () => {
    expect(selectUpdateApk([asset('qeemat.apk'), { name: 'notes.txt', browser_download_url: 'https://github.com/x', size: 10 }])?.name).toBe('qeemat.apk');
    expect(selectUpdateApk(undefined)).toBeUndefined();
    expect(selectUpdateApk('assets')).toBeUndefined();
  });
});



describe('device ABI selection', () => {
  it('picks the APK for a non-arm64 device even when an arm64 build is listed first', () => {
    const update = findNewerRelease('0.5.5-alpha', [releaseWithAssets('v0.6.0-alpha', [
      asset('qeemat-arm64-v8a.apk'), asset('qeemat-armeabi-v7a.apk')
    ])], ['armeabi-v7a', 'armeabi']);
    expect(update?.apk?.name).toBe('qeemat-armeabi-v7a.apk');
  });
  it('prefers the device primary ABI and accepts universal builds', () => {
    const x86 = findNewerRelease('0.5.5-alpha', [releaseWithAssets('v0.6.0-alpha', [
      asset('qeemat-x86.apk'), asset('qeemat-x86_64.apk')
    ])], ['x86_64', 'x86']);
    expect(x86?.apk?.name).toBe('qeemat-x86_64.apk');
    const universal = findNewerRelease('0.5.5-alpha', [releaseWithAssets('v0.6.0-alpha', [
      asset('qeemat-universal.apk')
    ])], ['armeabi-v7a']);
    expect(universal?.apk?.name).toBe('qeemat-universal.apk');
  });
  it('offers the release without an APK when no asset supports the device', () => {
    const update = findNewerRelease('0.5.5-alpha', [releaseWithAssets('v0.6.0-alpha', [
      asset('qeemat-arm64-v8a.apk')
    ])], ['armeabi-v7a', 'armeabi']);
    expect(update?.version).toBe('0.6.0-alpha');
    expect(update?.apk).toBeUndefined();
  });
  it('passes the device ABIs through checkForUpdate', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [releaseWithAssets('v0.6.0-alpha', [asset('qeemat-arm64-v8a.apk'), asset('qeemat-armeabi-v7a.apk')])]
    });
    const update = await checkForUpdate('0.5.5-alpha', fetcher, ['armeabi-v7a']);
    expect(update?.apk?.name).toBe('qeemat-armeabi-v7a.apk');
  });
});
