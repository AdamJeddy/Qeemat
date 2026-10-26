import { DISCOVERY_CATEGORY_GROUPS, DISCOVERY_CATEGORY_LABELS, normalizeDiscoveryCategories, migrateDiscoveryBudgets } from '../discoveryCategories';

describe('shopping category taxonomy', () => {
  it('separates shopping interests and technology departments', () => {
    expect(DISCOVERY_CATEGORY_LABELS).toEqual(expect.objectContaining({
      clothing: 'Clothing', footwear: 'Footwear', skincare: 'Skincare', fragrance: 'Fragrance',
      phones: 'Phones', computers: 'Computers', tablets: 'Tablets', televisions: 'TVs & projectors',
      audio: 'Audio', cameras: 'Cameras', gaming: 'Gaming'
    }));
    const categories = DISCOVERY_CATEGORY_GROUPS.flatMap((group) => group.categories);
    expect(new Set(categories).size).toBe(categories.length);
    expect(categories.sort()).toEqual(Object.keys(DISCOVERY_CATEGORY_LABELS).sort());
    expect(categories).not.toEqual(expect.arrayContaining(['fashion', 'beauty', 'electronics', 'sport']));
  });

  it('migrates legacy broad interests without dropping valid new choices', () => {
    expect(normalizeDiscoveryCategories(['fashion', 'beauty', 'phones', 'invalid', 'footwear']))
      .toEqual(expect.arrayContaining(['clothing', 'footwear', 'bags', 'makeup', 'skincare', 'fragrance', 'haircare', 'phones']));
    expect(normalizeDiscoveryCategories(['footwear', 'footwear', null])).toEqual(['footwear']);
    expect(normalizeDiscoveryCategories(null)).toEqual([]);
  });

  it('inherits old ceilings while preserving independent explicit category budgets', () => {
    expect(migrateDiscoveryBudgets({ fashion: 20000, beauty: 10000, skincare: 5000, phones: 300000, invalid: 7, gaming: -1 }))
      .toEqual(expect.objectContaining({ clothing: 20000, footwear: 20000, fragrance: 10000, skincare: 5000, phones: 300000 }));
    expect(migrateDiscoveryBudgets({ skincare: 5000, beauty: 10000 }).skincare).toBe(5000);
    expect(migrateDiscoveryBudgets(null)).toEqual({});
    expect(migrateDiscoveryBudgets({ phones: NaN, gaming: -1, audio: '100' })).toEqual({});
  });
});
