/**
 * oos-parser.test.ts
 *
 * Out-of-stock detection tests using HTML fixtures loaded from disk.
 * Fixtures are saved to src/domain/__tests__/fixtures/oos/<site-key>.html
 *
 * Run:
 *   npm test -- --runInBand oos-parser
 *
 * To add a new fixture:
 *   1. node scripts/_fetch.mjs <site-key> <url>
 *   2. npm test -- --runInBand oos-parser
 */

// @ts-nocheck -- Jest environment: uses require('fs'), require('path'), and __dirname

import { parseProductHtml } from '../parser';

const FIXTURE_DIR = require('path').resolve(__dirname, 'fixtures', 'oos');

function loadFixture(siteKey: string): string | undefined {
  try {
    return require('fs').readFileSync(require('path').resolve(FIXTURE_DIR, `${siteKey}.html`), 'utf-8');
  } catch {
    return undefined;
  }
}

type FixtureExpectation = 'out_of_stock' | 'page_not_found';

interface FixtureConfig {
  siteKey: string;
  url: string;
  expect: FixtureExpectation;
}

/** Expand this map as you add more fixtures. */
const FIXTURE_MAP: Record<string, FixtureConfig> = {
  noon: { siteKey: 'noon', url: 'https://www.noon.com/uae-en/test-oos/N12345/p/', expect: 'out_of_stock' },
  amazon_ae: { siteKey: 'amazon_ae', url: 'https://www.amazon.ae/dp/B0DJTGDB28/', expect: 'out_of_stock' },
  amazon_com: { siteKey: 'amazon_ae', url: 'https://www.amazon.com/dp/B000000000/', expect: 'out_of_stock' },
  ounass: { siteKey: 'ounass', url: 'https://www.ounass.ae/shop-test-product-123.html', expect: 'out_of_stock' },
  ay_accessories: { siteKey: 'ay_accessories', url: 'https://ay-accessories.com/product/test-oos/', expect: 'out_of_stock' },
  level_shoes: { siteKey: 'level_shoes', url: 'https://www.levelshoes.com/test-oos.html', expect: 'out_of_stock' },
  nike_uae: { siteKey: 'nike_uae', url: 'https://www.nike.ae/t/test-oos.html', expect: 'out_of_stock' },
  sun_sand_sports: { siteKey: 'sun_sand_sports', url: 'https://en-ae.sssports.com/test-oos.html', expect: 'page_not_found' },
  adidas: { siteKey: 'adidas', url: 'https://www.adidas.ae/en/test-oos-product/ABC123.html', expect: 'out_of_stock' },
};

// ---------------------------------------------------------------------------
// Fixture tests
// ---------------------------------------------------------------------------

describe('OOS fixture tests', () => {
  for (const [fixture, { siteKey, url, expect: expected }] of Object.entries(FIXTURE_MAP)) {
    const html = loadFixture(fixture);
    const run = html ? it : it.skip;

    if (expected === 'page_not_found') {
      run(`detects 404 / product-not-found on ${fixture}`, () => {
        const result = parseProductHtml(siteKey, url, html);
        expect(result).toBeUndefined();
      });
    } else {
      run(`detects OOS on ${fixture}`, () => {
        const result = parseProductHtml(siteKey, url, html);
        expect(result).toBeDefined();
        expect(result!.availability).toBe('out_of_stock');
      });
    }
  }
});
