const COMPACT_CONTENT_WIDTH = 360;

/**
 * Treat large system text as consuming horizontal space so controls reflow
 * before labels collide or are truncated.
 */
export function isCompactLayout(width: number, fontScale = 1): boolean {
  return width / Math.max(1, fontScale) < COMPACT_CONTENT_WIDTH;
}
