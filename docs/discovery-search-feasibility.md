# Product-name search across retailers

Updated: 28 October 2026. Scope: the 19 UAE/GCC retailers in Qeemat's discovery registry. Search is implemented for 18 sources on `codex/search-across-retailers`; Sharaf DG is excluded. A physical-device search smoke test passed on Samsung SM-S928B; the full per-source/query matrix remains incomplete.

## Finding

A search field in For You can submit the same product name to retailer-specific search providers, then progressively combine their products into the existing feed. No backend or accounts are required for the approaches investigated. Each source needs its own URL builder, result/empty-state handling and pagination contract; product-page tracking support alone does not establish search support.

The initial pass extracted products from 12 sources over desktop HTTP. Browser research and dedicated parsers added BFL, Centrepoint, Sephora, Decathlon and Salomon. A later Amazon retry supplied organic results and a verified empty state, so Amazon is included too. These are sample validations, not a guarantee that every request or query succeeds. Sharaf DG still supplies only an unreadable search shell and is not requested by the search coordinator.

## Source-by-source evidence

Numbers below are cards extracted from a single response, not total retailer inventory. Links are the actual sample searches; query parameters must be encoded when built from user text.

| Source | Search URL tested | Evidence | Implemented handling / limits |
|---|---|---|---|
| Nike UAE | [Air Max](https://www.nike.ae/en/search?q=air%20max) | 12 model matches; observed next page added 12 distinct matches. Earlier unmatched control extracted zero; a later request timed out. | Allow keyword-to-collection redirects and follow the retailer's grid cursor. Preserve failed-source status/cache. |
| Sun & Sand Sports | [shoes](https://en-ae.sssports.com/search?q=shoes) | 23 title/brand matches in the later pass; next page added 24. Unmatched control returned zero. | Query provider and observed grid pagination implemented. |
| Adidas | [shoes](https://www.adidas.ae/en/search?q=shoes) | Initially 48 products. Later responses were JavaScript challenge shells. | Included with native fallback. Challenge shells remain unavailable, never empty inventory. Native search reliability remains unverified. |
| Puma | [shoes](https://ae.puma.com/ae/en/search?q=shoes) | Later pass retained seven matches; page two added 11. Unmatched response uses an encoded apostrophe in its empty message. | Preserve query when following the observed page link; decode the empty-state message. |
| Level Shoes | [men's sneakers](https://www.levelshoes.com/search?term=sneakers&gender=men) | Separate women/men/kids samples each returned 48 results and zero matches for the control. Default search silently uses women. | Search all three genders. Read only `_productList` for the requested term, excluding recommendation state. First response only. |
| Ounass | [women's sneakers](https://www.ounass.ae/women?fh_location=%2F%24s%3Dsneakers) | Women/men/kids requests each returned products; unmatched controls returned zero. A guessed `/search?q=` route returned 404. | Search all three audiences and merge identical source identities. First response from each audience only. |
| Namshi | [sneakers](https://www.namshi.com/uae-en/search/?q=sneakers) | 56 matches after filtering; page two added 58. The impossible query's 25 unrelated raw products now produce zero matches. | Require query words/model tokens in title/brand and follow observed search page links. |
| The Deal | [shoes](https://www.thedealoutlet.com/ae-en/search?q=shoes) | 24 matches. Unmatched HTML says “No results for”. The observed next grid request returned 500. | Empty state handled. Failed continuation retains page one and can retry through native fetching; it is not counted as successful pagination. |
| Faces | [perfume](https://www.faces.ae/en/search?q=perfume) | 18 title/brand matches in the later pass. The impossible query's 20 unrelated products now produce zero matches. | Conservative query matching with fragrance/EDP/EDT vocabulary. First response only. |
| Noon | [iPhone 16](https://www.noon.com/uae-en/search/?q=iphone%2016) | 11 matches from 50 raw cards; iPhone 17 alternatives are excluded. Control returned zero. | Preserve model-number tokens and rank named products ahead of compatible accessories. First response only. |
| Carrefour | [milk](https://www.carrefouruae.com/mafuae/en/search?keyword=milk) | 60 matches; later control returned zero, although earlier requests were rate limited. | Retain seller/offer identity and source food/weight metadata. Use retailer-default delivery context. First response only. |
| Al Yousuf Accessories | [helmet JSON](https://ay-accessories.com/wp-json/wc/store/v1/products?search=helmet&per_page=20) | 19 priced matches on each of pages one and two, with 19 distinct additions. Control returned an empty array. | Paginate using raw response count, not usable-price count; an unpriced record must not prematurely end paging. |
| Brands For Less | [Nike](https://www.brandsforless.com/en-ae/search/?q=nike) | Browser DOM yields 47 matching cards; control yields zero. Clicking page two confirmed `?page=2&q=nike`. | Rendered card parser and observed pagination implemented; native wait now accepts verified empty headings. Android fetching remains unverified. |
| Centrepoint | [shoes](https://www.centrepointstores.com/ae/en/search?q=shoes) | Browser snapshot yields 84 matches; control yields zero. | Decode the public base64 UTF-8 search state and read product hits, not recommendations. First response only; native verification pending. |
| Sephora | [perfume](https://www.sephora.me/ae-en/search?q=perfume) | Browser snapshot yields 28 title/brand matches; control yields zero. | Read current rendered card attributes and visible AED selling prices; dollar analytics and struck prices are not used. First response only; native verification pending. |
| Decathlon | [shoes](https://decathlon.ae/search?q=shoes&type=product) | Browser card snapshot yields 23 matches; browser-confirmed empty search yields zero. | Dedicated Shopify search-card parser preserves visible From prices. Follow next links only when present in the returned HTML. Native verification pending. |
| Salomon GCC | [Speedcross](https://salomongcc.com/search?q=speedcross&type=product) | Browser snapshot yields 50 matches and an observed next-page link; control yields zero. | Dedicated Shopify search-card parser uses selling price and source product type. Retailer adds an in-stock filter on its own. Native verification pending. |
| Sharaf DG | [search](https://uae.sharafdg.com/?q=iphone&post_type=product) | Search UI submitted `q`; legacy `s` route also loaded a titled shell. Neither supplied a verifiable product grid in these checks. | Excluded from search. Product tracking and department discovery support are unchanged. |
| Amazon UAE | [iPhone](https://www.amazon.ae/s?k=iphone) | Initially desktop 503/browser timeout. Later browser retry yielded 46 organic matches and zero for the control, plus an observed next-page link. | Parse only complete organic search cards; exclude AdHolder advertisements and recommendation carousels. Reject robot challenges. Native verification pending. |

Namshi also documents product-name entry through its [official search help](https://help.namshi.com/portal/en/kb/articles/how-can-i-search-for-products-on-namshi). BFL's [public perfume search](https://www.brandsforless.com/en-ae/search/?q=perfumes) is separately indexed, but the counts above come from this investigation's browser observation.

## Implemented product behavior

- **Search products across stores** sits above the For You feed. Submit on the keyboard search action or Search button; typing alone does not fetch.
- Results stay on the same screen, with a query heading, clear action, retailer filters and progress such as “8 of 18 stores checked.” HTTP work uses three workers; browser challenges run afterward so they cannot occupy HTTP workers and block the remaining stores.
- Explicit search takes precedence over preference interests and budgets. Keep those available as optional filters; silently excluding a searched product because of onboarding choices would be confusing.
- Rank exact brand/model matches before broader keywords. Keep distinct sizes, configurations, packs and retailer offers distinguishable. The same item at different retailers is useful comparison coverage, not a duplicate to remove blindly.
- Separate **no matching products**, **unavailable/blocked**, and **still searching**. Never describe a failed store as having no stock. Do not fill empty search results with unrelated discovery picks under the search heading.
- Retain existing cards and Track price verification/variant selection. Clearing the query restores the previous discovery selection and scroll position.
- Cache up to eight normalized queries locally, retaining per-source results, observation times and continuation cursors. Fresh entries can be reused for 15 minutes; pull-to-refresh forces a retry. Obsolete queries cannot publish into the current feed. The cache uses each UAE storefront's default context, not a user-selected delivery address.
- No background search monitoring in the first version. Only saved trackers enter existing background checks.

## Implementation and validation boundary

All 18 included sources have extraction code and positive source-shaped evidence. The remaining exclusion is Sharaf DG. This does not establish simultaneous Android success, identical-query catalogue coverage, or a latency guarantee. Sources can still fail temporarily due to challenges or rate limits; those states are shown as unavailable with cached matches preserved.

Matching is intentionally conservative: query words must appear in the title, brand or explicitly supplied product type, with a small footwear/fragrance synonym map. Model numbers remain distinct. Exact phrases rank before longer matches, and compatible accessories rank lower unless requested. This can omit relevant products whose names use other synonyms; it is not a semantic recommendation engine.

Pagination is partial: observed continuation links or WooCommerce page parameters are followed, but the sources marked first-response-only above are not claimed to exhaust retailer search inventory. Retailer defaults (including Salomon's in-stock filtering) and delivery location can affect results and prices. Search does not promise interchangeable configurations, packs, sellers or delivered totals.

Before claiming a source works, test at least a real model name, a broad query, a nonsense/no-match query, Unicode/special characters, a second result page, a blocked/offline response, cancellation, and tracking a selected option. Check grocery packs and configuration-specific results. This investigation used different relevant sample queries for each retailer; it did not establish identical-query coverage or latency across all 19 at once.

Raw samples and probe outputs stay under ignored `.tmp/discovery-search/`. `scripts/probe-discovery-search.cjs` checks providers live, with optional source keys; `--browser-samples` re-parses captured DOM without claiming a new HTTP/device test. Browser DOM samples and unit fixtures cover the six browser-dependent additions. Typecheck passes; lint has one existing inline-style warning. Jest: 262 passing, one existing skip, 27 suites.

## Physical-device smoke test — 28 October 2026

- Installed the standalone APK over the existing app on Samsung SM-S928B without clearing storage. The original installation date remained 19 June; the watchlist still displayed 24 items and existing preferences remained available. No tracker was added, edited or deleted during testing.
- A fresh `iphone 16` search completed checks for all 18 included stores and displayed 196 title/brand matches across nine retailers. This is observed sample coverage, not a promise that all sources return products for every query.
- Device testing exposed retailer round-robin ordering placing cases before phones, plus the accessory heuristic exempting a case because its title included “with”. Revision `e665848` removes search round-robin ordering and distinguishes a case with magnets from a phone bundled with a case. Regression tests reproduce both failures.
- Rebuilt and installed the correction. The cached query then displayed actual iPhone 16 phones first. Verified retailer filtering to Nike produced zero matches, All search stores restored 196, clearing search restored discovery (1,069 products across 17 retailers at that observation), and the coverage sheet scrolled to the excluded Sharaf DG entry. Query cache survived the update.
- No fatal Android runtime or React Native JS errors appeared in the checked log samples. Screenshots and UI hierarchies are saved under `.tmp/discovery-search/phone-*`; `phone-final-search.png` shows the corrected order.
- This did not test every retailer with its own positive product query, offline operation, all continuation paths, tracking/variant saves or alert delivery. The per-source pending notes above refer to that broader matrix, not to installation or the basic search journey.

## Standalone build

Installed runtime revision `e665848` compiled successfully for arm64-v8a in 58 seconds. The APK is `com.qeemat`, version `0.5.5-alpha` / code 3, with launch activity `com.qeemat.MainActivity`. Its v2 signature verifies using the repository's existing Android debug certificate. Local artifact: `.tmp/discovery-search/qeemat-product-search-e665848-arm64-release.apk`. SHA-256: `7737ACD23CABC230AC110556E75DB1E17679C6E2D40A48EB363AE3286809BEB5`. It includes its JS bundle and does not require Metro. Device package metadata recorded `lastUpdateTime=2026-10-28 13:30:50`; installation and search UI were verified after that update.
