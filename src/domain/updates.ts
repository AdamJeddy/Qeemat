const RELEASES_URL = 'https://api.github.com/repos/AdamJeddy/Qeemat/releases?per_page=100';
const RELEASE_PAGE = 'https://github.com/AdamJeddy/Qeemat/releases/tag/';

type Version = { numbers: number[]; prerelease: string[] };
export type AvailableUpdate = { version: string; url: string };

function parseVersion(value: string): Version | undefined {
  const match = /^v?(\d+)\.(\d+)(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$/.exec(value);
  if (!match) { return undefined; }
  const prerelease = match[4]?.split('.') ?? [];
  if (prerelease.some((part) => !part)) { return undefined; }
  return { numbers: [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)], prerelease };
}

function compareVersions(a: Version, b: Version): number {
  for (let i = 0; i < 3; i++) {
    if (a.numbers[i] !== b.numbers[i]) { return a.numbers[i] > b.numbers[i] ? 1 : -1; }
  }
  if (!a.prerelease.length || !b.prerelease.length) {
    return Number(!a.prerelease.length) - Number(!b.prerelease.length);
  }
  for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i++) {
    const left = a.prerelease[i]; const right = b.prerelease[i];
    if (left === undefined || right === undefined) { return left === undefined ? -1 : 1; }
    if (left === right) { continue; }
    const leftNumber = /^\d+$/.test(left); const rightNumber = /^\d+$/.test(right);
    if (leftNumber && rightNumber) { return Number(left) > Number(right) ? 1 : -1; }
    if (leftNumber !== rightNumber) { return leftNumber ? -1 : 1; }
    return left > right ? 1 : -1;
  }
  return 0;
}

export function findNewerRelease(installedVersion: string, releases: unknown): AvailableUpdate | undefined {
  const installed = parseVersion(installedVersion);
  if (!installed || !Array.isArray(releases)) { return undefined; }
  let newest = installed;
  let result: AvailableUpdate | undefined;
  for (const item of releases) {
    if (!item || typeof item !== 'object' || item.draft !== false || typeof item.tag_name !== 'string' ||
      typeof item.prerelease !== 'boolean' || (!installed.prerelease.length && item.prerelease) ||
      !Array.isArray(item.assets) || !item.assets.some((asset: { name?: unknown }) => typeof asset?.name === 'string' && /\.apk$/i.test(asset.name))) { continue; }
    const version = parseVersion(item.tag_name);
    if (!version || compareVersions(version, newest) <= 0) { continue; }
    newest = version;
    result = { version: item.tag_name.replace(/^v/, ''), url: RELEASE_PAGE + encodeURIComponent(item.tag_name) };
  }
  return result;
}

export async function checkForUpdate(installedVersion: string, fetcher: typeof fetch = fetch): Promise<AvailableUpdate | undefined> {
  if (!parseVersion(installedVersion)) { return undefined; }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetcher(RELEASES_URL, { signal: controller.signal, headers: { Accept: 'application/vnd.github+json' } });
    return response.ok ? findNewerRelease(installedVersion, await response.json()) : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}
