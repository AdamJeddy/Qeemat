# Qeemat product scope

Status: maintained product scope, reconciled with the v0.6.5-alpha release on 2026-11-15. For detailed shipped behavior and limitations, read [current-state.md](current-state.md).

## Product goal

Qeemat is an Android-first, local-first shopping app. It helps a person track prices on supported UAE retailer pages, discover products across stores, and compare the same item when several retailers carry it. All tracking, preferences, discovery cache and history stay on the device.

The core loop now has two entry points:

1. **Track something you found:** add a supported product URL (or share one from an Android browser), verify the parsed product, choose an exact variant when the retailer exposes one, and save it with a check preference and alerts.
2. **Discover something worth tracking:** open Explore, browse a watchlist-shaped feed or search across stores, compare grouped offers, and track any verified source without pasting a URL.

Then Qeemat keeps watching:

1. Recheck products manually or through best-effort Android background work.
2. Record local price snapshots and Activity events.
3. Notify on the selected alert rules.
4. Offer updates from new GitHub releases inside the app.

## Platforms and architecture

- Android-first React Native + TypeScript app; no maintained iOS native target.
- Local AsyncStorage only: tracked products, snapshots, folders, discovery cache, preferences and update state.
- No backend, user account, cloud sync, SQLite database or server-side scraping.
- Manual route/tab stack in `App.tsx`; no React Navigation.
- Native Android modules for WorkManager, notifications, in-app APK download/install and the WebView fetch fallback.

## Supported stores

20 storefronts are supported for tracking. Discovery and search coverage varies by source; the source registry is `src/domain/sites.ts` and discovery maps live under `src/domain/discoverySources/`.

| Store | Tracking notes |
| --- | --- |
| Noon UAE | Product metadata and embedded page data. |
| Carrefour UAE | Streamed storefront data; seller, offer and delivery selection preserved. |
| Nike UAE | Structured product data. |
| Sun & Sand Sports UAE | Structured product data and product URLs. |
| Level Shoes | Embedded product payloads and metadata. |
| AYM Accessories | WooCommerce variations; 72-hour minimum check interval. |
| Ounass UAE | Inline PDP payloads. |
| Amazon (selected regions) | Best effort; challenge pages are reported as blocked. |
| Adidas UAE | JSON-LD and meta tags; monitor bot protection. |
| PUMA UAE | JSON-LD and source-defined size options. |
| Decathlon UAE | Shopify product data and source-defined options. |
| Salomon GCC | Shopify data with Android WebView fallback. |
| Sephora UAE | JSON-LD with Akamai-protected pages using the WebView fallback. |
| Faces UAE | Salesforce Commerce Cloud data with WebView fallback for session redirects. |
| Centrepoint UAE | Storefront data plus source-defined colour/size controls. |
| Namshi UAE | Structured data and source-defined size tracking. |
| The Deal UAE | Source-provided colour/size options verified against the exact variation endpoint. |
| Sharaf DG UAE | Source-linked product configurations tracked exactly when exposed. |
| H&M UAE | UAE product/size tracking with discovery categories and search. |
| Zara UAE | UAE product/colour/size tracking with discovery categories and search. |

Brands For Less UAE remains **experimental** and hidden from the supported-store UI because Cloudflare blocks reliable fetching. See [the BFL integration notes](bfl-integration.md).

## In scope

### Watchlist, tracking and alerts

- Watchlist with current or last-known price, direction, status, retailer, variant, folder and last-check state.
- Folders, archive/restore, multi-store and folder filters, sorting, bulk move/pause/resume/archive/delete.
- Manual checks, recheck all, and a chosen background schedule with per-product check preferences.
- Price-drop, any-change and target-price alerts; per-tracker minimum drop threshold and back-in-stock alert.
- Exact source-defined variant tracking where the retailer supplies reliable option IDs, prices and stock state.
- Out-of-stock handling that preserves the last known price.
- Android Share to Qeemat, URL cleaning/normalisation, and duplicate detection.

### Explore, search and comparison

- Local watchlist-derived taste profile; no setup quiz and no server recommendation.
- Explore feed with relevance reasons, dismissed-item handling, automatic continuation and visited-scope cache.
- Department/store/category browsing and a source-details view with coverage and fetch state.
- Cross-retailer grouping of compatible listings with a best-offer claim and a compare sheet sorted lowest price first.
- Watchlist copies hidden unless another retailer is cheaper, with an honest saving annotation.
- Product-name search across 20 storefronts (27 weighted requests; Sharaf DG excluded), streamed results and per-store progress.
- Filters for department, store, brand and maximum price; cached results retained when a source fails.
- Direct tracking from a discovered offer with variant verification.

### Product detail, Activity and updates

- Product detail with local low/high/average insights, labelled interactive price chart, snapshot provenance, copy and native share.
- Activity history grouped by local calendar day with direction badges and stock transitions.
- In-app update popup, background App-updates notification, APK download, size/SHA-256 verification and Android install prompt.
- Responsive layouts for compact widths and large system text.

## Out of scope

- Backend scheduler, server-side scraping or a push-notification service.
- User accounts, cross-device sync and payments.
- Captcha/bot-bypass work, arbitrary unsupported pages or store login/session handling.
- Guaranteed background timing or full retailer-inventory coverage.
- iOS-native parity for notifications/background work.
- Dark mode (not designed or validated yet).
- TalkBack speech-quality parity (audited at the accessibility-tree level; manual speech verification remains open).

## UX principles

- Start on the Watchlist; Explore is the comparison-first second tab.
- Prices and meaningful changes are the strongest signals, but never claim a saving or lowest price without comparable evidence.
- Show real retailer, offer, variant and observation-age context instead of invented metadata or fake activity.
- Prefer flat, bordered surfaces and compact rows; use colour with labels/icons, not colour alone.
- Make loading, empty, filtered, out-of-stock and failure states explicit.
- Keep the app fully usable offline with cached data; never block the core tracker on discovery or updates.

## Validation expectations

- Release gate: typecheck, lint, full Jest suite, and an arm64 release build.
- Device checks: actual Android phone, not only source inspection or the build succeeding.
- Check the main flows before release: Watchlist, Add/variant selection, Explore/search/compare, product detail, Activity, update prompt and notification settings.
- Document remaining limits honestly; Qeemat stores observations, not live guarantees.
