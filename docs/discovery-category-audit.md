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
- Retain exact source labels, department paths, audiences and URLs in a per-retailer registry. Distinguish permanent categories from brand filters, editorial pages, services and promotions.
- Make mapped listings individually selectable in the app. Fetch selected pages on demand and keep a varied initial feed; an expanded registry must not trigger thousands of requests at launch.
- Report mapping and extraction separately. Preserve cached products when a page is blocked or empty and keep its error visible. Validate product-to-tracker accuracy, not just listing counts.

This document will be updated with the final registry counts and actual extraction/device results as the source-by-source implementation lands.

### Nike checkpoint

Mapped 56 permanent listing pages from the retailer's own navigation: 27 clothing, 20 footwear, three bags and six accessories listings across men, women and kids. Every mapped page returned 12 products in the desktop extraction pass (56/56 successful). Exact URLs and source breadcrumbs are recorded in `src/domain/discoverySources/nike_uae.json`. These mappings are staged for the new on-demand browser; the current opening feed has not yet been switched to this registry.
