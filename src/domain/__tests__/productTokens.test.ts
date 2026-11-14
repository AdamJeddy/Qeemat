import {
  isUnknownBrand,
  normalizeBrandKey,
  normalizeProductTokens,
  productHardTokens,
  productModelTokens,
  productSignatureTokens,
  productTypeKey,
  productVariantHardTokens,
  relevanceKeywords,
  tokenizeProductTitle
} from '../productTokens';

describe('product title tokens', () => {
  it('normalizes case, apostrophes and leading-zero model numbers', () => {
    expect(tokenizeProductTitle("Nike Air Force 1 '07 Men's Shoes")).toEqual([
      'nike', 'air', 'force', '1', '7', 'mens', 'shoes'
    ]);
  });

  it('normalizes units and multiplier pack descriptions', () => {
    expect(normalizeProductTokens('Almarai Milk 1 L')).toEqual(['almarai', 'milk', '1l']);
    expect(normalizeProductTokens('Shampoo 3 x 500 ml')).toEqual(['shampoo', '3x500ml']);
    expect(normalizeProductTokens('iPhone 16 Pro 128 GB')).toEqual(['iphone', '16', 'pro', '128gb']);
  });

  it('removes brand, gender, colour and filler words from the signature', () => {
    expect(productSignatureTokens("Nike Air Force 1 '07 Men's Shoes", 'Nike')).toEqual(['1', '7', 'air', 'force', 'shoes']);
    expect(productSignatureTokens('Nike Air Force 1 07 Shoes - White', 'Nike')).toEqual(['1', '7', 'air', 'force', 'shoes']);
  });

  it('canonicalizes product-type synonyms', () => {
    expect(productSignatureTokens('Women Running Sneakers', 'Brand')).toEqual(['running', 'shoes']);
    expect(productSignatureTokens('Eau de Parfum Spray', 'Brand')).toEqual(['fragrance', 'spray']);
    expect(productTypeKey(productSignatureTokens('Running Shoes', 'Nike'))).toBe('shoes');
  });

  it('keeps numeric model/pack tokens as hard tokens', () => {
    expect(productHardTokens(productSignatureTokens('iPhone 16 Pro 128 GB', 'Apple'))).toEqual(['128gb', '16']);
    expect(productModelTokens(productSignatureTokens('iPhone 16 Pro 128 GB', 'Apple'))).toEqual(['16']);
    expect(productVariantHardTokens(productSignatureTokens('iPhone 16 Pro 128 GB', 'Apple'))).toEqual(['128gb']);
    expect(productModelTokens(productSignatureTokens('Sony WH-1000XM5 Wireless Headphones', 'Sony'))).toEqual(['1000xm5']);
  });

  it('builds brand identities and treats placeholders as unknown', () => {
    expect(normalizeBrandKey('H&M')).toBe('h m');
    expect(normalizeBrandKey('Nike')).toBe('nike');
    expect(isUnknownBrand('Other brands')).toBe(true);
    expect(isUnknownBrand(undefined)).toBe(true);
    expect(isUnknownBrand('Samsung')).toBe(false);
  });

  it('normalizes ordinals and generation wording', () => {
    expect(tokenizeProductTitle('AirPods Pro 2nd Generation')).toEqual(['airpods', 'pro', '2', 'generation']);
    expect(productSignatureTokens('AirPods Pro 2nd Generation With USB-C MagSafe Case', 'Apple')).toEqual([
      '2', 'airpods', 'c', 'case', 'magsafe', 'pro', 'usb'
    ]);
  });

  it('exposes relevance keywords without the brand', () => {
    expect(relevanceKeywords('Nike Air Zoom Pegasus 41 Running Shoes Black', 'Nike')).toEqual([
      'air', 'zoom', 'pegasus', '41', 'running', 'shoes'
    ]);
  });
});
