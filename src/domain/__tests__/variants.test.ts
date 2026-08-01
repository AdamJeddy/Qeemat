import {
  getVariantOptionGroups,
  resolveSelectedVariant,
  updateSelectedVariantAttributes
} from '../variants';
import { ProductVariant } from '../types';

const variants: ProductVariant[] = [
  {
    id: 'black-42',
    label: 'Black · EU 42',
    attributes: [
      { name: 'Colour', value: 'Black' },
      { name: 'Size', value: 'EU 42' }
    ],
    priceMinor: 42000,
    currency: 'AED',
    availability: 'in_stock',
    sku: 'BLACK-42'
  },
  {
    id: 'black-43',
    label: 'Black · EU 43',
    attributes: [
      { name: 'Colour', value: 'Black' },
      { name: 'Size', value: 'EU 43' }
    ],
    priceMinor: 43000,
    currency: 'AED',
    availability: 'out_of_stock',
    sku: 'BLACK-43'
  },
  {
    id: 'white-43',
    label: 'White · EU 43',
    attributes: [
      { name: 'Colour', value: 'White' },
      { name: 'Size', value: 'EU 43' }
    ],
    priceMinor: 44000,
    currency: 'AED',
    availability: 'in_stock',
    sku: 'WHITE-43'
  }
];

describe('variant selection', () => {
  it('keeps an in-stock option selectable when it requires clearing an incompatible selection', () => {
    const groups = getVariantOptionGroups(variants);
    const size = groups.find((group) => group.name === 'Size');

    expect(size?.values).toEqual([
      { value: 'EU 42', disabled: false },
      { value: 'EU 43', disabled: false }
    ]);
  });

  it('disables an option only when every variant with that value is out of stock', () => {
    const unavailableVariants = [
      ...variants,
      {
        id: 'white-44',
        label: 'White · EU 44',
        attributes: [
          { name: 'Colour', value: 'White' },
          { name: 'Size', value: 'EU 44' }
        ],
        priceMinor: 44000,
        currency: 'AED',
        availability: 'out_of_stock' as const
      }
    ];

    const size = getVariantOptionGroups(unavailableVariants).find((group) => group.name === 'Size');

    expect(size?.values).toContainEqual({ value: 'EU 44', disabled: true });
  });

  it('clears an incompatible selection when another attribute changes', () => {
    expect(updateSelectedVariantAttributes(variants, { Colour: 'Black', Size: 'EU 42' }, 'Colour', 'White')).toEqual({
      Colour: 'White'
    });
  });

  it('resolves only the exact in-stock selected variant', () => {
    expect(resolveSelectedVariant(variants, { Colour: 'White', Size: 'EU 43' })).toEqual(variants[2]);
    expect(resolveSelectedVariant(variants, { Colour: 'Black', Size: 'EU 43' })).toBeUndefined();
  });
});
