/**
 * Shared title tokenizer for locally discovered retailer listings.
 *
 * Retailers describe the same product differently ("Nike Air Force 1 '07 Men's
 * Shoes" and "Nike Air Force 1 07 Shoes"), so grouping and watchlist relevance
 * both need a small, predictable normalization layer. This module only
 * normalizes text; it never invents identifiers that a retailer did not
 * provide.
 */

const FILLER_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'with', 'without', 'for', 'of', 'in', 'on', 'by', 'to', 'from', 'at', 'de', 'eau',
  'new', 'latest', 'official', 'original', 'authentic', 'genuine', 'online', 'buy', 'shop', 'shopping',
  'free', 'delivery', 'shipping', 'uae', 'dubai', 'abu', 'dhabi', 'gcc', 'ksa', 'sale', 'offer', 'offers',
  'deal', 'deals', 'discount', 'clearance', 'outlet', 'exclusive', 'generation', 'gen',
  'men', 'mens', 'man', 'women', 'womens', 'woman', 'kids', 'kid', 'boys', 'boy', 'girls', 'girl',
  'unisex', 'adult', 'adults', 'male', 'female'
]);

const COLOR_WORDS = new Set([
  'black', 'white', 'blue', 'navy', 'red', 'green', 'grey', 'gray', 'beige', 'brown', 'pink', 'purple',
  'yellow', 'orange', 'gold', 'silver', 'multicolor', 'multicolour', 'ivory', 'cream', 'tan', 'khaki',
  'burgundy', 'maroon', 'teal', 'olive', 'nude', 'rose', 'clear', 'transparent',
  'lavender', 'lilac', 'violet', 'mint', 'sage', 'coral', 'peach', 'turquoise', 'cyan', 'magenta',
  'charcoal', 'stone', 'sand', 'taupe', 'chocolate', 'mustard', 'lime', 'aqua', 'sky', 'apricot',
  'fuchsia', 'indigo', 'plum', 'wine', 'rust', 'amber', 'emerald', 'sapphire', 'opal', 'pearl'
]);

const UNIT_ALIASES: Record<string, string> = {
  ml: 'ml', mls: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  l: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l', ltr: 'l',
  cl: 'cl',
  g: 'g', gram: 'g', grams: 'g', gm: 'g', gms: 'g',
  kg: 'kg', kgs: 'kg', kilogram: 'kg', kilograms: 'kg',
  mg: 'mg',
  gb: 'gb', tb: 'tb', mb: 'mb',
  oz: 'oz',
  cm: 'cm', mm: 'mm', inch: 'inch', inches: 'inch', in: 'inch', ft: 'ft',
  w: 'w', kw: 'kw', mah: 'mah', wh: 'wh', hz: 'hz', ghz: 'ghz',
  pcs: 'pcs', pc: 'pcs', piece: 'pcs', pieces: 'pcs', ct: 'pcs', count: 'pcs',
  pack: 'pack', packs: 'pack', pk: 'pack'
};

/** Product-type synonyms collapse to one canonical type token. */
const TYPE_SYNONYMS: Record<string, string> = {
  shoe: 'shoes', shoes: 'shoes', sneaker: 'shoes', sneakers: 'shoes', trainer: 'shoes', trainers: 'shoes',
  footwear: 'shoes', boot: 'shoes', boots: 'shoes', sandal: 'shoes', sandals: 'shoes', loafer: 'shoes',
  loafers: 'shoes', slipper: 'shoes', slippers: 'shoes', heel: 'shoes', heels: 'shoes', pump: 'shoes',
  pumps: 'shoes',
  tshirt: 'tshirt', tee: 'tshirt', tees: 'tshirt', shirt: 'shirt', shirts: 'shirt', top: 'top', tops: 'top',
  blouse: 'blouse', blouses: 'blouse', polo: 'polo', polos: 'polo', jersey: 'jersey', jerseys: 'jersey',
  hoodie: 'hoodie', hoodies: 'hoodie', sweatshirt: 'sweatshirt', sweatshirts: 'sweatshirt',
  sweater: 'sweater', sweaters: 'sweater', cardigan: 'cardigan', cardigans: 'cardigan',
  trouser: 'trousers', trousers: 'trousers', pant: 'pants', pants: 'pants', jeans: 'jeans', short: 'shorts',
  shorts: 'shorts', skirt: 'skirt', skirts: 'skirt', legging: 'leggings', leggings: 'leggings',
  tights: 'tights', joggers: 'joggers', trackpants: 'trackpants',
  dress: 'dress', dresses: 'dress', gown: 'gown', gowns: 'gown', abaya: 'abaya', abayas: 'abaya',
  kaftan: 'kaftan', kimono: 'kimono',
  jacket: 'jacket', jackets: 'jacket', coat: 'coat', coats: 'coat', blazer: 'blazer', blazers: 'blazer',
  vest: 'vest', vests: 'vest', gilet: 'gilet',
  bag: 'bag', bags: 'bag', handbag: 'handbag', handbags: 'handbag', tote: 'tote', totes: 'tote',
  backpack: 'backpack', backpacks: 'backpack', pouch: 'pouch', crossbody: 'crossbody', luggage: 'luggage',
  suitcase: 'suitcase', wallet: 'wallet', wallets: 'wallet',
  watch: 'watch', watches: 'watch', smartwatch: 'smartwatch', smartwatches: 'smartwatch',
  perfume: 'fragrance', perfumes: 'fragrance', fragrance: 'fragrance', fragrances: 'fragrance',
  parfum: 'fragrance', cologne: 'fragrance', edp: 'fragrance', edt: 'fragrance',
  lipstick: 'lipstick', mascara: 'mascara', foundation: 'foundation', concealer: 'concealer',
  blush: 'blush', eyeliner: 'eyeliner', eyeshadow: 'eyeshadow', lipgloss: 'lipgloss', highlighter: 'highlighter',
  bronzer: 'bronzer', primer: 'primer',
  serum: 'serum', serums: 'serum', moisturizer: 'moisturizer', moisturiser: 'moisturizer',
  cleanser: 'cleanser', sunscreen: 'sunscreen', toner: 'toner', essence: 'essence',
  shampoo: 'shampoo', conditioner: 'conditioner',
  phone: 'phone', phones: 'phone', smartphone: 'phone', smartphones: 'phone', mobile: 'phone', mobiles: 'phone',
  iphone: 'phone', iphones: 'phone',
  laptop: 'laptop', laptops: 'laptop', notebook: 'laptop', notebooks: 'laptop',
  tablet: 'tablet', tablets: 'tablet', ipad: 'tablet', ipads: 'tablet',
  tv: 'tv', tvs: 'tv', television: 'tv', televisions: 'tv',
  headphone: 'headphones', headphones: 'headphones', earbud: 'earbuds', earbuds: 'earbuds',
  earphone: 'earbuds', earphones: 'earbuds', headset: 'headset', headsets: 'headset',
  speaker: 'speaker', speakers: 'speaker', soundbar: 'soundbar', soundbars: 'soundbar',
  camera: 'camera', cameras: 'camera', console: 'console', consoles: 'console',
  chair: 'chair', chairs: 'chair', table: 'table', tables: 'table', sofa: 'sofa', sofas: 'sofa',
  bed: 'bed', beds: 'bed', mattress: 'mattress', mattresses: 'mattress', desk: 'desk', desks: 'desk',
  shelf: 'shelf', shelves: 'shelf',
  refrigerator: 'fridge', refrigerators: 'fridge', fridge: 'fridge', fridges: 'fridge',
  freezer: 'freezer', freezers: 'freezer', washer: 'washer', washers: 'washer', dryer: 'dryer', dryers: 'dryer',
  microwave: 'microwave', microwaves: 'microwave', oven: 'oven', ovens: 'oven', dishwasher: 'dishwasher',
  dishwashers: 'dishwasher', vacuum: 'vacuum', vacuums: 'vacuum', blender: 'blender', blenders: 'blender',
  kettle: 'kettle', kettles: 'kettle', toaster: 'toaster', toasters: 'toaster',
  toy: 'toy', toys: 'toy', book: 'book', books: 'book',
  milk: 'milk', water: 'water', rice: 'rice', oil: 'oil', coffee: 'coffee', tea: 'tea', sugar: 'sugar',
  flour: 'flour', bread: 'bread', eggs: 'eggs', egg: 'eggs', chicken: 'chicken', cheese: 'cheese',
  yogurt: 'yogurt', yoghurt: 'yogurt', juice: 'juice', soda: 'soda', cola: 'cola'
};

const CANONICAL_TYPE_TOKENS = new Set(Object.values(TYPE_SYNONYMS));

const NUMBER_UNIT_PATTERN = /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(ml|cl|l|litres?|liters?|ltr|kg|kgs|g|gm|gms|mg|oz)\b/gi;

export function tokenizeProductTitle(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[\u2018\u2019'`]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean)
    .map((token) => {
      // Ordinals describe the same generation across retailer wording:
      // "2nd generation" / "2nd Gen" / "2" should compare on the same number.
      const ordinal = token.match(/^(\d+)(?:st|nd|rd|th)$/);
      const normalized = ordinal ? ordinal[1] : token;
      return /^0+\d+$/.test(normalized) ? String(Number(normalized)) : normalized;
    });
}

/**
 * Tokens with units and multipliers normalized: `1 L` -> `1l`,
 * `3 x 500 ml` -> `3x500ml`, `Pack of 3` stays `pack`, `3`.
 */
export function normalizeProductTokens(value: string | undefined): string[] {
  const prepared = (value ?? '')
    .replace(NUMBER_UNIT_PATTERN, (_match, first: string, second: string, unit: string) =>
      `${first}x${second}${UNIT_ALIASES[unit.toLowerCase()] ?? unit.toLowerCase()}`
    )
    // A standalone decimal is specification copy (Bluetooth 5.3, 2.4 GHz), not
    // a model number; capacities like "1.5 L" were protected above.
    .replace(/(?<![a-z0-9])\d+\.\d+(?![a-z0-9])/gi, ' ');
  const raw = tokenizeProductTitle(prepared);
  const tokens: string[] = [];
  for (let index = 0; index < raw.length; index++) {
    const token = raw[index];
    const next = raw[index + 1];
    if (next === 'x' && raw[index + 2] && /^0*\d+(?:\.\d+)?$/.test(token)) {
      tokens.push(`${token}x${raw[index + 2]}`);
      index += 2;
      continue;
    }
    if (/^0*\d+(?:\.\d+)?$/.test(token) && next && UNIT_ALIASES[next]) {
      tokens.push(`${token}${UNIT_ALIASES[next]}`);
      index++;
      continue;
    }
    const attached = token.match(/^0*(\d+(?:\.\d+)?)([a-z]+)$/);
    if (attached && UNIT_ALIASES[attached[2]]) {
      tokens.push(`${attached[1]}${UNIT_ALIASES[attached[2]]}`);
      continue;
    }
    tokens.push(token);
  }
  return tokens;
}

export function isUnknownBrand(brand: string | undefined): boolean {
  const normalized = (brand ?? '').trim().toLowerCase();
  return !normalized || normalized === 'other brands' || normalized === 'other brand' || normalized === 'unknown' || normalized === 'n/a';
}

/** Brand identity used to require a brand match before clubbing offers. */
export function normalizeBrandKey(brand: string | undefined): string | undefined {
  if (isUnknownBrand(brand)) {
    return undefined;
  }
  const tokens = normalizeProductTokens(brand).filter((token) => !FILLER_WORDS.has(token));
  return tokens.length ? tokens.join(' ') : undefined;
}

export function brandTokens(brand: string | undefined): Set<string> {
  const key = normalizeBrandKey(brand);
  return new Set(key ? key.split(' ') : []);
}

/**
 * Distinctive tokens for cross-retailer matching. Brand, filler, colour and
 * gender words are dropped; product-type synonyms and units are canonicalized.
 * The result is de-duplicated and sorted so it can be compared directly.
 */
export function productSignatureTokens(title: string, brand?: string): string[] {
  const brandSet = brandTokens(brand);
  const result = new Set<string>();
  for (const token of normalizeProductTokens(title)) {
    if (FILLER_WORDS.has(token) || COLOR_WORDS.has(token) || brandSet.has(token)) {
      continue;
    }
    result.add(TYPE_SYNONYMS[token] ?? token);
  }
  return [...result].sort();
}

/** Canonical product-type token such as `shoes`, or `other` when absent. */
export function productTypeKey(signature: readonly string[]): string {
  return signature.find((token) => CANONICAL_TYPE_TOKENS.has(token)) ?? 'other';
}

/** Numeric model/pack tokens. Equal sets are required before grouping. */
export function productHardTokens(signature: readonly string[]): string[] {
  return [...new Set(signature.filter((token) => /\d/.test(token)))].sort();
}

const VARIANT_UNIT_TOKEN = /(?:\d(?:ml|cl|l|kg|g|mg|gb|tb|mb|oz|cm|mm|inch|ft|w|kw|mah|wh|hz|ghz|pcs|pack)$)|(?:\d+x\d+(?:ml|l|kg|g|gb|tb|mb))$/;

/** Capacity/pack tokens such as 128gb or 3x500ml must match exactly. */
export function productVariantHardTokens(signature: readonly string[]): string[] {
  return productHardTokens(signature).filter((token) => VARIANT_UNIT_TOKEN.test(token));
}

/**
 * Model numbers and model-like codes (16, 1000xm5, h2). Retailers often add
 * extra specification numbers to one title ("H2 chip"), so a shared model
 * token is stronger evidence than an identical whole list.
 */
export function productModelTokens(signature: readonly string[]): string[] {
  const variant = new Set(productVariantHardTokens(signature));
  return productHardTokens(signature).filter((token) => !variant.has(token));
}

/** Tokens useful for matching a listing against the shopper's tracked products. */
export function relevanceKeywords(title: string, brand?: string): string[] {
  const brandSet = brandTokens(brand);
  const result: string[] = [];
  for (const token of normalizeProductTokens(title)) {
    if (FILLER_WORDS.has(token) || COLOR_WORDS.has(token) || brandSet.has(token) || result.includes(token)) {
      continue;
    }
    result.push(TYPE_SYNONYMS[token] ?? token);
  }
  return result;
}
