import { inferWatchlistCategory, watchlistCategories } from '../watchlistDiscovery';
import { TrackedProduct } from '../types';

test('uses distinct categories from active watchlist products only', () => {
  const product = { isActive: true, isArchived: false, category: 'footwear' } as TrackedProduct;
  expect(watchlistCategories([product, { ...product }, { ...product, category: 'clothing' }, { ...product, category: 'phones', isArchived: true }, { ...product, category: 'audio', isActive: false }, { ...product, category: undefined }])).toEqual(['footwear', 'clothing']);
});

test.each([
  ['Galaxy S25 Ultra smartphone', 'phones'],
  ['Running sneakers', 'footwear'],
  ['Protective case for iPhone 16', 'tech_accessories'],
  ['Printed sweatshirt', 'clothing'],
  ['Satin midi dress', 'clothing'],
  ['Eau de parfum 100 ml', 'fragrance'],
  ['Wireless noise cancelling headphones', 'audio'],
  ['Cotton throw pillow', 'home']
] as const)('identifies %s from its product name', (title, expected) => {
  expect(inferWatchlistCategory({ title, url: '', canonicalUrl: '' })).toBe(expected);
});

test('does not force a category onto ambiguous products or override a choice', () => {
  expect(inferWatchlistCategory({ title: 'Galaxy collection', url: '', canonicalUrl: '' })).toBeUndefined();
  expect(inferWatchlistCategory({ title: 'iPhone 16', url: '', canonicalUrl: '', category: 'accessories' })).toBe('accessories');
  expect(inferWatchlistCategory({ title: 'iPhone 16', url: '', canonicalUrl: '', categoryExcluded: true })).toBeUndefined();
});
