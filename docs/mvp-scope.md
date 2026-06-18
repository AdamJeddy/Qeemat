# Qeemat MVP Scope

## MVP Goal

Qeemat is a local-first mobile app for tracking product prices from a small set of supported UAE websites. The user pastes a product URL, confirms the detected product details, chooses a practical check preference, and receives local notifications when Qeemat detects a price drop, any price change, or a target-price hit.

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

Do not promise exact background timing. iOS and Android both control when background work runs.

## Platforms

- iOS
- Android
- One shared codebase

## Architecture

- Bare React Native
- TypeScript
- Local device storage for the first Android Studio build
- Native background checks after the Android build is stable
- Native notifications after the Android build is stable
- No backend in the MVP
- No user accounts in the MVP
- No cloud sync in the MVP

## Supported MVP Websites

The MVP support list is intentionally small:

| Site | Status | Reason |
| --- | --- | --- |
| Noon UAE | MVP supported | Broad UAE shopping coverage and high user value. |
| Nike UAE | MVP supported | Product detail pages expose structured product data with AED price and availability. |
| Sun & Sand Sports UAE | MVP supported | Product detail pages expose structured product data with AED price and availability. |
| Level Shoes | MVP supported | Product pages expose product payloads with title, brand, image, stock, SKU, and AED prices. |

## Deferred Websites

| Site | Status | Reason |
| --- | --- | --- |
| Adidas UAE | Experimental/post-MVP | Product pages can expose useful data with browser-like headers, but direct requests showed intermittent access-denied behavior. |
| Amazon.ae | Deferred | High value but likely fragile for a fully local app because bot verification can appear. |
| Carrefour UAE | Deferred | Useful later, but grocery/location-sensitive pricing complicates MVP behavior. |
| Lulu UAE | Deferred | Useful later, but page behavior needs deeper validation. |

## In Scope

- Watchlist screen.
- Add product flow.
- Parsed product preview before saving.
- Product detail screen.
- Price history snapshots.
- Manual check now.
- Check preference: `daily`, `few_times`, `often`.
- Alert modes: `price_drop`, `any_change`, `target_price`.
- Optional target price.
- Supported stores screen.
- Settings screen with local-only status and data controls.
- Local persistence.
- Parser contract and supported-site registry.
- Native Android background task wiring after the bare build is stable.
- Native Android notification wiring after the bare build is stable.

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

## MVP UX Principles

- Start directly on the watchlist.
- Keep product cards compact and price-focused.
- Always show `last checked` and status.
- Let users manually check a product.
- Be explicit when a URL is unsupported.
- Make supported stores visible from add flow and settings.
- Prefer "price drops only" as the default alert mode.
- Use AED as the first-class currency for MVP.

## Validation Needed During Development

Before each site is considered truly supported, keep at least a few fixture URLs and verify that the parser can extract:

- Product title.
- Canonical product URL.
- Product image.
- AED price.
- Availability when present.
- Stable SKU or product identifier when present.

If any site starts requiring login, captcha, heavy browser automation, or unstable headers, move it from MVP supported to experimental.
