import { watchlistCategories } from '../watchlistDiscovery';
import { TrackedProduct } from '../types';

test('uses distinct categories from active watchlist products only', () => {
  const product = { isActive: true, isArchived: false, category: 'footwear' } as TrackedProduct;
  expect(watchlistCategories([product, { ...product }, { ...product, category: 'clothing' }, { ...product, category: 'phones', isArchived: true }, { ...product, category: 'audio', isActive: false }, { ...product, category: undefined }])).toEqual(['footwear', 'clothing']);
});
