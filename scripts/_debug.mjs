/**
 * Debug script: Inspect a saved fixture and print what the parser sees.
 *
 * Usage:
 *   1. Fetch a page:   node scripts/_fetch.mjs <site-key> <url>
 *   2. Debug it:       node scripts/_debug.mjs <site-key>
 *
 * Defaults to level_shoes if no site key provided.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const siteKey = process.argv[2] || 'level_shoes';
const htmlPath = resolve(`src/domain/__tests__/fixtures/oos/${siteKey}.html`);

if (!existsSync(htmlPath)) {
  console.error(`Fixture not found: ${htmlPath}`);
  console.error('Run: node scripts/_fetch.mjs <site-key> <url>');
  process.exit(1);
}

const html = readFileSync(htmlPath, 'utf-8');

// ── JSON-LD ──────────────────────────────────────────────────────────────
const ldMatch = html.match(/"@type"\s*:\s*"Offer"[\s\S]{0,800}?"availability"\s*:\s*"([^"]+)"/g);
console.log('=== JSON-LD Offers ===');
if (ldMatch) {
  ldMatch.forEach(m => {
    const avail = m.match(/"availability"\s*:\s*"([^"]+)"/)?.[1];
    const price = m.match(/"price"\s*:\s*([0-9.]+)/)?.[1];
    console.log(`  availability=${avail}  price=${price}`);
  });
} else {
  console.log('  NONE');
}

// ── Site-specific payload fields ────────────────────────────────────────
console.log('\n=== Site payload ===');

if (siteKey === 'level_shoes') {
  // productDetails from __NEXT_DATA__ (what the parser now uses)
  const ndMatch = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]+type="application\/json"[^>]*>([\s\S]+?)<\/script>/);
  if (ndMatch) {
    try {
      const pd = JSON.parse(ndMatch[1])?.props?.pageProps?.productDetails;
      if (pd) {
        console.log('  [productDetails]');
        console.log(`    name:           ${pd.name}`);
        console.log(`    rawSalePrice:   ${pd.rawSalePrice}`);
        console.log(`    rawOriginalPrice: ${pd.rawOriginalPrice}`);
        console.log(`    vpn:            ${pd.vpn}`);
        const sizes = pd.sizeOptions ?? [];
        if (sizes.length > 0) {
          const stocked = sizes.filter(s => s.isInStock).length;
          console.log(`    sizeOptions:    ${sizes.length} total, ${stocked} in stock`);
          sizes.slice(0, 3).forEach(s => {
            console.log(`      price=${s.rawSalePrice} isInStock=${s.isInStock} discount=${s.discountPercentage}`);
          });
        }
      }
    } catch { /* skip */ }
  }

  // Full-HTML regex (old approach, for comparison)
  const isInStockAll = [...html.matchAll(/"isInStock"\s*:\s*(true|false)/g)];
  const rawSalePriceFirst = html.match(/"rawSalePrice"\s*:\s*([0-9.]+)/);

  console.log('\n  [Full HTML regex (old)]');
  console.log(`    isInStock: ${isInStockAll.length} matches (true=${isInStockAll.filter(m => m[1] === 'true').length}, false=${isInStockAll.filter(m => m[1] === 'false').length})`);
  console.log(`    rawSalePrice (first match): ${rawSalePriceFirst?.[0] ?? 'NONE'}`);

  const anyTrue = isInStockAll.some(m => m[1] === 'true');
  const anyFalse = isInStockAll.some(m => m[1] === 'false');
  console.log(`\n=== Verdict ===`);
  console.log(`  ${anyTrue ? 'IN STOCK (≥1 variant available)' : anyFalse ? 'OUT OF STOCK (all OOS)' : 'UNKNOWN (no stock data)'}`);
} else {
  console.log('  (no site-specific probes; edit _debug.mjs to add your site)');
}

