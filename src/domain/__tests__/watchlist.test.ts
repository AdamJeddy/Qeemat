import { filterWatchlistProducts, getWatchlistSites } from '../watchlist';

const products = [
  { id: 1, siteKey: 'nike_uae' as const },
  { id: 2, siteKey: 'amazon_ae' as const },
  { id: 3, siteKey: 'nike_uae' as const },
  { id: 4, siteKey: 'noon' as const },
];

describe('getWatchlistSites', () => {
  it('keeps each tracked store once in first-product order', () => {
    expect(getWatchlistSites(products)).toEqual(['nike_uae', 'amazon_ae', 'noon']);
  });
});

describe('filterWatchlistProducts', () => {
  it('keeps every product when all stores is selected', () => {
    expect(filterWatchlistProducts(products, 'all')).toEqual(products);
  });

  it('keeps only products from the selected store', () => {
    expect(filterWatchlistProducts(products, 'nike_uae')).toEqual([products[0], products[2]]);
  });
});
