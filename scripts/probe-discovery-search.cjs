/* Read-only search validation. Raw retailer pages stay under ignored .tmp/. */
const fs = require('node:fs');
const ts = require('typescript');
const {request} = require('./audit-discovery-navigation.cjs');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true}
}).outputText, filename);
const {buildSearchRequests, parseSearchPage} = require('../src/domain/discoverySearch.ts');
const queries = {nike_uae:'air max',sun_sand_sports:'shoes',adidas:'shoes',puma_uae:'shoes',level_shoes:'sneakers',ounass:'sneakers',namshi:'sneakers',the_deal:'shoes',faces_uae:'perfume',noon:'iphone 16',carrefour_uae:'milk',ay_accessories:'helmet'};
const root = '.tmp/discovery-search';
fs.mkdirSync(root, {recursive:true});
(async () => {
  const selected = process.argv.slice(2);
  const rows = [];
  for (const [site, query] of Object.entries(queries)) {
    if (selected.length && !selected.includes(site)) continue;
    for (const source of buildSearchRequests(query).filter(item => item.siteKey === site)) {
      for (const input of [{source, query}, {source: {...source,url:source.url.replace(encodeURIComponent(query),'zzqeematnomatch827491')},query:'zzqeematnomatch827491'}]) {
        let row;
        try {
          const {response, html, url} = await request(input.source.url);
          fs.writeFileSync(`${root}/${source.id}-${input.query}.html`,html);
          const page = parseSearchPage(html,input.source,input.query,new Date().toISOString());
          row = {source:source.id,query:input.query,status:response.status,url,count:page?.products.length,unverified:!page,nextUrl:page?.nextUrl,samples:page?.products.slice(0,2).map(item=>item.title)};
          if (page?.nextUrl && input.query === query) {
            const next = await request(page.nextUrl);
            const second = parseSearchPage(next.html,{...source,url:page.nextUrl},query,new Date().toISOString());
            row.secondPage = {status:next.response.status,count:second?.products.length,newProducts:second?.products.filter(item=>!page.products.some(first=>first.id===item.id)).length};
          }
        } catch (error) {row={source:source.id,query:input.query,error:error.message};}
        rows.push(row);
        fs.writeFileSync(`${root}/provider-validation.json`,JSON.stringify(rows,null,2));
        console.log(JSON.stringify(row));
      }
    }
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
