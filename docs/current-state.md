# Qeemat Current State

**Last reconciled with the implementation:** 2026-10-26
**App version:** 0.5.5-alpha

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
| Brands For Less UAE | Experimental | Current rendered listing/PDP and size parsing implemented; browser markup verified. Android fetching verification is deferred. Hidden from supported-store UI until validated. |

The site registry is `src/domain/sites.ts`. It controls hostnames, enabled status, icons, and minimum check intervals.

## User-Facing Behavior

### Watchlist and activity

- The watchlist supports pull-to-refresh, manual `Recheck all prices`, price-direction arrows, an archived-items view, and a collapsible out-of-stock section below in-stock products. When products from multiple stores are tracked, a logo-only store rail filters both sections; a separate control filters local folders and sorts by recency, lowest price, largest drop, closest target, or name.
- Long-press selection opens a compact floating action dock. Selected products can be moved to a folder, paused/resumed, archived/restored, or deleted in bulk.
- Product cards show a site icon, local folder when present, price, status, and the most recent price-change direction. OOS cards are dimmed and show an amber out-of-stock badge.
- The Activity tab is newest-first, groups events by date, shows old and new prices with direction/source badges, records both out-of-stock and back-in-stock transitions, and can open an existing product. Events remain visible but non-tappable after a product is deleted.
- `For you` is the opening discovery tab. Its local quiz collects 56 independent shopping interests, favourite brands and budgets per interest. Legacy combined preferences migrate into separate interests and budgets. Eligible picks obey these choices and mix equally relevant categories/retailers. Price opportunities are no longer part of this tab.
- The department browser exposes 4,517 mapped listings across all 19 retailers, with searchable categories, retailer paths and source links. Selecting an interest, retailer or listing updates the same feed and fetches matching pages. An initial batch requests at most 24 listings; Load more listings adds another batch. Show more reveals already-fetched product cards. Each fetched page still has a 100-product extraction ceiling and retailer pagination is not automatic.
- Source mapping is broader than validated extraction. The expansion's desktop sample initially extracted 47/72 pages; subsequent parser repairs recovered Amazon book and baby cards. BFL rendered products and size choices now parse from browser markup; full physical-Android verification is deferred by the user until the final pass. See the [category audit](discovery-category-audit.md) for per-retailer evidence and limits. Earlier Android results in [source URLs and limits](discovery-sources.md) refer to the previous selected collections.
- Per-collection caches preserve observed prices and age during failures. Discovery refreshes while browsing and does not enter tracked-product background checks. Carrefour weighted groceries normalize their default-weight price to AED/kg; listings, tracker prices and targets show this basis. A changed pack size or price basis preserves history and records a failed check rather than sending a misleading price alert. Retailer default delivery context and final weight can affect checkout totals.
- Track price verifies the product page, saves existing defaults, and offers target settings afterward. Size/colour selection uses a sheet over the feed and preserves the exact source variant; existing trackers open their details. Secondary product actions live in the product-details modal.

### Add flow and product detail

- The add flow detects supported stores, replaces the store list with a single detected-store status for valid links, and brings the parsed result into view before saving. It then collects check preference, alert mode, optional target price, optional minimum price-drop threshold, back-in-stock preference, and a local folder. When a page exposes reliable variant data, the user must select an in-stock source option such as size before saving; that exact option is shown on cards and details and is used for later checks. Centrepoint size choices use the current product URL and source button ID, while color-only pages retain the current color and product route without guessing neighboring colors. Namshi size choices use the current product/color URL. The Deal builds source-provided color/size candidates, then verifies the selected combination against its exact variation endpoint before saving; a response that does not return the requested attributes is rejected. Sharaf DG linked configurations retain the source URL that preselects the exact item. Sephora and Faces shade labels remain page-level because their initial pages do not provide complete per-shade stock state. Android browsers can share a product URL directly to Qeemat, which opens this flow and automatically finds the product so the user can choose its variant and tracking settings.
- AYM excludes the daily option in the picker because its effective minimum interval is 72 hours. Existing daily AYM products are clamped in tracking settings.
- Product detail shows current price, an interactive price chart with tappable snapshots and color-coded price changes, local low/high/average/history-distance insights, snapshot history, `Check now`, `Open link`, and `Copy product link` actions.
- Snapshot sources are presented as `Check now`, `Recheck all`, or `Background`.

### Settings, onboarding, and navigation

- Settings shows supported-store icons, notification status/settings, battery-optimization guidance, preferred background-time presets, run diagnostics, a one-off background run, and deletion of local data.
- The preferred-time presets are Morning (9:00 AM), Afternoon (2:00 PM), and Evening (8:00 PM); selecting one saves and reschedules immediately.
- First-launch onboarding asks for notification permission and battery-optimization configuration. Both steps can be skipped and the overlay is stored as completed.
- Android hardware back navigation is handled within the manual route stack.

### Responsive layout

`src/theme/layout.ts` treats an effective content width below 360 as compact, accounting for system font scale. Product cards, previews, product details, action rows, option groups, supported-store chips, and time presets reflow in that state. Shared app text and relevant inputs cap font scaling at 1.3 to keep controls usable.

## URL and Parser Behavior

- Non-Amazon product URLs remove known tracking parameters and fragments before save and fetch.
- Recognized Amazon `/dp/<ASIN>` and `/gp/product/<ASIN>` links normalize to `https://<amazon-host>/dp/<ASIN>`. Product detail copies this clean URL.
- Parsers return title, image, price, currency, availability, canonical URL, and SKU when available.
- Confirmed out-of-stock products can parse successfully without a price. Storage preserves the last known product price and the UI shows an OOS state.
- Confirmed Amazon OOS pages deliberately leave price unset: recommendation carousels can contain prices belonging to other products.
- Amazon prices use the broadly available Buy Box price: sale prices are tracked, while Prime-exclusive discounts and alternate-seller prices are ignored. If that base Buy Box price is not unambiguous, the check reports that no current price was found instead of guessing.
- AYM, Ounass, Level Shoes, Nike UAE, Sun & Sand Sports, Adidas UAE, PUMA UAE, Decathlon UAE, Salomon, Namshi, Centrepoint, and The Deal expose reliable initial-page variant data when the markup includes source IDs, labels, stock state, and price. Centrepoint color-only pages can track the current source product route; its alternate color buttons are not promoted without exact linked URLs. The Deal forms only the color/size candidates exposed by the source page and verifies a chosen candidate through its exact variation endpoint before storing it; Sharaf DG retains exact source configuration URLs for later checks. BFL exposes current source size choices using stable product/system/label identities without invented SKUs; missing saved sizes fail safely. Noon, Amazon, Sephora and Faces retain page-level tracking unless a future initial response meets the same standard; Qeemat does not discover unadvertised neighbours or guess unavailable options.
- Challenge pages return `blocked`; pages without required product data return parser or price errors as appropriate.

Parser code is in `src/domain/parser.ts`; types are in `src/domain/types.ts`; tests are in `src/domain/__tests__/`.

### Out-of-stock handling

Out-of-stock is a successful parser result, not a generic missing-price error. Each supported parser has site-specific availability signals, and structured data with unknown availability falls through to those parsers. The database preserves `currentPriceMinor` when an OOS result has no price, and snapshots retain availability for history. OOS products continue to be checked so Qeemat can record and optionally notify a back-in-stock transition. Repeated OOS results do not create price-change activity or notifications.

No price-change activity event or notification is created for an OOS result without a price. The detail screen shows an amber banner explaining whether it is displaying the last known price or no recorded price.

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
- `src/components/` - reusable UI, including `AppText`, `ProductCard`, and `SiteIcon`.
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
- The local-only `For you` experience discovers products across categories and retailers, applies saved shopping preferences, and lets users track without pasting a URL.
- Salomon GCC and The Deal extend retailer support; The Deal saves only a response-verified color/size combination.
