import { findNewerRelease, checkForUpdate } from '../updates';

const release = (tag: string, prerelease = true) => ({ tag_name: tag, prerelease, draft: false, assets: [{ name: 'qeemat.apk' }] });

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
