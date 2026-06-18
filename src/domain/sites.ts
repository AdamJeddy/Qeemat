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
    shortName: 'Level',
    hostnames: ['levelshoes.com', 'www.levelshoes.com'],
    status: 'supported',
    notes: 'Product pages expose Next.js product payloads and useful structured metadata.'
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
