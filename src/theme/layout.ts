const COMPACT_CONTENT_WIDTH = 360;
const VARIANT_GRID_COLUMNS = 6;
const VARIANT_GRID_GAP = 6;

/**
 * Treat large system text as consuming horizontal space so controls reflow
 * before labels collide or are truncated.
 */
export function isCompactLayout(width: number, fontScale = 1): boolean {
  return width / Math.max(1, fontScale) < COMPACT_CONTENT_WIDTH;
}

export function getVariantGridMetrics(containerWidth: number, optionCount: number) {
  const columns = Math.max(1, Math.min(VARIANT_GRID_COLUMNS, optionCount));
  const availableWidth = Math.max(0, containerWidth - VARIANT_GRID_GAP * (columns - 1));

  return {
    columns,
    gap: VARIANT_GRID_GAP,
    tileWidth: Math.floor(availableWidth / columns)
  };
}
