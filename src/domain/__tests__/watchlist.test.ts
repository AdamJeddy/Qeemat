import {
  filterWatchlistProducts,
  getWatchlistFolders,
  getWatchlistSites,
  sortWatchlistProducts
} from '../watchlist';

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

  it('combines store and folder filters', () => {
    const organized = [
      { ...products[0], folder: 'Running' },
      { ...products[1], folder: 'Tech' },
      { ...products[2], folder: 'Running' }
    ];

    expect(filterWatchlistProducts(organized, 'nike_uae', { folder: 'Running' })).toEqual([organized[0], organized[2]]);
  });
});

describe('watchlist organization', () => {
  const organized = [
    { ...products[0], folder: 'Running' },
    { ...products[1], folder: 'Tech' },
    { ...products[2], folder: 'Running' }
  ];

  it('lists each folder once', () => {
    expect(getWatchlistFolders(organized)).toEqual(['Running', 'Tech']);
  });

  it('does not expose case-only duplicate folders', () => {
    expect(getWatchlistFolders([{ ...products[0], folder: 'Running' }, { ...products[1], folder: 'running' }])).toEqual(['Running']);
  });
});

describe('sortWatchlistProducts', () => {
  const sortable = [
    {
      id: 1,
      siteKey: 'nike_uae' as const,
      title: 'Zebra shoe',
      currentPriceMinor: 50000,
      previousPriceMinor: 60000,
      targetPriceMinor: 45000,
      updatedAt: '2026-10-20T10:00:00.000Z'
    },
    {
      id: 2,
      siteKey: 'noon' as const,
      title: 'Alpha watch',
      currentPriceMinor: 30000,
      previousPriceMinor: 31000,
      targetPriceMinor: 30000,
      updatedAt: '2026-10-21T10:00:00.000Z'
    },
    {
      id: 3,
      siteKey: 'amazon_ae' as const,
      title: 'Camera',
      currentPriceMinor: 80000,
      updatedAt: '2026-10-19T10:00:00.000Z'
    },
    {
      id: 4,
      siteKey: 'amazon_ae' as const,
      title: 'Unavailable product',
      updatedAt: '2026-10-18T10:00:00.000Z'
    }
  ];

  it('sorts by the selected watchlist metric without mutating the source', () => {
    expect(sortWatchlistProducts(sortable, 'lowest_price').map((product) => product.id)).toEqual([2, 1, 3, 4]);
    expect(sortWatchlistProducts(sortable, 'largest_drop').map((product) => product.id)).toEqual([1, 2, 3, 4]);
    expect(sortWatchlistProducts(sortable, 'closest_to_target').map((product) => product.id)).toEqual([2, 1, 3, 4]);
    expect(sortWatchlistProducts(sortable, 'name').map((product) => product.id)).toEqual([2, 3, 4, 1]);
    expect(sortable.map((product) => product.id)).toEqual([1, 2, 3, 4]);
  });
});
