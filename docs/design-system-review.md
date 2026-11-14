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

**Status at 14 November 2026** (after the Watchlist/status work in PR #84 and the in-app update UI in PR #85; source inspection at `32a6163`, device passes recorded in [`design-qa.md`](../design-qa.md)):

| # | Status | Evidence and remaining work |
| --- | --- | --- |
| 1 | Mostly shipped | `StatusPill` renders a neutral blue check (`16019c1`), `PriceDirectionBadge` renders green drops and red rises, and `SourceLabel` renders provenance as muted text instead of a coloured badge (`6794cec`); snapshot prices are tinted by direction. Full unification is still intended: `StatusPill` remains product-detail only and the price-history chart keeps its own change indicator. |
| 2 | Partial | Settings, Watchlist rows, product-detail insight cards and the update surfaces use flat bordered surfaces. Form fields share the 52-high `AppTextInput` role with focus/error states, and `Surface` now provides the shared card/muted/accent surface role used by Search discovery cards, empty states and detail insight cards. Search filter chips and some remaining local card styles still carry their own treatment (`DESIGN.md` marks chip consolidation **intended**). |
| 3 | Mostly shipped | Add puts **Find product** after the URL field and collapses supported stores; Settings is task-first; Search discovery cards use a compact outline Track action plus direction badges; product detail has the full title, image/price/status block and equal-weight flat insight cards. A fuller Search hierarchy and further detail insight/chart refinement remain **intended**. |
| 4 | Tokens shipped, adoption partial | Semantic `typography` and `layoutMetrics` roles ship in `src/theme/theme.ts`, and `AppText` renders on the body role. Screens still set many local font sizes and spacing values, so app-wide adoption is incomplete. |
| 5 | Partial | Font scaling caps at 1.3 for `AppText` and every current `TextInput`; the live font-scale remeasure is fixed (`bb1883f`); contrast was measured against WCAG AA and 1.3/1.5 layouts match. TalkBack order/heading announcement, landscape, other Android versions/devices and some loading/error/selection states remain unverified. |
| 6 | Partial | `DESIGN.md` now separates shipped from intended behaviour and documents type, spacing, surfaces, actions, inputs and status rules. A validated component catalog and complete state matrix are still missing. |

## Suggested sequence

1. Define status semantics and fix the misleading direction indicator. **Done.**
2. Establish type, spacing, surface and action roles, using real examples from all four screens. **Tokens done; screen adoption partial.**
3. Build a small set of shared primitives and state examples, including large-text and error cases. **Status, input and surface primitives done; chip/action consolidation still intended.**
4. Apply them screen by screen, beginning with Watchlist and product detail, followed by Search and Settings; validate on device. **Watchlist, product detail, Add, Settings and Activity done; a fuller Search hierarchy is still open.**

## Scope of verification

The review used source inspection and phone views of Watchlist, Search, product detail and Settings. It does not establish TalkBack behaviour, contrast compliance for every future surface, dark mode, or layout quality on all phone sizes. Product imagery and retailer data vary by source.
