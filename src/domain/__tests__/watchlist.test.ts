import {
  filterWatchlistProducts,
  getWatchlistFolders,
  getWatchlistSites,
  matchesWatchlistSearch,
  searchWatchlistProducts,
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

describe('searchWatchlistProducts', () => {
  const searchable = [
    {
      id: 1,
      siteKey: 'amazon_ae' as const,
      title: 'Seiko 5 Sports Automatic Watch',
      folder: 'Watches',
      variant: { label: 'Color: Green' }
    },
    {
      id: 2,
      siteKey: 'noon' as const,
      title: 'Xiaomi Redmi Note 15 Smartphone',
      folder: 'Phones',
      variant: { label: 'Color: Black' }
    },
    {
      id: 3,
      siteKey: 'decathlon_uae' as const,
      title: 'Germany 26 Home Replica Jersey',
      folder: 'Running',
      variant: { label: 'Size: UK XL / FR 48' }
    }
  ];

  it('returns every product for an empty query', () => {
    expect(searchWatchlistProducts(searchable, '   ')).toEqual(searchable);
  });

  it('matches product titles case-insensitively', () => {
    expect(searchWatchlistProducts(searchable, 'seiko').map((product) => product.id)).toEqual([1]);
    expect(searchWatchlistProducts(searchable, 'JERSEY').map((product) => product.id)).toEqual([3]);
  });

  it('matches retailer names, folders and selected options', () => {
    expect(searchWatchlistProducts(searchable, 'noon').map((product) => product.id)).toEqual([2]);
    expect(searchWatchlistProducts(searchable, 'watches').map((product) => product.id)).toEqual([1]);
    expect(searchWatchlistProducts(searchable, 'uk xl').map((product) => product.id)).toEqual([3]);
  });

  it('requires every word of a multi-word query to match', () => {
    expect(searchWatchlistProducts(searchable, 'xiaomi black').map((product) => product.id)).toEqual([2]);
    expect(searchWatchlistProducts(searchable, 'xiaomi green')).toEqual([]);
  });

  it('reports no match without mutating the source', () => {
    expect(searchWatchlistProducts(searchable, 'nonexistent')).toEqual([]);
    expect(searchable.map((product) => product.id)).toEqual([1, 2, 3]);
  });

  it('exposes the per-product predicate for combined filters', () => {
    expect(matchesWatchlistSearch(searchable[0], 'amazon green')).toBe(true);
    expect(matchesWatchlistSearch(searchable[0], 'amazon black')).toBe(false);
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
