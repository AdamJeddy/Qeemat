# Search tab review and redesign

**Date:** 14 November 2026
**Branch:** `feat/search-tab-redesign`
**Scope:** the Search tab (`OpportunityScreen` in `App.tsx`, `src/components/Discovery*.tsx`, `src/domain/discovery*.ts`, `src/data/discovery*.ts`) compared with the Watchlist tab, plus the proposed cross-retailer comparison behaviour and UI upgrade. Source review, tests and the existing design/QA docs were used; device evidence is recorded in `design-qa.md` after verification.

## 1. What the tab is today

The tab is labelled **Search**, but it has two different jobs bolted together:

1. **A discovery feed (default).** On open, `OpportunityScreen` loads cached retailer listings through `loadDiscoveryCatalog`, scopes the fetch to source collections that match the categories inferred from active watchlist products, then renders a 2-column grid of listing cards under **Explore products**.
2. **A product-name search (secondary).** Submitting a query calls `loadProductSearch`, which queries 18 retailer search endpoints with three HTTP workers plus a native-browser fallback, streams per-store results, and replaces the grid with ranked matches and per-retailer filter chips.

Supporting surfaces: department tiles (`DiscoveryDepartments`), a full browse sheet (`DiscoveryBrowseSheet`) for departments/stores/store categories with source status and URLs, a source coverage sheet, an inline filters panel (retailer/brand/max price), listing preview modal with up to 5 observations, and direct tracking with variant selection.

### Data and ranking today

- A listing is the unit of everything: `DiscoveryProduct` is one retailer's observation (`siteKey` + retailer product id + URL + title/brand/price/availability). The same product at three retailers is three unrelated records.
- Cache: 24-hour per-collection cache (`qeemat.discovery.source.v2.*`), parser-version invalidation, 24-item display batches, failed-source retry after 24 hours.
- Observations: each listing keeps up to 30 local observations (`qeemat.discovery.history.v1.*`). `recordDiscoveryObservations` attaches `previousPriceMinor` when the same listing was seen before with the same currency, price basis and range status. A WorkManager job rotates small batches of previously discovered sources roughly every six hours.
- Feed ordering (`buildDiscoverySections` in `src/domain/discovery.ts`): filter out dismissed products and out-of-stock listings, keep products in the `DiscoveryPreferences.categories`, score with a four-line `discoveryScore` (only `+1000` if the category is in preferences, `+50` for a favourite brand), then round-robin categories and retailers within each score tier. `OpportunityScreen.effectivePreferences` then overrides `favoriteBrands` to `[]` and `budgetsByCategory` to `{}`, so in practice the only personalization is **the category set**.
- The first 24 feed cards are deliberately rotated at each app launch (`rotateDiscoveryProducts`, session offset persisted in `advanceDiscoveryOffset`). The first products a shopper sees are therefore *intentionally randomized*, not the most relevant ones.
- Search result ranking (`rankSearchMatches`) is a title/brand token match with a phrase bonus and an accessory penalty. It is a good relevance rank for the query, but it is still listing-level: the same iPhone found at Noon, Amazon and Carrefour is three cards with no comparison.
- Price history exists per listing and is already displayed in the preview modal, but it is never aggregated across retailers.

### UI today

- Plain light page: 28px **Search** heading, subtitle “Discover it. Track the price.”, search field, department tile rail, count/refresh/filters toolbar, 2-column grid cards (120px image, 11–14px text, “Observed 3h ago”, repeated outline **Track price** button per card), preview modal with secondary actions.
- The Watchlist uses a blue banner with the Qeemat lockup, white title, count pill, a toolbar in the banner language and flat divided product rows. Search does not use that language: it is a separate visual system with a grid, smaller labels and action repetition.
- The old personalization quiz is dead code: `DiscoverySetupCard` and `DiscoveryPreferencesSheet` are not rendered anywhere; saved `categories`, `favoriteBrands` and `budgetsByCategory` no longer influence the feed.

## 2. Findings

| Severity | Finding | Consequence |
|---|---|---|
| Critical | The feed's first products are randomized (`rotateDiscoveryProducts`) and category-filtered only; the watchlist's brands, product names and price level have no effect on order | The tab does not feel personal even though it is labelled as being based on the watchlist; a shopper tracking running shoes can see an arbitrary mix of footwear first |
| Critical | No cross-retailer identity. `mergeDiscoveryProducts` only de-duplicates the same retailer listing id | The same product is shown 2–3 times as separate cards; the shopper has to compare prices manually and cannot see which store is cheapest |
| High | Retailer prices are never compared or ranked. `hasPriceRange` and `priceBasis` are captured, but no best-source logic exists | The app stores exactly the data needed for a comparison feature but exposes none of it |
| High | Tracked products are not connected to discovery/search listings | A shopper who tracks an item at Noon cannot see that the same item is cheaper at Amazon even when both are in the catalogue |
| High | Search and discovery are visually and structurally two products in one tab; search results keep listing cards and listing counts | Searching for a product gives no price comparison, which is the main reason to search across 18 stores |
| High | UI is a separate design system from Watchlist (grid instead of flat rows, no blue banner, tiny metadata, repeated Track buttons) | Feels like a secondary prototype inside an otherwise coherent app; harder to scan and compare |
| Medium | Counts are listing counts, not products or stores; “1 title and brand match · 1 retailer” describes rows, not comparison value | Understates/overstates what the user is seeing and gets worse once grouping exists |
| Medium | Filters are inline expandable rails, unlike the Watchlist filter sheet; no sort control | Inconsistent interaction with the rest of the app and harder to manage on a phone |
| Medium | “Observed 3h ago” is surface metadata on every card; freshness is not tied to the price being compared | Creates noise without explaining whether a comparison is fresh |
| Medium | Dead personalization UI/data (`DiscoverySetupCard`, `DiscoveryPreferencesSheet`, budgets/favourite brands ignored) | Confusing code and product model; saved preferences imply control that no longer exists |
| Low | Dismissed-product identity uses `discoveryFeedbackId`; feedback aliases depend on cache availability | Existing behaviour works; grouping must preserve dismissal by all offer identities |
| Low | `DiscoveryProductGrid` preview modal holds its own history fetch and five secondary actions | Fine for browsing but the wrong container for comparison |

### What to keep

- Local-first storage and the existing per-listing observation history; no backend is needed.
- Streaming per-store search with coverage/status, cached queries and failure handling. This is genuinely useful and should stay.
- The browse/coverage sheet's source URLs, counts and failure states.
- Direct tracking with page verification and exact variant selection.
- Dismiss feedback, “Show more”, “Load more”, tab state persistence and pull-to-refresh.
- Truthful empty, unavailable and request-failure states.

## 3. Agreed product direction

**Search & compare first.** A prominent cross-store search leads; the default screen becomes a watchlist-relevant price feed where one item represents the same product across retailers, with all source prices and the best source. Search results use the same grouped rows. The tab keeps the name **Search**.

**Watchlist-only relevance, with explanations.** The taste profile is derived from active tracked products: inferred categories, brands (tracker brand or source metadata), distinctive title keywords, and typical price bands. Each row can show one honest reason such as “Because you track running shoes” or “More from Nike”. The dead quiz UI is removed; the stored preferences continue to serve dismissal state only.

**Conservative cross-retailer clubbing.** There is no cross-retailer product id, so grouping is a local inference. The shipped rules were tightened after checking real retailer titles:

- Require a compatible brand. A search card that omits its brand may still match when the brand word leads its title (`Apple AirPods…`); an accessory title such as `Case for Apple AirPods…` does not gain the brand.
- Require the same canonical product type, or accept one title without a product type word (for example a marketing `AirPods Pro 2nd Generation` heading) when brand, model and at least three tokens agree.
- Numeric model numbers must match exactly (`iPhone 16` ≠ `iPhone 15`, `AirPods Pro 2` ≠ `AirPods Pro 3`); capacity and pack tokens must match exactly (`128GB` ≠ `256GB`, `1L` ≠ `500ml`).
- Alphanumeric model codes may match by containment so a retailer-appended SKU (`WH1000XM5B165935990`) still matches `WH-1000XM5`; extra specification numbers (`H2`, `Bluetooth 5.3`, `2 years`) do not block a match.
- Ordinals are normalized (`2nd Generation` = `2`), common colour words are ignored, and brand, gender, filler and unit noise are removed before comparison.
- One offer per retailer, so repeated colour variants from the same store collapse to the retailer's cheapest offer; the compare sheet still shows the offer title that was kept.
- Best offer only when at least two offers are genuinely comparable (single price, in stock, same currency and pack/weight basis). “From” range prices and out-of-stock offers are shown but never used for the “lowest price” claim.
- Group-level previous-best price is only shown when every compared offer had a previous observation, so the saving cannot be inflated by a partial comparison.

**Tracked-product annotation.** When a group matches an active tracked product (exact URL first, then conservative brand+signature), the row and compare sheet say “You track this at Noon” and can open the tracker. This is display-only and makes no new claim about the tracker itself.

## 4. Proposed behaviour

### Default (no query) — “For you” price feed

1. Blue banner in the Watchlist language: Qeemat lockup, **Search** title with a live count pill (`N products · M stores`), coverage and refresh actions, and a permanent white cross-store search field with a filter button.
2. A compact department rail: **For you** (default), watchlist categories first, then popular departments, plus “All departments” which opens the existing browse sheet.
3. Relevance summary line: `Based on your watchlist: Footwear, Beauty` or, with no trackers, `Track a product to personalise this feed`.
4. Flat grouped rows ordered by relevance: image, brand · category, 2-line title, best price with direction badge, source icons + `Lowest at Noon` / `3 stores`, honest saving line, reason line, and compact **Compare** / **Track** actions. Tapping the row opens the compare sheet.
5. Progressively revealed content: 12 grouped rows initially, `Show more` for the already-fetched groups, `Load more listings` for the next collection batch, then freshness and failed-source status.
6. Pull-to-refresh reuses the existing force refresh; the freshness line says when observed prices were checked and whether cached results are stale.
7. Empty states: no tracker yet (explain relevance and offer Explore all), loading stream, filtered-to-nothing, refresh failure with saved listings.

### Follow-up after the first visual review (14 November 2026)

The first device look showed the Search banner content sitting on the screen edges. The Search ScrollView was missing the base 20dp gutter that the Watchlist has, so the banner's full-bleed negative margin cancelled its internal padding. The ScrollView now carries the same gutter and the body no longer double-pads; the banner title, subtitle, Qeemat lockup, count pill, search field and coverage/refresh controls all line up on the Watchlist content line. The review also shortened the tracked row annotation to “On your watchlist” and capitalises a lowercase retailer title's first display glyph (display-only; retailer text is unchanged in the compare sheet).

### Search mode — “find it, compare it”

1. The same banner search field; explicit submit only; typing does not fetch.
2. Progress line (`8 of 18 stores checked · Searching…`) and a Coverage action; store chips stay for narrowing.
3. Results heading counts **products across stores** after grouping, not listings.
4. Grouped result rows use the same row component and compare sheet. Search rank still favors exact brand/model matches; grouping is applied after matching.
5. `Show more` for returned groups, `Load more search results` for provider cursors, failed-source copy preserved, clearing restores the feed and scroll position.

### Compare sheet

- Product image, brand/category, full title; lowest price and best store; saving across comparable offers; observed time.
- Per-store rows: site icon, store, price, availability, “From” marker, previous observed price with direction, relative check time, and a short “not directly comparable” explanation where relevant.
- Tracked annotation with **Open tracker** when matched.
- Actions: **Track lowest price**, per-store **Track**/**Open**, **Not interested**, **More like this**.
- Truthful single-offer state: price shown, no “lowest” claim.
- Variant-selection and page-verification flows remain the existing ones.

### Filters

A bottom sheet matching the Watchlist **Filter & sort** interaction: departments, stores with counts, brands, maximum price, active-filter summary, **Clear filters**, applied immediately, closed with Show results. Search-mode store chips remain available for quick narrowing.

### Accessibility and layout

- 44dp minimum touch targets, row/action accessibility labels that state price, best store, store count and reason, separate Compare/Track labels, header role on section titles, live-region notices.
- Flat rows at normal width; stacked row at compact width / large font scale; no information hidden behind colour alone.
- Keep the tab mounted and preserve scroll/search state.

## 5. Truth and data constraints

- Grouping and tracked-product matching are local heuristics over retailer titles. The compare sheet always shows each retailer's own title so a shopper can verify the offer; the UI says “Lowest listed price”, not “identical item”.
- Comparability rules: defined single price, not `hasPriceRange`, not `out_of_stock`, same currency, same `priceBasis` (kg or pack signature). Out-of-stock and range offers remain visible but cannot win the lowest-price claim.
- Prices are observations, not live quotes. The UI states when they were checked and keeps stale/failed source states; tracking a product still re-fetches and verifies the page before saving.
- Dismissal is matched against every offer identity in a group, so dismissing a product hides it regardless of the source shown.
- No new network calls, backend, analytics or fake popularity/deal claims are introduced.

## 6. Implementation outline

| Area | Change |
|---|---|
| `src/domain/productTokens.ts` | New shared title normalizer: filler/colour/gender/brand removal, product-type synonyms, ordinal and unit folding, decimal-spec removal, numeric and model tokens, variant pack/capacity tokens, relevance keywords |
| `src/domain/types.ts` | New `DiscoveryOffer`, `DiscoveryRelevance`, `DiscoveryProductGroup` types |
| `src/domain/discoveryGroups.ts` | New conservative grouping, one-offer-per-retailer, comparable best offer, price spread, previous best, tracked-product match, inferred missing brand, model-code containment |
| `src/domain/discoveryRanking.ts` | New watchlist taste profile, group scoring with reasons, diversity-aware ranking, taste summary |
| `src/components/SearchProductRow.tsx` | New grouped row (price, direction, source icons, saving, reason, compare/open/track) |
| `src/components/SearchCompareSheet.tsx` | New cross-store comparison sheet: lowest source, saving, previous cross-store best, per-store prices/check age, tracked annotation |
| `src/components/SearchFilterSheet.tsx` | New filter sheet for department/store/brand/maximum price |
| `src/components/Discovery*.tsx` | Department rail and search progress rebuilt; old grid, preview modal and dead quiz components removed; shared filter chip retained |
| `App.tsx` (`OpportunityScreen`) | Blue Watchlist-style banner, grouped feed, relevance reasons, filter sheet, grouped search with product/store counts, tracked annotation, accessory-aware result ranking, compare sheet wiring |
| `src/domain/discoverySearch.ts` | Broader accessory penalty (`for`-pattern, tips, insoles, charms, replacement) so the named product leads results |
| Tests | Tokenizer 10, grouping 25, ranking 12, row 6, compare 7, filter 4, plus updated `App.test.tsx` Search integration flows |
| Docs | This review, `current-state.md`, `DESIGN.md`, `design-qa.md`, `discovery-search-feasibility.md` |

## 7. Verification

1. `npm run typecheck` clean; `npm run lint` 0 errors (the known out-of-stock thumbnail inline-style warning remains); Jest 58 suites / 541 passed / 1 skipped.
2. The arm64 release was installed over the existing app on the connected Samsung SM-S928B (1440 × 3120) with the existing 28-item watchlist and cache preserved. The Search feed, grouped cross-store search, compare sheet and filter sheet were inspected:
   - [Search feed](assets/search-redesign-2026-11-14/search-feed.png) — blue banner, 790 grouped products, watchlist relevance line, tracked-group annotation and saving.
   - [Grouped search results](assets/search-redesign-2026-11-14/search-grouped-results.png) — `airpods pro 2` across 20 stores, first item grouped across Noon and Carrefour, `Lowest at Noon · 2 stores`, `Save AED 150`.
   - [Compare sheet](assets/search-redesign-2026-11-14/search-compare-sheet.png) — lowest source, saving, previous cross-store best, per-store title/price/availability/previous price/check age.
   - [Filter sheet](assets/search-redesign-2026-11-14/search-filters.png) — departments, stores with grouped counts, brands and maximum price.
3. Not covered by this pass: tracking a grouped offer through page verification and variant selection, TalkBack order/labels, landscape, larger font scales, every retailer/query combination, and background freshness guarantees. Grouping remains a local heuristic; the compare sheet shows each retailer's own title so the offer can be verified.


## 8. Risks and limits

- Retailer titles are inconsistent; conservative grouping will miss some real duplicates (for example one store omitting the model number) and can still club different colourways of the same model. The compare sheet mitigates this by showing retailer titles, and only same-pack/same-capacity single prices can win the lowest-price claim. Grouping must not be described as a guaranteed identical-item match.
- The feed only contains products from the source collections fetched for the selected scope; cross-store coverage in the default feed depends on which collections the 24-page batch includes. Search mode provides the broad comparison.
- Freshness is per collection refresh (up to 24h) with best-effort background rotation; per-source observed times are shown instead of implying live prices.
- Tracked-product matching is heuristic unless the exact URL is present; the annotation is a convenience, not a price guarantee.
- Large catalogues (hundreds of listings) make grouping and ranking CPU work on device; the grouping is bucketed and deterministic, but the first load can be slower with a large cached catalogue.
- Amazon search cards frequently omit the brand field even when the title starts with it. The grouping now infers a leading brand conservatively, but cards that neither expose a brand nor lead with one remain ungrouped.

## 9. Follow-up iteration: Explore experience (14 November 2026)

After the first device review the tab was renamed **Explore** (bottom tab, screen heading and docs) and the following gaps raised in the next review were addressed:

- **First-search feedback.** A first search no longer shows `0 results` while stores respond. The banner shows a spinner and “Searching…”, the results area says “Checking 20 stores. Matches appear here as each store responds.”, and an animated `SearchProgress` card shows a progress bar plus per-store status pills (checking, ready with count, empty, unavailable). Cached matches stay visible while stores revalidate.
- **Multi-source promotion.** Search groups are ranked within each textual match grade so items available from more retailers rise toward the top; exact named-product matches stay above weaker matches, and accessories (cases, tips, insoles) never receive the multi-store boost unless the shopper searched for the accessory.
- **Automatic continuation.** The separate Show more and Load more search/listings buttons were removed. Both the Explore feed and search results continue automatically near the bottom: already-fetched rows are revealed first, then the next search page or retailer collection batch is requested. A compact loading row replaces the buttons.
- **Watchlist duplicates.** A grouped item already matched to an active tracker is hidden from Explore unless a different retailer is cheaper. When it is cheaper, the row shows the saving against the tracked price; the compare sheet also shows the tracked price and saving.
- **Price-sorted compare sheet.** Store offers are listed lowest price first, with a “Lowest price first” caption; the best comparable offer remains highlighted. The tracked-price saving is shown above the offer list.
- **Faster department switching.** Visited department/store scopes are cached in memory for 24 hours. Returning to a previously opened department uses the cached products immediately, and narrow department changes do not refetch unless the scope is new. A scope change now shows a loading state instead of a transient “0 products” empty state.
- **Explore naming.** The tab, heading, accessibility copy and documentation now use Explore; the internal `opportunities` route id is unchanged for compatibility.

Verification on the connected SM-S928B: [Explore feed](assets/search-redesign-2026-11-14/search-feed.png), [first-search progress](assets/search-redesign-2026-11-14/search-progress.png), [grouped results while checking](assets/search-redesign-2026-11-14/search-grouped-results.png), [lowest-price-first compare](assets/search-redesign-2026-11-14/search-compare-sheet.png). Automated gates: typecheck clean; ESLint 0 errors (one existing inline-style warning); Jest 61 suites / 570 passed / 1 skipped. Not covered by this pass: timed device verification of the department cache, tracking a grouped offer, TalkBack/large-text/landscape on the new progress card, and the infinite-scroll experience on slow networks.