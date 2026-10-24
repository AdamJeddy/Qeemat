import { normalizeFolderName } from '../organization';

describe('watchlist organization names', () => {
  it('reuses an existing folder name regardless of casing', () => {
    expect(normalizeFolderName('  running ', ['Running', 'Gifts'])).toBe('Running');
  });
});
