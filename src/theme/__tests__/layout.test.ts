import { getVariantGridMetrics, isCompactLayout } from '../layout';

describe('isCompactLayout', () => {
  it('uses the available width on standard-size displays', () => {
    expect(isCompactLayout(360)).toBe(false);
    expect(isCompactLayout(359)).toBe(true);
  });

  it('treats larger system text as reduced available width', () => {
    expect(isCompactLayout(412, 1.3)).toBe(true);
    expect(isCompactLayout(412, 1)).toBe(false);
  });

  it('keeps every size tile the same width in short and multi-row option lists', () => {
    expect(getVariantGridMetrics(320, 6)).toEqual({ columns: 6, gap: 6, tileWidth: 48 });
    expect(getVariantGridMetrics(320, 16)).toEqual({ columns: 6, gap: 6, tileWidth: 48 });
  });

  it('reduces tile width on a narrow screen without changing the grid rhythm', () => {
    expect(getVariantGridMetrics(280, 16)).toEqual({ columns: 6, gap: 6, tileWidth: 41 });
  });
});
