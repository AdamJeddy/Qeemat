import { rankSearchGroups } from '../discoverySearchRanking';
import type { DiscoveryCategory, DiscoveryOffer, DiscoveryProductGroup, SiteKey } from '../types';

const OBSERVED_AT = '2026-11-14T08:00:00.000Z';
const CATEGORY: DiscoveryCategory = 'footwear';
const QUERY = 'nike air force 1';

function offer(siteKey: SiteKey, order: number, comparable: boolean): DiscoveryOffer {
  return {
    comparable,
    order,
    product: {
      id: `${siteKey}:listing-${order}`,
      siteKey,
      title: 'Retailer listing',
      brand: 'Nike',
      category: CATEGORY,
      url: `https://www.${siteKey.replace(/_/g, '')}.example/listing-${order}`,
      currency: 'AED',
      availability: 'in_stock',
      observedAt: OBSERVED_AT,
      priceMinor: 20000 + order
    }
  };
}

function group(
  id: string,
  title: string,
  siteKeys: SiteKey[],
  comparableOfferCount = 0
): DiscoveryProductGroup {
  const offers = siteKeys.map((siteKey, index) => offer(siteKey, index, index < comparableOfferCount));
  return {
    id,
    title,
    brand: 'Nike',
    category: CATEGORY,
    categories: [CATEGORY],
    currency: 'AED',
    offers,
    comparableOfferCount: offers.filter((entry) => entry.comparable).length,
    observedAt: OBSERVED_AT
  };
}

function ids(groups: DiscoveryProductGroup[]): string[] {
  return groups.map((entry) => entry.id);
}

describe('rankSearchGroups', () => {
  it('keeps an exact named product above lower-grade multi-store matches', () => {
    const multiA = group('multi-a', 'Mens Nike Air Force 1 Running Shoes', ['noon', 'adidas', 'namshi', 'puma_uae'], 3);
    const multiB = group(
      'multi-b',
      'Shoes Nike Air Force 1 Low',
      ['amazon_ae', 'nike_uae', 'the_deal', 'faces_uae', 'centrepoint_uae'],
      4
    );
    const exact = group('exact', "Nike Air Force 1 '07 Men's Shoes", ['noon']);

    expect(ids(rankSearchGroups([multiA, multiB, exact], QUERY))).toEqual(['exact', 'multi-a', 'multi-b']);

    // A max-boost grade-0 group still cannot leapfrog a grade-1 group.
    const unmatchedMulti = group('unmatched-multi', 'Gym Running Shoes', ['noon', 'adidas', 'namshi', 'puma_uae'], 4);
    const containsSingle = group('contains-single', 'Shoes Nike Air Force 1', ['noon']);
    expect(ids(rankSearchGroups([unmatchedMulti, containsSingle], QUERY))).toEqual(['contains-single', 'unmatched-multi']);
  });

  it('moves a two-store product above a single-store product of the same grade', () => {
    const single = group('single', 'Nike Air Force 1 Low', ['noon']);
    const double = group('double', 'Nike Air Force 1 Mid', ['noon', 'adidas']);
    expect(ids(rankSearchGroups([single, double], QUERY))).toEqual(['double', 'single']);

    // Two comparable prices are stronger evidence than two uncomparable ones.
    const plainPair = group('plain-pair', 'Nike Air Force 1 High', ['noon', 'adidas']);
    const comparablePair = group('comparable-pair', 'Nike Air Force 1 Premium', ['nike_uae', 'the_deal'], 2);
    expect(ids(rankSearchGroups([plainPair, comparablePair], QUERY))).toEqual(['comparable-pair', 'plain-pair']);
  });

  it('ranks a three-store product above a two-store product of the same grade', () => {
    const twoStore = group('two-store', 'Nike Air Force 1 Low', ['noon', 'adidas']);
    const threeStore = group('three-store', 'Nike Air Force 1 High', ['noon', 'adidas', 'namshi']);
    expect(ids(rankSearchGroups([twoStore, threeStore], QUERY))).toEqual(['three-store', 'two-store']);
  });

  it('leaves a single-store result list in its incoming order', () => {
    const groups = [
      group('first', 'Nike Air Force 1 Low', ['noon']),
      group('second', 'Nike Air Force 1 Mid', ['adidas']),
      group('third', 'Nike Air Force 1 High', ['namshi'])
    ];
    expect(ids(rankSearchGroups(groups, QUERY))).toEqual(['first', 'second', 'third']);
  });

  it('bounds the boost and breaks adjusted-position ties by original position', () => {
    const filler = (index: number) => group(`filler-${index}`, `Nike Air Force 1 Edition ${index}`, ['noon']);

    // Index 24 with a 24-point boost ties index 0, and the earlier result wins.
    const tied = group('tied', 'Nike Air Force 1 Mid', ['noon', 'adidas', 'namshi']);
    const withTie = [...Array.from({ length: 24 }, (_, index) => filler(index)), tied];
    expect(ids(rankSearchGroups(withTie, QUERY))[0]).toBe('filler-0');

    // Index 25 minus the capped boost of 24 can no longer reach the first result.
    const tooFarBack = group('too-far-back', 'Nike Air Force 1 High', ['noon', 'adidas', 'namshi']);
    const withTooFarBack = [...Array.from({ length: 25 }, (_, index) => filler(index)), tooFarBack];
    expect(ids(rankSearchGroups(withTooFarBack, QUERY))[0]).toBe('filler-0');

    // One position nearer and the same capped boost is enough to take the lead.
    const inReach = group('in-reach', 'Nike Air Force 1 Premium', ['noon', 'adidas', 'namshi']);
    const withInReach = [...Array.from({ length: 23 }, (_, index) => filler(index)), inReach];
    expect(ids(rankSearchGroups(withInReach, QUERY))[0]).toBe('in-reach');
  });

  it('compares whole tokens so a longer model number is not a textual hit', () => {
    const longerModel = group('longer-model', 'Nike Air Force 10 Running Shoes', ['noon', 'adidas', 'namshi', 'puma_uae'], 3);
    const containsPhrase = group('contains-phrase', 'Shoes Nike Air Force 1 Low', ['noon']);
    expect(ids(rankSearchGroups([longerModel, containsPhrase], QUERY))).toEqual(['contains-phrase', 'longer-model']);

    const phoneOf16 = group('phone-16', 'iPhone 16', ['noon']);
    const phone160 = group('phone-160', 'iPhone 160 Case', ['noon', 'adidas', 'namshi'], 2);
    expect(ids(rankSearchGroups([phone160, phoneOf16], 'iphone 16'))).toEqual(['phone-16', 'phone-160']);
  });

  it('does not let multi-store accessories leapfrog the product itself', () => {
    const product = group('product', 'Apple AirPods Pro 2 Wireless Earbuds', ['noon'], 1);
    const accessory = group('accessory', 'Apple AirPods Pro 2 Case Cover', ['noon', 'amazon_ae', 'carrefour_uae'], 2);
    expect(ids(rankSearchGroups([product, accessory], 'airpods pro 2'))).toEqual(['product', 'accessory']);
  });

  it('is deterministic and never mutates the input groups', () => {
    const groups = [
      group('weak-multi', 'Running Shoes Nike Air Force 1', ['noon', 'adidas', 'namshi', 'puma_uae', 'the_deal'], 2),
      group('exact', 'Nike Air Force 1', ['noon']),
      group('unrelated', 'Adidas Gazelle Shoes', ['noon', 'adidas', 'namshi', 'puma_uae'], 3)
    ];
    const before = JSON.stringify(groups);

    const first = rankSearchGroups(groups, QUERY);
    const second = rankSearchGroups([...groups], QUERY);

    expect(ids(first)).toEqual(ids(second));
    expect(ids(first)).toEqual(['exact', 'weak-multi', 'unrelated']);
    expect(ids(groups)).toEqual(['weak-multi', 'exact', 'unrelated']);
    expect(JSON.stringify(groups)).toBe(before);
    expect(first).not.toBe(groups);
  });

  it('keeps the incoming order for a blank query and an empty list', () => {
    const groups = [
      group('unrelated-multi', 'Adidas Gazelle Shoes', ['noon', 'adidas', 'namshi'], 2),
      group('exact-single', 'Nike Air Force 1', ['noon'])
    ];
    expect(rankSearchGroups([], QUERY)).toEqual([]);
    expect(ids(rankSearchGroups(groups, ''))).toEqual(['unrelated-multi', 'exact-single']);
    expect(ids(rankSearchGroups(groups, '   '))).toEqual(['unrelated-multi', 'exact-single']);
    expect(ids(rankSearchGroups(groups, '!!!'))).toEqual(['unrelated-multi', 'exact-single']);
  });
});
