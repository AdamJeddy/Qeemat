/* Read-only search validation. Raw retailer pages stay under ignored .tmp/. */
const fs = require('node:fs');
const ts = require('typescript');
const {request} = require('./audit-discovery-navigation.cjs');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true}
}).outputText, filename);
const {buildSearchRequests, parseSearchPage} = require('../src/domain/discoverySearch.ts');
const queries = {nike_uae:'air max',sun_sand_sports:'shoes',adidas:'shoes',puma_uae:'shoes',level_shoes:'sneakers',ounass:'sneakers',namshi:'sneakers',the_deal:'shoes',faces_uae:'perfume',noon:'iphone 16',carrefour_uae:'milk',ay_accessories:'helmet',brands_for_less:'nike',centrepoint_uae:'shoes',sephora_uae:'perfume',decathlon_uae:'shoes',salomon_gcc:'speedcross',amazon_ae:'iphone'};
const browserFiles = {brands_for_less:'bfl',centrepoint_uae:'centrepoint',sephora_uae:'sephora',decathlon_uae:'decathlon',salomon_gcc:'salomon',amazon_ae:'amazon'};
const root = '.tmp/discovery-search';
fs.mkdirSync(root, {recursive:true});
(async () => {
  const savedBrowser = process.argv.includes('--browser-samples');
  const selected = process.argv.slice(2).filter(arg=>arg!=='--browser-samples');
  const label = savedBrowser ? 'browser-sample-validation' : `provider-validation-${selected.join('-') || 'all'}`;
  const rows = [];
  for (const [site, query] of Object.entries(queries)) {
    if (selected.length && !selected.includes(site)) continue;
    if (savedBrowser && !browserFiles[site]) continue;
    for (const source of buildSearchRequests(query).filter(item => item.siteKey === site)) {
      for (const input of [{source, query}, {source: {...source,url:source.url.replace(encodeURIComponent(query),'zzqeematnomatch827491')},query:'zzqeematnomatch827491'}]) {
        let row;
        try {
          const isEmpty = input.query !== query;
          const observed = savedBrowser ? {html:fs.readFileSync(`${root}/browser-${browserFiles[site]}${isEmpty?'-empty':site==='decathlon_uae'?'-cards':''}.html`,'utf8'),url:input.source.url,response:{status:undefined}} : await request(input.source.url);
          const {response, html, url} = observed;
          if (!savedBrowser) fs.writeFileSync(`${root}/${source.id}-${input.query}.html`,html);
          const page = parseSearchPage(html,input.source,input.query,new Date().toISOString());
          row = {source:source.id,query:input.query,evidence:savedBrowser?'saved browser DOM':'live HTTP',status:response.status,url,count:page?.products.length,unverified:!page,nextUrl:page?.nextUrl,samples:page?.products.slice(0,2).map(item=>item.title)};
          if (page?.nextUrl && input.query === query && !savedBrowser) {
            const next = await request(page.nextUrl);
            const second = parseSearchPage(next.html,{...source,url:page.nextUrl},query,new Date().toISOString());
            row.secondPage = {status:next.response.status,count:second?.products.length,newProducts:second?.products.filter(item=>!page.products.some(first=>first.id===item.id)).length};
          }
        } catch (error) {row={source:source.id,query:input.query,error:error.message};}
        rows.push(row);
        fs.writeFileSync(`${root}/${label}.json`,JSON.stringify(rows,null,2));
        console.log(JSON.stringify(row));
      }
    }
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
