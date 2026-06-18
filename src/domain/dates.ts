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

export function minimumCheckIntervalHours(preference: string): number {
  if (preference === 'often') {
    return 3;
  }

  if (preference === 'few_times') {
    return 8;
  }

  return 24;
}

export function isDueForCheck(lastCheckedAt: string | undefined, preference: string): boolean {
  if (!lastCheckedAt) {
    return true;
  }

  const elapsedHours = (Date.now() - new Date(lastCheckedAt).getTime()) / 3600000;
  return elapsedHours >= minimumCheckIntervalHours(preference);
}
