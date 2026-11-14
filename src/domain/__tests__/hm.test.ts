import { parseHmCatalogue } from '../hm';
const url = 'https://ae.hm.com/en/buy-printed-brushed-inside-sweatshirt-light-grey-marl-chelsea';
const payload = { data: { products: [{ sku:'1340299002', name:'Printed brushed-inside sweatshirt', inStock:true,
  options:[{id:'size',title:'Size',values:[{id:'size1',title:'2-4Y',inStock:true},{id:'size2',title:'4-6Y',inStock:false}]}],
  variants:{variants:[
    {selections:['size1','season'],product:{sku:'347323341',inStock:true,price:{final:{amount:{value:55,currency:'AED'}}}}},
    {selections:['size2','season'],product:{sku:'347293004',inStock:false,price:{final:{amount:{value:45,currency:'AED'}}}}}
  ]}
}]}};
test('resolves H&M individual size SKUs, prices and stock from catalogue records', () => {
 const parsed = parseHmCatalogue(url, payload);
 expect(parsed?.variants).toEqual(expect.arrayContaining([
  expect.objectContaining({id:'347323341',priceMinor:5500,availability:'in_stock',attributes:[{name:'Size',value:'2-4Y'}]}),
  expect.objectContaining({id:'347293004',priceMinor:4500,availability:'out_of_stock',attributes:[{name:'Size',value:'4-6Y'}]})
 ]));
});
test('does not assign a different size price to a variant with no final price', () => {
 const incomplete = JSON.parse(JSON.stringify(payload)); delete incomplete.data.products[0].variants.variants[0].product.price;
 expect(parseHmCatalogue(url,incomplete)?.variants?.find(item => item.id === '347323341')).toBeUndefined();
});

test('handles a single-SKU H&M product without inventing sizes', () => {
 const simple = {data:{products:[{sku:'one',name:'Accessory',inStock:true,price:{final:{amount:{value:29,currency:'AED'}}}}]}};
 expect(parseHmCatalogue(url,simple)).toEqual(expect.objectContaining({priceMinor:2900,availability:'in_stock'}));
 expect(parseHmCatalogue(url,simple)?.variants).toBeUndefined();
});

import { fetchAndParseProduct, parseProductHtml } from '../parser';
import { fetchPageHtmlViaWebView } from '../webViewFetcher';
import { detectSupportedSite } from '../sites';
jest.mock('../webViewFetcher', () => ({fetchPageHtmlViaWebView: jest.fn()}));
const rendered = `<script id="qeemat-hm-catalogue" type="application/json">${JSON.stringify(payload)}</script>`;
test('recognizes H&M and rechecks the selected source SKU', () => {
 expect(detectSupportedSite(url)?.key).toBe('hm_uae');
 const selection = {id:'347293004', label:'Size: 4-6Y', attributes:[{name:'Size',value:'4-6Y'}]};
 expect(parseProductHtml('hm_uae',url,rendered,selection)).toEqual(expect.objectContaining({availability:'out_of_stock',selectedVariant:selection}));
});
test('uses rendered catalogue data when H&M blocks direct fetch', async () => {
 const original = globalThis.fetch;
 globalThis.fetch = jest.fn().mockResolvedValue({status:403,ok:false}) as jest.Mock;
 (fetchPageHtmlViaWebView as jest.Mock).mockResolvedValueOnce(rendered);
 try { expect(await fetchAndParseProduct(url)).toEqual(expect.objectContaining({ok:true,product:expect.objectContaining({siteKey:'hm_uae',variants:expect.any(Array)})})); }
 finally {globalThis.fetch=original;}
});

test('retains a sold-out size even when its price disappears', () => {
 const unavailable = JSON.parse(JSON.stringify(payload)); delete unavailable.data.products[0].variants.variants[1].product.price;
 expect(parseHmCatalogue(url,unavailable)?.variants).toContainEqual(expect.objectContaining({id:'347293004',availability:'out_of_stock',priceMinor:undefined}));
});

test('does not guess when a size maps to multiple child SKUs', () => {
 const ambiguous = JSON.parse(JSON.stringify(payload));
 ambiguous.data.products[0].variants.variants.push({selections:['size1','other-season'], product:{sku:'different',inStock:true,price:{final:{amount:{value:99,currency:'AED'}}}}});
 expect(parseHmCatalogue(url,ambiguous)?.variants?.find(item => item.label === 'Size: 2-4Y')).toBeUndefined();
});
