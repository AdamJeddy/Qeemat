# For You source register

**Category expansion, 27 October 2026:** the active department browser now uses per-retailer maps under [`src/domain/discoverySources/`](../src/domain/discoverySources/), with 4,051 named listings across 18 retailers plus the existing BFL source. The [category audit](discovery-category-audit.md) records this expansion and its validation gaps. The selected-collection URLs and Android counts below are historical evidence from 25–26 October, not validation of every expanded listing. Open **Browse departments & retailers → All listings** in the app to search the current registry, browse a PLP in the same feed, and open its exact retailer URL.

Verified against source and a connected Galaxy S24 Ultra on 25 October 2026. This is a validation snapshot: retailer counts, prices, rate limits, and bot challenges can change.

The final signed standalone release was installed and launched on that device on 26 October, showing 672 available products across 17 retailers after refresh. The earlier 649-product figures below describe the 25 October audit snapshot.

The previous implementation used **only Decathlon**, through these three endpoints:

- `https://decathlon.ae/collections/men-footwear/products.json?limit=24`
- `https://decathlon.ae/collections/fitness/products.json?limit=24`
- `https://decathlon.ae/collections/outdoors/products.json?limit=24`

The last endpoint returned an empty product array in this audit. It has been replaced by the retailer's current [Hiking & Camping collection](https://decathlon.ae/collections/hike-camp).

## Current sources

Carrefour UAE was added on 26 October after the original audit below. The registry now covers 19 retailers, including experimental BFL. Its Headphones & Earphones collection uses `https://www.carrefouruae.com/mafuae/en/c/NF1210300`; desktop and native Android responses supplied 61 distinct seller-specific product listings. This addition does not broaden the other retailers' selected collections; category coverage is a separate follow-up.

The original 25 October audit covered all 18 retailers then registered. **17 retailers supplied products on Android; Brands For Less did not.** That observed personalized feed contained **649 available products across four categories**, before the later source-limit increase and Carrefour addition. These are locally fetched listings, not a bundled sample catalogue.

| Retailer | Exact URL fetched by the app | Content | Android result |
|---|---|---|---|
| Carrefour UAE | [Headphones & Earphones](https://www.carrefouruae.com/mafuae/en/c/NF1210300) | Electronics; source brands kept separate from Carrefour and its marketplace sellers | See [Carrefour validation](carrefour-validation.md) |
| Decathlon | [Footwear JSON](https://decathlon.ae/collections/men-footwear/products.json?limit=100), [Fitness JSON](https://decathlon.ae/collections/fitness/products.json?limit=100), [Hiking & Camping JSON](https://decathlon.ae/collections/hike-camp/products.json?limit=100) | Shoes, fitness equipment, outdoor gear | Products loaded |
| Nike | [Men's shoes](https://www.nike.ae/en/mens/shoes), [Women's shoes](https://www.nike.ae/en/womens/shoes) | Nike footwear | Products loaded |
| Sun & Sand Sports | [Men's shoes](https://en-ae.sssports.com/mens/shoes) | Multiple sports brands | Products loaded |
| Level Shoes | [Men's sneakers](https://www.levelshoes.com/men/shoes/sneakers.html) | Multiple footwear brands | Products loaded |
| Al Yousuf Accessories | [WooCommerce product feed](https://ay-accessories.com/wp-json/wc/store/v1/products?per_page=100) | Motorcycle helmets, communications and gear; [shop page](https://ay-accessories.com/shop/) | Products loaded |
| Ounass | [Beauty](https://www.ounass.ae/women/beauty), [Clothing](https://www.ounass.ae/women/clothing) | Beauty brands and fashion | Products loaded |
| Noon | [Headphones & Earphones](https://www.noon.com/uae-en/electronics-and-mobiles/portable-audio-and-video/headphones-24056/) | Electronics, multiple brands | Products loaded; rendered Android tiles need a separate extraction path from desktop inline state |
| Amazon UAE | [Headphones search](https://www.amazon.ae/s?k=headphones) | Electronics, multiple brands | Products loaded; UAE feed only, not every Amazon regional domain |
| Adidas | [Men's shoes](https://www.adidas.ae/en/men-all-shoes) | Adidas footwear | Products loaded; browser fallback sometimes required |
| Puma | [Men's shoes](https://ae.puma.com/ae/en/men/shoes) | Puma footwear | Products loaded |
| Salomon GCC | [Shop-all JSON](https://salomongcc.com/collections/shop-all-products/products.json?limit=100) | Outdoor footwear/apparel | Products loaded; native HTTP may be rate limited |
| Sephora | [UAE featured products](https://www.sephora.me/ae-en) | Featured beauty, fragrance and makeup | Products loaded through Android fallback; currently the homepage's product collections, not full department pagination |
| Faces | [Skincare](https://www.faces.ae/en/skincare) | Multiple beauty brands | Products loaded; storefront cookie/redirect handling matters |
| Centrepoint | [Women](https://www.centrepointstores.com/ae/en/c/women) | Multiple fashion brands | Products loaded on Android; desktop request was challenged |
| Namshi | [Men's shoes](https://www.namshi.com/uae-en/men-shoes/all-collection/) | Multiple footwear brands | Products loaded |
| The Deal | [Women's clothing](https://www.thedealoutlet.com/ae-en/flash_sale_26/women/clothing) | Multiple outlet fashion brands | Products loaded; storefront cookie/redirect handling matters |
| Sharaf DG | [Headphones & Earphones](https://uae.sharafdg.com/headphones-and-earphones/) | Electronics, multiple brands | Products loaded |
| Brands For Less | [Women](https://www.brandsforless.com/en-ae/women/) | Fashion candidate | **Unavailable:** desktop challenge and Android WebView timeout after 45 seconds; no BFL products were fabricated |

`src/domain/discovery.ts` is the executable source register. A test compares its retailer keys with `SUPPORTED_SITES`, so a tracked retailer cannot silently disappear from discovery coverage. Registration does not imply a successful fetch: the app's **Sources** control displays actual per-collection counts, age, failures, and these endpoint URLs. Tapping a JSON collection opens its human-readable store listing.

## Fetching and reliability

- HTML extraction handles retailer JSON-LD, Level Shoes state, Salesforce product tiles, Namshi/Sephora Flight data, Puma tiles, Amazon results, and Noon's inline and rendered formats. Remote JavaScript is never evaluated by the TypeScript parser.
- Shopify feeds serve Decathlon/Salomon. Al Yousuf uses its public WooCommerce store feed. No backend, external recommendation service, account, API credential, or scraping proxy is involved.
- Four foreground workers fetch independent collections. Protected HTML pages can use the existing Android WebView fetcher; browser fallbacks are queued. A timeout now stops and destroys the WebView.
- Successful collections have separate AsyncStorage keys. Concurrent writes cannot overwrite another retailer's cache. Failed or empty responses retain previous products and their original observation time.
- Browsing reuses a six-hour cache, while pull-to-refresh requests new observations. Cached products appear before slower retailers finish. Discovery never enters the tracked-product background schedule.
- Listings carry observed prices, including `From` when the source exposes a range. Tracking fetches the product page again and requires source options where supported. A listing price is not a historical-low claim or a guarantee about every variant.

## Limits that still exist

This is a set of selected collections, not every department or every SKU at every retailer. On 26 October, the parameter-based Decathlon, Salomon and Al Yousuf feeds were increased from 24 to 100 products per request, and the local HTML/WooCommerce extraction cap was increased from 48 to 100. Live checks returned 51 Footwear, 100 Fitness, 100 Hiking/Camping, 97 usable Al Yousuf, and 100 Salomon products. Retailer responses can contain fewer usable products than requested.

HTML listings still supply their retailer-defined first page; a higher local extraction cap does not fetch additional retailer pages. **Show more** continues to reveal the fetched catalogue in display batches of 24. Older caches automatically refresh after this limit change. BFL remains unavailable. Additional source pages and pagination should be added with the same extraction and Android validation checks.

Storefront challenges can change between requests. A successful listing fetch does not guarantee that every product page will load; tracking reports a verification failure rather than saving an unverified item. Retailers that omit a brand are shown as `Other brands` instead of guessing from a product title.

## Reproduce the checks

```powershell
node --max-http-header-size=131072 scripts/probe-discovery.cjs
# Connected Android debug build + Metro:
node scripts/probe-discovery-android.cjs carrefour-nf1210300
node scripts/probe-discovery-android.cjs bfl-women
```

The desktop probe reads the same source register as the app. Responses and machine-readable results stay under ignored `.tmp/discovery/`; do not commit full retailer HTML because it may include session data. The Android probe calls the existing native fetcher through the local Hermes inspector, which is unavailable in the standalone release build.
