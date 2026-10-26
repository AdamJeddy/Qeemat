/* Read-only navigation audit. Run with node --max-http-header-size=131072.
 * Raw pages and navigation records stay under ignored .tmp/discovery-navigation/.
 */
const fs = require('node:fs');
let seeds = {
  decathlon_uae: 'https://decathlon.ae/',
  nike_uae: 'https://www.nike.ae/en/',
  sun_sand_sports: 'https://en-ae.sssports.com/',
  level_shoes: 'https://www.levelshoes.com/',
  ay_accessories: 'https://ay-accessories.com/',
  ounass: 'https://www.ounass.ae/',
  noon: 'https://www.noon.com/uae-en/',
  amazon_ae: 'https://www.amazon.ae/',
  adidas: 'https://www.adidas.ae/en',
  puma_uae: 'https://ae.puma.com/ae/en',
  salomon_gcc: 'https://salomongcc.com/',
  sephora_uae: 'https://www.sephora.me/ae-en',
  faces_uae: 'https://www.faces.ae/en',
  centrepoint_uae: 'https://www.centrepointstores.com/ae/en/',
  namshi: 'https://www.namshi.com/uae-en/',
  the_deal: 'https://www.thedealoutlet.com/ae-en',
  sharaf_dg: 'https://uae.sharafdg.com/',
  brands_for_less: 'https://www.brandsforless.com/en-ae/',
  carrefour_uae: 'https://www.carrefouruae.com/mafuae/en/'
};
const root = '.tmp/discovery-navigation';
const decode = value => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');
function extractNavigation(html, url) {
  const links = new Map();
  for (const match of html.matchAll(/<a\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/a>/gi)) {
    const href = match[1].match(/\bhref=("|')([\s\S]*?)\1/i)?.[2];
    if (!href || /^(?:javascript:|mailto:|tel:|#)/i.test(href)) continue;
    try {
      const target = new URL(decode(href), url);
      if (target.hostname !== new URL(url).hostname) continue;
      const label = decode(match[2].replace(/<style\b[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim() || match[1].match(/aria-label="([^"]+)"/)?.[1] || '';
      if (!links.has(target.href) || label) links.set(target.href, {url:target.href, label});
    } catch { /* Ignore non-URL navigation controls. */ }
  }
  return [...links.values()];
}
async function request(start) {
  let url = start;
  const cookies = {};
  for (let hop = 0; hop < 6; hop++) {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(25000), headers: {
      'Accept-Language': 'en-AE,en;q=0.9',
      Cookie: Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join('; ')
    } });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0]; const equals = pair.indexOf('=');
      cookies[pair.slice(0, equals)] = pair.slice(equals + 1);
    }
    const location = response.headers.get('location');
    if (!location) return { response, html: await response.text(), url };
    const next = new URL(location, url);
    if (next.hostname !== new URL(start).hostname) throw new Error(`Cross-host redirect to ${next.hostname}`);
    url = next.href;
  }
  throw new Error('Redirect loop');
}
async function main() {
  fs.mkdirSync(root, {recursive:true});
  const selected = process.argv.slice(2);
  if (selected[0] === '--input') seeds = JSON.parse(fs.readFileSync(selected[1], 'utf8'));
  const entries = Object.entries(seeds).filter(([key]) => !selected.length || selected[0] === '--input' || selected.includes(key));
  let index = 0;
  await Promise.all(Array.from({length:2}, async () => {
    while (index < entries.length) {
      const [site, input] = entries[index++];
      let record;
      try {
        const {response, html, url} = await request(input);
        fs.writeFileSync(`${root}/${site}.html`, html);
        record = {site, input, url, status:response.status, bytes:html.length, title:html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], links:extractNavigation(html,url)};
      } catch (error) { record = {site,input,error:error.message}; }
      fs.writeFileSync(`${root}/${site}.json`, JSON.stringify(record,null,2));
      console.log(`${site}: ${record.status ?? record.error}, ${record.links?.length ?? 0} links, ${record.bytes ?? 0} bytes`);
    }
  }));
}
module.exports = {extractNavigation};
if (require.main === module) main().catch(error => {console.error(error.message);process.exitCode=1;});
