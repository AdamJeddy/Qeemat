# Qeemat Local-Only MVP Plan

## Product Direction

Qeemat is a simple local-first mobile app for tracking product prices from supported shopping websites. A user adds a product link, chooses how often they would like the app to check it, and Qeemat keeps a local history of detected price changes. When the app finds a meaningful change, it sends a local notification.

The MVP should stay intentionally narrow:

- iOS and Android from one codebase.
- No user accounts.
- No backend service.
- No cloud database.
- No cross-device sync.
- Supported websites only.
- Local price history stored on the device.
- Local notifications for price changes and target-price hits.

The product promise should be precise:

> Qeemat checks supported product pages periodically when the device allows it and alerts you when it detects a price change.

The product should not promise exact schedules like "checks every 30 minutes" because iOS and Android both control background task timing.

## Why Local-Only Works

A local-only build is viable for an MVP because the first version can run all important behavior on the phone:

- Store tracked products in a local SQLite database.
- Fetch supported product pages directly from the device.
- Parse title, image, price, currency, and availability locally.
- Compare each new snapshot with the last saved snapshot.
- Store every price snapshot locally.
- Trigger local notifications when the price changes.

This makes the app private, cheap to operate, and simpler to ship. The main tradeoff is reliability: background checks are best-effort and controlled by the operating system.

## Local-Only Constraints

Background price checks are not guaranteed to run at exact times.

On Android, periodic work can be delayed by battery, network, vendor restrictions, and system scheduling. On iOS, background execution is more restrictive and short intervals are often ignored. If the user force-quits the app on iOS, background tasks will not resume until the app is opened again.

The UI should reflect this honestly:

- Use labels like "Roughly daily", "A few times per day", and "As often as allowed".
- Show `lastCheckedAt` and `nextCheckPreference`, not a guaranteed next run time.
- Show check status per product: `ok`, `price_changed`, `price_not_found`, `network_error`, `unsupported_page`, `blocked`, or `site_parser_failed`.
- Include a manual "Check now" action for user-initiated refreshes.

## Supported Websites First

The MVP should not support arbitrary product pages. It should support a short list of websites with explicit parser modules.

Supported websites for the first MVP:

- Noon
- Nike UAE
- Sun & Sand Sports UAE
- Level Shoes

Adidas UAE should remain experimental/post-MVP because direct requests showed intermittent access-denied behavior during discovery. Amazon.ae, Carrefour UAE, and Lulu UAE are deferred until the local parser approach is proven.

A website should only be included if a normal unauthenticated product page exposes enough product data in static HTML or embedded structured data.

### Website Acceptance Rules

A website is a good MVP candidate when:

- Product pages can be fetched without login.
- Price is available in static HTML, JSON-LD, Open Graph, or predictable embedded data.
- Currency is visible and parseable.
- Product title is visible and parseable.
- Product image is available from metadata or static markup.
- The page does not require captcha or bot bypassing.
- The price does not depend heavily on a logged-in account, loyalty price, coupon, or exact delivery address.

A website should be deferred when:

- Price is rendered only after heavy client-side JavaScript.
- Login is required.
- Captcha or bot protection appears during normal use.
- The page blocks ordinary mobile HTTP requests.
- Price meaning is ambiguous, such as multiple sellers, coupons, installment prices, or location-only prices.

Before public release, we should also review the terms of supported websites and keep request volume conservative.

## Recommended Coding Language

Use TypeScript.

TypeScript is the best fit for this MVP because:

- React Native supports TypeScript well in bare Android Studio projects.
- The app needs cross-platform iOS and Android UI from one codebase.
- Product-page parsing is naturally text/HTML/JSON heavy, which TypeScript handles well.
- Parser modules can later be reused in a Node.js backend if Qeemat grows beyond local-only.
- The ecosystem has mature libraries for networking, parsing, testing, local storage, and native Android capabilities.
- Type safety is valuable for parser contracts, price snapshots, supported-site metadata, and database rows.

Flutter with Dart is also a credible option for a polished cross-platform app, but TypeScript plus React Native is more pragmatic for this product because parser code and any future backend code can stay in the same language.

Kotlin Multiplatform is not recommended for the MVP. It is strong for shared business logic but adds unnecessary complexity for a small product that needs fast UI iteration, HTML parsing, local storage, and notification plumbing.

## Recommended MVP Stack

### Mobile App

- Framework: Bare React Native
- Language: TypeScript
- Navigation: lightweight in-app navigation for the MVP; React Navigation can be added when the flow grows
- Local storage: AsyncStorage for the first Android Studio build; SQLite can be added with a native package later
- Background checks: native Android WorkManager integration after the bare build is stable
- Local notifications: native Android notification integration after the bare build is stable
- Networking: built-in `fetch` first; add a small HTTP wrapper if needed
- HTML parsing: a lightweight parser such as `cheerio` or `node-html-parser`, validated during the first spike
- Testing: Jest for parser and price-comparison logic
- Build path: Android Studio or `npm run android:device`

The project was moved away from Expo so Android Studio can own native build, device testing, and later background/notification integration.

### No Backend In MVP

Do not build these for the MVP:

- User authentication
- Server-side scraping
- Push notification server
- Admin dashboard
- Cloud sync
- Shared product catalog
- Browser automation service
- Payment system

These are useful later only if the local-only product proves valuable and users need more reliable checks.

## Core App Components

### 1. Product List

Shows all tracked products:

- Product image
- Product title
- Current price
- Currency
- Last checked time
- Last change direction
- Check status

Primary action: add a product URL.

### 2. Add Product Flow

Steps:

1. User pastes a product URL.
2. App detects the website.
3. App fetches and parses the product page.
4. App shows a confirmation screen with title, image, price, currency, and website.
5. User chooses a check preference and optional target price.
6. App saves the product and first price snapshot locally.

If parsing fails, the app should show a clear unsupported-page message rather than silently saving a broken tracker.

### 3. Product Detail

Shows:

- Current price
- Price history chart
- Price snapshot list
- Target price
- Check preference
- Last successful check
- Last failed check, if any
- Manual "Check now" action

### 4. Background Price Checker

Runs periodically when the OS allows it:

1. Load active tracked products.
2. Skip products checked too recently based on the user's preference.
3. Fetch each product page.
4. Run the matching site parser.
5. Normalize price into minor units.
6. Compare with the last snapshot.
7. Save a new snapshot when the price, availability, or parse status changes.
8. Send a local notification if the user's alert rules match.

The background worker should be conservative:

- Limit how many products it checks in one run.
- Add jitter between checks.
- Use request timeouts.
- Avoid retry loops in the background.
- Record failures without bothering the user unless a product keeps failing.

### 5. Site Parser Layer

Each supported website should have its own parser module with a shared contract:

```ts
type ParsedProduct = {
  siteKey: string;
  canonicalUrl: string;
  title: string;
  imageUrl?: string;
  priceMinor?: number;
  currency?: string;
  availability?: 'in_stock' | 'out_of_stock' | 'unknown';
  rawPriceText?: string;
};
```

Parser modules should be unit-tested with saved sample HTML fixtures. This matters because supported websites will change over time.

### 6. Alert Rules

MVP alert types:

- Any price change
- Price drop only
- Target price reached

Default should be "price drop only" to avoid noisy notifications.

## Suggested Local Data Model

### `tracked_products`

- `id`
- `url`
- `canonical_url`
- `site_key`
- `title`
- `image_url`
- `currency`
- `current_price_minor`
- `target_price_minor`
- `alert_mode`
- `check_preference`
- `is_active`
- `last_checked_at`
- `last_success_at`
- `last_error_at`
- `last_error_code`
- `created_at`
- `updated_at`

### `price_snapshots`

- `id`
- `tracked_product_id`
- `price_minor`
- `currency`
- `availability`
- `raw_price_text`
- `status`
- `error_code`
- `checked_at`

### `site_configs`

This can start as TypeScript constants rather than a database table:

- `site_key`
- `display_name`
- `hostnames`
- `parser_version`
- `enabled`

## MVP Milestones

### Milestone 1: App Skeleton

- Expo React Native app with TypeScript.
- Basic navigation.
- SQLite setup and migrations.
- Empty product list screen.
- Add URL screen.

### Milestone 2: Parser Spike

- Test 3-5 candidate websites.
- Pick the first 2-3 reliable supported websites.
- Build parser contract.
- Add fixture-based parser tests.

### Milestone 3: Local Tracking

- Save tracked products locally.
- Save first snapshot.
- Product detail screen.
- Manual "Check now".
- Price history list.

### Milestone 4: Background Checks

- Register background task.
- Run conservative local checks.
- Store success/failure snapshots.
- Show last checked status.

### Milestone 5: Local Notifications

- Request notification permission.
- Send local notification for price drops and target-price hits.
- Add alert settings per product.

## Later Options

If the local-only version is useful but users need more reliability, Qeemat can add an optional backend later:

- Server-side scheduled checks.
- Push notifications.
- Account sync.
- Better parser observability.
- Shared parsers and site health monitoring.
- Cross-device product tracking.

The MVP should be designed so this is possible later, but it should not build the backend now.

## Open Product Questions

- Which region should the first version target: UAE only, GCC, or global?
- Which 2-3 websites should be supported first after the parser spike?
- Should the default alert be any price change or price drop only?
- Should users be able to track out-of-stock/in-stock changes in the MVP?
- Should target price be optional in the add flow or configured later from product detail?
- Should Qeemat allow unsupported links to be saved as manual notes, or reject them for MVP clarity?

## Reference Notes

- React Native defaults new projects to TypeScript and supports Expo TypeScript templates.
- Expo SQLite persists a queryable SQLite database across app restarts.
- Expo Background Task uses Android WorkManager and iOS BGTaskScheduler, and task timing is inexact.
- Expo Notifications supports local notification scheduling and permission handling on Android and iOS.
