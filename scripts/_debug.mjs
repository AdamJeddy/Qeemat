import { readFileSync } from 'node:fs';
import { parseProductHtml } from '../src/domain/parser';

const html = readFileSync('src/domain/__tests__/fixtures/oos/amazon_ae.html', 'utf-8');
const r = parseProductHtml('amazon_ae', 'https://www.amazon.ae/dp/B0DJTGDB28/', html);
console.log('title:', JSON.stringify(r?.title?.slice(0, 80)));
console.log('priceMinor:', r?.priceMinor);
console.log('availability:', r?.availability);
console.log('rawPriceText:', r?.rawPriceText);
console.log('sku:', r?.sku);
