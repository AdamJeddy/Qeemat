# Adding a new source

A **source** is a retailer/storefront Qeemat can use. Adding one is not only a parser branch: a source can participate in tracking, discovery, search, compare/grouping, variants, alerts and the release docs. Decide the scope first, prove the evidence, then wire each layer.

Use this guide with the [`add-source` specialist](../.zero/specialists/add-source.md) and copy [`source-onboarding-template.md`](source-onboarding-template.md) for the decision/evidence record.

## 0. Decide the scope before coding

Ask/answer these explicitly:

- **Tracking only, discovery, search, or all three?** A source can be supported for tracking without a verified discovery/search map (`discoveryAvailable: false`); the Add flow and Settings still show it, Explore does not.
- **Supported or experimental?** Experimental means hidden from the supported-store UI and not promised to users; use it while validation is incomplete.
- **Is the product page fetchable without login, captcha bypass or a browser-only session?** Qeemat does not bypass bot protection. A WebView fallback is acceptable only for pages that render normally in a normal browser; do not add CAPTCHA/login flows.
- **What is the actual price?** One unambiguous price, or a "from" range? What currency? Is it per kg / per pack? Does a marketplace seller change the offer?
- **What identifies the exact variant?** SKU / option ID / source URL / initial-page options. If none is reliable, track at page level and say so.
- **What does discovery expose?** Owned navigation/collection URLs and a listing format; map only real observed URLs. Deduplicate product ids and keep an observed category, not a guessed one.
- **What does search expose?** A real search URL, a query echo/verification signal, a no-results state, pagination and challenge behaviour. If search cannot be verified, exclude it explicitly and document why.
- **Rate/bot constraints?** Minimum interval, required headers/locale, 403/checkpoint behaviour, whether a browser fallback is needed.
- **Currency/location assumptions?** Qeemat is UAE-first; do not silently treat a foreign price as AED.

Write the answer in the onboarding template before editing code.

## 1. Tracking foundation

### 1.1 Site key and registry

- `src/domain/types.ts` — add to the `SiteKey` union.
- `src/domain/sites.ts` — add the `SupportedSite` entry:
  - `displayName`, `shortName`, `hostnames` (include all real storefront/regional hosts; `detectSupportedSite` uses suffix matching).
  - `status: 'supported' | 'experimental'`.
  - `notes` describing the real source and limitations, not marketing copy.
  - `minimumIntervalHours` when the retailer needs a slower check cadence.
  - `discoveryAvailable: false` only when tracking works but no verified discovery source exists.
  - `iconAsset: require('../../assets/site-icons/<key>.png')`.
- `src/components/SiteIcon.tsx` — add the fallback colour to `SITE_COLORS` (the `Record<SiteKey, string>` type makes omissions a type error). Faces has a special component; do not add another special case without a reason.

### 1.2 Icon asset

- Add a 32–64 px PNG at `assets/site-icons/<key>.png`, transparent where possible.
- Update `docs/site-icons.md` (asset count and verification).

### 1.3 URL detection and cleaning

- `src/domain/sites.ts` — verify `detectSupportedSite` matches the real product/share URLs; add host variants rather than stripping the host.
- `cleanUrl` / `normalizeUrl` — only extend for source-specific tracking parameters or canonical URL rules when needed. Do not break existing retailers.
- Check Android Share → Add flow still detects the source.

### 1.4 Product parsing

- `src/domain/parser.ts` — add the site branch to `parseProductHtmlCore` (or a dedicated parser called from it).
- `getRequestHeaders` — add required headers/locale when the source rejects the default request.
- `fetchAndParseProduct` — respect blocked/checkpoint handling and the WebView fallback. Do not evaluate arbitrary retailer scripts; parse static HTML/JSON that the page provides.
- Return `ParsedProduct` fields truthfully: title, image, URL/canonical URL, currency, current price or one confirmed range basis, availability, SKU when present.
- Out-of-stock pages must succeed without inventing a price; preserve the last known price in storage.
- Avoid recommendation-carousel prices. If the page does not expose an unambiguous buy price, return `price_not_found`/blocked as appropriate.

### 1.5 Variants and price basis

- If the initial response exposes reliable options, build `ProductVariant[]` with a stable id, label, attributes, availability, price, and exact source URL when available. The existing variant sheet and tracking flow will use them automatically.
- Verify `resolveSelectedVariant`, `findTrackedVariant`, `toVariantSelection` and the Add flow selection persist the chosen option.
- If variants are page-level only, do not pretend to track a size/colour the page cannot select.
- Use `priceBasis` (`kg` or `pack:<n>`) for weighted/multipack pricing; never compare a per-kg price to a per-item price. Preserve an explicit price range as `hasPriceRange` rather than treating the lowest bound as the price.
- Add/extend `priceBasis` tests when the source has a special basis.

### 1.6 Background checks and rate limits

- Check `minimumIntervalHours` against the retailer's tolerance.
- Verify a manual check, a recheck-all and a background check all use the right URL/variant and report non-price failures honestly.
- If the source needs a different worker/stagger or browser fallback, wire it through the existing checker/discovery infrastructure; do not add a second scheduler.

## 2. Discovery (Explore feed)

Only skip this section when the source is intentionally tracking-only (`discoveryAvailable: false`) and the UI copy says so.

### 2.1 Source map

- Create `src/domain/discoverySources/<site>.json` using the `DiscoveryCollection` schema:
  ```json
  {
    "id": "<site>-<department>-<label-slug>",
    "label": "Observed department label",
    "siteKey": "<site>",
    "category": "clothing",
    "audience": "optional",
    "path": ["Department", "Label"],
    "url": "https://retailer.example/actual/observed/url",
    "provider": "html",
    "isDepartment": false
  }
  ```
- Use only real, retailer-owned HTTPS URLs; the tests check hostnames against `sites.ts`.
- `provider`: `shopify` (products.json), `woocommerce` (store API), or `html`. Do not mark an HTML page as Shopify just because it is a store.
- Import the JSON in `src/domain/discoverySources.ts` and add it to the `maps` list.
- Apply the correct `category` from `src/domain/discoveryCategories.ts`; do not add a new interest unless the source genuinely needs it and the category catalogue/UI/tests are updated.

### 2.2 Listing parser

- `src/domain/discoveryListings.ts` — add a branch in `parseDiscoveryListing` when the source's listing HTML/JSON is special; otherwise rely on the shared structured-data path and confirm it works.
- `src/domain/searchRenderedListings.ts` — add a branch when a rendered search page needs a source-specific extraction before the shared listing parser.
- Product ids must be stable and source-scoped (`<site>:<productId>`); URLs must be absolute and canonical; images must come from the same card/product.
- Filter incomplete cards rather than picking a recommendation price.

### 2.3 Catalog/cache integration

- `src/domain/discoveryCatalog.ts` — confirm fetch/JSON handling, response body limits and error semantics; add a branch only if the provider is genuinely new.
- If parser output/version semantics change for an existing source, bump `DISCOVERY_PARSER_VERSION` in `src/data/discovery.ts` so cached results are invalidated.
- Ensure `recordDiscoveryObservations` can attach previous prices and price basis to the new listing shape.
- Confirm source limits and pagination: one response is currently capped by `DISCOVERY_SOURCE_PRODUCT_LIMIT`; retailer pagination is not automatic unless the source has a verified next-page contract.

### 2.4 Tests

Add/extend:
- `src/domain/__tests__/discoverySources.test.ts` — every supported discovery source has a valid category, HTTPS URL and matching hostname; ids are unique.
- `src/domain/__tests__/discoveryListings.test.ts` — representative listing HTML/JSON produces the right title, id, price, URL, image and stock; incomplete cards are rejected.
- `src/domain/__tests__/discoveryCatalog.test.ts` / `discovery.test.ts` — caching, provider, merge/registry behaviour.
- `src/domain/__tests__/discoverySearch.test.ts` / `discoverySearchCatalog.test.ts` — search URL/parse/no-results/pagination if search is in scope.
- Pair/grouping tests when the source introduces titles/variants that need normalization (`discoveryGroups.test.ts`, `productTokens.test.ts`).

## 3. Search

Only skip when search is explicitly excluded.

- `src/domain/discoverySearch.ts`
  - Add the query URL to `SEARCH_URLS` **or** add audience/section-specific requests for sources like Zara/Ounass/Level Shoes.
  - Update `parseSearchPage` when the source needs a query-echo/verification check; an unverified page or suggestion-only page must return `undefined`, not empty results.
  - Handle a real no-results page as `{ products: [] }`; do not turn a challenge page into empty results.
  - Add pagination via `nextSearchPage` only when the source has a verified next-page contract.
- `src/domain/discoverySearchCatalog.ts` — confirm the three-worker progressive fetch, timeout, browser fallback, cache/15-minute reuse and observation recording still behave for the new source.
- `src/components/DiscoverySearch.tsx` — if search is not verified, add the source to `EXCLUDED` with a user-facing reason (and keep coverage copy honest). If search is added, remove the exclusion and update the source-request count in docs/tests.
- Tests: `discoverySearch.test.ts` for request building, query verification, empty/challenge/pagination; `discoverySearchCatalog.test.ts` for progressive merging/cache; `DiscoverySearch.test.tsx`/App tests if UI counts change.

## 4. Product surfaces and counts

Most UI is registry-driven, but verify:

- **Add flow:** `AddSupportedStores` shows only `status: 'supported'`. A new supported source appears automatically; experimental stays hidden.
- **Settings → Supported stores:** live count and store list come from `SUPPORTED_SITES`; check the count changed.
- **Explore Browse sheet:** stores and source maps come from `SUPPORTED_SITES`/`DISCOVERY_SOURCE_MAPS`.
- **Search coverage/progress:** store pills come from `buildSearchRequests`; the Coverage sheet reads source results. Excluded sources should be explained.
- **Watchlist/Activity/product detail/compare:** `SiteIcon` and `getSiteByKey` cover the new key via the typed registries. Check names, icon fallback and price/basis labels.
- **Tracking product:** check exact URL/variant used in detail, copy/open and later checks.

## 5. Reliability and safety requirements

- No login, CAPTCHA solving, stealth browser, or credential storage.
- Do not run untrusted retailer JavaScript; parse HTML/JSON or use the existing WebView fetch for a real browser-rendered page.
- Do not invent SKUs, option combinations, stock states, categories or prices.
- Do not claim a "lowest price" across currencies/bases, or compare a range price to a single price.
- A failed/blocked check must surface as a check failure; it must not silently keep a stale value as current.
- Keep the source interval/rate limits and document retailer blocking behaviour.
- If the retailer's own terms/robots disallow automated access, treat the source as not supported rather than working around it.

## 6. Documentation and release

Update in the same branch/PR as the source:

- `README.md` — supported-store list and counts.
- `docs/current-state.md` — supported stores table, discovery counts, any search/source limit changes.
- `docs/site-icons.md` — icon asset count/verification.
- `docs/discovery-sources.md` — new map/source entries and historical evidence dates.
- `docs/discovery-category-audit.md` — new categories/limits if the source expands mapping.
- `docs/adding-a-source.md` if the workflow itself changed.
- `release/vX.Y.Z-alpha/RELEASE_NOTES.md` — only when the source is actually included in a release; describe scope and limits.
- The source onboarding template — fill it in and keep it in the PR/issue evidence (do not commit private URLs/tokens).

## 7. Definition of done

- [ ] Scope and support level agreed; evidence recorded in the onboarding template.
- [ ] `SiteKey`, `SUPPORTED_SITES`, icon asset and `SITE_COLORS` complete.
- [ ] Tracking URL detection/cleaning works; product parser returns truthful title, price/currency, availability, URL and exact variant (or page-level).
- [ ] Out-of-stock and blocked/failed pages behave safely.
- [ ] Variant selection and later checks use the same exact source identity; price basis/range handled.
- [ ] Discovery maps (or `discoveryAvailable: false`), listing parser, categories and cache/parser version verified.
- [ ] Search request/parse/no-results/pagination handled or the source explicitly excluded with a reason.
- [ ] Add flow, Settings, Explore, search coverage, icons and counts verified in the device build.
- [ ] Unit/component tests added; `npm run typecheck`, `npm run lint`, `npm test -- --runInBand` pass.
- [ ] ARM64 release build succeeds; real-device checks recorded (not just unit tests).
- [ ] README/current-state/site-icons/source docs updated.
- [ ] Supported vs experimental is honest; every remaining limitation is documented.

## Quick file map

| Layer | Files |
| --- | --- |
| Registry/types | `src/domain/types.ts`, `src/domain/sites.ts` |
| Icons | `assets/site-icons/<key>.png`, `src/components/SiteIcon.tsx`, `src/components/FacesIcon.tsx` |
| URL handling | `src/domain/sites.ts` (`detectSupportedSite`, `cleanUrl`, `normalizeUrl`) |
| Product parser | `src/domain/parser.ts`, `src/domain/variants.ts`, `src/domain/priceBasis.ts` |
| Discovery maps | `src/domain/discoverySources/<site>.json`, `src/domain/discoverySources.ts`, `src/domain/discoveryCategories.ts` |
| Listing parser | `src/domain/discoveryListings.ts`, `src/domain/searchRenderedListings.ts` |
| Catalog/cache | `src/domain/discoveryCatalog.ts`, `src/data/discovery.ts`, `src/data/discoveryHistory.ts` |
| Search | `src/domain/discoverySearch.ts`, `src/domain/discoverySearchCatalog.ts`, `src/data/discoverySearch.ts`, `src/components/DiscoverySearch.tsx` |
| Background checks | `src/domain/checker.ts`, `src/domain/backgroundScheduler.ts`, `android/.../QeematBackground*` |
| UI exposure | `App.tsx`, `src/components/DiscoveryBrowseSheet.tsx`, `src/components/DiscoverySearch.tsx` |
| Tests | `src/domain/__tests__/`, `src/components/__tests__/`, `App.test.tsx` |
| Docs | `README.md`, `docs/current-state.md`, `docs/site-icons.md`, `docs/discovery-*.md`, `release/` |

See the reusable [`source onboarding template`](source-onboarding-template.md) before starting.
