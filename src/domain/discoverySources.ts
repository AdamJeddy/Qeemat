import type { DiscoveryCollection } from './discovery';
import type { DiscoveryCategory, SiteKey } from './types';
import nike from './discoverySources/nike_uae.json';
import sss from './discoverySources/sun_sand_sports.json';
import adidas from './discoverySources/adidas.json';
import puma from './discoverySources/puma_uae.json';
import decathlon from './discoverySources/decathlon_uae.json';
import level from './discoverySources/level_shoes.json';
import ounass from './discoverySources/ounass.json';
import namshi from './discoverySources/namshi.json';
import deal from './discoverySources/the_deal.json';
import sharaf from './discoverySources/sharaf_dg.json';
import faces from './discoverySources/faces_uae.json';
import sephora from './discoverySources/sephora_uae.json';
import salomon from './discoverySources/salomon_gcc.json';
import ay from './discoverySources/ay_accessories.json';
import carrefour from './discoverySources/carrefour_uae.json';
import centrepoint from './discoverySources/centrepoint_uae.json';
import noon from './discoverySources/noon.json';
import amazon from './discoverySources/amazon_ae.json';

const MIXED_DEPARTMENTS = new Set<DiscoveryCategory>(['fashion', 'beauty', 'electronics', 'sport', 'home_department', 'groceries', 'general']);
const maps = [decathlon, nike, sss, level, ay, ounass, noon, amazon, adidas, puma, salomon, sephora, faces, centrepoint, namshi, deal, sharaf, carrefour].flat() as DiscoveryCollection[];

/** Observed retailer navigation, not generated search terms. Extraction failures remain visible. */
export const DISCOVERY_SOURCE_MAPS: DiscoveryCollection[] = [
  ...maps.filter((source) => !source.url?.endsWith('/-/')).map((source) => ({ ...source, isDepartment: MIXED_DEPARTMENTS.has(source.category) })),
  // BFL's current SPA is still under investigation. Keep its existing source and
  // report failures rather than presenting unverified category URLs as working.
  { id: 'bfl-women', label: 'Women', category: 'fashion', siteKey: 'brands_for_less', url: 'https://www.brandsforless.com/en-ae/women/', provider: 'html', path: ['Women'], isDepartment: true }
];

export type DiscoveryScope = {
  categories?: DiscoveryCategory[];
  siteKey?: SiteKey;
  collectionId?: string;
  offset?: number;
  limit?: number;
};

export function selectDiscoveryCollections(scope: DiscoveryScope = {}): DiscoveryCollection[] {
  if (scope.collectionId) { return DISCOVERY_SOURCE_MAPS.filter((source) => source.id === scope.collectionId); }
  const candidates = DISCOVERY_SOURCE_MAPS.filter((source) =>
    !source.isDepartment && (!scope.siteKey || source.siteKey === scope.siteKey) &&
    (!scope.categories?.length || scope.categories.includes(source.category)));
  // First spread requests across retailers, then spread each retailer's pages
  // across interests. A large sitemap must not dominate the first batch.
  const stores = [...new Set(candidates.map((source) => source.siteKey))].map((site) => {
    const sources = candidates.filter((source) => source.siteKey === site).sort((left, right) =>
      Number(Boolean(left.url?.includes('?') && left.provider === 'html')) - Number(Boolean(right.url?.includes('?') && right.provider === 'html')) ||
      (left.path?.length ?? 1) - (right.path?.length ?? 1));
    const groups = [...new Set(sources.map((source) => source.category))].map((category) => sources.filter((source) => source.category === category));
    return interleave(groups);
  });
  return interleave(stores).slice(scope.offset ?? 0, (scope.offset ?? 0) + (scope.limit ?? 24));
}

function interleave<T>(queues: T[][]): T[] {
  const result: T[] = [];
  for (let index = 0; queues.some((queue) => index < queue.length); index++) {
    for (const queue of queues) { if (index < queue.length) { result.push(queue[index]); } }
  }
  return result;
}
