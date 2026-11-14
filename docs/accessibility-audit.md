# Accessibility audit (14 November 2026)

Audit of the release build on the Samsung SM-S928B (Android 17 / API 37, 1440 × 3120, 560 dpi, font scale 0.9) after the shared input and surface work merged into `dev`. This is an accessibility-tree, text-scale and orientation pass, not a substitute for a TalkBack speech walkthrough.

## Method

- `uiautomator dump` on each screen: every clickable node was checked for a non-empty label (`content-desc` or text), duplicate labels in the same screen, and bounds below the 44dp minimum touch target (154 px at this density).
- Font scale was set to 1.3 and 1.5 and the app relaunched on each; Watchlist and Add Product were captured to check reflow/clipping.
- Device rotation was forced to landscape and the app relaunched; Watchlist was captured to check reflow.
- Existing WCAG AA contrast measurements from 13 November remain valid for the palette; the new input border uses the same `colors.border` token as Watchlist chips/cards.

## Findings and fixes

| Screen | Finding | Fix |
| --- | --- | --- |
| Watchlist | “Filter & sort” control was 41dp high. | `controlsButton` now has a 44dp minimum height. |
| Watchlist | Out-of-stock “Still unavailable · Remove” row was 27dp high and its auto-generated label was malformed (“Still unavailable · , Remove”). | Row now has a 44dp minimum height, `accessibilityRole="button"` and an explicit “Remove <product> from watchlist” label. |
| Watchlist | Product cards had no explicit accessibility label, so TalkBack merged child text into one long sentence including the nested remove row. | Each card now exposes a concise label: title, price, availability/check failure, retailer and last-check time. |
| Watchlist filter sheet | Sort and folder chips were 39dp high. | `textFilterButton` and `collectionPickerChip` now have a 44dp minimum height. |
| Watchlist filter sheet | The dimmed backdrop was a second “Close filters” button (full-screen), duplicating the close control. | Backdrop is now hidden from the accessibility tree (`accessible={false}`, `importantForAccessibility="no"`); the 44dp close button remains. Same fix for the bulk move-products sheet. |
| Product detail | Copy-link and tracking-settings icon buttons were 34dp (44dp only via hit slop). | `iconButton` is now 44×44dp. |
| Add Product, Activity, Settings, Search, Search filters, browse sheet | No unlabeled controls and no real sub-44dp targets; only nodes clipped by the viewport or a horizontal scroll edge were flagged. | No change. |

## Results after fixes

- Watchlist, Add Product, Activity, Settings, Search, Search filters, browse sheet and product detail: **0 unlabeled interactive nodes**, **0 duplicate labels**, and no real touch targets below 44dp (remaining flags are viewport/horizontal-scroll clipping of otherwise standard controls). Evidence: [filter-sheet controls](assets/accessibility-2026-11-14/filter-sheet-controls.png), [product-detail header controls](assets/accessibility-2026-11-14/detail-header-controls.png).
- Font scale 1.3 and 1.5: identical layouts (the 1.3 cap), Watchlist uses its compact card layout, the Add Product intro wraps, and no labels clip. [1.3 Watchlist](assets/accessibility-2026-11-14/font-scale-1-3-watchlist.png), [1.3 Add](assets/accessibility-2026-11-14/font-scale-1-3-add.png), [1.5 Watchlist](assets/accessibility-2026-11-14/font-scale-1-5-watchlist.png)
- Landscape: Watchlist reflows to the wider layout with the toolbar and product rows intact; the floating add button overlaps the out-of-stock strip as an accepted consequence of the floating-button decision. [landscape](assets/accessibility-2026-11-14/landscape-watchlist.png)

## Still not verified

- Actual TalkBack speech order, heading navigation and swipe traversal were not performed; the audit checks the accessibility tree and explicit labels, not spoken output.
- Only one device (Samsung SM-S928B, Android 17) was tested. Other Android versions, OEM skins and smaller screens are unverified in this pass.
- Dark mode is not supported by the app, so it was not audited.
- Loading, error and selection states were checked only through the automated tree on the screens listed; a manual focused sweep of every transient state is still useful.
