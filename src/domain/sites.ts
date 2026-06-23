import { SiteKey, SupportedSite } from './types';

export const SUPPORTED_SITES: SupportedSite[] = [
  {
    key: 'noon',
    displayName: 'Noon UAE',
    shortName: 'Noon',
    hostnames: ['noon.com', 'www.noon.com'],
    status: 'supported',
    notes: 'Broad UAE marketplace coverage. Parser uses product metadata and embedded page data when available.'
  },
  {
    key: 'nike_uae',
    displayName: 'Nike UAE',
    shortName: 'Nike',
    hostnames: ['nike.ae', 'www.nike.ae'],
    status: 'supported',
    notes: 'Product pages expose schema.org product data with AED price and availability.'
  },
  {
    key: 'sun_sand_sports',
    displayName: 'Sun & Sand Sports UAE',
    shortName: 'Sun & Sand',
    hostnames: ['en-ae.sssports.com', 'sssports.com', 'www.sssports.com'],
    status: 'supported',
    notes: 'Product pages expose structured product data and predictable product URLs.'
  },
  {
    key: 'level_shoes',
    displayName: 'Level Shoes',
    shortName: 'Level Shoes',
    hostnames: ['levelshoes.com', 'www.levelshoes.com'],
    status: 'supported',
    notes: 'Product pages expose Next.js product payloads and useful structured metadata.'
  },
  {
    key: 'ay_accessories',
    displayName: 'AYM Accessories',
    shortName: 'AYM',
    hostnames: ['ay-accessories.com', 'www.ay-accessories.com'],
    status: 'supported',
    notes: 'WooCommerce product pages expose variation JSON, images, and AED pricing for supported product pages.'
  },
  {
    key: 'ounass',
    displayName: 'Ounass UAE',
    shortName: 'Ounass',
    hostnames: ['ounass.ae', 'www.ounass.ae'],
    status: 'supported',
    notes: 'Product pages expose inline PDP payloads with title, image, stock state, and AED pricing.'
  },
  {
    key: 'amazon_ae',
    displayName: 'Amazon',
    shortName: 'Amazon',
    hostnames: [
      'amazon.ae',
      'amazon.ca',
      'amazon.com',
      'amazon.com.au',
      'amazon.com.be',
      'amazon.com.br',
      'amazon.com.mx',
      'amazon.com.sa',
      'amazon.com.tr',
      'amazon.co.jp',
      'amazon.co.uk',
      'amazon.de',
      'amazon.eg',
      'amazon.es',
      'amazon.fr',
      'amazon.it',
      'amazon.nl',
      'amazon.pl',
      'amazon.se',
      'amazon.sg',
      'www.amazon.ae',
      'www.amazon.ca',
      'www.amazon.com',
      'www.amazon.com.au',
      'www.amazon.com.be',
      'www.amazon.com.br',
      'www.amazon.com.mx',
      'www.amazon.com.sa',
      'www.amazon.com.tr',
      'www.amazon.co.jp',
      'www.amazon.co.uk',
      'www.amazon.de',
      'www.amazon.eg',
      'www.amazon.es',
      'www.amazon.fr',
      'www.amazon.it',
      'www.amazon.nl',
      'www.amazon.pl',
      'www.amazon.se',
      'www.amazon.sg'
    ],
    status: 'supported',
    notes: 'Product pages can be parsed across selected Amazon regional domains when Amazon serves a normal product page without a challenge.'
  }
];

export function getSiteByKey(siteKey: SiteKey): SupportedSite {
  return SUPPORTED_SITES.find((site) => site.key === siteKey) ?? SUPPORTED_SITES[0];
}

export function detectSupportedSite(urlValue: string): SupportedSite | undefined {
  const match = urlValue.trim().match(/^(?:https?:\/\/)?([^/?#]+)/i);
  if (match?.[1]) {
    const hostname = match[1].toLowerCase().replace(/^m\./, '').replace(/^en-ae\./, 'en-ae.');
    return SUPPORTED_SITES.find((site) =>
      site.hostnames.some((candidate) => hostname === candidate || hostname.endsWith(`.${candidate}`))
    );
  }

  return undefined;
}

export function normalizeUrl(urlValue: string): string {
  const trimmed = urlValue.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}
