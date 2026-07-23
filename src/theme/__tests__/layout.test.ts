import { isCompactLayout } from '../layout';

describe('isCompactLayout', () => {
  it('uses the available width on standard-size displays', () => {
    expect(isCompactLayout(360)).toBe(false);
    expect(isCompactLayout(359)).toBe(true);
  });

  it('treats larger system text as reduced available width', () => {
    expect(isCompactLayout(412, 1.3)).toBe(true);
    expect(isCompactLayout(412, 1)).toBe(false);
  });
});
