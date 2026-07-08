import { writeFileSync, mkdirSync } from 'node:fs';
import https from 'node:https';
import http from 'node:http';

const [,, siteKey, url] = process.argv;
if (!siteKey || !url) { console.error('Usage: node scripts/_fetch.mjs <site-key> <url>'); process.exit(1); }

const lib = url.startsWith('https') ? https : http;
const req = lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'en-AE,en-US;q=0.9' } }, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    mkdirSync('src/domain/__tests__/fixtures/oos', { recursive: true });
    const dest = `src/domain/__tests__/fixtures/oos/${siteKey}.html`;
    writeFileSync(dest, data);
    console.log(`OK: ${data.length} bytes -> ${dest}`);
  });
});
req.on('error', e => { console.error(e.message); process.exit(1); });
req.end();
