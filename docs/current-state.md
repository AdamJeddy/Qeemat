# Qeemat Current State

**Last reconciled with the implementation:** 2026-11-13
**App version:** 0.6.0-alpha (development; not yet published)

This is the repo handoff for the current app. Product-planning documents are useful for intent, but this file describes shipped behavior and active limitations.

## Product and Architecture

Qeemat is an Android-first, local-first React Native + TypeScript price tracker. It tracks supported product pages on device using AsyncStorage, parses pages in TypeScript, and uses native Android modules for WorkManager scheduling, notifications, battery-optimization support, and the experimental WebView fetch fallback.

The app uses a small manual route stack in `App.tsx`, not React Navigation. There is no backend, user account, cloud sync, SQLite database, or maintained iOS native implementation.

## Supported Stores

| Store | Status | Notes |
| --- | --- | --- |
| Noon UAE | Supported | Product metadata and embedded page data. |
| Carrefour UAE | Supported | Streamed storefront product data; the exact seller, offer and delivery selection is preserved for checks. A missing or changed offer is rejected rather than replaced with another seller. |
| Nike UAE | Supported | Structured product data. |
| Sun & Sand Sports UAE | Supported | Structured product data and product URLs. |
| Level Shoes | Supported | Embedded product payloads and metadata. |
| AYM Accessories | Supported | WooCommerce variations; checks have a 72-hour minimum interval. |
| Ounass UAE | Supported | Inline PDP payloads. |
| Amazon regional domains | Supported, best effort | Selected domains only; challenge pages return `blocked`. |
| Adidas UAE | Supported | Monitor for bot-protection changes. |
| PUMA UAE | Supported | JSON-LD product data and source-defined initial-page size options. |
| Decathlon UAE | Supported | Shopify ProductJson data with source-defined initial-page options. |
| Salomon GCC | Supported | Shopify product data; the Android WebView fallback handles native-request rejections. |
| Sephora UAE | Supported | JSON-LD product data; Akamai-protected pages use the native WebView fallback. |
| Faces UAE | Supported | Salesforce Commerce Cloud structured product data; session redirects use the native WebView fallback when needed. |
| Centrepoint UAE | Supported | Centrepoint storefront JSON-LD plus source-defined color and size controls across group brands such as Splash. |
| Namshi UAE | Supported | Structured product data plus source size controls are tracked by size when the initial response provides stock state; parent/color choices use their own product URLs. |
| The Deal UAE | Supported | Salesforce Commerce Cloud product data plus source color and size controls; exact variation endpoints preserve the chosen option for later AED price and stock checks. |
| Sharaf DG UAE | Supported | AED product metadata plus source-linked configuration URLs are tracked exactly when the initial response exposes complete option controls. |
| H&M UAE | Supported | UAE product and size tracking with discovery categories and search; Android WebView may be needed. |
| Zara UAE | Supported | UAE product, colour and size tracking, plus discovery categories and search. |
| Brands For Less UAE | Experimental | Current rendered listing/PDP and size parsing implemented; browser markup verified. Android fetching verification is deferred. Hidden from supported-store UI until validated. |

The site registry is `src/domain/sites.ts`. It controls hostnames, enabled status, icons, and minimum check intervals.

## User-Facing Behavior

### Watchlist and activity

- The watchlist supports pull-to-refresh, a bordered `Recheck all` action at the right end of the toolbar, price-direction arrows, an archived-items view, and a collapsible out-of-stock section below in-stock products. The banner search control opens an inline search for tracked products by name, retailer, folder or selected option that combines with the other controls. When products from multiple stores are tracked, a store rail filters both sections and supports selecting several stores at once; a separate control filters local folders and sorts by recency, lowest price, largest drop, closest target, or name. The archived view is toggled from a toolbar icon. Cards keep showing the most recent actual price change (with its direction and amount) after later unchanged checks. The tab keeps its scroll and search state but reloads stored products when a flow (Add, product detail, tracking settings) returns to the tabs. An empty archived view, an empty search and a list filtered to nothing show their own explanation with a recovery action.
- Long-press selection opens a compact floating action dock. Selected products can be moved to a folder, paused/resumed, archived/restored, or deleted in bulk.
- Product cards show a site icon, local folder when present, price, status, and the most recent price-change direction. OOS cards are dimmed and show an amber out-of-stock badge.
- The Activity tab is newest-first and groups events into stable local calendar-day sections (`Today`, `Yesterday`, then e.g. `Mon, 10 Nov`) with a per-day change count. Each day is one flat card of compact rows: product thumbnail and title, new price first with the previous price struck through, an explicit delta badge (for example `+AED 39` or `−AED 250`), then retailer · source · time as muted metadata. Price rises render red and drops green across the app. Out-of-stock and back-in-stock transitions keep their state text, first observations read “Started tracking” with a `New` badge, existing products open their detail screen, and deleted products render a non-tappable “Product removed” row. Day headers are accessibility headings and each row has a descriptive accessibility label.
- `Watchlist` is the opening tab; `Search` provides discovery. The default Explore feed uses categories on active, non-archived watchlist products. When no category is assigned, it uses recognizable product-page metadata and then conservative suggestions inferred from names and URLs. Users can change or remove a suggestion. It explains those categories and supports browsing all products or filtering by department, store, brand and price. With no recognizable categories, it shows general listings. Saved quiz preferences no longer filter the feed.
- Search keeps its screen state while switching between tabs and also after opening a product or the Add flow, because the tab stack stays mounted. Its default feed rotates the first group of products at each app launch, while search results and explicitly filtered views keep their existing order. Listing cards show a previous price comparison only when the price changes, and missing or failed listing images fall back to a neutral placeholder.
- Tracked products retain available retailer-provided category paths, product types and selected attributes separately from shopper-selected categories. Product details show the captured information; existing products acquire it on their next successful check. Fields vary by page and retailer, and an omitted field does not erase previously captured metadata. See the [product metadata source review](product-metadata-audit.md) for retailer-specific evidence and gaps.
- The department browser exposes 4,517 mapped listings across all 19 retailers. It offers searchable Departments and Stores views, compact department groups and store-specific categories; source URLs, breadcrumbs and fetch status are available under Source details. Selecting an interest, retailer or listing updates the same feed and fetches matching pages. An initial batch requests at most 24 listings; Load more listings adds another batch. Show more reveals already-fetched product cards. Each fetched page still has a 100-product extraction ceiling and retailer pagination is not automatic.
- Source mapping is broader than validated extraction. The expansion's desktop sample initially extracted 47/72 pages; subsequent parser repairs recovered Amazon book and baby cards. BFL rendered products and size choices now parse from browser markup; full physical-Android verification is deferred by the user until the final pass. See the [category audit](discovery-category-audit.md) for per-retailer evidence and limits. Earlier Android results in [source URLs and limits](discovery-sources.md) refer to the previous selected collections.
- Discovery caches listings for 24 hours and retries failed sources after 24 hours or an explicit refresh. Refresh applies to the current scope, not every mapped listing. Fetched listings keep up to 30 local observations each; comparisons require matching listing identity, currency, price basis and range status. Product previews show recent listing history separately from variant-specific watchlist snapshots. A separate Android WorkManager job rotates through small batches of previously discovered collection and search sources approximately every six hours when network and system conditions permit. It records prices when a retailer returns the same listing; listings that disappear from a source are not individually checked. Carrefour weighted groceries normalize default-weight prices to AED/kg; final weight may affect checkout totals. A changed pack size or price basis preserves tracker history and records a failed check rather than sending a misleading price alert.
- Search retailer filters appear only for stores with visible matches and show their counts. A filter resets to all results if its store loses its last match during refresh or dismissal. Search offers compact department chips that update the same feed; All departments opens the full interest, retailer and listing browser. An explicitly selected interest still applies its own saved budget. Fresh food remains separate from pantry, beverages and frozen food. The refresh action remains available above products.
- Cancelled discovery loads do not create cached failures. Search and discovery keep separate display limits so clearing search returns to the expanded feed. Dismissal feedback for Decathlon and Salomon uses a shared product-path identity across search and collection listings; older numeric feedback is reconciled when its corresponding cached product is available.
- Track price verifies the product page, saves existing defaults, and offers target settings afterward. Size/colour selection uses a sheet over the feed and preserves the exact source variant; existing trackers open their details. Secondary product actions live in the product-details modal.
- Product-name search runs in the same Search feed across 18 sources; Sharaf DG is excluded until its search grid can be verified. Searches submit explicitly, bypass quiz interests/budgets, stream matching results, expose per-store status and retain cached matches on failures. Ounass and Level Shoes search women, men and kids separately. Query/model matching removes unrelated fallbacks and ranks named products ahead of compatible accessories across retailers; Amazon search excludes advertising cards. Clearing search restores discovery. Up to eight queries are cached locally with a 15-minute reuse window. Pagination follows verified source cursors where available; several providers currently supply only their first response. Runtime `e665848` installed and passed a search/filter/clear smoke test on Samsung SM-S928B on 28 October: one query checked 18 stores and showed 196 matches across nine retailers; the existing 24-item watchlist remained available. This is not exhaustive per-source, offline or tracking/variant QA. See [search evidence and limits](discovery-search-feasibility.md).

### Add flow and product detail

- The add flow detects supported stores, replaces the store list with a single detected-store status for valid links, and brings the parsed result into view before saving. The full supported-store list is collapsed behind a disclosure below `Find product`. As soon as a product is parsed, the flow checks the watchlist: an exact duplicate shows an inline **Duplicate product** warning with an **Open product** action and disables **Confirm Tracking**; a different option of an already-tracked product shows an **Adding another option** notice and is saved as a separate tracker. A save-time duplicate check remains as a fallback. It then collects check preference, alert mode, optional target price, optional minimum price-drop threshold, back-in-stock preference, and a local folder. When a page exposes reliable variant data, the user must select an in-stock source option such as size before saving; that exact option is shown on cards and details and is used for later checks. Centrepoint size choices use the current product URL and source button ID, while color-only pages retain the current color and product route without guessing neighboring colors. Namshi size choices use the current product/color URL. The Deal builds source-provided color/size candidates, then verifies the selected combination against its exact variation endpoint before saving; a response that does not return the requested attributes is rejected. Sharaf DG linked configurations retain the source URL that preselects the exact item. Sephora and Faces shade labels remain page-level because their initial pages do not provide complete per-shade stock state. Android browsers can share a product URL directly to Qeemat, which opens this flow and automatically finds the product so the user can choose its variant and tracking settings.
- AYM excludes the daily option in the picker because its effective minimum interval is 72 hours. Existing daily AYM products are clamped in tracking settings.
- Product detail uses the Watchlist visual language: a blue banner with back and copy/settings actions, then a compact summary card (image, 2-line title, current or last-known price with a direction badge, retailer, variant/folder line and check status). Price insights are one flat card with separated Lowest/Highest/Average rows, About this item is collapsed behind a summary disclosure, and price snapshots show the three most recent groups with **Show all** for the rest. The price chart plots only the points where the price actually changed (repeated checks at the same price do not add points), marks the high and low with dashed guide lines and a High/Low readout, supports dragging across it to scrub the selected price/date/change, tapping still selects a point, identical consecutive failed snapshots collapse behind a count, and `Check now`, `Open link`, `Copy product link` (URL only) and `Share product` (opens the native share sheet with a price update ending in Tracked with Qeemat) remain. Tracking settings include a per-product **Active** switch that pauses checks without removing the product.
- Snapshot sources are presented as `Check now`, `Recheck all`, or `Background`.

### Settings, onboarding, and navigation

- Settings leads with notification status/settings, battery-optimization guidance and the preferred background-time presets. Run diagnostics, the one-off background run and the supported-store list are collapsed behind disclosures, followed by deletion of local data.
- The preferred-time presets are Morning (9:00 AM), Afternoon (2:00 PM), and Evening (8:00 PM); selecting one saves and reschedules immediately.
- First-launch onboarding asks for notification permission and battery-optimization configuration. Both steps can be skipped and the overlay is stored as completed.
- Android hardware back navigation is handled within the manual route stack.

### Responsive layout

`src/theme/layout.ts` treats an effective content width below 360 as compact, accounting for system font scale. Product cards, previews, product details, action rows, option groups, supported-store chips, and time presets reflow in that state. Shared app text and all text inputs cap font scaling at 1.3 to keep controls usable; the 1.3 and 1.5 system scales render identically. Watchlist, product detail and the Add flow were checked on a 343dp-wide layout and with the keyboard open, and the blue Watchlist status bar was verified on an Android 17 device with edge-to-edge enforcement. Body/muted/directional text pairs were contrast-checked against WCAG AA, and placeholders and the banner count pill were adjusted to pass.

## URL and Parser Behavior

- Non-Amazon product URLs remove known tracking parameters and fragments before save and fetch.
- Recognized Amazon `/dp/<ASIN>` and `/gp/product/<ASIN>` links normalize to `https://<amazon-host>/dp/<ASIN>`. Product detail copies this clean URL.
- Amazon Renewed and return offers expose `/clp/<ASIN>` canonical URLs that render a modal shell without a buy box. These are rewritten to `/dp/<ASIN>?th=1&psc=1` before fetching (and stored that way after a successful check), so those products keep checking. Short bare `/dp/<ASIN>` links receive the same query to avoid Amazon's checkpoint page, and checkpoint interstitials are reported as blocked so the existing WebView fallback handles them.
- Parsers return title, image, price, currency, availability, canonical URL, and SKU when available.
- Confirmed out-of-stock products can parse successfully without a price. Storage preserves the last known product price and the UI shows an OOS state.
- Confirmed Amazon OOS pages deliberately leave price unset: recommendation carousels can contain prices belonging to other products.
- Amazon prices use the broadly available Buy Box price: sale prices are tracked, while Prime-exclusive discounts and alternate-seller prices are ignored. If that base Buy Box price is not unambiguous, the check reports that no current price was found instead of guessing.
- AYM, Ounass, Level Shoes, Nike UAE, Sun & Sand Sports, Adidas UAE, PUMA UAE, Decathlon UAE, Salomon, Namshi, Centrepoint, and The Deal expose reliable initial-page variant data when the markup includes source IDs, labels, stock state, and price. Centrepoint color-only pages can track the current source product route; its alternate color buttons are not promoted without exact linked URLs. The Deal forms only the color/size candidates exposed by the source page and verifies a chosen candidate through its exact variation endpoint before storing it; Sharaf DG retains exact source configuration URLs for later checks. BFL exposes current source size choices using stable product/system/label identities without invented SKUs; missing saved sizes fail safely. Noon, Amazon, Sephora and Faces retain page-level tracking unless a future initial response meets the same standard; Qeemat does not discover unadvertised neighbours or guess unavailable options.
- H&M and Zara retain the selected size SKU for later checks; H&M colour choices use separate product URLs. An out-of-stock option cannot currently be selected when first creating a tracker.
- Challenge pages return `blocked`; pages without required product data return parser or price errors as appropriate.

Parser code is in `src/domain/parser.ts`; types are in `src/domain/types.ts`; tests are in `src/domain/__tests__/`.

### Out-of-stock handling

Out-of-stock is a successful parser result, not a generic missing-price error. Each supported parser has site-specific availability signals, and structured data with unknown availability falls through to those parsers. The database preserves `currentPriceMinor` when an OOS result has no price, and snapshots retain availability for history. OOS products continue to be checked so Qeemat can record and optionally notify a back-in-stock transition. Repeated OOS results do not create price-change activity or notifications.

No price-change activity event or notification is created for an OOS result without a price. The detail screen shows an amber banner explaining whether it is displaying the last known price or no recorded price.

### App updates

- On Android, the app checks published GitHub releases once when it opens. When a newer version with an APK exists it shows an update popup over the app; closing the popup adds red badges to the Watchlist bell and the Activity tab and leaves a pinned update item in Activity, all of which reopen the popup and disappear once the app is updated. A separate WorkManager job checks approximately every 48 hours and posts one notification per newer release on the App updates notification channel. Android notification permission and system background restrictions apply. Alpha/prerelease builds can see prereleases; stable builds are offered stable releases. The popup offers **Download and install**: Qeemat picks an APK compatible with the device architecture, downloads it itself over HTTPS, checks its size and (when GitHub publishes one) its SHA-256 digest, then opens the standard Android install prompt. Android requires the user to allow installs from Qeemat the first time; if that is missing the popup explains it and opens the relevant Settings screen. The GitHub release page remains linked as the release notes and as the fallback when the download fails. Offline or failed checks leave the app usable and retry on the next launch. Release tags must use a version such as `v0.5.5-alpha`, and the Android `versionName` must be updated for each release. Details and the device verification are in [the in-app update notes](in-app-update.md).

## Storage and Background Work

AsyncStorage stores tracked products, snapshots, activity events, background status, and onboarding state. Snapshot sources are `manual_single`, `manual_batch`, `background`, and `unknown` for older data.

WorkManager schedules a daily periodic run with a preferred hour and can queue a one-off run. Per-product preferences (`daily`, `every_3_days`, `weekly`) still decide whether a product is due. Background product checks use a 15-second stagger; manual rechecks use a shorter stagger.

WorkManager is best effort. Battery saver, device-vendor restrictions, connectivity, idle mode, and force-stopping the app can delay or stop work. Notifications are Android-only and require `POST_NOTIFICATIONS` on Android 13+.

## Adding a Store

1. Add the `SiteKey` in `src/domain/types.ts`.
2. Add its `SupportedSite` registry entry in `src/domain/sites.ts`.
3. Add a 32-64px PNG favicon in `assets/site-icons/` and register it with the site entry.
4. Add a fallback colour in `src/components/SiteIcon.tsx`.
5. Implement the parser in `src/domain/parser.ts` and add parser tests.
6. Add OOS fixture coverage when practical, then run typecheck, lint, and Jest.

`SiteIcon` automatically appears across existing UI surfaces; a new store does not need separate UI wiring.

## Important Files

- `App.tsx` - screens and manual route stack.
- `src/data/database.ts` - local persistence, snapshots, activity events.
- `src/domain/parser.ts` - fetch and site parsers.
- `src/domain/sites.ts` - site registry and URL cleaning.
- `src/domain/checker.ts` - check orchestration and alert rules.
- `src/components/` - reusable UI, including `AppText`, `AppTextInput`, `Surface`, `ProductCard`, and `SiteIcon`.
- `src/theme/layout.ts` - compact layout helper.
- `android/app/src/main/java/com/qeemat/` - Android WorkManager, notifications, and WebView modules.
- `docs/bfl-integration.md` - BFL's current rendered parser and historical fetch limitations.

## Development and Validation

```bash
npm install
npm run start
npm run android:device
npm run typecheck
npm run lint
npm test -- --runInBand
```

OOS fixtures are documented in `src/domain/__tests__/fixtures/oos/README.md`. Missing fixture files are skipped by the OOS fixture suite.

For a terminal Android build, use JDK 17+ and make `adb` available from Android SDK platform-tools. Android Studio's bundled JBR is valid.

## Recent Product Additions

- Price-drop thresholds and back-in-stock alerts are set per tracker.
- Folder-based organisation, watchlist filtering/sorting, archive, and compact bulk actions support larger watchlists.
- Product detail includes local price insights and an interactive price-history chart.
- The local-only Search experience selects default discovery categories from the watchlist, records listing observations, and lets users track without pasting a URL.
- Salomon GCC and The Deal extend retailer support; The Deal saves only a response-verified color/size combination.
