import { mergeTags, normalizeFolderName, splitTagInput } from '../organization';

describe('watchlist organization names', () => {
  it('reuses an existing folder name regardless of casing', () => {
    expect(normalizeFolderName('  running ', ['Running', 'Gifts'])).toBe('Running');
  });

  it('splits tag text on spaces and commas', () => {
    expect(splitTagInput('sale, race day')).toEqual(['sale', 'race', 'day']);
  });

  it('keeps one canonical version of each selected tag', () => {
    expect(mergeTags(['Sale'], ['sale', 'RACE'], ['sale', 'Race'])).toEqual(['sale', 'Race']);
  });
});
