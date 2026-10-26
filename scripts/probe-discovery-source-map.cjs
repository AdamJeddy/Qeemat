/* Validate mapped listing pages independently. Input is a per-retailer JSON map.
 * Example: node --max-http-header-size=131072 scripts/probe-discovery-source-map.cjs .tmp/discovery-catalog/nike_uae.json
 */
const fs = require('node:fs');
const ts = require('typescript');
const {request} = require('./audit-discovery-navigation.cjs');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,filename);
const {parseDiscoveryListing} = require('../src/domain/discoveryListings.ts');

(async () => {
  const input = process.argv[2];
  if (!input) throw new Error('Pass a source-map JSON file.');
  const entries = JSON.parse(fs.readFileSync(input,'utf8'));
  const root = '.tmp/discovery-validation';
  fs.mkdirSync(root,{recursive:true});
  const output = `${root}/${entries[0]?.siteKey ?? 'empty'}.json`;
  const results = [];
  let index = 0;
  await Promise.all(Array.from({length:2}, async () => {
    while (index < entries.length) {
      const source = entries[index++];
      let record;
      try {
        const {response,html,url} = await request(source.url);
        const products = response.ok ? parseDiscoveryListing(html,source,new Date().toISOString()) : [];
        record = {id:source.id,url:source.url,finalUrl:url,status:response.status,count:products.length,title:html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],sample:products[0]};
        fs.writeFileSync(`${root}/${source.id}.html`,html);
      } catch(error) {record={id:source.id,url:source.url,error:error.message};}
      results.push(record);
      fs.writeFileSync(output,JSON.stringify(results,null,2));
      console.log(`${source.id}: ${record.count ?? 0} products (${record.status ?? record.error})`);
      await new Promise(resolve=>setTimeout(resolve,300));
    }
  }));
  console.log(`${results.filter(r=>r.count>0).length}/${entries.length} pages extracted; ${output}`);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
