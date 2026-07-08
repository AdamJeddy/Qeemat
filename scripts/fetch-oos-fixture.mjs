/**
 * fetch-oos-fixture.mjs
 *
 * Fetches a product page and saves the HTML as an OOS test fixture.
 * Run with Node ≥ 20 (uses built-in fetch):
 *
 *   node scripts/fetch-oos-fixture.mjs <site-key> <url>
 *
 * Example:
 *   node scripts/fetch-oos-fixture.mjs noon "https://www.noon.com/uae-en/some-oos-product/p/"
 *
 * The HTML is saved to src/domain/__tests__/fixtures/oos/<site-key>.html
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, '..', 'src', 'domain', '__tests__', 'fixtures', 'oos');

const REQUEST_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AE,en-US;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
};

async function main() {
  const [,, siteKey, rawUrl] = process.argv;

  if (!siteKey || !rawUrl) {
    console.error('Usage: node scripts/fetch-oos-fixture.mjs <site-key> <url>');
    console.error('Example: node scripts/fetch-oos-fixture.mjs noon "https://www.noon.com/uae-en/..."');
    process.exit(1);
  }

  // Validate siteKey against allowed values
  const VALID_KEYS = [
    'noon', 'nike_uae', 'sun_sand_sports', 'level_shoes',
    'ay_accessories', 'ounass', 'amazon_ae',
  ];
  if (!VALID_KEYS.includes(siteKey)) {
    console.error(`Invalid site key: "${siteKey}". Must be one of: ${VALID_KEYS.join(', ')}`);
    process.exit(1);
  }

  const url = rawUrl.trim();
  console.log(`Fetching: ${url}`);

  let response;
  try {
    response = await fetch(url, { headers: REQUEST_HEADERS });
  } catch (err) {
    console.error(`Network error: ${err.message}`);
    process.exit(1);
  }

  if (!response.ok) {
    console.error(`HTTP ${response.status}: ${response.statusText}`);
    process.exit(1);
  }

  const html = await response.text();
  console.log(`Received ${html.length} bytes of HTML`);

  // Quick sanity check: does this look like a product page?
  const hasProductIndicators =
    html.includes('product') ||
    html.includes('Product') ||
    html.includes('price') ||
    html.includes('Price');
  if (!hasProductIndicators) {
    console.warn('⚠ Warning: HTML does not contain obvious product/price indicators. The page may be a bot challenge or error page.');
  }

  // Ensure the fixture directory exists
  if (!existsSync(FIXTURE_DIR)) {
    mkdirSync(FIXTURE_DIR, { recursive: true });
  }

  const outPath = resolve(FIXTURE_DIR, `${siteKey}.html`);
  writeFileSync(outPath, html, 'utf-8');

  console.log(`✅ Saved fixture to: ${outPath}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Review the saved HTML to verify it contains OOS signals');
  console.log('  2. Add a test case in src/domain/__tests__/oos-parser.test.ts');
  console.log('  3. Run: npm test -- --runInBand oos-parser');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
