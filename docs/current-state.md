# Qeemat Current State

**Last reconciled with the implementation:** 2026-08-04
**App version:** 0.6.0

This is the repo handoff for the current app. Product-planning documents are useful for intent, but this file describes shipped behavior and active limitations.

## Product and Architecture

Qeemat is an Android-first, local-first React Native + TypeScript price tracker. It tracks supported product pages on device using AsyncStorage, parses pages in TypeScript, and uses native Android modules for WorkManager scheduling, notifications, battery-optimization support, and the experimental WebView fetch fallback.

The app uses a small manual route stack in `App.tsx`, not React Navigation. There is no backend, user account, cloud sync, SQLite database, or maintained iOS native implementation.

## Supported Stores

| Store | Status | Notes |
| --- | --- | --- |
| Noon UAE | Supported | Product metadata and embedded page data. |
| Nike UAE | Supported | Structured product data. |
| Sun & Sand Sports UAE | Supported | Structured product data and product URLs. |
| Level Shoes | Supported | Embedded product payloads and metadata. |
| AYM Accessories | Supported | WooCommerce variations; checks have a 72-hour minimum interval. |
| Ounass UAE | Supported | Inline PDP payloads. |
| Amazon regional domains | Supported, best effort | Selected domains only; challenge pages return `blocked`. |
| Adidas UAE | Supported | Monitor for bot-protection changes. |
| PUMA UAE | Supported | JSON-LD product data and source-defined initial-page size options. |
| Decathlon UAE | Supported | Shopify ProductJson data with source-defined initial-page options. |
| Sephora UAE | Supported | JSON-LD product data; Akamai-protected pages use the native WebView fallback. |
| Faces UAE | Supported | Salesforce Commerce Cloud structured product data; session redirects use the native WebView fallback when needed. |
| Centrepoint UAE | Supported | Centrepoint storefront JSON-LD plus source-defined color and size controls across group brands such as Splash. |
| Namshi UAE | Supported | Structured product data plus source size controls are tracked by size when the initial response provides stock state; parent/color choices use their own product URLs. |
| Sharaf DG UAE | Supported | AED product metadata plus source-linked configuration URLs are tracked exactly when the initial response exposes complete option controls. |
| Brands For Less UAE | Experimental | Parser and WebView fallback exist, but Cloudflare blocks reliable fetching; hidden from the supported-store UI. |

The site registry is `src/domain/sites.ts`. It controls hostnames, enabled status, icons, and minimum check intervals.

## User-Facing Behavior

### Watchlist and activity

- The watchlist supports pull-to-refresh, manual `Recheck all prices`, price-direction arrows, and a collapsible out-of-stock section below in-stock products. When products from multiple stores are tracked, a logo-only store rail filters both sections; it contains only stores already in the watchlist.
- Product cards show a site icon, price, status, and the most recent price-change direction. OOS cards are dimmed and show an amber out-of-stock badge.
- The Activity tab is newest-first, groups events by date, shows old and new prices with direction/source badges, and can open an existing product. Events remain visible but non-tappable after a product is deleted.

### Add flow and product detail

- The add flow detects supported stores, replaces the store list with a single detected-store status for valid links, and brings the parsed result into view before saving. It then collects check preference, alert mode, and an optional target price. When a page exposes reliable variant data, the user must select an in-stock source option such as size before saving; that exact option is shown on cards and details and is used for later checks. Centrepoint size choices use the current product URL and source button ID, while color-only pages retain the current color and product route without guessing neighboring colors. Namshi size choices use the current product/color URL, while Sharaf DG linked configurations retain the source URL that preselects the exact item. Sephora and Faces shade labels remain page-level because their initial pages do not provide complete per-shade stock state. Android browsers can share a product URL directly to Qeemat, which opens this flow and automatically finds the product so the user can choose its variant and tracking settings.
- AYM excludes the daily option in the picker because its effective minimum interval is 72 hours. Existing daily AYM products are clamped in tracking settings.
- Product detail shows current price, chart, stats, snapshot history, `Check now`, `Open link`, and `Copy product link` actions.
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
- AYM, Ounass, Level Shoes, Nike UAE, Sun & Sand Sports, Adidas UAE, PUMA UAE, Decathlon UAE, Namshi, and Centrepoint expose reliable initial-page variant data when the markup includes source IDs, labels, stock state, and price. Centrepoint color-only pages can track the current source product route; its alternate color buttons are not promoted without exact linked URLs. Sharaf DG exposes linked configuration variants when the source provides option controls and preselecting URLs; the saved URL is fetched for each later check so a different configuration cannot be substituted. Noon, Amazon, Sephora, Faces, and Brands For Less retain page-level tracking unless a future initial response meets the same standard; Qeemat never makes extra requests to discover neighbours or guesses an unavailable option.
- Challenge pages return `blocked`; pages without required product data return parser or price errors as appropriate.

Parser code is in `src/domain/parser.ts`; types are in `src/domain/types.ts`; tests are in `src/domain/__tests__/`.

### Out-of-stock handling

Out-of-stock is a successful parser result, not a generic missing-price error. Each supported parser has site-specific availability signals, and structured data with unknown availability falls through to those parsers. The database preserves `currentPriceMinor` when an OOS result has no price, and snapshots retain availability for history.

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
- `docs/bfl-integration.md` - BFL's experimental Cloudflare limitation.

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

## Recent Notable Changes

- **#12:** Amazon product links normalize to direct ASIN URLs before fetch and clipboard copy.
- **#23:** compact-screen and large-text responsive reflow.
- **#24:** copy-product-link action on product detail.
- **#25:** retain the last known price when an OOS result has no current price.
- **#26:** ignore Amazon recommendation-carousel prices on confirmed OOS pages.
- **#14:** Amazon tracks only the base Buy Box price, excluding Prime-exclusive and alternate-seller prices.
- **#22:** app version updated to 0.5.0.
- **#29:** logo-only store filtering on the watchlist.
- **#28:** exact, source-defined variant selection and later resolution; a missing saved option reports `variant_not_found` rather than substituting another option.
- **#32:** Decathlon UAE support with source-defined Shopify variants.
- **#33 and #34:** Sephora UAE and Faces UAE support, including the native WebView fallback for protected or redirected checks.
- **#36 and #38:** Android Share to Qeemat, including automatic product discovery for newly received and warm-app shares.
- **#39:** PUMA UAE support with source-defined size variants.
- **#30:** Namshi UAE support with structured product parsing and source-defined size tracking.
- **#31:** Sharaf DG UAE support with product metadata parsing and source-linked configuration tracking.
- **#35:** Centrepoint UAE support with Splash-compatible structured product parsing and source-defined color/size tracking.
