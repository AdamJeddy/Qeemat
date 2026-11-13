# Design system review

Reviewed 13 November 2026 against the current React Native code and Watchlist, Search, a product detail and Settings on a Samsung phone. Direction requested: clean, practical, compact and calm, with prices easy to scan. This is a baseline review, not a claim that all screens or accessibility settings have been tested.

## Existing foundations

- `src/theme/theme.ts` defines shared colors, spacing, corner radii and a shadow. The palette is light, with blue actions and separate price/status colors.
- `AppText` centralizes base text color, size and weights. `PrimaryButton`, `ProductCard`, `StatusPill` and `SiteIcon` provide reusable patterns.
- `src/theme/layout.ts` provides a compact-layout check that considers font scale. Some individual screens have additional responsive rules.
- The Watchlist and Search are already functional, recognizable app surfaces. Their current implementation is the starting point for refinement.

## Gaps to address

1. **Status semantics.** A product whose price increased showed a downward green trend icon beside “Checked” on its detail screen, while its chart and Watchlist showed an increase. `StatusPill` treats every `price_changed` as a green down-trend. Define separate check freshness, price direction, availability and error states; ensure colors and icons agree with the data.
2. **Shared components.** Watchlist cards are now flat, while detail statistics and Settings cards use the shared shadow; Search uses a separate card and button treatment. The same screen also uses custom and shared buttons. Define shared surface, action, input and state primitives, then apply them consistently without forcing discovery and tracking into the same card layout.
3. **Information hierarchy.** Search uses large repeated blue track buttons; Settings begins with a large supported-stores panel that pushes settings down; the detail screen gives average price a stronger blue treatment than the current price's supporting information. Establish a common hierarchy of primary task, price, supporting facts and secondary controls.
4. **Typography and spacing.** `AppText` supplies a body default, but screens set many individual font sizes and spacing values. Introduce semantic roles for screen title, section, product title, price, body and caption, and apply a consistent spacing rhythm.
5. **Accessibility and adaptation.** `AppText` caps font scaling at 1.3; some controls lack explicit roles or labels. A 1.3 font-scale phone check confirmed Watchlist control wrapping, but not TalkBack, contrast or larger scales throughout the app. Set a scaling and touch-target policy, then verify each screen.
6. **System documentation and governance.** `DESIGN.md` now records the existing baseline and chosen direction, but it does not yet define complete states or a validated component catalog. Update it alongside implemented primitives and distinguish desired direction from shipped behavior.

## Suggested sequence

1. Define status semantics and fix the misleading direction indicator.
2. Establish type, spacing, surface and action roles, using real examples from all four screens.
3. Build a small set of shared primitives and state examples, including large-text and error cases.
4. Apply them screen by screen, beginning with Watchlist and product detail, followed by Search and Settings; validate on device.

## Scope of verification

The review used source inspection and phone views of Watchlist, Search, product detail and Settings. It does not establish TalkBack behavior, contrast compliance, dark mode, or layout quality on all phone sizes. Product imagery and retailer data vary by source.
