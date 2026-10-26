/* Android-only diagnostics through the local Metro/Hermes inspector.
 * Run with a connected debug build and Metro: node scripts/probe-discovery-android.cjs SOURCE_ID
 * Raw storefront HTML stays in .tmp/discovery/; no user preferences or trackers are read.
 */
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, filename);
const { DISCOVERY_COLLECTIONS, discoverySourceUrl } = require('../src/domain/discovery.ts');
const { parseDiscoveryListing } = require('../src/domain/discoveryListings.ts');

(async () => {
  const source = DISCOVERY_COLLECTIONS.find((item) => item.id === process.argv[2]);
  const checkProducts = process.argv[2] === '--products';
  const inputs = checkProducts ? JSON.parse(fs.readFileSync('.tmp/discovery/product-check-input.json', 'utf8')) : [];
  if (!source && !checkProducts) { throw new Error('Pass a source ID from DISCOVERY_COLLECTIONS, or --products.'); }
  const targets = await fetch('http://localhost:8081/json/list').then((response) => response.json());
  const target = targets.find((item) => item.title.includes('com.qeemat'));
  if (!target) { throw new Error('No Qeemat Hermes inspector is connected.'); }
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  const expression = checkProducts ? `(function() {
    const modules = [...globalThis.__r.getModules().values()];
    const parser = modules.find(item => item.verboseName && item.verboseName.endsWith('/domain/parser.ts')).publicModule.exports;
    globalThis.__qeematDiscoveryProbe = {pending: true, results: []};
    ${JSON.stringify(inputs)}.reduce(function(chain, item) {
      return chain.then(function() {
        if (!globalThis.__qeematDiscoveryProbe || globalThis.__qeematDiscoveryProbe.cancelled) { return; }
        return parser.fetchAndParseProduct(item.url).then(function(result) {
          globalThis.__qeematDiscoveryProbe.results.push({site: item.site, url: item.url, ok: result.ok,
            title: result.ok ? result.product.title : undefined,
            priceMinor: result.ok ? result.product.priceMinor : undefined,
            variants: result.ok ? (result.product.variants || []).length : undefined,
            code: result.ok ? undefined : result.code});
        }, function(error) { globalThis.__qeematDiscoveryProbe.results.push({site: item.site, ok: false, error: error.message}); });
      });
    }, Promise.resolve()).then(function() { if (globalThis.__qeematDiscoveryProbe) { globalThis.__qeematDiscoveryProbe.pending = false; } });
    return true;
  })()` : `(function() {
    const modules = [...globalThis.__r.getModules().values()];
    const native = modules.find(item => item.verboseName && item.verboseName.endsWith('/BatchedBridge/NativeModules.js'));
    if (!native) { throw new Error('NativeModules was not found in the development bundle.'); }
    const exports = native.publicModule.exports;
    const fetcher = (exports.default || exports).QeematWebViewFetcher;
    globalThis.__qeematDiscoveryProbe = {pending: true};
    fetcher.fetchPageHtml(${JSON.stringify(discoverySourceUrl(source))}).then(function(html) {
      globalThis.__qeematDiscoveryProbe = {html: html};
    }, function(error) { globalThis.__qeematDiscoveryProbe = {error: error.message}; });
    return true;
  })()`;
  let id = 0;
  const evaluate = (code) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => reject(new Error('Inspector timed out')), 10000);
    socket.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (data.id === requestId) { clearTimeout(timer); resolve(data); }
    };
    socket.send(JSON.stringify({ id: requestId, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
  });
  let result = await evaluate(expression);
  if (result.result?.exceptionDetails) { socket.close(); throw new Error(JSON.stringify(result.result.exceptionDetails)); }
  const deadline = Date.now() + (checkProducts ? 300000 : 55000);
  let completed = 0;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    result = await evaluate('globalThis.__qeematDiscoveryProbe');
    const rows = result.result?.result?.value?.results ?? [];
    for (const row of rows.slice(completed)) { console.log(`${row.site}: ${row.ok ? 'parsed' : row.code ?? row.error}`); }
    completed = rows.length;
    if (!result.result?.result?.value?.pending) { break; }
  }
  await evaluate('if (globalThis.__qeematDiscoveryProbe) { globalThis.__qeematDiscoveryProbe.cancelled = true; }');
  socket.close();
  if (result.result?.exceptionDetails) { throw new Error(JSON.stringify(result.result.exceptionDetails)); }
  if (checkProducts) {
    const summary = result.result?.result?.value;
    fs.writeFileSync('.tmp/discovery/android-product-checks.json', JSON.stringify(summary, null, 2));
    console.log(`${summary.results.filter((row) => row.ok).length}/${inputs.length} product pages parsed${summary.pending ? ' (incomplete)' : ''}`);
    return;
  }
  if (result.result?.result?.value?.error) { throw new Error(result.result.result.value.error); }
  const html = result.result?.result?.value?.html;
  if (typeof html !== 'string') { throw new Error('Android did not return HTML.'); }
  fs.mkdirSync('.tmp/discovery', { recursive: true });
  fs.writeFileSync(`.tmp/discovery/android-${source.id}.html`, html);
  const products = parseDiscoveryListing(html, source, new Date().toISOString());
  console.log(JSON.stringify({ source: source.id, bytes: html.length, products: products.length, sample: products[0] }, null, 2));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
