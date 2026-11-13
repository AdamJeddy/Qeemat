import { findTrackingMatches, trackingOptionLabel } from '../duplicates';
import { TrackedProduct } from '../types';

const pageLevel = {
  id: 1,
  title: 'Running shoes',
  url: 'https://www.noon.com/shoe',
  canonicalUrl: 'https://www.noon.com/shoe',
  siteKey: 'noon'
} as TrackedProduct;

const sizeOption = {
  ...pageLevel,
  id: 2,
  variant: {
    id: 'variant-42',
    label: 'Size: 42',
    attributes: [{ name: 'Size', value: '42' }],
    url: 'https://www.noon.com/shoe?variant=42'
  }
} as TrackedProduct;

const otherOption = {
  ...pageLevel,
  id: 3,
  variant: {
    id: 'variant-44',
    label: 'Size: 44',
    attributes: [{ name: 'Size', value: '44' }],
    url: 'https://www.noon.com/shoe?variant=44'
  }
} as TrackedProduct;

const parsedPageLevel = {
  title: 'Running shoes',
  canonicalUrl: 'https://www.noon.com/shoe/?utm_source=share'
};

const parsedVariant = (id: string, label: string) => ({
  title: 'Running shoes',
  canonicalUrl: 'https://www.noon.com/shoe',
  selectedVariant: {
    id,
    label,
    attributes: [{ name: 'Size', value: label }],
    url: `https://www.noon.com/shoe?variant=${id}`
  }
});

it('matches a page-level parsed product to an existing page-level tracker', () => {
  const match = findTrackingMatches(parsedPageLevel, [pageLevel]);
  expect(match.exact).toBe(pageLevel);
  expect(match.sameProduct).toHaveLength(1);
});

it('matches the same variant id even when the product URL changed', () => {
  const match = findTrackingMatches(parsedVariant('variant-42', 'Size: 42'), [sizeOption]);
  expect(match.exact).toBe(sizeOption);
});

it('reports other options of the same product without treating them as duplicates', () => {
  const match = findTrackingMatches(parsedVariant('variant-44', 'Size: 44'), [sizeOption]);
  expect(match.exact).toBeUndefined();
  expect(match.sameProduct).toContain(sizeOption);
});

it('keeps page-level tracking and variant tracking as separate matches', () => {
  const parsed = parsedVariant('variant-44', 'Size: 44');
  const match = findTrackingMatches(parsed, [pageLevel, otherOption]);
  expect(match.exact).toBe(otherOption);
  expect(match.sameProduct.map((item) => item.id)).toEqual([1, 3]);
});

it('returns no matches for a different product', () => {
  const match = findTrackingMatches(
    { title: 'Different product', canonicalUrl: 'https://www.noon.com/other' },
    [pageLevel, sizeOption]
  );
  expect(match.exact).toBeUndefined();
  expect(match.sameProduct).toEqual([]);
});

it('labels an option for duplicate prompts', () => {
  expect(trackingOptionLabel(sizeOption)).toBe('Size: 42');
  expect(trackingOptionLabel({ ...sizeOption, variant: undefined })).toBe('page-level tracking');
  expect(trackingOptionLabel({ selectedVariant: { id: 'x', label: 'Size: 44', attributes: [], url: 'u' } })).toBe('Size: 44');
});
