# Qeemat MVP Scope

Note: this file is product scope and intent. For the current implemented repo state, read [current-state.md](current-state.md).

## MVP Goal

Qeemat is a local-first mobile app for tracking product prices from a small set of supported websites. The MVP remains UAE-first, but Amazon support now extends to selected regional domains. The user pastes a product URL, confirms the detected product details, chooses a practical check preference, and receives local notifications when Qeemat detects a price drop, any price change, or a target-price hit.

The MVP should prove the core loop:

1. Add a supported product URL.
2. Parse the product title, image, price, currency, and availability.
3. Save the product and first price snapshot locally.
4. Show a watchlist with current prices and check status.
5. Show product detail with price history.
6. Let the user manually check a product.
7. Register best-effort background checks.
8. Send local notifications for matching alert rules.

## Product Promise

Use this promise in product copy and UI behavior:

> Qeemat checks supported product pages periodically when the device allows it and alerts you when it detects a price change.

Do not promise exact background timing. The current implementation uses Android WorkManager and Android still controls when background work actually runs.

## Platforms

- Android-first MVP in a shared React Native codebase
- iOS is not a completed native target yet for background checks or notifications

## Architecture

- Bare React Native
- TypeScript
- Local device storage with AsyncStorage
- Native Android background checks through WorkManager
- Native Android local notifications
- No backend in the MVP
- No user accounts in the MVP
- No cloud sync in the MVP

## Supported MVP Websites

The MVP support list is intentionally small:

| Site | Status | Reason |
| --- | --- | --- |
| Noon UAE | MVP supported | Broad UAE shopping coverage and high user value. Product pages currently expose JSON-LD product offers to plain fetch requests. |
| Nike UAE | MVP supported | Product detail pages expose structured product data with AED price and availability. |
| Sun & Sand Sports UAE | MVP supported | Product detail pages expose structured product data with AED price and availability. |
| Level Shoes | MVP supported | Product pages expose product payloads with title, brand, image, stock, SKU, and AED prices. |
| AYM Accessories | MVP supported | WooCommerce product pages expose variation data, images, stock state, and AED pricing on supported product pages. |
| Ounass UAE | MVP supported | Product pages expose inline PDP payloads with title, image, stock state, SKU, and AED pricing. |
| Amazon (selected regions) | MVP supported | High user value and supported at MVP level across selected Amazon regional domains when Amazon serves a normal product page without a challenge. |

## Deferred Websites

| Site | Status | Reason |
| --- | --- | --- |
| Adidas UAE | Experimental/post-MVP | Product pages can expose useful data with browser-like headers, but direct requests showed intermittent access-denied behavior. |
| Brands For Less UAE | Deferred | Browser-rendered pages expose JSON-LD product data, but direct product-page fetches return Cloudflare 403, so local background checks would not be reliable. |
| Carrefour UAE | Deferred | Useful later, but grocery/location-sensitive pricing complicates MVP behavior. |
| Lulu UAE | Deferred | Useful later, but page behavior needs deeper validation. |

## In Scope

- Watchlist screen.
- Add product flow.
- Parsed product preview before saving.
- Product detail screen.
- Price history snapshots.
- Manual check now.
- Manual recheck all tracked products.
- Check preference: `daily`, `every_3_days`, `weekly`.
- Alert modes: `price_drop`, `any_change`, `target_price`.
- Optional target price.
- Supported stores screen.
- Settings screen with notification status, background time presets, and local data controls.
- Local persistence.
- Parser contract and supported-site registry.
- Native Android background task wiring.
- Native Android notification wiring.
- Snapshot history source tags for manual vs background checks.

## Out Of Scope

- Backend scheduler.
- Server-side scraping.
- Push notification server.
- User accounts.
- Cross-device sync.
- Payments.
- Browser automation service.
- Captcha or bot-bypass work.
- Arbitrary unsupported product pages.
- Store login/session handling.
- Exact background check schedules.
- iOS-native parity for notifications/background behavior.

## MVP UX Principles

- Start directly on the watchlist.
- Keep product cards compact and price-focused.
- Always show `last checked` and status.
- Let users manually check a product.
- Let users manually recheck all products from the watchlist.
- Be explicit when a URL is unsupported.
- Make supported stores visible from add flow and settings.
- Prefer "price drops only" as the default alert mode.
- Use AED as the first-class currency for the UAE-first MVP, while preserving Amazon regional currencies when Amazon exposes them reliably.

## Validation Needed During Development

Before each site is considered truly supported, keep at least a few fixture URLs and verify that the parser can extract:

- Product title.
- Canonical product URL.
- Product image.
- AED price.
- Availability when present.
- Stable SKU or product identifier when present.

If any site starts requiring login, captcha, heavy browser automation, or unstable headers, move it from MVP supported to experimental. Amazon regional domains should specifically fall back to blocked/experimental if bot verification becomes common in real device checks.
