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
  green-soft: "#DDF8E5"
  red: "#C2410C"
  red-soft: "#FFEDD5"
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

This document records existing tokens and components alongside the agreed direction. The code remains authoritative for current behavior; the flatter treatment and improved density are design goals, not claims that every existing screen already follows them. See [the review](docs/design-system-review.md) for gaps and verification limits.

## Colors

Use the existing blue for primary actions, selection and links. Light neutrals separate the page, surfaces and borders. Green, orange-red and amber communicate price or check states; pair colors with descriptive text or icons. The palette currently defines a light appearance only; a dark theme has not been specified or validated.

## Typography

Use the platform system font through `AppText`, with regular, medium, semibold and bold weights. Its present body default is 15 with a 21 line height; individual screens use additional sizes. Titles identify the product, while price and price changes carry the strongest emphasis in tracking contexts. A semantic type scale and unrestricted large-text behavior still need design and device testing; the current component caps font scaling at 1.3.

## Layout

Use the spacing scale in the frontmatter as the shared starting point, with React Native density-independent units. Existing screens also use local values. Favor compact, legible layouts that keep prices and relevant variants visible. `isCompactLayout` switches below an effective width of 360 after accounting for font scale; verify layout at narrow widths and larger text settings.

## Elevation & Depth

The desired direction is mostly flat, using subtle borders to separate surfaces. The existing shared shadow uses an 8-unit vertical offset, 0.08 opacity, 18-unit radius and Android elevation 3; it remains in existing components until they are deliberately refined. Reserve elevation for genuine layering and avoid adding decorative shadows.

## Shapes

Use the existing small, medium and large corner radii, with restrained borders. Keep touch targets usable even when information density increases.

## Components

- **Buttons:** `PrimaryButton` currently supplies primary, outline and danger variants, a 58-unit minimum height, disabled opacity and a loading state. Use the primary action where it helps the user complete the screen's main task.
- **Tracked-product cards:** `ProductCard` presents the product, retailer, selected variant, current or last-known price, price change and check state where available. Improve density without hiding variant or failure context.
- **Status:** `StatusPill` and product cards use icon, label and semantic color. Their states are not yet fully unified; clarify increases, decreases, unavailable products and failed checks before consolidating.
- **Navigation:** the app has a manual Android tab and route stack. Preserve established navigation and Android back behavior.
- **Search cards:** listing cards serve discovery, while Watchlist cards serve monitoring. Share underlying visual principles without forcing identical layouts.

## Do's and Don'ts

- **Do** prioritize price, meaningful changes and selected variant in tracking views.
- **Do** make status understandable without color alone.
- **Do** inspect real screens, long titles and error states at device sizes before shipping.
- **Don't** add decorative panels or shadows where a simple label or border is sufficient.
- **Don't** treat missing retailer metadata as a confirmed product category.
