/* Run: node --max-http-header-size=131072 scripts/probe-discovery.cjs
 * Read-only source validation. Raw retailer responses remain under .tmp/.
 * Desktop extraction is separate from Android validation; see docs/discovery-sources.md.
 */
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, filename);
};
const { DISCOVERY_COLLECTIONS, discoverySourceUrl } = require('../src/domain/discovery.ts');
const { parseDiscoveryListing } = require('../src/domain/discoveryListings.ts');

async function request(url) {
  const cookies = {};
  for (let hop = 0; hop < 6; hop++) {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(25000), headers: {
      'Accept-Language': 'en-AE,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
      Cookie: Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join('; ')
    } });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0];
      const equals = pair.indexOf('=');
      cookies[pair.slice(0, equals)] = pair.slice(equals + 1);
    }
    const location = response.headers.get('location');
    if (!location) { return { response, body: await response.text(), url }; }
    const next = new URL(location, url);
    if (next.hostname !== new URL(url).hostname) { throw new Error('Cross-host redirect requires review'); }
    url = next.href;
  }
  throw new Error('Redirect loop');
}

(async () => {
  fs.mkdirSync('.tmp/discovery', { recursive: true });
  const results = [];
  let index = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (index < DISCOVERY_COLLECTIONS.length) {
      const source = DISCOVERY_COLLECTIONS[index++];
      const url = discoverySourceUrl(source);
      let record;
      try {
        const { response, body, url: finalUrl } = await request(url);
        fs.writeFileSync(`.tmp/discovery/${source.id}.html`, body);
        const products = response.ok ? parseDiscoveryListing(body, source, new Date().toISOString()) : [];
        record = { id: source.id, site: source.siteKey, url, finalUrl, status: response.status, bytes: body.length, products: products.length, sample: products[0] };
      } catch (error) { record = { id: source.id, site: source.siteKey, url, error: error.message }; }
      results.push(record);
      console.log(`${source.id}: ${record.products ?? 0} products (${record.status ?? record.error})`);
    }
  }));
  fs.writeFileSync('.tmp/discovery/probe.json', JSON.stringify(results, null, 2));
  console.log(`${results.filter((record) => record.products > 0).length}/${results.length} collections extracted. Full results: .tmp/discovery/probe.json`);
})();
