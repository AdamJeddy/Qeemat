import { CheckPreference, SiteKey } from './types';
import { getSiteByKey } from './sites';

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatRelativeTime(iso?: string): string {
  if (!iso) {
    return 'Never checked';
  }

  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) {
    return 'Just now';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return 'Yesterday';
  }

  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString('en-AE', {
    month: 'short',
    day: 'numeric'
  });
}

export function formatSnapshotTime(iso: string): string {
  return new Date(iso).toLocaleString('en-AE', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function normalizeCheckPreference(preference: string | undefined): CheckPreference {
  if (preference === 'weekly') {
    return 'weekly';
  }

  if (preference === 'every_3_days') {
    return 'every_3_days';
  }

  if (preference === 'daily') {
    return 'daily';
  }

  // Older local builds stored more aggressive frequencies. Normalize them to daily
  // so existing users do not silently lose check cadence after upgrading.
  if (preference === 'few_times' || preference === 'often') {
    return 'daily';
  }

  return 'daily';
}

/** Returns the minimum hours between checks based on the user's
 *  check-preference, clamped to the site's minimum if one exists. */
export function minimumCheckIntervalHours(preference: string, siteKey?: SiteKey): number {
  const normalized = normalizeCheckPreference(preference);

  let interval: number;
  if (normalized === 'weekly') {
    interval = 24 * 7;
  } else if (normalized === 'every_3_days') {
    interval = 24 * 3;
  } else {
    interval = 24;
  }

  // Clamp to the site's minimum if it's higher
  if (siteKey) {
    const site = getSiteByKey(siteKey);
    if (site.minimumIntervalHours && site.minimumIntervalHours > interval) {
      interval = site.minimumIntervalHours;
    }
  }

  return interval;
}

/** Returns the check preferences that are valid for a given site.
 *  Options whose interval would be shorter than the site minimum are excluded. */
export function availableCheckPreferences(siteKey?: SiteKey): CheckPreference[] {
  const all: CheckPreference[] = ['daily', 'every_3_days', 'weekly'];

  if (!siteKey) {
    return all;
  }

  const site = getSiteByKey(siteKey);
  if (!site.minimumIntervalHours) {
    return all;
  }

  return all.filter((pref) => minimumCheckIntervalHours(pref, siteKey) >= site.minimumIntervalHours!);
}

export function isDueForCheck(lastCheckedAt: string | undefined, preference: string, siteKey?: SiteKey): boolean {
  if (!lastCheckedAt) {
    return true;
  }

  const elapsedHours = (Date.now() - new Date(lastCheckedAt).getTime()) / 3600000;
  return elapsedHours >= minimumCheckIntervalHours(preference, siteKey);
}
