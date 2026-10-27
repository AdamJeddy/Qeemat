import { inferPackBasis, pricesShareBasis } from '../priceBasis';
import { formatPrice } from '../price';

describe('grocery pricing basis', () => {
  it('distinguishes pack sizes and counts while accepting equivalent unit spelling', () => {
    expect(inferPackBasis('Rice 1 kg')).toBe(inferPackBasis('Rice 1000g'));
    expect(inferPackBasis('Milk 2 x 500 ml')).not.toBe(inferPackBasis('Milk 500 ml'));
    expect(pricesShareBasis({ title: 'Rice 1kg' }, { title: 'Rice 500g' })).toBe(false);
    expect(pricesShareBasis({ title: 'Milk 1L' }, { title: 'Milk 1000ml' })).toBe(true);
    expect(inferPackBasis('Milk 500ml pack of 2')).toBe(inferPackBasis('Milk 2 x 500 ml'));
    expect(inferPackBasis('Diapers 9-14kg Size 4 Box 222 Count')).toBe('pack:222pcs');
    expect(pricesShareBasis({ title: 'Diapers 222 count' }, { title: 'Diapers 111 count' })).toBe(false);
  });
  it('does not compare an old default-weight price against a normalized kilogram price', () => {
    expect(pricesShareBasis({ title: 'Banana' }, { title: 'Banana', priceBasis: 'kg' })).toBe(false);
    expect(formatPrice(990, 'AED', 'kg')).toBe('AED 9.90 /kg');
  });
});
