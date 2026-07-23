# Qeemat Current State

**Last reconciled with the implementation:** 2026-07-23
**App version:** 0.5.0

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
| Brands For Less UAE | Experimental | Parser and WebView fallback exist, but Cloudflare blocks reliable fetching; hidden from the supported-store UI. |

The site registry is `src/domain/sites.ts`. It controls hostnames, enabled status, icons, and minimum check intervals.

## User-Facing Behavior

- Watchlist with pull-to-refresh, manual `Recheck all prices`, price-direction arrows, and a collapsible out-of-stock section.
- Add flow that detects a supported URL, parses a preview before save, and collects checking and alert preferences.
- Product detail with current price, price chart, snapshot history, `Check now`, `Open link`, and `Copy product link` actions.
- Activity tab with newest-first price-change events, date grouping, direction indicators, source badges, and non-tappable deleted-product events.
- Settings for supported stores, notifications, battery optimization, preferred background time, background diagnostics, one-off background runs, and local-data deletion.
- First-launch onboarding for notification permission and battery-optimization guidance.
- Android hardware back navigation is handled within the manual route stack.

### Responsive layout

`src/theme/layout.ts` treats an effective content width below 360 as compact, accounting for system font scale. Product cards, previews, product details, action rows, option groups, supported-store chips, and time presets reflow in that state. Shared app text and relevant inputs cap font scaling at 1.3 to keep controls usable.

## URL and Parser Behavior

- Non-Amazon product URLs remove known tracking parameters and fragments before save and fetch.
- Recognized Amazon `/dp/<ASIN>` and `/gp/product/<ASIN>` links normalize to `https://<amazon-host>/dp/<ASIN>`. Product detail copies this clean URL.
- Parsers return title, image, price, currency, availability, canonical URL, and SKU when available.
- Confirmed out-of-stock products can parse successfully without a price. Storage preserves the last known product price and the UI shows an OOS state.
- Confirmed Amazon OOS pages deliberately leave price unset: recommendation carousels can contain prices belonging to other products.
- Challenge pages return `blocked`; pages without required product data return parser or price errors as appropriate.

Parser code is in `src/domain/parser.ts`; types are in `src/domain/types.ts`; tests are in `src/domain/__tests__/`.

## Storage and Background Work

AsyncStorage stores tracked products, snapshots, activity events, background status, and onboarding state. Snapshot sources are `manual_single`, `manual_batch`, `background`, and `unknown` for older data.

WorkManager schedules a daily periodic run with a preferred hour and can queue a one-off run. Per-product preferences (`daily`, `every_3_days`, `weekly`) still decide whether a product is due. Background product checks use a 15-second stagger; manual rechecks use a shorter stagger.

WorkManager is best effort. Battery saver, device-vendor restrictions, connectivity, idle mode, and force-stopping the app can delay or stop work. Notifications are Android-only and require `POST_NOTIFICATIONS` on Android 13+.

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
- **#22:** app version updated to 0.5.0.
