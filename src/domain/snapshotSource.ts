import { SnapshotSource } from './types';

/** Human-readable label for where a price snapshot came from. */
export function snapshotSourceLabel(source: SnapshotSource): string {
  if (source === 'manual_single') {
    return 'Check now';
  }

  if (source === 'manual_batch') {
    return 'Recheck all';
  }

  if (source === 'background') {
    return 'Background';
  }

  return 'Unknown';
}
