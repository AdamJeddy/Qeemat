# Design system review

Reviewed against the current React Native code and the Watchlist and Search screens on a Samsung phone. Direction requested: clean, practical, compact and calm, with prices easy to scan. This is a baseline review, not a claim that all screens or accessibility settings have been tested.

## Existing foundations

- `src/theme/theme.ts` defines shared colors, spacing, corner radii and a shadow. The palette is light, with blue actions and separate price/status colors.
- `AppText` centralizes base text color, size and weights. `PrimaryButton`, `ProductCard`, `StatusPill` and `SiteIcon` provide reusable patterns.
- `src/theme/layout.ts` provides a compact-layout check that considers font scale. Some individual screens have additional responsive rules.
- The Watchlist and Search are already functional, recognizable app surfaces. Their current implementation is the starting point for refinement.

## Gaps to address

1. **Information hierarchy and density.** Watchlist cards put folder, variant, suggested category, price and check status on separate lines; the price sits low and fewer products fit on screen. Define what is essential at a glance, and how secondary information behaves when space is limited. Retain variant, last-known-price and error context where relevant.
2. **Component consistency.** Buttons, chips, cards, inputs and sheets use a mixture of shared components and screen-specific styles. Inventory their variants and states, then consolidate the patterns that actually recur. Search product cards and Watchlist cards serve different tasks and need not look identical.
3. **Type and spacing roles.** The theme has spacing values but many styles use literal values. Text has a shared base but no documented semantic scale for screen titles, product titles, prices, labels and supporting text. Define roles using real screens and verify large text before migrating.
4. **Status language.** Price changes, availability and check failures use icons, colors and text in different combinations. The Watchlist can duplicate an error icon and a failure label. Define one understandable treatment per state, including stale and last-known prices, without relying on color alone.
5. **Accessibility and adaptation.** `AppText` caps font scaling at 1.3; some controls lack explicit roles or labels in source. Audit TalkBack, text scaling, touch targets and contrast on-device before claiming conformance. Compact-mode logic exists, but narrower screens and large system text need direct validation.
6. **System documentation and governance.** No root `DESIGN.md` exists. Record the observed tokens and components, the agreed direction, and examples of intended usage. Keep the code as the token source of truth and distinguish agreed rules from proposed changes.

## Suggested sequence

1. Agree the visual direction and document the existing baseline.
2. Define typography, spacing, color roles and status states using real Watchlist examples.
3. Refine the Watchlist card across normal, variant, changed-price, out-of-stock and failed-check states; verify on device and at larger text sizes.
4. Apply the agreed primitives to Search, details, settings and sheets in focused increments; review each screen in context.

## Scope of verification

The review used source inspection and phone screenshots of Watchlist and Search. It does not establish TalkBack behavior, contrast compliance, dark mode, or layout quality on all phone sizes. Product imagery and retailer data vary by source.
