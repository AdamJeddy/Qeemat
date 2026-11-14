---
name: Qeemat
description: An Android-first, local price tracker for shopping.
colors:
  primary: "#075FD8"
  primary-dark: "#0347A8"
  background: "#F8FAFC"
  surface: "#FFFFFF"
  surface-muted: "#F1F5F9"
  border: "#E2E8F0"
  border-strong: "#CBD5E1"
  text: "#0F172A"
  text-muted: "#64748B"
  text-soft: "#94A3B8"
  green: "#16833A"
  green-soft: "#ECFDF3"
  red: "#B91C1C"
  red-soft: "#FEE2E2"
  amber: "#B45309"
  amber-soft: "#FEF3C7"
  blue-soft: "#DBEAFE"
  scrim: "#0F172A80"
typography:
  body:
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "21px"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: "58px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    height: "58px"
---

# Design System: Qeemat

## Overview

Qeemat is an Android-first price tracker. The chosen direction is clean, practical, compact and calm: prices and useful status should be easy to scan. Retain the existing blue and light palette and Android system typography. Cards and controls should be mostly flat with subtle borders.

This document records the agreed system and its implementation. Semantic type and layout tokens now ship in `src/theme/theme.ts`, and `AppText` renders on the body role, so the type scale has one source of truth. Items marked **shipped** were verified in source on 13 November 2026; items marked **intended** are agreed but not yet applied everywhere. The code remains authoritative for current behavior. See [the review](docs/design-system-review.md) for gaps and verification limits, and [the handover](docs/design-handover.md) for the current work.

## Colors

Use the existing blue for primary actions, selection and links. Light neutrals separate the page, surfaces and borders. Green, red and amber communicate price or check states: red marks negative price movement and failures, amber warns about availability, and green marks a price drop. Pair colors with descriptive text or icons. The palette ships as `colors` and defines a light appearance only; a dark theme has not been specified or validated.

Foreground/background pairs are checked for WCAG AA contrast: body and muted text on page/surface, primary on white and blue-soft, green/amber/red text on their soft tints, and placeholders use `textMuted` rather than `textSoft`. The Watchlist count pill uses `primaryDark` behind white text (8.5:1) instead of a translucent overlay.

## Typography

Use the platform system font through `AppText` in regular (400), medium (500), semibold (600) and bold (700). Titles identify the product; prices and price changes carry the strongest emphasis in tracking views. The roles below ship as `typography` in `src/theme/theme.ts` and are spread into `StyleSheet.create` styles.

### Type roles

| Role | Size / line | Weight | Use |
| --- | --- | --- | --- |
| `screenTitle` | 28 / 34 | 700 | Screen titles |
| `detailTitle` | 20 / 26 | 700 | Product-detail title |
| `sheetTitle` | 20 / 26 | 600 | Sheet and modal titles |
| `sectionTitle` | 18 / 24 | 600 | Section headings |
| `rowTitle` | 16 / 22 | 600 | List-row and card titles |
| `price` | 26 / 32 | 700 | Primary price in detail and hero blocks |
| `priceSmall` | 20 / 26 | 700 | Price in list rows |
| `body` | 15 / 21 | 400 | Default text |
| `caption` | 13 / 18 | 400 | Secondary metadata and hints |
| `micro` | 11 / 15 | 500 | Badges, provenance and compact labels |

- **Shipped:** the role objects; `AppText`'s base style is the `body` role, so default text stays 15/21. `AppText` opts out of Android's own text scaling (`allowFontScaling={false}`) and applies a manual factor of `min(fontScale, 1.3)` from `FontScaleContext` to both font size and line height. This is a cap, not unrestricted large-text support.
- **Intended:** migrating every screen from local font sizes to these roles. Until a screen is migrated its rendered text may not match a role; do not read the table as app-wide application.

## Layout and spacing

Use the 4/8/12/16/24/32 `spacing` scale in React Native density-independent units, plus the `layoutMetrics` shipped in the theme: screen gutter 20, card padding 16, section gap 16, row gap 12 and minimum touch target 44. Favor compact, legible layouts that keep prices and relevant variants visible.

- **Shipped:** the token objects above.
- **Intended:** applying the rhythm uniformly; existing screens still use local spacing values in places.
- `isCompactLayout` switches below an effective width of 360 after accounting for font scale; verify layout at narrow widths and larger text settings.

## Surfaces

Page background is `colors.background` (#F8FAFC); inline cards are flat white (`colors.surface`) with a 1px `colors.border` border; muted insets use `colors.surfaceMuted` (#F1F5F9). Radii come from the `radius` scale (sm 6, md 8, lg 12; pills use 999). Overlay sheets keep the shared `shadow` (8 vertical offset, 0.08 opacity, 18 radius, Android elevation 3); inline cards carry no shadow.

- **Shipped:** flat Watchlist rows, Settings cards, product-detail insight cards, empty-state cards, the Add-product preview card and the onboarding card; overlay sheets and the floating bulk action bar keep the `shadow` token for genuine layering.
- **Shipped (14 November 2026):** `Surface` in `src/components/Surface.tsx` provides the shared flat-surface role — `card` (white, 1px border), `muted` (surfaceMuted inset), `accent` (blueSoft) and `plain`, with token-based padding and radius. Search discovery/product cards, the discovery setup/empty cards, Watchlist/Activity empty states and product-detail insight cards render through it. Remaining local card styles visually match the role and can migrate without changing their treatment.
- **Intended:** no further inline shadows; future elevated elements should be limited to floating layers.

## Actions

- **Primary:** 58 high, `colors.primary` fill, white label, radius 8.
- **Secondary:** 58 high, white fill, 1px `colors.primary` border, primary label.
- **Compact:** 44-high rounded control (chips and card actions).
- **Icon:** 44×44 minimum target.
- **Link-row:** 44 minimum height for tappable rows.

`PrimaryButton` ships the 58 minimum height, primary/outline/danger variants, disabled opacity and a loading state. Several controls already meet the 44 minimum (header icon buttons, filter chips, recheck actions), but the compact, icon and link-row roles are not yet a shared primitive.

## Inputs

Agreed input role: 52 high, radius 8, 1px `colors.border` (soft, matching Watchlist chips and cards; primary when focused, red on error), body-role text, with the same 1.3 scaling cap as other text. **Shipped:** `AppTextInput` in `src/components/AppTextInput.tsx` implements the field role, including optional label, hint, leading/trailing accessories and a `bare` variant for inputs embedded in custom search rows. Every current `TextInput` renders through it. **Intended:** compact search rows and per-category budget fields still use their own container styling; unify those containers if a future pass needs a single field rhythm everywhere.

## Status

Treat check freshness, price direction, availability and failure as separate signals:

- **Freshness:** neutral blue for a successful check; a check is not itself a price drop.
- **Price drop:** green.
- **Price rise:** red (the same red as errors; the label and trend icon distinguish them).
- **Out of stock:** amber.
- **Error:** red.
- **Provenance:** muted text, never green.

- **Shipped:** the status primitives use the agreed colors: `StatusPill` renders `ok` and `price_changed` as a neutral blue check, out-of-stock as amber and failures as red; `PriceDirectionBadge` renders a drop green and a rise red; `SourceLabel` (backed by `snapshotSourceLabel` in `src/domain/snapshotSource.ts`) renders provenance as muted text with no colored badge; `ProductCard`, the product-detail snapshot list, Activity and the price-history chart use the same direction colors (green drop, red rise). Snapshot prices on product detail are tinted by direction rather than every `price_changed` row being green.
- **Intended:** one shared status treatment applied consistently across every surface. `StatusPill` remains product-detail only, and the price-history chart keeps its own change indicator styling. Do not treat full unification as shipped.

## Components

`PrimaryButton`, `ProductCard`, `StatusPill`, `SiteIcon` and `AppText` are the shared components today, alongside the status primitives `PriceDirectionBadge` and `SourceLabel`, the shared field primitive `AppTextInput` and the flat-surface primitive `Surface`. Semantic tokens ship; the remaining consolidation is the action/state role set and the compact chip/surface adoptions marked intended below.

- **Buttons:** `PrimaryButton` supplies primary, outline and danger variants, a 58-unit minimum height, disabled opacity and a loading state. Use the primary action where it helps the user complete the screen's main task. Screens still style some controls locally, so button roles are not fully consolidated.
- **Tracked-product cards:** `ProductCard` presents the product, retailer, selected variant, current or last-known price, price change and check state where available. **Shipped:** compact, flat divided rows without the shared shadow; the change badge reflects the most recent actual price change and keeps showing through later unchanged checks (its accessibility label includes when the change happened). Improve density without hiding variant or failure context.
- **Floating add button:** **Shipped:** Watchlist uses a circular add button floating over the list (`12aaa66`). The user explicitly chose it over a separate white dock; it can cover list content, and that overlap is an accepted tradeoff, not a defect to fix by restoring a dock. Keep enough bottom scroll padding for the final product to be scrolled clear.
- **Navigation:** the app has a manual Android tab and route stack. Preserve established navigation and Android back behavior.
- **Search cards:** listing cards serve discovery, while Watchlist cards serve monitoring. Share underlying visual principles without forcing identical layouts. **Shipped (13 November 2026):** discovery cards use a compact outline Track action instead of a solid primary button on every card, so the card content leads, and missing or failed listing images fall back to a neutral placeholder. A previously observed price change renders as the same green/red direction badge used by Watchlist cards. A fuller Search hierarchy pass remains **intended**.
- **Task-first flows:** **Shipped (13 November 2026):** Add keeps **Find product** directly after the URL field and collapses the supported-store list behind a disclosure; Settings keeps notifications, battery and background time first and collapses run diagnostics and the supported-store list; tracking settings exposes a per-product **Active** switch, and the tab stack stays mounted so Watchlist and Search keep their state after opening a product or the Add flow.
- **Product detail:** **Shipped (14 November 2026):** matches the Watchlist language — a blue banner with back/copy/settings actions, then a compact summary card (image, 2-line title, price with direction badge, retailer, variant/folder and check status). Price insights are one flat card with divided Lowest/Highest/Average rows; **About this item** is collapsed behind a summary disclosure; price snapshots show the three most recent groups with **Show all**, identical consecutive failures collapse behind a count, and the chart supports horizontal drag-to-scrub selection. Snapshots color a lower price green and a higher price red. Further chart hierarchy refinement is **intended**.

## Accessibility

- **Text scaling:** `AppText` applies `min(system font scale, 1.3)` to font size and line height, and text inputs cap at 1.3. On the Samsung SM-S928B the 1.3 and 1.5 layouts are identical, confirming the cap; changing the system scale on Android 17 restarted the activity, and the app reopened reflowed at Watchlist rather than remeasuring the current screen in place.
- **Contrast:** body text is 17:1; muted text is 4.5:1+ on page/surface; primary on white and blue-soft is 4.7:1+; direction text on its soft tint is 4.5:1+ after the green-soft adjustment; the count pill is 8.5:1. Placeholders use muted text.
- **Touch targets:** header, dialog close, tab, filter, card actions and primary/secondary buttons are at least 44; the small detail icon buttons keep a 34 visual size with extra hit slop (44 effective).
- **Verification limits:** TalkBack order/labels, scales above 1.3 elsewhere, dark mode and landscape have not been verified. Heading roles are set in code, but Android heading semantics could not be confirmed through UI Automator dumps.

## Do's and Don'ts

- **Do** prioritize price, meaningful changes and selected variant in tracking views.
- **Do** make status understandable without color alone.
- **Do** inspect real screens, long titles and error states at device sizes before shipping.
- **Don't** add decorative panels or shadows where a simple label or border is sufficient.
- **Don't** treat missing retailer metadata as a confirmed product category.
