# Qeemat Current State

This file is the repo handoff for future AI or developer sessions. It describes the app as it exists now, not just the original plan.

## Product Summary

Qeemat is a local-first price tracker for supported product pages, with a UAE-first MVP plus selected Amazon regional domains.

Core loop:

1. Paste a supported product URL.
2. Parse product title, image, price, currency, and availability.
3. Confirm tracking settings and save the product locally.
4. View the watchlist, product detail, price chart, and snapshot history.
5. Recheck a single product manually or recheck all tracked products.
6. Let Android run best-effort background checks and send local alerts when rules match.
7. Browse a chronological activity feed of price changes across all tracked products.

## Current Supported Stores

- Noon UAE
- Nike UAE
- Sun & Sand Sports UAE
- Level Shoes
- AYM Accessories
- Ounass UAE
- Amazon (selected regions)

Amazon support is intentionally MVP-level only. It works across selected Amazon regional product domains when Amazon serves a normal product page and should surface `blocked` when Amazon returns robot-check or challenge pages instead.

## Current User-Facing Behavior

### Watchlist

- Shows tracked products with price and status.
- Supports pull-to-refresh.
- Has a `Recheck all prices` button.
- Has a floating add button.

### Add Flow

- Detects supported stores from the URL.
- Parses the product before save.
- Lets the user choose:
  - check preference: `daily`, `every_3_days`, `weekly`
  - alert mode: `price_drop`, `any_change`, `target_price`
  - optional target price
- AYM Accessories excludes `daily` from the check-preference picker (site enforces a 72-hour minimum interval to avoid rate limiting). Existing AYM products saved with `daily` are automatically clamped on the tracking-settings screen.

### Product Detail

- Shows current price, chart, and stats.
- Supports manual `Check now`.
- `Open link` button opens the product URL in the system browser.
- Shows price snapshots with source tags:
  - `Check now`
  - `Recheck all`
  - `Background`

### Settings

- Shows supported stores.
- Shows notification status and deep-links to Android notification settings.
- Shows battery optimization status (exempt/restricted) with a button to open app system settings.
- Shows daily background check time presets:
  - Morning: `9:00 AM`
  - Afternoon: `2:00 PM`
  - Evening: `8:00 PM`
- Saves the background time immediately when a preset is tapped.
- Shows background run diagnostics:
  - last scheduled
  - last started
  - last completed
  - last source
  - last error
- Supports `Queue background check once`.
- Supports deleting all local data.

### Onboarding (first launch)

- First-time users see a two-step overlay on app launch:
  - Step 1: Enable notifications for price alerts.
  - Step 2: Open system settings to disable battery optimization for reliable background checks.
- Each step can be skipped. The overlay never appears again after completing.

### Navigation

- Bottom tab bar with **Watchlist**, **Activity**, and **Settings** tabs.
- Activity tab shows a chronological feed of price-change events across all tracked products, with date grouping, price direction indicators (trend arrows for up/down), old price (strikethrough), source badges, and a "Started tracking" label for first-recorded prices.
- Tapping an activity event navigates to the product detail view.
- Deleted product events remain visible but become non-tappable.
- Android hardware back gesture/button is handled inside the app for the current lightweight route stack instead of immediately exiting the app.

### Activity Tab

- Shows a chronological, newest-first feed of price-change events across all tracked products.
- Events are grouped by relative date (Today / Yesterday / date label).
- Each event card shows:
  - Product thumbnail or placeholder icon.
  - Product title.
  - Old price (strikethrough) and new price (bold, coloured: green for drops, red for increases, primary blue for first-recorded).
  - Direction arrow: `TrendingDown` for price drops, `TrendingUp` for increases, a blue dot for first-recorded prices.
  - "Started tracking" label shown for first-recorded price events.
  - Source badge indicating whether the check came from `Check now`, `Recheck all`, or `Background`.
- Tapping a card navigates to that product's detail screen.
- Events survive product deletion (denormalized product title is stored on the event).
- Empty state shown when no price changes have been recorded yet.

### Onboarding (first launch)

## Current Storage Model

Storage is local-only and currently uses AsyncStorage, not SQLite.

Important stored entities:

- `tracked products`
- `price snapshots`
- `activity events` — chronological log of price-change events with direction, old/new prices, and denormalized product data
- `background status`

Current snapshot source values:

- `manual_single`
- `manual_batch`
- `background`
- `unknown` for older migrated data

## Background Checks

Background work is currently Android-specific.

- Native scheduler: Android WorkManager
- Periodic schedule: once every 24 hours
- Time targeting: preferred hour of day with initial delay aligned to the next selected hour
- Due logic: per-product check preference still decides whether a product is checked during a given worker run
- Force run: settings screen can queue a one-off background run
- **Staggered checks**: individual product checks during a background run are spaced 15 seconds apart to avoid triggering rate limits on supported stores. Manual "Recheck all" uses a shorter 1.5-second stagger.

Important constraint:

- WorkManager is best-effort only
- battery saver, vendor restrictions, idle mode, missing connectivity, or force-stopping the app can delay or pause future runs
- the settings screen includes a battery optimization card that checks exemption status and can open system app settings
- the first-launch onboarding prompts users to disable battery optimization
- REQUEST_IGNORE_BATTERY_OPTIMIZATIONS permission is declared in the manifest

## Notifications

Notifications are currently Android-specific.

- Android 13+ requires `POST_NOTIFICATIONS`
- The app checks runtime permission and app-level notification enablement
- The settings screen can request permission or open system notification settings
- Notifications are sent for:
  - target price reached
  - price dropped
  - price changed

If permission is blocked, the app should continue tracking locally without showing alerts.

## Parser and Site Notes

- Parsers are wired through the site registry in `src/domain/sites.ts`
- Each `SupportedSite` can declare a `minimumIntervalHours` that clamps the effective check interval regardless of the user's check-preference. Currently AYM Accessories uses this (72 hours) to reduce load on their rate-limited WooCommerce backend.
- Parser coverage includes AYM WooCommerce variation markup
- Parser coverage includes Ounass inline PDP payload parsing
- Parser coverage includes Amazon regional-domain detection, multi-currency price parsing, buy-box style markup, alternate total-price fallback handling, and challenge-page detection in tests
- Current parser tests cover:
  - Noon structured data parsing
  - AYM product page parsing
  - Ounass product page parsing
  - Amazon product page parsing across `.ae`, `.com`, and `.de` price formats
  - blocked/challenge page detection

If a supported site starts requiring login, bot bypassing, or unstable browser-only behavior, it should be downgraded from reliable MVP support.

## Important Files

App and screens:

- `App.tsx`

Domain and storage:

- `src/data/database.ts`
- `src/domain/checker.ts`
- `src/domain/dates.ts`
- `src/domain/sites.ts`
- `src/domain/types.ts`
- `src/domain/backgroundStatus.ts`
- `src/domain/backgroundScheduler.ts`
- `src/domain/onboarding.ts`
- `src/domain/notifications.ts`
- `src/domain/parser.ts`

Android native integration:

- `android/app/src/main/java/com/qeemat/QeematBackgroundCheckModule.kt`
- `android/app/src/main/java/com/qeemat/QeematBackgroundWorker.kt`
- `android/app/src/main/java/com/qeemat/QeematBackgroundTaskService.kt`
- `android/app/src/main/java/com/qeemat/QeematNotificationsModule.kt`
- `android/app/src/main/java/com/qeemat/QeematNotificationsPackage.kt`
- `android/app/src/main/java/com/qeemat/MainApplication.kt`
- `android/app/src/main/AndroidManifest.xml`

Headless entrypoint:

- `index.js`

## Development Commands

Install:

```bash
npm install
```

Start Metro:

```bash
npm run start
```

Run Android:

```bash
npm run android:device
```

Checks:

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
```

## Android Environment Notes

For terminal Android builds on this repo:

- `JAVA_HOME` must point to a valid JDK 17+ installation
- Android Studio's bundled JBR is a valid choice
- `adb` must be available from Android SDK `platform-tools`

If terminal builds fail with invalid `JAVA_HOME` or missing `adb`, fix those local machine settings before debugging app code.

## Known Limitations

- Native background checks and notifications are implemented only for Android right now.
- Storage is AsyncStorage-based, which is acceptable for the MVP but not ideal long-term for larger history volumes.
- Amazon regional domains can return robot-check/challenge pages, so Amazon support is best-effort.
- There is no backend, push service, user account system, or cloud sync.
- Background timing is approximate even after choosing a preferred hour.

## Recent Notable Changes

- Expanded Amazon support to selected regional domains, multi-currency price parsing, and more resilient Amazon price fallback handling.
- Added AYM Accessories parser support.
- Added Ounass UAE parser support.
- Changed per-product check preferences to `daily`, `every_3_days`, and `weekly`.
- Added `Recheck all prices` on the watchlist.
- Added Android notification permission handling and native local notifications.
- Added Android background run status tracking and preferred time-of-day scheduling.
- Added snapshot source tagging for manual vs background checks.
- Fixed Android back navigation so the hardware back gesture returns through app screens instead of always leaving the app.
- Improved Android background worker reliability: proper error classification with logging, increased headless timeout to 5 min, WorkManager configuration with debug logging, ProGuard keep rules, and `foregroundServiceType` for Android 14+.
- Added battery optimization support: permission declaration, native exemption check/request, app system settings opener, and settings UI card with exempt/restricted status.
- Added first-launch onboarding overlay prompting users to enable notifications and disable battery optimization (shown once, stored in AsyncStorage).
- Added `Open link` button on product detail that opens the product URL in the system browser.
- Fixed status bar text color to dark-content for visibility against the light app background.
- Removed dead 3-dot menu icon from product card tiles.
- Condensed background check settings card layout and added step indicator dots to onboarding.
- Replaced the read-only "Alerts" tab with a dynamic "Activity" tab showing a chronological feed of actual price-change events across all products, with date grouping, price direction indicators, source badges, and one-time backfill migration from existing snapshot history.
- Added `ActivityEvent` data model and `PriceDirection` type (`up`, `down`, `first`) for the activity feed.
- Activity events survive product deletion (denormalized title/image stored on each event).
- One-time migration backfills activity events from existing snapshot data on first launch after upgrade.
