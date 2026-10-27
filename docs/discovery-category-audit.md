# Discovery category coverage audit

Started 26 October 2026, after Carrefour PR #68 merged. This is an implementation work log and source map, not a claim that every discovered URL already supplies products.

The previous registry had 23 selected listings for 19 retailers. Four interests combined unrelated shopping choices and electronics supply was concentrated on headphones. The replacement must make each retailer's departments and product listings browsable, with independent shopping interests and budgets.

## Source-by-source investigation

Navigation HTML was fetched independently for every retailer with `scripts/audit-discovery-navigation.cjs`. It writes raw responses and extracted navigation to ignored `.tmp/discovery-navigation/`. Counts below are navigation links, not counts of working product feeds.

| Retailer | Evidence inspected | Initial finding / next extraction check |
|---|---|---|
| [Nike](https://www.nike.ae/en/) | Homepage navigation, 359 links | 56 men's, women's and kids' footwear, clothing and accessories category links; current feed used two footwear listings. |
| [Sun & Sand Sports](https://en-ae.sssports.com/) | Homepage navigation, 732 links | 81 apparel/footwear/accessory listings plus cycling, swimming, fitness, boxing, football, basketball and racket-sport equipment. |
| [Adidas](https://www.adidas.ae/en) | Homepage navigation, 308 links | Separate men's, women's and kids' shoes, clothing and accessories; sport and equipment categories are additional listings. |
| [Puma](https://ae.puma.com/ae/en) | Homepage navigation, 170 links | Separate footwear, clothing, accessories and sports equipment across women, men, boys and girls. |
| [Decathlon](https://decathlon.ae/) | Homepage navigation, 350 links | Many sports and equipment/apparel/footwear collections beyond the three existing feeds. The collections enumeration endpoint returned 429; navigation still loaded. |
| [Salomon](https://salomongcc.com/) | Official storefront via web reader | Shop-by-activity includes trail, road and gravel running, hiking, sportstyle and hydration. Native/browser listing validation is needed; desktop home/enumeration returned 429. |
| [Level Shoes](https://www.levelshoes.com/) | Homepage Next data | 560 relative/absolute navigation references before canonical deduplication, spanning women, men and kids with shoes, bags and accessories. |
| [Ounass](https://www.ounass.ae/women) | Women/men landing pages and six women's department pages | Department navigation changes with the active page. Clothing, footwear, bags, accessories, jewellery and beauty each need their own subtree extraction. |
| [Namshi](https://www.namshi.com/uae-en/) | Homepage navigation, 648 links | Apparel, footwear, bags, accessories, makeup, skincare, fragrance, haircare, bodycare, home and kids have distinct PLPs. |
| [The Deal](https://www.thedealoutlet.com/ae-en) | Homepage navigation, 348 links | Permanent department paths coexist with monthly promotional copies. Map the permanent women's, men's and kids' categories and keep designer filters separate. |
| [Faces](https://www.faces.ae/en) | Homepage navigation, 403 links | Fragrance families/types, makeup, skincare, haircare and bodycare have extensive independent categories. |
| [Sephora](https://www.sephora.me/ae-en) | Official navigation and published category sitemap | Full makeup, skincare, fragrance, haircare and bath/body trees exist. Sitemaps include multiple locales: only UAE English URLs belong in this registry. Desktop home was blocked. |
| [Centrepoint](https://www.centrepointstores.com/ae/en/) | Official navigation via web reader | Women's/men's/kids' apparel, shoes, bags/accessories, beauty, baby and home trees. Desktop requests were blocked; Android extraction must be checked. |
| [Sharaf DG](https://uae.sharafdg.com/) | Homepage navigation, 348 links | Phones, tablets, computers, gaming, TV, audio, cameras, wearables, appliances, furniture, grooming and fragrance; the old feed used only headphones. |
| [Noon](https://www.noon.com/uae-en/) | Homepage navigation, 1,224 links | Broad marketplace taxonomy and promotions are mixed in navigation; separate permanent category URLs from campaigns, brands and product links. |
| [Amazon UAE](https://www.amazon.ae/) | Homepage and electronics browse navigation | Public browse nodes provide department/category paths. Department landing pages must resolve to actual result listings rather than editorial pages. |
| [Carrefour](https://www.carrefouruae.com/mafuae/en/all-categories) | All Categories page plus official PLP sitemap | 189 navigation links; the sitemap lists 2,899 PLPs, mostly coded URLs. Use the named department tree to establish labels and hierarchy instead of showing category codes. Grocery and household departments must also be accounted for. |
| [Al Yousuf](https://ay-accessories.com/) | Navigation and public WooCommerce category feed, pages 1–5 | Three nonempty pages of category records. Resolve parent categories and source counts; the old unfiltered product feed mixed distinct departments. |
| [Brands For Less](https://www.brandsforless.com/en-ae/) | Desktop request and user's phone-browser check | Desktop returned 403. The user confirmed categories/products work in their phone browser. Investigate Qeemat's browser fetch path; do not represent BFL as validated supply until that works. |

## Implementation approach

- Separate clothing, footwear, bags, accessories, jewellery, watches, makeup, skincare, fragrance and haircare. Split technology into actual departments such as phones, computers, tablets, television, audio, cameras and gaming.
- Preserve the original broad preference selections by migrating them into the corresponding new interests and budget ceilings. Keep tracking data untouched.
- The user explicitly confirmed that this release should enable **all departments, including groceries**. Include price-basis/unit handling and protect tracking from pack-size or pricing-basis changes; do not silently exclude groceries.
- Retain exact source labels, department paths, audiences and URLs in a per-retailer registry. Distinguish permanent categories from brand filters, editorial pages, services and promotions.
- Make mapped listings individually selectable in the app. Fetch selected pages on demand and keep a varied initial feed; an expanded registry must not trigger thousands of requests at launch.
- Report mapping and extraction separately. Preserve cached products when a page is blocked or empty and keep its error visible. Validate product-to-tracker accuracy, not just listing counts.

This document will be updated with the final registry counts and actual extraction/device results as the source-by-source implementation lands.

### Nike checkpoint

Mapped 56 permanent listing pages from the retailer's own navigation: 27 clothing, 20 footwear, three bags and six accessories listings across men, women and kids. Every mapped page returned 12 products in the desktop extraction pass (56/56 successful). Exact URLs and source breadcrumbs are recorded in `src/domain/discoverySources/nike_uae.json`. These maps are now connected to the on-demand browser on this branch.

### Sun & Sand Sports, Puma and Adidas checkpoints

- Sun & Sand Sports: 104 named category listings mapped; 104/104 returned products in the desktop extraction pass, including clothing, footwear, accessories, cycling, boxing, swimming, fitness and racket-sport equipment.
- Puma: 46 named listings mapped; 45/46 returned products. Men's underwear returned no usable product tiles and needs further inspection; it is not counted as validated supply.
- Adidas: 108 permanent/category listings mapped. Seven pages returned products before the desktop client began receiving 2,760-byte JavaScript challenges with HTTP 200. The remaining pages are recorded as blocked/unverified, not empty inventory. Android browser-path validation is required before claiming complete extraction coverage.

Each retailer has its own JSON map under `src/domain/discoverySources/`. The mappings retain source URLs, audience, department paths and whether a page is a department listing. Promotional sale copies and brand-filter URLs were excluded from this permanent category pass.

## Integrated expansion — 27 October 2026

The app and diagnostics now share `src/domain/discoverySources.ts` for scoped discovery; the previous 23-source selection has been removed. Default loads request a bounded batch, and diagnostic scripts accept explicit source IDs. There are **50 independent interests**, **4,051 mapped listings across 18 retailers**, and one existing BFL source. These are listing URLs, not 4,051 different shopping interests or 4,051 independently validated feeds.

| Retailer | Mapped listings | Current evidence |
|---|---:|---|
| Nike | 56 | Full desktop map: 56/56 extracted. |
| Sun & Sand Sports | 104 | Full desktop map: 104/104 extracted. |
| Adidas | 108 | Initial seven extracted before desktop challenges; later cross-source sample 4/4 extracted. Native WebView men's clothing extracted 48 products. |
| Puma | 46 | Full desktop map: 45/46 extracted; men's underwear unresolved. |
| Decathlon | 231 | Navigation and public collection feeds mapped; desktop rate limiting varies. Native HTTP fitness returned 100 products. |
| Salomon GCC | 28 | Native HTTP accessories returned 43 products. Later desktop sample extracted apparel and bags, with shoes/accessories rate limited. |
| Level Shoes | 67 | Embedded navigation mapped; cross-source sample 4/4 extracted. |
| Ounass | 195 | Women, men and kids departmental navigation mapped; cross-source sample 4/4 extracted. |
| Namshi | 167 | Cross-source clothing, footwear and bags extracted; the home landing supplied no usable products. |
| The Deal | 154 | Permanent women/men/kids navigation mapped; cross-source sample 4/4 extracted. |
| Faces | 216 | Perfume, skincare, makeup, hair and body navigation mapped; cross-source sample 4/4 extracted. Makeup brushes/sponges are classified as beauty tools. |
| Sephora | 356 | UAE-English permanent category sitemap mapped. Cross-source desktop sample 403; expanded departments still require Android validation. |
| Centrepoint | 579 | Native navigation mapped, including home, baby, school and travel. Native HTTP women's clothing returned 84 products; desktop sample 403. |
| Sharaf DG | 56 | Own category navigation mapped. Desktop tablets extracted four products; phones, accessories and fryers require rendered-page extraction validation. |
| Carrefour | 341 | All Categories plus named child links from department pages. A further 166-page navigation pass returned 70 HTTP 200 and 96 HTTP 429 responses; it is incomplete. Cross-source food sample 4/4 extracted. |
| Amazon UAE | 226 | Own department browse nodes mapped, including book genres and computer subcategories. Search-result and department-card layouts differ; parser repairs recovered baby and book cards from saved sample responses. |
| Noon | 824 | Own observed category and filtered-listing URLs, including instruments, music and films. Unlike the permanent-only maps, this includes named brand/filter/promotion PLPs, which can expire. Cross-source desktop responses were challenge shells; expanded Android validation is pending. |
| Al Yousuf Accessories | 297 | Positive-count public WooCommerce categories retain their parent paths. Cross-source sample 4/4 extracted across marine/motorcycle/apparel/footwear. |
| Brands For Less | 1 existing source | User confirmed normal phone-browser categories/products. Qeemat's hidden WebView timed out; desktop catalogue service was challenged. Its current storefront is a SPA, while the old parser expects Next data. Full category mapping and current product extraction remain unresolved. |

### Browsing and preferences

- The quiz groups separate interests such as clothing, footwear, skincare, fragrance, phones, computers, cameras, audio, fresh food, pantry, pets and household supplies. Old combined choices expand into their constituent interests, with independent budget overrides retained.
- **Browse departments & retailers** exposes interests, retailers and a virtualized/searchable listing index. Listing rows retain retailer paths and show human page URLs plus the fetch URL where different. Selecting any of these updates the same feed; tracking preserves the browsing position.
- Initial loading requests at most 24 matching listing pages, spread across retailers and interests. **Load more listings** adds another 24 pages. **Show more** displays additional cards already fetched. Retailer pagination beyond each page's response is still not implemented; each response has a 100-product extraction ceiling.
- Mixed department pages are available explicitly but do not masquerade as a specific leaf interest. A blocked retailer retains its cache and shows failure status. Newly selected pages can be unavailable offline until first successfully loaded.

### Groceries and price comparisons

The user explicitly chose to enable all departments, including groceries. Carrefour's observed default-weight price is normalized to AED/kg using its supplied weight. Confirmed native observations included banana AED 4.95 for 500 g (AED 9.90/kg) and sale apples AED 5 for 500 g (AED 10/kg). Apple's analytics `unitPrice` was 13, the marked/original rate, so it must not be used as the selling price. These observations are test evidence, not current price promises.

The kilogram basis persists on products, snapshots and activity. Product prices, selected options and target inputs show the basis. Source-declared title pack sizes/counts are normalized for comparison; a changed pack or basis records a failed check, retains history and suppresses alerts. Legacy default-weight trackers require review/re-adding rather than silently changing units and target thresholds. Titles that omit pack information cannot prove pack equivalence. Retailer default delivery context and final delivered weight can change the checkout total.

### Validation status

- Typecheck passes. Lint passes with the existing App.tsx inline-margin warning. Jest: 227 passing tests, one existing skip, 23 suites.
- New checks cover bounded source selection, category/budget migration, collection memberships, independent category budgets, source selection updating the current screen, weighted prices and changed-pack alert suppression.
- A cross-source desktop extraction sample initially returned products from 47/72 pages. Re-parsing saved Amazon responses after layout fixes recovered one baby card and 19 book cards; this is not a fresh all-source Android pass.
- Standalone release at runtime revision `12d1999` compiled successfully (52 seconds). APK v2 signature verifies using the repository's existing Android debug certificate. Package metadata: `com.qeemat`, `0.5.5-alpha`, versionCode 3, arm64-v8a, launch activity `com.qeemat.MainActivity`. APK SHA-256: `88DFECE34C8CB51031473A76D1455530F6FF7F772029445AE1ED984B6CB29343`. A copy is available locally at `.tmp/discovery-validation/qeemat-category-expansion-12d1999-arm64-release.apk`.
- Installation of this revision is still pending. Windows currently sees the Samsung device, but ADB does not expose a debugging connection. No emulator is configured. Existing trackers must be preserved during installation; APK inspection is not installed-device verification.
- Do not treat this as complete Android validation or complete enumeration of every retailer's internal taxonomy. BFL, blocked/rendered department paths and product-to-tracker checks remain open.
