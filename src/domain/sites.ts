import { SiteKey, SupportedSite } from './types';

export const SUPPORTED_SITES: SupportedSite[] = [
  {
    key: 'noon',
    displayName: 'Noon UAE',
    shortName: 'Noon',
    hostnames: ['noon.com', 'www.noon.com'],
    status: 'supported',
    notes: 'Broad UAE marketplace coverage. Parser uses product metadata and embedded page data when available.',
    iconAsset: require('../../assets/site-icons/noon.png')
  },
  {
    key: 'nike_uae',
    displayName: 'Nike UAE',
    shortName: 'Nike',
    hostnames: ['nike.ae', 'www.nike.ae'],
    status: 'supported',
    notes: 'Product pages expose schema.org product data with AED price and availability.',
    iconAsset: require('../../assets/site-icons/nike_uae.png')
  },
  {
    key: 'sun_sand_sports',
    displayName: 'Sun & Sand Sports UAE',
    shortName: 'Sun & Sand',
    hostnames: ['en-ae.sssports.com', 'sssports.com', 'www.sssports.com'],
    status: 'supported',
    notes: 'Product pages expose structured product data and predictable product URLs.',
    iconAsset: require('../../assets/site-icons/sun_sand_sports.png')
  },
  {
    key: 'level_shoes',
    displayName: 'Level Shoes',
    shortName: 'Level Shoes',
    hostnames: ['levelshoes.com', 'www.levelshoes.com'],
    status: 'supported',
    notes: 'Product pages expose Next.js product payloads and useful structured metadata.',
    iconAsset: require('../../assets/site-icons/level_shoes.png')
  },
  {
    key: 'ay_accessories',
    displayName: 'AYM Accessories',
    shortName: 'AYM',
    hostnames: ['ay-accessories.com', 'www.ay-accessories.com'],
    status: 'supported',
    notes: 'WooCommerce product pages expose variation JSON, images, and AED pricing for supported product pages.',
    minimumIntervalHours: 72,
    iconAsset: require('../../assets/site-icons/ay_accessories.png')
  },
  {
    key: 'ounass',
    displayName: 'Ounass UAE',
    shortName: 'Ounass',
    hostnames: ['ounass.ae', 'www.ounass.ae'],
    status: 'supported',
    notes: 'Product pages expose inline PDP payloads with title, image, stock state, and AED pricing.',
    iconAsset: require('../../assets/site-icons/ounass.png')
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
    notes: 'Product pages can be parsed across selected Amazon regional domains when Amazon serves a normal product page without a challenge.',
    iconAsset: require('../../assets/site-icons/amazon_ae.png')
  },
  {
    key: 'adidas',
    displayName: 'Adidas UAE',
    shortName: 'Adidas',
    hostnames: ['adidas.ae', 'www.adidas.ae'],
    status: 'supported',
    notes: 'Product pages expose JSON-LD structured data and meta tags with AED pricing and availability.',
    iconAsset: require('../../assets/site-icons/adidas.png')
  },
  {
    key: 'puma_uae',
    displayName: 'PUMA UAE',
    shortName: 'PUMA',
    hostnames: ['ae.puma.com'],
    status: 'supported',
    notes: 'Product pages expose JSON-LD product data and source-defined size options in their initial HTML.',
    iconAsset: require('../../assets/site-icons/puma_uae.png')
  },
  {
    key: 'decathlon_uae',
    displayName: 'Decathlon UAE',
    shortName: 'Decathlon',
    hostnames: ['decathlon.ae', 'www.decathlon.ae'],
    status: 'supported',
    notes: 'Shopify product pages expose initial-page ProductJson data with source-defined options, stock state, and AED prices.',
    iconAsset: require('../../assets/site-icons/decathlon_uae.png')
  },
  {
    key: 'sephora_uae',
    displayName: 'Sephora UAE',
    shortName: 'Sephora',
    hostnames: ['sephora.me', 'www.sephora.me'],
    status: 'supported',
    notes: 'Product pages expose JSON-LD title, image, AED price, and availability. Bot protection uses the native WebView fallback.',
    iconAsset: require('../../assets/site-icons/sephora_uae.png')
  },
  {
    key: 'faces_uae',
    displayName: 'Faces UAE',
    shortName: 'Faces',
    hostnames: ['faces.ae', 'www.faces.ae'],
    status: 'supported',
    notes: 'Salesforce Commerce Cloud product pages expose structured product data with AED price and availability.',
    iconAsset: require('../../assets/site-icons/faces_uae.png')
  },
  {
    key: 'centrepoint_uae',
    displayName: 'Centrepoint UAE',
    shortName: 'Centrepoint',
    hostnames: ['centrepointstores.com', 'www.centrepointstores.com'],
    status: 'supported',
    notes: 'Centrepoint storefront pages expose JSON-LD product data plus source color and size controls across group brands such as Splash.',
    iconAsset: require('../../assets/site-icons/centrepoint_uae.png')
  },
  {
    key: 'namshi',
    displayName: 'Namshi UAE',
    shortName: 'Namshi',
    hostnames: ['namshi.com', 'www.namshi.com'],
    status: 'supported',
    notes: 'Product pages expose structured data, AED pricing, and source size controls; parent/color choices remain represented by their own product URLs.',
    iconAsset: require('../../assets/site-icons/namshi.png')
  },
  {
    key: 'sharaf_dg',
    displayName: 'Sharaf DG UAE',
    shortName: 'Sharaf DG',
    hostnames: ['uae.sharafdg.com', 'sharafdg.com', 'www.sharafdg.com'],
    status: 'supported',
    notes: 'Product pages expose AED pricing, item metadata, and linked configuration URLs; incomplete option responses remain page-level.',
    iconAsset: require('../../assets/site-icons/sharaf_dg.png')
  },
  {
    key: 'brands_for_less',
    displayName: 'Brands For Less UAE',
    shortName: 'BFL',
    hostnames: ['brandsforless.com', 'www.brandsforless.com'],
    status: 'experimental',
    notes: 'Next.js product pages with __NEXT_DATA__ SSR payloads and meta tags. Cloudflare protection blocks non-browser HTTP clients (TLS fingerprint mismatch). Parser implemented but fetch path blocked — see docs/bfl-integration.md.',
    iconAsset: require('../../assets/site-icons/brands_for_less.png')
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

/**
 * Extract the first web URL from Android share text. Browsers may include a
 * product title before the URL instead of sharing the URL on its own.
 */
export function detectSharedUrl(sharedText: string): string | undefined {
  const url = sharedText.match(/https?:\/\/[^\s<>"']+/i)?.[0];
  return url?.replace(/[),.;!?]+$/, '');
}

/**
 * Common tracking/analytics query parameters to strip from product URLs.
 */
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'msclkid',
  'ref',
  'ref_',
  'tag'
]);

/**
 * Strip tracking/analytics query parameters and URL fragments from a product URL.
 *
 * For Amazon URLs, all query parameters are stripped because the ASIN in the path
 * (`/dp/ASIN`) uniquely identifies the product. For other sites, only known
 * tracking/analytics parameters are removed to avoid breaking URLs that use
 * query params for product identification.
 */
export function cleanUrl(urlValue: string): string {
  const trimmed = urlValue.trim();
  if (!trimmed) {
    return trimmed;
  }

  // Split off the fragment (#...)
  const fragmentIdx = trimmed.indexOf('#');
  const beforeFragment = fragmentIdx >= 0 ? trimmed.slice(0, fragmentIdx) : trimmed;

  // Find the query string start
  const qIdx = beforeFragment.indexOf('?');
  if (qIdx < 0) {
    // No query params — just return without fragment
    return beforeFragment;
  }

  const pathPart = beforeFragment.slice(0, qIdx);
  const queryPart = beforeFragment.slice(qIdx + 1);

  const isAmazon = /(?:^|\.)amazon\./.test(beforeFragment);

  if (isAmazon) {
    // Amazon: the ASIN uniquely identifies the product, so use its stable
    // direct URL instead of a copied slug, referral path, or query string.
    const origin = pathPart.match(/^(https?:\/\/[^/?#]+)/i)?.[1];
    const asin = pathPart.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1];
    if (origin && asin) {
      return `${origin}/dp/${asin.toUpperCase()}`;
    }

    return pathPart;
  }

  // Other sites: strip only known tracking/analytics params
  const kept: string[] = [];
  for (const pair of queryPart.split('&')) {
    const eqIdx = pair.indexOf('=');
    const key = eqIdx >= 0 ? pair.slice(0, eqIdx) : pair;
    if (!TRACKING_PARAMS.has(key)) {
      kept.push(pair);
    }
  }

  return kept.length > 0 ? `${pathPart}?${kept.join('&')}` : pathPart;
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
