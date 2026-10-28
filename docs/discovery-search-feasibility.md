# Product-name search across retailers

Investigation: 28 October 2026. Scope: the 19 UAE/GCC retailers in Qeemat's discovery registry. This is a feasibility audit, not an implemented search feature or Android certification.

## Finding

A search field in For You can submit the same product name to retailer-specific search providers, then progressively combine their products into the existing feed. No backend or accounts are required for the approaches investigated. Each source needs its own URL builder, result/empty-state handling and pagination contract; product-page tracking support alone does not establish search support.

Twelve sources returned extractable products in live desktop HTTP samples. Five further sources displayed product search results in the in-app browser. Two remain unresolved for extraction in this pass. These counts describe sample evidence, not production reliability or guaranteed matches for every query.

## Source-by-source evidence

Numbers below are cards extracted from a single response, not total retailer inventory. Links are the actual sample searches; query parameters must be encoded when built from user text.

| Source | Search URL tested | Evidence | Work before enabling |
|---|---|---|---|
| Nike UAE | [shoes](https://www.nike.ae/en/search?q=shoes) | 12 products; retailer redirected to its shoes PLP. Air Max also redirected to the matching collection and returned 12 cards including Air Max 90/Plus/Muse. Unmatched control extracted zero. | Verify Android requests; allow legitimate category redirects. |
| Sun & Sand Sports | [shoes](https://en-ae.sssports.com/search?q=shoes) | 24 products; unmatched control extracted zero. | Search provider and pagination. |
| Adidas | [shoes](https://www.adidas.ae/en/search?q=shoes) | 48 products. Unmatched control returned HTTP 404 with zero products. | Distinguish a genuine no-match response from an invalid URL or challenge. |
| Puma | [shoes](https://ae.puma.com/ae/en/search?q=shoes) | 16 products; unmatched control extracted zero. | Search provider and pagination. |
| Level Shoes | [sneakers](https://www.levelshoes.com/search?term=sneakers) | 48 extracted; rendered page confirmed the search heading and products. Uses `term`, not `q`. Impossible query still extracted nine unrelated cards. | Isolate genuine results from fallback/recommendations; search provider and pagination. |
| Ounass | [women's sneakers](https://www.ounass.ae/women?fh_location=%2F%24s%3Dsneakers) | 24 extracted after submitting its actual search UI; unmatched control extracted zero. A guessed `/search?q=` route returned 404. | Search separate women/men/kids audiences and merge duplicates; a women-only query would omit coverage. |
| Namshi | [sneakers](https://www.namshi.com/uae-en/search/?q=sneakers) | 60 extracted. An impossible query still returned 25 unrelated products. | Detect retailer fallback/semantic results and apply relevance checks before treating cards as matches. |
| The Deal | [shoes](https://www.thedealoutlet.com/ae-en/search?q=shoes) | 24 products; unmatched control extracted zero. | Search provider; retain exact variant verification on tracking. |
| Faces | [perfume](https://www.faces.ae/en/search?q=perfume) | 48 extracted. An impossible query still returned 20 unrelated products. | Separate genuine matches from fallback/recommended inventory. |
| Noon | [iPhone](https://www.noon.com/uae-en/search/?q=iphone) | 50 products; unmatched control extracted zero. | Preserve model/configuration identity and handle challenges/Android validation. |
| Carrefour | [milk](https://www.carrefouruae.com/mafuae/en/search?keyword=milk) | 60 seller-specific products. `/v4/search` redirects here. Unmatched follow-up was rate limited (429), so no empty-state conclusion. | Delivery context, seller/offer identity, grocery pack/weight metadata and rate limiting. |
| Al Yousuf Accessories | [helmet JSON](https://ay-accessories.com/wp-json/wc/store/v1/products?search=helmet&per_page=20) | 19 products through the public WooCommerce store endpoint; unmatched control returned an empty array. | Search provider using existing WooCommerce normalization and page parameters. |
| Brands For Less | [Nike](https://www.brandsforless.com/en-ae/search/?q=nike) | Desktop 403; rendered browser showed 471 results with 48 visible product cards. | Native rendered search fetch and timeout/empty-state verification. Browser success does not establish Android success. |
| Centrepoint | [shoes](https://www.centrepointstores.com/ae/en/search?q=shoes) | Desktop 403; rendered browser showed 22,450 results and 84 cards. | Native search fetch and pagination/empty-state checks. |
| Sephora | [perfume](https://www.sephora.me/ae-en/search?q=perfume) | Desktop 403; rendered browser displayed 36 of 4,690 products. | Search-result extraction from rendered page and native validation. |
| Decathlon | [shoes](https://decathlon.ae/search?q=shoes&type=product) | Desktop 429; browser showed 1,000 results with 24 product cards. | Dedicated search provider: existing Shopify collection `products.json` parsing cannot simply be pointed at search HTML. Preserve From prices. |
| Salomon GCC | [shoes](https://salomongcc.com/search?q=shoes&type=product) | Desktop 429; storefront search UI produced 764 results with prices. Current store uses Shopify search; guessed Magento route returned 404. | Search adapter and native validation. Store UI added prefix and in-stock filters; do not silently inherit those when promising all results. |
| Sharaf DG | [search](https://uae.sharafdg.com/?q=iphone&post_type=product) | Search UI submitted `q`; legacy `s` route also loaded a titled search shell. Neither supplied an extractable product grid in this pass. | Resolve actual asynchronous search results and wait conditions. Do not substitute unrelated recommendations. |
| Amazon UAE | [iPhone](https://www.amazon.ae/s?k=iphone) | Desktop 503; browser navigation timed out in this pass. | Validate search results through the Android fetch path, challenges, ads and price extraction. Existing Amazon listing parsing is insufficient evidence by itself. |

Namshi also documents product-name entry through its [official search help](https://help.namshi.com/portal/en/kb/articles/how-can-i-search-for-products-on-namshi). BFL's [public perfume search](https://www.brandsforless.com/en-ae/search/?q=perfumes) is separately indexed, but the counts above come from this investigation's browser observation.

## Recommended product behavior

- Place **Search products across stores** above the For You feed. Submit on the keyboard search action or a Search button, rather than issuing 19 requests for every keystroke.
- Keep results on the same screen. Show the query, clear-search action, retailer filters, and progress such as “8 of 19 stores checked.” Stream products as retailers finish; a slow store must not hold the whole result set.
- Explicit search takes precedence over preference interests and budgets. Keep those available as optional filters; silently excluding a searched product because of onboarding choices would be confusing.
- Rank exact brand/model matches before broader keywords. Keep distinct sizes, configurations, packs and retailer offers distinguishable. The same item at different retailers is useful comparison coverage, not a duplicate to remove blindly.
- Separate **no matching products**, **unavailable/blocked**, and **still searching**. Never describe a failed store as having no stock. Do not fill empty search results with unrelated discovery picks under the search heading.
- Retain existing cards and Track price verification/variant selection. Clearing the query restores the previous discovery selection and scroll position.
- Cache by normalized query, source, locale/delivery context and page. Cancel or ignore obsolete requests when a new query is submitted. Limit parallel requests and native browser work; add source-specific Load more rather than fetching every page.
- No background search monitoring in the first version. Only saved trackers enter existing background checks.

## Implementation and validation boundary

The most concrete initial scope is the 12 HTTP-extractable sources, with explicit repairs for Namshi/Faces/Level Shoes relevance and Ounass audience coverage. A more specific Noon iPhone 16 query also returned an iPhone 17 among its cards, reinforcing the need to rank exact model matches and separate alternatives. The five browser-confirmed sources are plausible additional integrations, pending adapters and Android checks. Sharaf DG and Amazon should remain unavailable in search until actual product-result extraction is proven.

Before claiming a source works, test at least a real model name, a broad query, a nonsense/no-match query, Unicode/special characters, a second result page, a blocked/offline response, cancellation, and tracking a selected option. Check grocery packs and configuration-specific results. This investigation used different relevant sample queries for each retailer; it did not establish identical-query coverage or latency across all 19 at once.

Raw samples and read-only probe outputs are under ignored `.tmp/discovery-search/` (`results.json`, `followup.json`, `final-checks.json`). No application behavior was changed and no device build was installed for this audit.
